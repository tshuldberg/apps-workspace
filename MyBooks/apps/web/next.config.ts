import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@mybooks/shared', '@mybooks/ui'],
};

export default nextConfig;
