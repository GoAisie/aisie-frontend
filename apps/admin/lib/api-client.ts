import { env } from './env';
import { getAccessToken, getRole, markLogoutReason, useSessionStore } from './auth/session-store';
import { getActingCompanyId } from './auth/acting-company-store';
import { loginResponseSchema } from '@aisie/shared';

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly body: unknown, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

// Thrown internally by tryRefreshAccessToken when refresh fails with 5xx or
// a network error. Distinguishes "server rejected my token" (401/403 → log
// out) from "couldn't reach server" (5xx / fetch threw → keep session).
// Without this split, a rolling deploy or transient gateway blip kicks every
// user to /login mid-dashboard.
class TransientRefreshError extends Error {
  constructor(public readonly status: number) {
    super(`Transient refresh failure: ${status}`);
    this.name = 'TransientRefreshError';
  }
}

type FetchOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  skipAuth?: boolean;
  // Internal — set by 401-retry path to prevent infinite recursion.
  _isRetry?: boolean;
};

// Single-flight refresh: concurrent 401s (e.g. dashboard fan-out fetching
// reports + analytics + users at the same time) share ONE /auth/refresh call
// instead of stampeding the endpoint and racing each other to setSession.
let refreshInFlight: Promise<boolean> | null = null;

async function tryRefreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const stored = useSessionStore.getState().refreshToken
        ?? (typeof localStorage !== 'undefined'
          ? localStorage.getItem('aisie_admin_refresh_token')
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
        throw new TransientRefreshError(0);
      }
      if (res.status === 401 || res.status === 403) {
        // Refresh token rejected by server (expired, revoked, reuse detected
        // per OAuth 2.1 single-use rotation). Clear the session AND mark a
        // reason so the login page can surface "Oturum süreniz doldu" —
        // without the marker the user silently lands on the login form with
        // no explanation. Centralising the clear+mark here means every caller
        // (apiFetch 401-retry, future paths) gets consistent UX without
        // duplicated logic. Mirrors apps/pwa/lib/api-client.ts.
        markLogoutReason('session_expired');
        useSessionStore.getState().clearSession();
        return false;
      }
      if (!res.ok) {
        // 5xx / unexpected non-2xx — gateway up, downstream sick. Keep session.
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

export async function apiFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const { body, skipAuth, _isRetry, headers: callerHeaders, ...rest } = opts;

  const headers = new Headers(callerHeaders);
  if (body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  // Phase 1C: end-to-end trace_id propagation. See PWA api-client for
  // rationale — gateway honours any existing X-Trace-ID before generating
  // its own, so the same trace appears in browser console + backend logs.
  if (!headers.has('X-Trace-ID')) {
    headers.set('X-Trace-ID', crypto.randomUUID());
  }
  if (!skipAuth) {
    const token = getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    // X-Acting-Company-Id: SUPER_ADMIN-only. The gateway 403s every request
    // with this header for non-SUPER_ADMIN roles (defense-in-depth security
    // check). Role-gating here prevents the bug where a stale localStorage
    // entry — e.g. left over from a previous SUPER_ADMIN session on the
    // same browser — bricks a subsequent COMPANY_ADMIN login by forcing
    // every request into a 403 (verified 2026-05-16: Ayşe Yılmaz could not
    // load any data because the previous login's acting-company persisted).
    const role = getRole();
    const actingCompanyId = getActingCompanyId();
    if (
      role === 'SUPER_ADMIN'
      && actingCompanyId
      && !headers.has('X-Acting-Company-Id')
    ) {
      headers.set('X-Acting-Company-Id', actingCompanyId);
    }
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
      // Access token expired mid-session. Silent refresh; success → replay.
      // Genuine refresh failure (false) → clearSession. TransientRefreshError
      // (5xx / network) → keep session, surface the original 401 so the
      // caller can retry on its own cadence without dragging the user to
      // /login mid-flow.
      let refreshed = false;
      try {
        refreshed = await tryRefreshAccessToken();
      } catch (e) {
        if (!(e instanceof TransientRefreshError)) {
          useSessionStore.getState().clearSession();
        }
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
