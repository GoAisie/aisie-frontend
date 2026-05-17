'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { useState, useEffect } from 'react';
import { createQueryClient } from '@/lib/query-client';
import { useSessionStore } from '@/lib/auth/session-store';
import { useConversationStore } from '@/lib/conversation/conversation-store';
import { Toaster } from '@/components/ui/sonner';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());
  const initialize = useSessionStore((s) => s.initialize);

  // Attempt silent token refresh on every cold page load so the user stays
  // logged in across browser refreshes (refreshToken is in localStorage).
  // After auth has settled (success or failure), verify the boot-time
  // resume hint: if sessionStorage had a paused conversation_id and the
  // backend has already finalized that conversation (1h cron, pagehide
  // close beacon, manual explicit close from another tab, etc.), silently
  // demote the store from 'paused' to 'idle' so the user does not see a
  // paused UI for a conversation they cannot actually resume.
  // verifyResumeHint is a no-op when sessionStorage is empty, when there
  // is no access token (auth failed), or when the user already moved past
  // 'paused' mode in the meantime.
  useEffect(() => {
    (async () => {
      await initialize();
      await useConversationStore.getState().verifyResumeHint();
    })();
  }, [initialize]);

  // Logout cleanup: when the session transitions from authenticated to
  // logged-out (accessToken non-null → null), end any in-flight conversation
  // so the backend receives close_session before the WS is torn down. This
  // triggers post-correction + email + pipeline_finalize on the server. If
  // the user logs out without an active conversation, endSession is a cheap
  // no-op (idempotent guard inside the store).
  useEffect(() => {
    const unsubscribe = useSessionStore.subscribe((state, prev) => {
      if (prev.accessToken !== null && state.accessToken === null) {
        void useConversationStore.getState().endSession();
      }
    });
    return unsubscribe;
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        disableTransitionOnChange
      >
        {children}
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
