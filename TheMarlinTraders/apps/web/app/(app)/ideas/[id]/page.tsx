import type { Metadata } from 'next'
import { IdeaDetailClient, MOCK_IDEA, MOCK_COMMENTS } from './client'

// ── ISR Configuration (Task 20.6) ────────────────────────────────────────────
// Revalidate every hour. When tRPC data fetching is wired up,
// this ensures fresh-enough data without rebuilding on every request.
export const revalidate = 3600

/**
 * Pre-render popular ideas at build time.
 * TODO: Fetch top N idea IDs from the API for static generation.
 * For now, return an empty array so all pages are dynamically rendered on first request
 * and then cached via ISR.
 */
export async function generateStaticParams(): Promise<{ id: string }[]> {
  // TODO: Replace with tRPC call to fetch popular idea IDs
  // const ideas = await trpc.ideas.getPopular.query({ limit: 50 })
  // return ideas.map((idea) => ({ id: idea.id }))
  return []
}

// ── OG Metadata (Task 20.3) ──────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params

  // TODO: Replace with tRPC server-side call to fetch the idea
  // const idea = await trpc.ideas.getById.query({ id })
  // For now, use mock data. In production this will be a real data fetch.
  const idea = MOCK_IDEA

  const title = `${idea.symbol}: ${idea.title}`
  const description = idea.body.slice(0, 160).replace(/[#*\n]/g, ' ').trim()
  const ogImageUrl = `/api/og?${new URLSearchParams({
    title: idea.title,
    symbol: idea.symbol,
    sentiment: idea.sentiment,
    author: idea.authorName ?? 'MarlinTraders',
  }).toString()}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      url: `/ideas/${id}`,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${idea.symbol} — ${idea.title}`,
        },
      ],
      siteName: 'MarlinTraders',
    },
    twitter: {
      card: 'summary_large_image',
      site: '@MarlinTraders',
      title,
      description,
      images: [ogImageUrl],
    },
  }
}

// ── Page component ───────────────────────────────────────────────────────────

export default async function IdeaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // TODO: Fetch idea and comments server-side via tRPC
  // const idea = await trpc.ideas.getById.query({ id })
  // const comments = await trpc.comments.getByIdeaId.query({ ideaId: id })

  return <IdeaDetailClient ideaId={id} />
}
