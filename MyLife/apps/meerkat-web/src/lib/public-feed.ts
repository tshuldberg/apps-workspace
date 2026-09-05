// Public feed config + topic rail + reader (Plan 39 P10/P11). WEB twin of
// apps/meerkat/app/(root)/data/public-feed.ts. The consumer-side of The Commons base feed: the
// serving node + per-topic publication sources, the topic chip rail, and the reader that pulls a
// page of REAL, dual-verified public posts with a verify-to-view session attached.
//
// HONESTY: with no commons feed configured the Public view shows the honest "not connected" state.
// A card renders ONLY from a real, dual-signature-verified post (fetchPublicPage re-verifies each
// post against the descriptor-pinned node key, fail-closed); the node is never trusted.

import type { DatabaseAdapter } from '@mylife/db';
import { fetchPublicPage, MAX_PUBLIC_POST_BODY_CHARS, type AcceptedPublicPost } from '@mylife/sync';
import { readSessionHeaders } from './persona-core';
import { filterBlockedPublicPosts } from './public-safety';

/** The system community namespace The Commons publications live under (matches the relay). */
export const COMMONS_COMMUNITY_ID = 'the-commons';

/** Post body cap surfaced by the composer (the protocol enforces the same limit). */
export const MAX_PUBLIC_POST_BODY = MAX_PUBLIC_POST_BODY_CHARS;

/** Verbatim composer placeholder (mockup S5/S6), parity-locked with the native twin. */
export const PUBLIC_COMPOSE_PLACEHOLDER = 'Say something worth reading…';

export interface CommonsTopicSource {
  channelId: string;
  publicationId: string;
  /** The descriptor-pinned node receipt key (64-hex); required to dual-verify posts. */
  nodeKeyHex: string;
}

export interface CommonsFeedConfig {
  nodeUrl: string;
  topics: CommonsTopicSource[];
}

function parseTopics(raw: string): CommonsTopicSource[] {
  if (!raw.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: CommonsTopicSource[] = [];
  for (const row of parsed) {
    if (row && typeof row === 'object') {
      const r = row as Partial<CommonsTopicSource>;
      if (typeof r.channelId === 'string' && typeof r.publicationId === 'string' && typeof r.nodeKeyHex === 'string') {
        out.push({ channelId: r.channelId, publicationId: r.publicationId, nodeKeyHex: r.nodeKeyHex });
      }
    }
  }
  return out;
}

/** Read the commons feed config from Vite build env. Empty => unconfigured. */
export function commonsFeedConfig(): CommonsFeedConfig {
  const nodeUrl = (import.meta.env.VITE_MEERKAT_COMMONS_NODE_URL ?? '').trim();
  return { nodeUrl, topics: parseTopics(import.meta.env.VITE_MEERKAT_COMMONS_TOPICS ?? '') };
}

export function isCommonsFeedConfigured(config: CommonsFeedConfig): boolean {
  return config.nodeUrl.startsWith('http') && config.topics.length > 0;
}

export interface PublicFeedTopic {
  channelId: string;
  title: string;
  emoji: string;
}

/** The topic chip rail for The Commons base feed (parity-locked against the native twin). */
export const PUBLIC_FEED_TOPICS: readonly PublicFeedTopic[] = [
  { channelId: 'commons', title: 'The Commons', emoji: '🌐' },
  { channelId: 'technology', title: 'Technology', emoji: '🚀' },
  { channelId: 'gaming', title: 'Gaming', emoji: '🎮' },
  { channelId: 'news', title: 'News', emoji: '📰' },
  { channelId: 'sports', title: 'Sports', emoji: '⚽' },
  { channelId: 'local', title: 'Local', emoji: '📍' },
  { channelId: 'hobbies', title: 'Hobbies', emoji: '🌱' },
  { channelId: 'creative', title: 'Creative', emoji: '🎨' },
];

export type LoadCommonsResult =
  | { ok: true; posts: AcceptedPublicPost[] }
  | { ok: false; reason: 'not_configured' | 'not_wired' | 'unreachable' | 'not_found' };

/** Load a page of a topic channel from The Commons, session-attached + dual-verified. */
export async function loadCommonsTopic(
  db: DatabaseAdapter,
  config: CommonsFeedConfig,
  channelId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<LoadCommonsResult> {
  if (!isCommonsFeedConfigured(config)) return { ok: false, reason: 'not_configured' };
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
  });
  if (page.ok) return { ok: true, posts: filterBlockedPublicPosts(db, page.publicPosts) };
  if (page.reason === 'not_found') return { ok: false, reason: 'not_found' };
  return { ok: false, reason: 'unreachable' };
}
