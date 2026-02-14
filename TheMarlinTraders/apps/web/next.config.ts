import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@marlin/ui', '@marlin/shared', '@marlin/data', '@marlin/charts'],

  // ── Headers for embeddable widgets (Sprint 20) ─────────────────────────────
  async headers() {
    return [
      {
        // Allow embed pages to be loaded in iframes on any origin
        source: '/embed/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
          { key: 'Content-Security-Policy', value: "frame-ancestors *" },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET' },
        ],
      },
      {
        // OG image route needs CORS for crawlers
        source: '/api/og',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Cache-Control', value: 'public, max-age=86400, s-maxage=86400' },
        ],
      },
    ]
  },

  experimental: {
    optimizePackageImports: [
      'lightweight-charts',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-dialog',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip',
      'cmdk',
      'class-variance-authority',
      'lucide-react',
    ],
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.r2.cloudflarestorage.com',
      },
      {
        protocol: 'https',
        hostname: 'cdn.marlintraders.com',
      },
    ],
  },

  webpack: (config, { isServer }) => {
    // Allow .js imports to resolve to .ts/.tsx source files in monorepo packages
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.jsx': ['.tsx', '.jsx'],
    }

    // Bundle analyzer (run with ANALYZE=true pnpm build --filter web)
    if (process.env.ANALYZE === 'true' && !isServer) {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          reportFilename: '../analyze/client.html',
          openAnalyzer: false,
        }),
      )
    }

    return config
  },
}

export default nextConfig
