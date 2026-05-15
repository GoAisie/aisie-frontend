'use client';

import { create } from 'zustand';
import type { User } from '@aisie/shared';
import { loginResponseSchema } from '@aisie/shared';
import { env } from '../env';

const STORAGE_KEY_REFRESH = 'aisie_admin_refresh_token';
const STORAGE_KEY_USER = 'aisie_admin_user';

// Access token stays in memory only. Refresh token persisted in localStorage
// so page reloads don't force the admin back to /login.
// SUPER_ADMIN added in Phase 4 — crosses company boundaries via the org
// picker, with the gateway enforcing X-Acting-Company-Id authorization.
export type AdminRole = 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'SALES_REP' | 'SALES_MANAGER';

type SessionState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  role: AdminRole | null;
  // Flips to true after initialize() settles — auth guards must not redirect before this.
  initialized: boolean;
  setSession: (args: { accessToken: string; refreshToken: string; user: User }) => void;
  clearSession: () => void;
  initialize: () => Promise<void>;
};

function decodeRole(token: string): AdminRole | null {
  // JWT = header.payload.signature — we only need the payload claim.
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    // atob only accepts base64; JWT uses base64url (–/_ swapped, no padding).
    const b64 = parts[1]!.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const json = typeof atob === 'function'
      ? atob(padded)
      : Buffer.from(padded, 'base64').toString('utf-8');
    const claims = JSON.parse(json) as { role?: string };
    if (claims.role === 'SUPER_ADMIN' || claims.role === 'COMPANY_ADMIN' || claims.role === 'SALES_REP' || claims.role === 'SALES_MANAGER') {
      return claims.role;
    }
    return null;
  } catch {
    return null;
  }
}

export const useSessionStore = create<SessionState>((set) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  role: null,
  initialized: false,

  setSession: ({ accessToken, refreshToken, user }) => {
    set({ accessToken, refreshToken, user, role: decodeRole(accessToken) });
    try {
      localStorage.setItem(STORAGE_KEY_REFRESH, refreshToken);
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    } catch {
      // Private browsing mode may block localStorage writes.
    }
  },

  clearSession: () => {
    set({ accessToken: null, refreshToken: null, user: null, role: null });
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
      set({ initialized: true });
      return;
    }
    if (!storedRefresh) {
      set({ initialized: true });
      return;
    }

    try {
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

export function getRole(): AdminRole | null {
  return useSessionStore.getState().role;
}
