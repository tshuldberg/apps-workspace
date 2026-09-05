// Public post thread reader (Plan 39 P10/P11, screen S7). WEB twin of
// apps/meerkat/app/(root)/data/public-thread.ts. Loads a public post (the root)
// plus its dual-verified replies from The Commons; replies are PublicPostEvents
// whose parentPostId points at the root, re-verified against the pinned node key
// by fetchPublicPage (fail-closed, the node is never trusted).
//
// HONESTY: no fabricated posts, counts, or engagement. The reply count is the real
// number of verified replies loaded; bump/like counts are not shown (NC-P6).

import type { DatabaseAdapter } from '@mylife/db';
import { fetchPublicPage, type AcceptedPublicPost } from '@mylife/sync';
import { readSessionHeaders } from './persona-core';
import { COMMONS_COMMUNITY_ID, type CommonsFeedConfig } from './public-feed';
import { filterBlockedPublicPosts } from './public-safety';

export interface PublicThread {
  root: AcceptedPublicPost;
  replies: AcceptedPublicPost[];
}

export type LoadThreadResult =
  | { ok: true; thread: PublicThread }
  | { ok: false; reason: 'not_configured' | 'not_wired' | 'unreachable' | 'not_found' };

function receiptTimeMs(p: AcceptedPublicPost): number {
  const t = Date.parse(p.receipt.hlc.wall);
  return Number.isNaN(t) ? 0 : t;
}

export async function loadPublicThread(
  db: DatabaseAdapter,
  config: CommonsFeedConfig,
  channelId: string,
  rootPostId: string,
  fetchImpl: typeof fetch = fetch,
  limit = 200,
): Promise<LoadThreadResult> {
  if (!config.nodeUrl.startsWith('http') || config.topics.length === 0) return { ok: false, reason: 'not_configured' };
  const source = config.topics.find((t) => t.channelId === channelId);
  if (!source) return { ok: false, reason: 'not_wired' };
  const sessionFetch = ((input: RequestInfo | URL, init?: RequestInit) =>
    fetchImpl(input, { ...init, headers: { ...(init?.headers as Record<string, string>), ...readSessionHeaders(db) } })) as typeof fetch;
  const page = await fetchPublicPage({
    baseUrl: config.nodeUrl,
    publicationId: source.publicationId,
    channelId,
    expectedCommunityId: COMMONS_COMMUNITY_ID,
    pinnedNodeKeyHex: source.nodeKeyHex,
    fetchFn: sessionFetch,
    limit,
  });
  if (!page.ok) return { ok: false, reason: page.reason === 'not_found' ? 'not_found' : 'unreachable' };
  const posts = filterBlockedPublicPosts(db, page.publicPosts);
  const root = posts.find((p) => p.post.postId === rootPostId);
  if (!root) return { ok: false, reason: 'not_found' };
  const replies = posts
    .filter((p) => p.post.parentPostId === rootPostId)
    .sort((a, b) => receiptTimeMs(b) - receiptTimeMs(a));
  return { ok: true, thread: { root, replies } };
}

/** "{n} repl{y|ies}" honest label from the REAL loaded reply count. */
export function replyCountLabel(count: number): string {
  return count === 1 ? '1 reply' : `${count} replies`;
}
