import { env } from './env';
import { getAccessToken, useSessionStore } from './auth/session-store';

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
};

// Single JSON fetch wrapper. Injects Authorization from the Zustand store,
// serialises JSON bodies, and throws ApiError on non-2xx. On 401, clears the
// session so UI routes can redirect to /login on the next render.
export async function apiFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const { body, skipAuth, headers: callerHeaders, ...rest } = opts;

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
    if (response.status === 401) {
      useSessionStore.getState().clearSession();
    }
    throw new ApiError(response.status, payload, `API ${response.status} ${response.statusText}`);
  }

  return payload as T;
}
