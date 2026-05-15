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
