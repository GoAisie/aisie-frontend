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
    // Audit-only logout per current main-service contract; failures are ignored
    // because clearing local state is the user-facing source of truth.
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      // Network failure or 401 — proceed with local clear regardless.
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
