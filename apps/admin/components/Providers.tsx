'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { createQueryClient } from '@/lib/query-client';
import { useSessionStore } from '@/lib/auth/session-store';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());
  const initialize = useSessionStore((s) => s.initialize);

  // Attempt silent token refresh on every cold page load so the admin stays
  // logged in across browser refreshes (refreshToken is in localStorage).
  useEffect(() => {
    initialize();
  }, [initialize]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
