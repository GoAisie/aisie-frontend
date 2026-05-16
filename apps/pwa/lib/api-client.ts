import { env } from './env';
import { getAccessToken, useSessionStore } from './auth/session-store';
import { loginResponseSchema } from '@aisie/shared';

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly body: unknown, message: string) {
    super(message);
    this.name = 'ApiError';
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
      const res = await fetch(`${env.apiBaseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: stored }),
      });
      if (!res.ok) return false;
      const raw = await res.json();
      const data = loginResponseSchema.parse(raw);
      useSessionStore.getState().setSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user,
      });
      return true;
    } catch {
      return false;
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
      atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')),
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
// Returns null when: no access token AND refresh failed, OR refresh token
// itself is invalid. Callers treat null as a hard "user must re-login".
export async function ensureValidAccessToken(): Promise<string | null> {
  const current = getAccessToken();
  if (!current) {
    const ok = await tryRefreshAccessToken();
    return ok ? getAccessToken() : null;
  }
  const exp = getJwtExpiry(current);
  const now = Math.floor(Date.now() / 1000);
  if (exp === null || exp - now <= TOKEN_REFRESH_BUFFER_SEC) {
    const ok = await tryRefreshAccessToken();
    return ok ? getAccessToken() : null;
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
      const refreshed = await tryRefreshAccessToken();
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
