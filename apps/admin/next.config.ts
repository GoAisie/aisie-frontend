import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@aisie/shared'],
  reactStrictMode: true,
};

export default nextConfig;
