import { setDeviceLayoutDefault, type LayoutDeviceClass, type DeviceLayoutChoice } from './device-layout-core';
// community-template-commit.ts (web): Plan 38 Phase 7 (amendment C.1). The
// all-or-nothing staged creation of a community from a template. It composes the
// SHIPPED primitives -- createCommunity (genesis: chat channels + categories +
// layout), createLibrary (one owner-signed cm_libraries row + a kind:'library'
// channel per library), and publishCommunityIdentity (theme/accent/description).
//
// Ordering is load-bearing (rc13 defect 1, mirror of the mobile twin at
// apps/meerkat/app/(root)/data/community-template-commit.ts):
// storeOwnedCommunity mints the workspace epoch inside its OWN transaction, so
// it CANNOT be nested inside another transaction on the sql.js browser adapter
// (a raw BEGIN-inside-BEGIN throws "cannot start a transaction within a
// transaction"). The genesis descriptor is signed first (pure), then
// storeOwnedCommunity runs OUTSIDE any outer transaction, then the library
// provisioning + identity publish commit in ONE transaction after it. On ANY
// failure, purgeLocalCommunity removes every row this creation wrote, so a
// half-built community never persists and the result carries an honest error.
//
// This is the pure data seam behind MeerkatProvider.createCommunityFromTemplate,
// factored out so the atomicity is unit-testable against the real db without
// React. It flushes NOTHING and refreshes NOTHING; the caller owns persistence
// side effects after a successful return.

import type { DatabaseAdapter } from '@mylife/db';
import {
  createCommunity,
  type CommunityChannel,
  type CommunityChannelCategory,
  type CommunityLayout,
  type DeviceIdentity,
  type RecordKeyWrapChange,
} from '@mylife/sync';
import { createLibrary } from './library-store';
import {
  CM_COMMUNITY_IDENTITY_TABLE,
  CM_LIBRARIES_TABLE,
  CM_LAYOUT_TABLE,
  publishCommunityLayout,
  publishCommunityIdentity,
  storeOwnedCommunity,
  setSetting,
} from './meerkat-data';
import type { KnownMediaType } from './library-metadata-core';
import { visibleCommunityName } from './community-templates';

export interface TemplateLibrarySpec {
  name: string;
  mediaType: KnownMediaType;
}

export interface CommitCommunityTemplateInput {
  name: string;
  layoutBlob?: string | null;
  completeOnboarding?: boolean;
  localLayoutDefault?: { profile: LayoutDeviceClass; choice: DeviceLayoutChoice };
  description: string | null;
  accent: string | null;
  themeBlob: string | null;
  layout: CommunityLayout;
  categories: CommunityChannelCategory[];
  /** Genesis chat channels, already stamped kind:'chat' + presentation order. */
  chatChannels: CommunityChannel[];
  /** Library channels appended after the community exists (owner-signed rows). */
  libraries: TemplateLibrarySpec[];
}

export type CommitCommunityTemplateResult =
  | { ok: true; communityId: string; firstChannelId: string | null }
  | { ok: false; error: string };

/** Delete every row a fresh owner-community creation wrote (compensating cleanup). */
function purgeLocalCommunity(db: DatabaseAdapter, communityId: string): void {
  // The epoch mint (createGroupCommit inside storeOwnedCommunity) commits in its
  // OWN transaction before the failing step and records its key wraps into
  // sync_change_log. Deleting only the key rows would leave ghost change records
  // that a later session ships for a community that no longer exists; drop them
  // by their `${workspaceId}:${keyVersion}:${deviceId}` row-id prefix first
  // (communityId is hex, so it carries no LIKE metacharacters).
  db.execute(
    `DELETE FROM sync_change_log WHERE table_name = 'sync_workspace_keys' AND row_id LIKE ?`,
    [`${communityId}:%`],
  );
  db.execute(`DELETE FROM ${CM_COMMUNITY_IDENTITY_TABLE} WHERE community_id = ?`, [communityId]);
  db.execute(`DELETE FROM ${CM_LAYOUT_TABLE} WHERE community_id = ?`, [communityId]);
  db.execute(`DELETE FROM ${CM_LIBRARIES_TABLE} WHERE community_id = ?`, [communityId]);
  db.execute('DELETE FROM sync_workspace_keys WHERE workspace_id = ?', [communityId]);
  db.execute('DELETE FROM sync_workspace_members WHERE workspace_id = ?', [communityId]);
  db.execute('DELETE FROM sync_communities WHERE community_id = ?', [communityId]);
  db.execute('DELETE FROM sync_workspaces WHERE id = ?', [communityId]);
}

export function commitCommunityTemplate(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  input: CommitCommunityTemplateInput,
  recordChange?: RecordKeyWrapChange,
): CommitCommunityTemplateResult {
  const name = input.name.trim();
  // A name whose VISIBLE form is empty (only zero-width/control characters)
  // would create a community that renders as a blank card everywhere.
  if (!name || !visibleCommunityName(name)) {
    return { ok: false, error: 'Give the community a name.' };
  }
  if (input.chatChannels.length === 0) {
    return { ok: false, error: 'A community needs at least one channel.' };
  }

  // 1) Sign the genesis descriptor -- pure, no db writes yet.
  const signed = createCommunity(identity, {
    name,
    channels: input.chatChannels,
    ...(input.categories.length ? { categories: input.categories } : {}),
    ...(input.layout ? { layout: input.layout } : {}),
  });
  const communityId = signed.descriptor.communityId;
  const firstChannelId = signed.descriptor.channels[0]?.id ?? null;

  // 2) Commit. storeOwnedCommunity self-transacts (epoch mint via
  //    createGroupCommit), so it runs first and the library provisioning +
  //    identity publish go in ONE transaction after it. Any failure purges, so
  //    nothing half-built persists.
  try {
    storeOwnedCommunity(db, identity, signed, undefined, recordChange);
    db.transaction(() => {
      for (const library of input.libraries) {
        createLibrary(
          db,
          identity,
          { workspaceId: communityId, name: library.name, mediaType: library.mediaType },
          { recordChange },
        );
      }
      if (input.layoutBlob) publishCommunityLayout(db, identity, communityId, input.layoutBlob, recordChange);
      if (input.localLayoutDefault) setDeviceLayoutDefault(db, input.localLayoutDefault.profile, input.localLayoutDefault.choice);
      if (input.completeOnboarding) setSetting(db, 'onboarding_complete', '1');
      if (input.description || input.accent || input.themeBlob) {
        publishCommunityIdentity(
          db,
          identity,
          communityId,
          { description: input.description, accentColor: input.accent, themeBlob: input.themeBlob },
          recordChange,
        );
      }
    });
    return { ok: true, communityId, firstChannelId };
  } catch (error) {
    purgeLocalCommunity(db, communityId);
    return { ok: false, error: error instanceof Error ? error.message : 'Could not create the community.' };
  }
}
