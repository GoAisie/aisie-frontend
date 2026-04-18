import { QueryClient } from '@tanstack/react-query';

// One client instance per browser session. staleTime 30s reduces refetch storm
// during quick tab switches; retry 1 avoids hammering the backend on transient
// 5xx (gateway-level retry in Faz 2 handles most of those).
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
