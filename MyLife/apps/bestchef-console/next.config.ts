import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Internal ops tool: never index, never cache at the edge.
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Cache-Control', value: 'no-store' },
          // Explicit anti-framing: an ops console full of one-click
          // enforcement actions must never render inside a frame.
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default nextConfig;
