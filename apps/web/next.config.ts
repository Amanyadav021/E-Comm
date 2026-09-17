import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@shopcraft/shared'],
  async rewrites() {
    // Same-origin API path in dev keeps cookies first-party
    return [
      { source: '/api/:path*', destination: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/:path*` },
    ];
  },
};

export default nextConfig;
