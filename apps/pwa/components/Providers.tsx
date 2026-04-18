'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { createQueryClient } from '@/lib/query-client';

export function Providers({ children }: { children: React.ReactNode }) {
  // useState keeps the client stable across re-renders; not a module-level
  // singleton because Next can re-instantiate on HMR / route transitions and
  // we want each browser tab to own its own cache.
  const [queryClient] = useState(() => createQueryClient());
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
