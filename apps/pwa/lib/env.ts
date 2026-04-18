// Centralised env access. NEXT_PUBLIC_* is exposed to the browser; everything
// else stays server-only. Default points at the local api-gateway for dev; Vercel
// deploys set NEXT_PUBLIC_API_BASE_URL / NEXT_PUBLIC_WS_BASE_URL to api.goaisie.com.
export const env = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8001',
  wsBaseUrl: process.env.NEXT_PUBLIC_WS_BASE_URL ?? 'ws://localhost:8001',
  useMockBackend: process.env.NEXT_PUBLIC_USE_MOCK_BACKEND === '1',
} as const;
