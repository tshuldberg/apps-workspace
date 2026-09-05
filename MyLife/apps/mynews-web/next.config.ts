import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

import { staticSecurityHeaders } from './lib/security-headers';

// Web server code imports ONLY '@mylife/mynews/cloud-fetch' (a dedicated
// package subpath with zero runtime imports). The package barrel re-exports
// the signing module, which imports @mylife/sync, whose entry re-exports
// React client hooks; pulling that into a Server Component fails next build.
// The subpath keeps the RSC graph clean without aliases. Type-only imports of
// the barrel are fine anywhere (erased before bundling).

// Monorepo root. Without it, Next infers a tracing root from the nearest
// lockfile and either warns or traces a bundle that is missing the workspace
// packages this app symlinks to.
const monorepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const isProduction = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  transpilePackages: ['@mylife/mynews'],
  outputFileTracingRoot: monorepoRoot,
  // The framework version is not something a public site should announce.
  poweredByHeader: false,
  async headers() {
    return [
      {
        // Every path, including /_next/static, which middleware deliberately
        // skips. These headers are path-independent, so serving them from the
        // config costs nothing per request.
        source: '/:path*',
        headers: staticSecurityHeaders({
          production: isProduction,
          // Outbound links keep the origin but not the path, which is the
          // referrer behaviour a news site wants: a publisher can see that
          // MyNews sent the reader without learning which article they read.
          referrerPolicy: 'strict-origin-when-cross-origin',
        }),
      },
    ];
  },
};

// Content-Security-Policy is deliberately absent here and set in middleware.ts:
// it carries a per-response nonce, and two CSP headers are intersected by the
// browser rather than merged.

export default nextConfig;
