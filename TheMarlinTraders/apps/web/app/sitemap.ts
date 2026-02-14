import type { MetadataRoute } from 'next'

/**
 * Dynamic sitemap using Next.js App Router convention.
 * Next.js automatically serves this at /sitemap.xml.
 *
 * In production, the dynamic ideas section will fetch published ideas
 * from the database via tRPC server-side call.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://marlintraders.com'

  // ── Static pages ───────────────────────────────────────────────────────────

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/ideas`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/leaderboards`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/screener`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
  ]

  // ── Dynamic pages: published ideas ─────────────────────────────────────────
  // TODO: Replace with tRPC server-side call to fetch published ideas
  // const ideas = await trpc.ideas.listPublished.query({ limit: 5000 })
  // const ideaPages = ideas.map((idea) => ({
  //   url: `${baseUrl}/ideas/${idea.id}`,
  //   lastModified: new Date(idea.updatedAt ?? idea.publishedAt),
  //   changeFrequency: 'weekly' as const,
  //   priority: 0.6,
  // }))

  // Mock idea pages for now
  const mockIdeaIds = ['1', '2', '3', '4', '5']
  const ideaPages: MetadataRoute.Sitemap = mockIdeaIds.map((id) => ({
    url: `${baseUrl}/ideas/${id}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.6,
  }))

  return [...staticPages, ...ideaPages]
}
