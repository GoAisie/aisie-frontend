'use client';

import { create } from 'zustand';
import type { User } from '@aisie/shared';
import { loginResponseSchema } from '@aisie/shared';
import { env } from '../env';

// Access token stays in memory only (no localStorage) — avoids XSS exfiltration.
// Refresh token is stored in localStorage so a page reload can silently re-issue
// a new access token without forcing the user back to /login.
const STORAGE_KEY_REFRESH = 'aisie_refresh_token';
const STORAGE_KEY_USER = 'aisie_user';

type SessionState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  // Flips to true after initialize() settles — auth guards must not redirect before this.
  initialized: boolean;
  setSession: (args: { accessToken: string; refreshToken: string; user: User }) => void;
  clearSession: () => void;
  initialize: () => Promise<void>;
};

export const useSessionStore = create<SessionState>((set) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  initialized: false,

  setSession: ({ accessToken, refreshToken, user }) => {
    set({ accessToken, refreshToken, user });
    try {
      localStorage.setItem(STORAGE_KEY_REFRESH, refreshToken);
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    } catch {
      // Private browsing mode may block localStorage writes.
    }
  },

  clearSession: () => {
    set({ accessToken: null, refreshToken: null, user: null });
    try {
      localStorage.removeItem(STORAGE_KEY_REFRESH);
      localStorage.removeItem(STORAGE_KEY_USER);
    } catch {
      // ignore
    }
  },

  initialize: async () => {
    let storedRefresh: string | null = null;
    try {
      storedRefresh = localStorage.getItem(STORAGE_KEY_REFRESH);
    } catch {
      return;
    }
    if (!storedRefresh) {
      set({ initialized: true });
      return;
    }

    try {
      // Use native fetch to avoid circular dependency with apiFetch (which imports getAccessToken).
      const res = await fetch(`${env.apiBaseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: storedRefresh }),
      });
      if (!res.ok) {
        useSessionStore.getState().clearSession();
        set({ initialized: true });
        return;
      }
      const raw = await res.json();
      const data = loginResponseSchema.parse(raw);
      useSessionStore.getState().setSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user,
      });
    } catch {
      useSessionStore.getState().clearSession();
    } finally {
      set({ initialized: true });
    }
  },
}));

export function getAccessToken(): string | null {
  return useSessionStore.getState().accessToken;
}
