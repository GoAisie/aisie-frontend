'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { useState, useEffect } from 'react';
import { createQueryClient } from '@/lib/query-client';
import { useSessionStore } from '@/lib/auth/session-store';
import { useActingCompanyStore } from '@/lib/auth/acting-company-store';
import { Toaster } from '@/components/ui/sonner';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());
  const initialize = useSessionStore((s) => s.initialize);
  const initializeActing = useActingCompanyStore((s) => s.initialize);

  // Silent token refresh on cold page load — admin stays logged in across
  // browser refreshes. Acting-company selection is rehydrated from
  // localStorage so a SUPER_ADMIN does not lose their org pick after reload.
  useEffect(() => {
    initialize();
    initializeActing();
  }, [initialize, initializeActing]);

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
