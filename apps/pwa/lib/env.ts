// Centralised env access. NEXT_PUBLIC_* is exposed to the browser; everything
// else stays server-only. Default points at the local api-gateway for dev; Vercel
// deploys set NEXT_PUBLIC_API_BASE_URL / NEXT_PUBLIC_WS_BASE_URL to api.goaisie.com.
//
// `showTranscript` gates the on-screen transcript / partial-transcript / assistant-text
// panel in ConversationView. Production is voice-only by design — the user listens
// to the assistant rather than reading it, and on-screen text is reserved for dev
// debugging. Default: true in dev, false in prod. NEXT_PUBLIC_SHOW_TRANSCRIPT=1
// forces the panel on in any environment for ad-hoc verification.
const isDev =
  process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test';

export const env = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8001',
  wsBaseUrl: process.env.NEXT_PUBLIC_WS_BASE_URL ?? 'ws://localhost:8001',
  useMockBackend: process.env.NEXT_PUBLIC_USE_MOCK_BACKEND === '1',
  showTranscript:
    process.env.NEXT_PUBLIC_SHOW_TRANSCRIPT === '1' || isDev,
} as const;
