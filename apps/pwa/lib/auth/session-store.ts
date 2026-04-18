'use client';

import { create } from 'zustand';
import type { User } from '@aisie/shared';

// SECURITY: access token is kept in memory only (Zustand state, no persistence).
// A page refresh loses the token; the refresh token (stored by the server in an
// httpOnly cookie in a later commit) is used to silently re-login. This avoids
// the XSS exfiltration risk of putting JWTs in localStorage that the RN app had.
type SessionState = {
  accessToken: string | null;
  user: User | null;
  setSession: (args: { accessToken: string; user: User }) => void;
  clearSession: () => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  accessToken: null,
  user: null,
  setSession: ({ accessToken, user }) => set({ accessToken, user }),
  clearSession: () => set({ accessToken: null, user: null }),
}));

// Non-hook accessor for non-React call sites (e.g. the fetch wrapper).
export function getAccessToken(): string | null {
  return useSessionStore.getState().accessToken;
}
