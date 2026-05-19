import * as Sentry from '@sentry/nextjs';

// Edge runtime Sentry init — runs in Middleware and edge route handlers. The
// edge SDK uses fetch-based transport, no node:fs, no native modules.
const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: !!dsn,
  tracesSampleRate: 0.1,
});
