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

// ----- Paused conversation_id (per-tab) -----------------------------------
//
// Lives in sessionStorage rather than localStorage so each browser tab carries its
// own pause state. Two reasons:
//   1. Two tabs racing to resume the same conversation_id would each open a WS
//      and then evict the other — wasteful, confusing UX.
//   2. Pause state is inherently ephemeral; closing the tab is a clear "give up"
//      signal, after which the backend cleanup cron will finalize the conversation
//      after 1 hour of `updated_at` inactivity.
const STORAGE_KEY_PAUSED_CONVERSATION = 'aisie_paused_conversation_id';

export function savePausedConversationId(id: string): void {
  try {
    sessionStorage.setItem(STORAGE_KEY_PAUSED_CONVERSATION, id);
  } catch {
    // Private browsing or storage quota — pause UI still works in-memory; the
    // user just cannot survive a tab reload, which is acceptable degradation.
  }
}

export function getPausedConversationId(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY_PAUSED_CONVERSATION);
  } catch {
    return null;
  }
}

export function clearPausedConversationId(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY_PAUSED_CONVERSATION);
  } catch {
    // ignore
  }
}
