import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

import { CONSOLE_STATIC_HEADERS } from './lib/security-headers';

// Monorepo root. Without it Next infers the tracing root from the nearest
// lockfile, which in this checkout resolves to the home directory and traces a
// bundle that is missing the workspace packages this app symlinks to.
const monorepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const nextConfig: NextConfig = {
  outputFileTracingRoot: monorepoRoot,
  // Internal ops tool: never announce the framework version.
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: [...CONSOLE_STATIC_HEADERS] }];
  },
};

// Content-Security-Policy (frame-ancestors included) is set in middleware.ts,
// which is the only place a per-response nonce can be minted. It used to be a
// bare `frame-ancestors 'none'` here; that had to move, because two CSP headers
// are intersected by the browser rather than merged and the pair would have been
// a debugging trap the first time the policy grew.

export default nextConfig;
