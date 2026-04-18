// Admin-side env. Same gateway as the PWA — all traffic lands on the
// ALB/api.goaisie.com, which then enforces role-based ACL. The admin app
// itself has no server-side secrets.
export const env = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8001',
  wsBaseUrl: process.env.NEXT_PUBLIC_WS_BASE_URL ?? 'ws://localhost:8001',
} as const;
