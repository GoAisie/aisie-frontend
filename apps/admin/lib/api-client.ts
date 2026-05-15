import { env } from './env';
import { getAccessToken, useSessionStore } from './auth/session-store';
import { getActingCompanyId } from './auth/acting-company-store';
import { loginResponseSchema } from '@aisie/shared';

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly body: unknown, message: string) {
    super(message);
    this.name = 'ApiError';
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

export async function apiFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const { body, skipAuth, _isRetry, headers: callerHeaders, ...rest } = opts;

  const headers = new Headers(callerHeaders);
  if (body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (!skipAuth) {
    const token = getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    // X-Acting-Company-Id: only forwarded when set (SUPER_ADMIN with an org
    // selection). The gateway validates and 403s if any non-SUPER_ADMIN ever
    // tries this header, so leaving it unset for COMPANY_ADMIN is correct.
    const actingCompanyId = getActingCompanyId();
    if (actingCompanyId && !headers.has('X-Acting-Company-Id')) {
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
      // Access token expired mid-session. Try a silent refresh; if it succeeds,
      // replay the original request with the new token. If the refresh fails
      // (refresh token also expired or revoked), clear the session and surface
      // the 401 so route guards redirect to /login.
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
