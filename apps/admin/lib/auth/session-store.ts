'use client';

import { create } from 'zustand';
import type { User } from '@aisie/shared';

// Shared shape with the PWA's session-store (in-memory access token, no
// localStorage — avoids the XSS exfiltration risk the legacy RN app had).
// The admin also decodes `role` from the JWT itself so the route guards
// don't need to call a /me endpoint just to read one claim.
export type AdminRole = 'COMPANY_ADMIN' | 'SALES_REP' | 'SALES_MANAGER';

type SessionState = {
  accessToken: string | null;
  user: User | null;
  role: AdminRole | null;
  setSession: (args: { accessToken: string; user: User }) => void;
  clearSession: () => void;
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
    if (claims.role === 'COMPANY_ADMIN' || claims.role === 'SALES_REP' || claims.role === 'SALES_MANAGER') {
      return claims.role;
    }
    return null;
  } catch {
    return null;
  }
}

export const useSessionStore = create<SessionState>((set) => ({
  accessToken: null,
  user: null,
  role: null,
  setSession: ({ accessToken, user }) =>
    set({ accessToken, user, role: decodeRole(accessToken) }),
  clearSession: () => set({ accessToken: null, user: null, role: null }),
}));

export function getAccessToken(): string | null {
  return useSessionStore.getState().accessToken;
}

export function getRole(): AdminRole | null {
  return useSessionStore.getState().role;
}
