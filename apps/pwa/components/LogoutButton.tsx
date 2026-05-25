'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSessionStore } from '@/lib/auth/session-store';
import { useConversationStore } from '@/lib/conversation/conversation-store';
import { apiFetch } from '@/lib/api-client';

export function LogoutButton() {
  const router = useRouter();
  const clearSession = useSessionStore((s) => s.clearSession);

  const handleLogout = async () => {
    // End any active voice session first so the WS sends its close beacon,
    // stops the mic, and releases the audio context before we drop the token.
    try {
      useConversationStore.getState().endSession();
    } catch {
      // No active session, or store not mounted — non-fatal.
    }
    // Real logout: pass the refresh_token in the body so main-service can
    // persist its jti into revoked_refresh_tokens. The next /auth/refresh
    // with that token gets 401 "Token reuse detected" — closes the K-1
    // logout-no-op gap. Read refresh token BEFORE clearSession runs.
    //
    // skipAuth=true bypasses the apiFetch 401-retry-via-refresh path. If
    // the access token happened to expire at the exact moment of logout,
    // the retry path would silently call /auth/refresh with the same token
    // we're about to revoke — rotation would consume the jti, the logout
    // call would never reach the server, and the revocation would not
    // persist. Backend identifies the user from the refresh_token body,
    // not from the Authorization header, so skipping auth here is safe.
    const refreshToken = useSessionStore.getState().refreshToken;
    try {
      await apiFetch('/auth/logout', {
        method: 'POST',
        body: refreshToken ? { refresh_token: refreshToken } : undefined,
        skipAuth: true,
      });
    } catch {
      // Network failure or 401 — proceed with local clear regardless. The
      // refresh token's TTL still bounds the damage to 7 days in this case.
    }
    clearSession();
    router.replace('/login');
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      aria-label="Çıkış yap"
      title="Çıkış yap"
      className="flex size-9 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-all duration-150 hover:bg-muted active:scale-95"
    >
      <LogOut className="size-[18px]" aria-hidden />
    </button>
  );
}
