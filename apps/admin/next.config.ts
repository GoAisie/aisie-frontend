import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

// Build-time SHA inlining for the user-visible version badge.
// See apps/pwa/next.config.ts for full rationale — same pattern, mapped from
// Vercel's VERCEL_GIT_COMMIT_SHA system env var to NEXT_PUBLIC_BUILD_SHA so
// the admin Sidebar footer can render it without an extra env config step.
const BUILD_SHA = (process.env.VERCEL_GIT_COMMIT_SHA ?? 'local').substring(0, 7);

const nextConfig: NextConfig = {
  transpilePackages: ['@aisie/shared'],
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_BUILD_SHA: BUILD_SHA,
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: 'aisie-admin',
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: '/sentry-tunnel',
  disableLogger: true,
  automaticVercelMonitors: true,
});
