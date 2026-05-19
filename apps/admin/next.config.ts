import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  transpilePackages: ['@aisie/shared'],
  reactStrictMode: true,
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
