import * as Sentry from '@sentry/nextjs';

// Next.js calls register() once per runtime (nodejs, edge). We lazy-import the
// runtime-specific Sentry config so the wrong SDK build never ships to a
// runtime that can't use it (e.g. node:fs in edge).
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

// onRequestError hooks server-rendered RSC and route handler errors directly
// into Sentry. Without this, errors thrown during streaming SSR are swallowed
// by Next's error boundary before they reach Sentry's instrumentation.
export const onRequestError = Sentry.captureRequestError;
