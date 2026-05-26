import { env } from './env';
import { getAccessToken, markLogoutReason, useSessionStore } from './auth/session-store';
import { loginResponseSchema } from '@aisie/shared';

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly body: unknown, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

// Thrown internally by the refresh path when the response status is 5xx or
// the network was unreachable — i.e. the refresh did not *fail* (token
// rejected) but instead *could not complete*. apiFetch treats this distinctly
// from a 401: a 5xx must NOT clear the session, otherwise a transient gateway
// blip during a tunnel switch or rolling deploy drops the user to /login mid-
// workflow. The caller path simply propagates the original ApiError up so
// the UI surfaces "couldn't reach server" rather than "logged out".
class TransientRefreshError extends Error {
  constructor(public readonly status: number) {
    super(`Transient refresh failure: ${status}`);
    this.name = 'TransientRefreshError';
  }
}

type FetchOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  // Opt out of auth header injection (used for /auth/login, /auth/refresh).
  skipAuth?: boolean;
  // Internal — set by 401-retry path to prevent infinite recursion.
  _isRetry?: boolean;
};

// Single-flight refresh: concurrent 401s share ONE /auth/refresh call instead
// of racing each other. Prevents a fan-out page (reports + customers +
// notifications fetching in parallel) from issuing N refresh requests.
let refreshInFlight: Promise<boolean> | null = null;

async function tryRefreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const stored = useSessionStore.getState().refreshToken
        ?? (typeof localStorage !== 'undefined'
          ? localStorage.getItem('aisie_refresh_token')
          : null);
      if (!stored) return false;
      let res: Response;
      try {
        res = await fetch(`${env.apiBaseUrl}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: stored }),
        });
      } catch {
        // Fetch threw — DNS / TCP / TLS / offline. Treat as transient: do not
        // clear the session; let the caller retry on its next request when
        // the network may have recovered.
        throw new TransientRefreshError(0);
      }
      if (res.status === 401 || res.status === 403) {
        // Refresh token rejected by server (expired, revoked, reuse detected
        // per OAuth 2.1 single-use rotation). This is a genuine "log out"
        // signal. Clear the session AND mark a reason so the login page can
        // surface "Oturum süreniz doldu" — without the marker the user
        // silently lands on the login form with no explanation, which reads
        // as "Sunucuya bağlanılamadı" (the generic WS / fetch error) from
        // upstream caller paths. Centralising the clear+mark here means every
        // caller (apiFetch 401-retry, ensureValidAccessToken on WS connect,
        // future paths) gets consistent UX without duplicated logic.
        markLogoutReason('session_expired');
        useSessionStore.getState().clearSession();
        return false;
      }
      if (!res.ok) {
        // 5xx or other non-2xx that isn't an auth verdict — gateway is up but
        // a downstream is sick (DB blip, rolling deploy). Don't kick the user.
        throw new TransientRefreshError(res.status);
      }
      const raw = await res.json();
      const data = loginResponseSchema.parse(raw);
      useSessionStore.getState().setSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user,
      });
      return true;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

// Decode the `exp` claim from a JWT access token. Returns Unix seconds, or
// null on malformed / missing claim. Cheap (no signature verification — the
// gateway re-verifies on every request) and fully client-side.
function getJwtExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(
      atob((token.split('.')[1] ?? '').replace(/-/g, '+').replace(/_/g, '/')),
    );
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

// Refresh proactively if the token expires within this window. 60 s covers
// ALB/network jitter + small JWT clock-skew tolerance. Wide enough that a
// "valid at connect, expired at first message" race never burns a turn,
// narrow enough that we don't churn refresh calls.
const TOKEN_REFRESH_BUFFER_SEC = 60;

// Returns a fresh-enough access token, refreshing on demand. Used by paths
// that can't ride the apiFetch 401-retry loop — specifically the WS connect
// path, where token expiry surfaces as `close 1008` (no HTTP status, no
// recovery hook inside the WebSocket API). Decoding the exp claim client-side
// is safe: the gateway re-verifies on every connect, so this is only a
// hint to know when to refresh.
//
// Returns null when: no access token AND refresh failed (server rejected),
// OR refresh token itself is invalid. Callers treat null as a hard "user must
// re-login". TransientRefreshError (5xx / network) keeps the current access
// token in play and returns it — caller can retry on its own cadence rather
// than yielding the user to /login.
export async function ensureValidAccessToken(): Promise<string | null> {
  const current = getAccessToken();
  if (!current) {
    try {
      const ok = await tryRefreshAccessToken();
      return ok ? getAccessToken() : null;
    } catch (e) {
      if (e instanceof TransientRefreshError) return null;
      return null;
    }
  }
  const exp = getJwtExpiry(current);
  const now = Math.floor(Date.now() / 1000);
  if (exp === null || exp - now <= TOKEN_REFRESH_BUFFER_SEC) {
    try {
      const ok = await tryRefreshAccessToken();
      return ok ? getAccessToken() : current;
    } catch (e) {
      if (e instanceof TransientRefreshError) return current;  // keep current; let WS connect try anyway
      return null;
    }
  }
  return current;
}

// Single JSON fetch wrapper. Injects Authorization from the Zustand store,
// serialises JSON bodies, and throws ApiError on non-2xx. On 401, tries a
// silent refresh first; only clears the session if refresh also fails. This
// keeps long PWA sessions alive across the 30-minute access-token TTL without
// forcing the user back to /login mid-workflow.
export async function apiFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const { body, skipAuth, _isRetry, headers: callerHeaders, ...rest } = opts;

  const headers = new Headers(callerHeaders);
  if (body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  // Phase 1C: end-to-end trace_id propagation. Browser generates a fresh
  // trace_id per request and forwards as X-Trace-ID; the gateway honours
  // any existing X-Trace-ID before generating its own, so the same trace
  // appears in browser console (logged by callers) AND backend log lines
  // for that request. Enables single-grep correlation across hop layers.
  if (!headers.has('X-Trace-ID')) {
    headers.set('X-Trace-ID', crypto.randomUUID());
  }
  if (!skipAuth) {
    const token = getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const url = path.startsWith('http') ? path : `${env.apiBaseUrl}${path}`;
  const response = await fetch(url, {
    ...rest,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const contentType = response.headers.get('content-type') ?? '';
  const payload: unknown = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text().catch(() => null);

  if (!response.ok) {
    if (response.status === 401 && !skipAuth && !_isRetry) {
      // Silent refresh attempt. tryRefreshAccessToken now throws
      // TransientRefreshError on 5xx / network — those must NOT clear the
      // session; treat them as "couldn't refresh, surface the original 401".
      // Only a genuine server-confirmed refresh failure (returns false)
      // triggers clearSession + /login redirect.
      let refreshed = false;
      try {
        refreshed = await tryRefreshAccessToken();
      } catch (e) {
        if (!(e instanceof TransientRefreshError)) {
          useSessionStore.getState().clearSession();
        }
        // Transient: do not clear session; the user keeps their tokens and
        // can retry the action when the network recovers.
        throw new ApiError(response.status, payload, `API ${response.status} ${response.statusText}`);
      }
      if (refreshed) {
        return apiFetch<T>(path, { ...opts, _isRetry: true });
      }
      useSessionStore.getState().clearSession();
    } else if (response.status === 401) {
      useSessionStore.getState().clearSession();
    }
    throw new ApiError(response.status, payload, `API ${response.status} ${response.statusText}`);
  }

  return payload as T;
}
