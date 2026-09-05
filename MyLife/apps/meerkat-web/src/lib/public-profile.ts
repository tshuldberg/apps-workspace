// Public persona profile reader (Plan 39 P10/P11, screen S8). WEB twin of
// apps/meerkat/app/(root)/data/public-profile.ts. A profile is assembled PURELY
// from a persona's signed public posts; this pages every configured Commons topic,
// filters to the persona's top-level posts, and unions them newest-first, each
// dual-verified against the descriptor-pinned node key by fetchPublicPage.
//
// HONESTY: only real, dual-signed posts by THIS persona appear; the count is the
// real number loaded. No fabricated member-since/follower/post totals (NC-P6).

import type { DatabaseAdapter } from '@mylife/db';
import { fetchPublicPage, type AcceptedPublicPost } from '@mylife/sync';
import { readSessionHeaders } from './persona-core';
import { COMMONS_COMMUNITY_ID, type CommonsFeedConfig } from './public-feed';

export interface PersonaProfile {
  personaPubkey: string;
  posts: AcceptedPublicPost[];
  channelByPostId: Record<string, string>;
}

export type LoadProfileResult =
  | { ok: true; profile: PersonaProfile }
  | { ok: false; reason: 'not_configured' | 'unreachable' };

function receiptTimeMs(p: AcceptedPublicPost): number {
  const t = Date.parse(p.receipt.hlc.wall);
  return Number.isNaN(t) ? 0 : t;
}

export async function loadPersonaProfile(
  db: DatabaseAdapter,
  config: CommonsFeedConfig,
  personaPubkey: string,
  fetchImpl: typeof fetch = fetch,
  limitPerTopic = 100,
): Promise<LoadProfileResult> {
  if (!config.nodeUrl.startsWith('http') || config.topics.length === 0) return { ok: false, reason: 'not_configured' };
  const wantKey = personaPubkey.toLowerCase();
  const sessionFetch = ((input: RequestInfo | URL, init?: RequestInit) =>
    fetchImpl(input, { ...init, headers: { ...(init?.headers as Record<string, string>), ...readSessionHeaders(db) } })) as typeof fetch;

  const byPostId = new Map<string, AcceptedPublicPost>();
  const channelByPostId: Record<string, string> = {};
  let anySucceeded = false;
  for (const source of config.topics) {
    const page = await fetchPublicPage({
      baseUrl: config.nodeUrl,
      publicationId: source.publicationId,
      channelId: source.channelId,
      expectedCommunityId: COMMONS_COMMUNITY_ID,
      pinnedNodeKeyHex: source.nodeKeyHex,
      fetchFn: sessionFetch,
      limit: limitPerTopic,
    });
    if (!page.ok) continue;
    anySucceeded = true;
    for (const accepted of page.publicPosts) {
      if (accepted.post.personaPubkey.toLowerCase() !== wantKey) continue;
      if (accepted.post.parentPostId !== null) continue;
      if (!byPostId.has(accepted.post.postId)) {
        byPostId.set(accepted.post.postId, accepted);
        channelByPostId[accepted.post.postId] = source.channelId;
      }
    }
  }
  if (!anySucceeded) return { ok: false, reason: 'unreachable' };
  const posts = Array.from(byPostId.values()).sort((a, b) => receiptTimeMs(b) - receiptTimeMs(a));
  return { ok: true, profile: { personaPubkey, posts, channelByPostId } };
}

/** "{n} public post{s}" honest label from the REAL loaded post count. */
export function publicPostCountLabel(count: number): string {
  return count === 1 ? '1 public post' : `${count} public posts`;
}
