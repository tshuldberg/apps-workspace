// Composition plan 2.1 sandbox rule (WEB twin of apps/meerkat/app/(root)/data/
// block-queries.ts): THE single data seam block renderers may read through.
// Each query function touches ONLY the tables its block's contract declares in
// BLOCK_REGISTRY[type].dataSources; the block-data-scope test greps this file
// per function and the renderer map's imports to enforce it. Blocks never
// fetch the network; every value here derives from verified local rows.

import type { DatabaseAdapter } from '@mylife/db';
import type {
  ChannelMessageEvent,
  CommunityDescriptor,
  CommunityIdentityEvent,
} from '@mylife/sync';
import {
  aggregateCommunityFiles,
  buildCommunityPeerNameMap,
  getCommunityIdentity,
  listChannelMessages,
  listChannelPostCards,
  type AggregatedFile,
  type ChannelPostCard,
} from './meerkat-data';
import {
  libraryItemEventFromRow,
  verifyLibraryItemEvent,
  type LibraryItemEvent,
} from './library-data-core';

/** A member row for the members block (name resolution, no raw device ids shown). */
export interface BlockMemberRow {
  deviceId: string;
  name: string;
  role: string;
}

/**
 * The queries a block renderer receives. Narrow by construction: nothing here
 * exposes the DatabaseAdapter, a raw SQL door, or tables outside the block
 * contracts.
 */
export interface BlockQueries {
  /** hero: cm_community_identity. */
  heroIdentity(): CommunityIdentityEvent | null;
  /** chat: cm_messages (+ read models that collapse edits/deletes). */
  recentMessages(channelId: string, limit: number): ChannelMessageEvent[];
  /** posts: cm_posts + cm_messages read model. */
  recentPostCards(channelId: string, limit: number): ChannelPostCard[];
  /** gallery: cm_library_items (verified events only). */
  recentLibraryItems(limit: number): LibraryItemEvent[];
  /** files: the aggregated verified attachment index. */
  recentFiles(limit: number): AggregatedFile[];
  /** members: descriptor members + cm_profiles names. */
  memberRows(maxShown: number): BlockMemberRow[];
}

/** Build the query seam for one community (host-side; renderers never see db). */
export function buildBlockQueries(
  db: DatabaseAdapter,
  descriptor: CommunityDescriptor,
): BlockQueries {
  const communityId = descriptor.communityId;
  return {
    heroIdentity() {
      return getCommunityIdentity(db, communityId);
    },
    recentMessages(channelId, limit) {
      const messages = listChannelMessages(db, communityId, channelId);
      return messages.slice(Math.max(0, messages.length - limit));
    },
    recentPostCards(channelId, limit) {
      return listChannelPostCards(db, communityId, channelId).slice(0, limit);
    },
    recentLibraryItems(limit) {
      const rows = db.query<Record<string, unknown>>(
        `SELECT * FROM cm_library_items WHERE community_id = ? ORDER BY updated_at DESC LIMIT ?`,
        [communityId, Math.max(1, Math.min(100, limit))],
      );
      const items: LibraryItemEvent[] = [];
      for (const row of rows) {
        const event = libraryItemEventFromRow(row);
        if (event && !event.tombstone && verifyLibraryItemEvent(event)) items.push(event);
      }
      return items;
    },
    recentFiles(limit) {
      return aggregateCommunityFiles(db, communityId, descriptor.channels)
        .slice(0, Math.max(1, Math.min(100, limit)));
    },
    memberRows(maxShown) {
      const names = buildCommunityPeerNameMap(db, communityId);
      return descriptor.members.slice(0, Math.max(1, Math.min(50, maxShown))).map((member) => ({
        deviceId: member.deviceId,
        name: names.get(member.deviceId) ?? member.displayName ?? member.deviceId.slice(0, 8),
        role: member.role,
      }));
    },
  };
}
