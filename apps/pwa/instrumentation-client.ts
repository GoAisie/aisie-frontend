import * as Sentry from '@sentry/nextjs';

// Browser-side Sentry init. `enabled: !!dsn` makes Sentry a no-op when the env
// var isn't set — so local dev and any deployment without secrets continues to
// work without throwing or sending events.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // 10% of transactions get traces — enough signal for pilot scale without
  // exhausting the 10K span/month free quota.
  tracesSampleRate: 0.1,

  // 5% of all sessions get Session Replay recording. Session Replay quota on
  // Sentry Developer plan is 50/month — keeping the baseline low ensures the
  // budget covers errored sessions (which capture at 100%).
  replaysSessionSampleRate: 0.05,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      // Keep text visible — Aisie surfaces are not financial/PII-heavy; masked
      // replays would be debugging-useless. Audio captured by mic is never
      // serialized into the DOM, so it's outside Replay's reach anyway.
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
});

// Capture client-side navigation errors (App Router router.push() failures).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
