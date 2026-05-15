'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { createQueryClient } from '@/lib/query-client';
import { useSessionStore } from '@/lib/auth/session-store';
import { useActingCompanyStore } from '@/lib/auth/acting-company-store';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());
  const initialize = useSessionStore((s) => s.initialize);
  const initializeActing = useActingCompanyStore((s) => s.initialize);

  // Attempt silent token refresh on every cold page load so the admin stays
  // logged in across browser refreshes (refreshToken is in localStorage).
  // Acting-company selection is also rehydrated from localStorage so a
  // SUPER_ADMIN doesn't lose their org pick after a reload.
  useEffect(() => {
    initialize();
    initializeActing();
  }, [initialize, initializeActing]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
