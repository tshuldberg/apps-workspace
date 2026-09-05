import { setDeviceLayoutDefault, type LayoutDeviceClass, type DeviceLayoutChoice } from './device-layout-core';
// Plan 38 Phase 7 (amendment C.1): the MOBILE all-or-nothing commit for a
// community created from a template. The preset data + the pure genesis helpers
// live in community-templates.ts (the twin); this module owns the on-device
// write, which is deliberately mobile-only (it reaches storeOwnedCommunity,
// createLibrary, and publishCommunityIdentity).
//
// All-or-nothing: the genesis descriptor is SIGNED first (pure), then persisted.
// storeOwnedCommunity mints the workspace epoch inside its OWN transaction, so it
// cannot be nested inside another transaction on expo-sqlite (BEGIN-inside-BEGIN
// throws); the library provisioning + identity publish then commit in ONE
// transaction right after. On ANY failure, purgeLocalCommunity removes every row
// this creation wrote, so a half-made community never persists and the caller
// shows an honest error.

import type { DatabaseAdapter } from '@mylife/db';
import {
  createCommunity,
  type DeviceIdentity,
  type CommunityChannel,
  type RecordKeyWrapChange,
} from '@mylife/sync';
import { setSetting, ONBOARDING_COMPLETE_KEY } from './db';
import { encodeThemeBlob, getPreset } from '@mylife/meerkat-theme';
import {
  CM_COMMUNITY_IDENTITY_TABLE,
  CM_LIBRARIES_TABLE,
  CM_LAYOUT_TABLE,
  publishCommunityLayout,
  publishCommunityIdentity,
  storeOwnedCommunity,
} from './community-core';
import { createLibrary } from './library-store-core';
import {
  templateGenesisCategories,
  templateGenesisChannels,
  visibleCommunityName,
  type CommunityTemplate,
} from './community-templates';

export interface CreateCommunityFromTemplateArgs {
  name: string;
  template: CommunityTemplate;
  /**
   * The 'Use my current theme' option: the caller's exported current theme blob.
   * When set it wins over the preset's themePresetId. null/undefined = no adopt.
   */
  adoptThemeBlob?: string | null;
  genesisChannels?: CommunityChannel[];
  layoutBlob?: string | null;
  completeOnboarding?: boolean;
  localLayoutDefault?: { profile: LayoutDeviceClass; choice: DeviceLayoutChoice };
}

/** Resolve the theme blob to seal into the identity row (adopt > preset > none). */
function resolveThemeBlob(template: CommunityTemplate, adoptThemeBlob?: string | null): string | null {
  if (adoptThemeBlob) return adoptThemeBlob;
  if (template.themePresetId) {
    const preset = getPreset(template.themePresetId);
    if (preset) return encodeThemeBlob(preset);
  }
  return null;
}

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

/**
 * Create a community from a template, staged locally and committed once. Returns
 * the new community id. Throws (after a full purge) on any failure so the caller
 * can surface an honest error and NOTHING persists.
 */
export function createCommunityFromTemplate(
  db: DatabaseAdapter,
  owner: DeviceIdentity,
  args: CreateCommunityFromTemplateArgs,
  recordChange?: RecordKeyWrapChange,
): { communityId: string } {
  const name = args.name.trim();
  // A name whose VISIBLE form is empty (only zero-width/control characters)
  // would create a community that renders as a blank card everywhere.
  if (!name || !visibleCommunityName(name)) throw new Error('Enter a community name.');
  const { template } = args;

  const now = new Date().toISOString();
  const categories = templateGenesisCategories(template);

  // 1) Sign the genesis descriptor (chat channels + categories + layout) -- pure.
  const signed = createCommunity(owner, {
    name,
    channels: args.genesisChannels ?? templateGenesisChannels(template),
    ...(categories.length ? { categories } : {}),
    layout: template.layout,
    now,
  });
  const communityId = signed.descriptor.communityId;

  const themeBlob = resolveThemeBlob(template, args.adoptThemeBlob);
  const seedsIdentity = Boolean(template.description || template.accent || themeBlob);

  // 2) Commit. storeOwnedCommunity self-transacts (epoch), so it runs first and
  //    the library provisioning + identity publish go in ONE transaction after
  //    it. Each createLibrary appends its kind:'library' channel via a signed
  //    revision AND writes the owner-signed cm_libraries row. Any failure purges.
  try {
    storeOwnedCommunity(db, owner, signed, now, recordChange);
    db.transaction(() => {
      for (const library of template.libraries) {
        createLibrary(
          db,
          owner,
          { workspaceId: communityId, name: library.name, mediaType: library.mediaType },
          { recordChange, now },
        );
      }
      if (args.layoutBlob) publishCommunityLayout(db, owner, communityId, args.layoutBlob, recordChange);
      if (args.localLayoutDefault) setDeviceLayoutDefault(db, args.localLayoutDefault.profile, args.localLayoutDefault.choice);
      if (args.completeOnboarding) setSetting(db, ONBOARDING_COMPLETE_KEY, '1');
      if (seedsIdentity) {
        publishCommunityIdentity(
          db,
          owner,
          communityId,
          {
            description: template.description || null,
            accentColor: template.accent,
            themeBlob,
          },
          recordChange,
        );
      }
    });
  } catch (err) {
    purgeLocalCommunity(db, communityId);
    throw err instanceof Error ? err : new Error('Could not create the community from this template.');
  }

  return { communityId };
}
