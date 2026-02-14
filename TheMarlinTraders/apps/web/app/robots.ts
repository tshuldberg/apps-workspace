import type { MetadataRoute } from 'next'

/**
 * Robots.txt configuration using Next.js App Router convention.
 * Next.js automatically serves this at /robots.txt.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/settings', '/api', '/embed'],
      },
    ],
    sitemap: 'https://marlintraders.com/sitemap.xml',
  }
}
