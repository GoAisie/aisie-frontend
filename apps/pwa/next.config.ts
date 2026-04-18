import type { NextConfig } from 'next';

// Transpile the workspace-local shared package so Next doesn't
// try to import it as a pre-compiled node module.
const nextConfig: NextConfig = {
  transpilePackages: ['@aisie/shared'],
  reactStrictMode: true,
};

export default nextConfig;
