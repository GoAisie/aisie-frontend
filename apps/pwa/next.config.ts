import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

// Transpile the workspace-local shared package so Next doesn't
// try to import it as a pre-compiled node module.
const nextConfig: NextConfig = {
  transpilePackages: ['@aisie/shared'],
  reactStrictMode: true,
};

// withSentryConfig wires source-map upload, tunnel route, and Vercel cron
// monitor integration at build time. The org/project/auth-token come from env
// vars set in Vercel; when absent (local dev, preview without secrets) the
// wrapper is a no-op and the app builds normally.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: 'aisie-pwa',
  // Silence the upload progress chatter in non-CI builds.
  silent: !process.env.CI,
  // Upload a wider set of client source maps so prod stack traces map back to
  // your original TypeScript instead of a minified blob.
  widenClientFileUpload: true,
  // Route Sentry's event ingestion through your own domain to bypass
  // ad-blockers that filter sentry.io. The /sentry-tunnel path is reserved.
  tunnelRoute: '/sentry-tunnel',
  // Drop the Sentry SDK logger from the production bundle — saves ~10KB.
  disableLogger: true,
  // Auto-instrument Vercel cron functions if they exist (currently none, but
  // this is free insurance for future jobs).
  automaticVercelMonitors: true,
});
