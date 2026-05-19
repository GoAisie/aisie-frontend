import * as Sentry from '@sentry/nextjs';

// Node.js runtime Sentry init — runs in API routes, Server Actions, and during
// streaming SSR. DSN can come from either SENTRY_DSN (server-only) or the
// NEXT_PUBLIC variant; same project either way.
const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: !!dsn,
  tracesSampleRate: 0.1,
});
