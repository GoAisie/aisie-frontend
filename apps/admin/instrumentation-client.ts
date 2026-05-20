import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: 0.1,

  // Admin sees less traffic than the PWA; we can afford a slightly more
  // generous session-replay baseline without busting the 50/month free quota.
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
    // Forward console.error() calls as Sentry events. See apps/pwa for the
    // full rationale; admin runs on the same quota strategy.
    Sentry.captureConsoleIntegration({ levels: ['error'] }),
  ],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
