'use client';

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
    // because clearing local state is the user-facing source of truth for logout.
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
      style={{
        position: 'fixed',
        top: 12,
        right: 16,
        zIndex: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 36,
        height: 36,
        borderRadius: '50%',
        background: '#fff',
        border: '1px solid #e5e7eb',
        boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
        cursor: 'pointer',
        padding: 0,
        color: '#374151',
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
    </button>
  );
}
