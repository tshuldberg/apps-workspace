/**
 * Module-config drift guard for the multi-node QA harness (Task 5).
 *
 * The harness redeclares the Meerkat sync prefixes + policies (meerkatpad/mp_ and
 * community/cm_) so it can drive the engine under Node. If the app's real config
 * drifts from the harness copy, the harness would silently prove a config the app
 * no longer ships. This guard pins the harness copy against the documented
 * source-of-truth values.
 *
 * WHY NOT A LIVE IMPORT of apps/meerkat/.../data/sync-core.ts:
 *   The design asked for a guard that imports MEERKAT_SYNC_PREFIXES /
 *   MEERKAT_SYNC_POLICIES from the app and deep-equals the harness copy. Two facts
 *   determined the final shape (both verified, not assumed):
 *     1. sync-core.ts + community-core.ts are Node-SAFE -- they import only
 *        @mylife/db (type-only DatabaseAdapter) and @mylife/sync (resolved via
 *        "main" in tests), with NO expo / react-native imports. So native modules
 *        are NOT the blocker.
 *     2. The relay tsconfig pins `rootDir: ./src`. Importing any file under
 *        apps/meerkat (outside ./src) fails `tsc --noEmit` with TS6059
 *        ("File is not under 'rootDir'"). Verified by probe.
 *   Forcing the live import would break the relay typecheck gate, which guardrail
 *   #5 explicitly forbids. So this guard is the lighter honest check it permits:
 *   it asserts the harness config deep-equals the documented literal values and
 *   cites the exact source lines. Keep these in lockstep with the app: if you
 *   change sync-core.ts / community-core.ts, update the harness AND this guard.
 */

import { describe, expect, it } from 'vitest';
import type { ModuleSyncPolicy } from '@mylife/module-registry/types';
import {
  HARNESS_COMMUNITY_MODULE_ID,
  HARNESS_COMMUNITY_PREFIX,
  HARNESS_COMMUNITY_SYNC_POLICY,
  HARNESS_KEYS_SYNC_POLICY,
  HARNESS_MEERKAT_KEYS_MODULE_ID,
  HARNESS_MEERKAT_SYNC_MODULE_ID,
  HARNESS_MEERKAT_SYNC_PREFIXES,
  HARNESS_MEERKAT_SYNC_POLICIES,
} from './support/multi-node-harness';

// ---------------------------------------------------------------------------
// Documented source-of-truth (transcribed verbatim from the app):
//   apps/meerkat/app/(root)/data/sync-core.ts
//     - MEERKAT_SYNC_MODULE_ID (line 31)
//     - MEERKAT_SYNC_PREFIXES  (lines 34-37)
//     - MEERKAT_SYNC_POLICIES  (lines 39-51)
//   apps/meerkat/app/(root)/data/community-core.ts
//     - COMMUNITY_MODULE_ID    (line 17)
//     - COMMUNITY_PREFIX       (line 18)
//     - COMMUNITY_SYNC_POLICY  (lines 23-52)
// ---------------------------------------------------------------------------

const SOURCE_MEERKAT_SYNC_MODULE_ID = 'meerkatpad';
const SOURCE_COMMUNITY_MODULE_ID = 'community';
const SOURCE_COMMUNITY_PREFIX = 'cm_';
const SOURCE_MEERKAT_KEYS_MODULE_ID = 'communitykeys';

const SOURCE_MEERKAT_SYNC_PREFIXES = new Map<string, string>([
  [SOURCE_MEERKAT_SYNC_MODULE_ID, 'mp_'],
  [SOURCE_COMMUNITY_MODULE_ID, SOURCE_COMMUNITY_PREFIX],
  [SOURCE_MEERKAT_KEYS_MODULE_ID, 'sync_workspace_keys'],
]);

const SOURCE_COMMUNITY_SYNC_POLICY: ModuleSyncPolicy = {
  defaultScope: 'shared_workspace',
  shareable: true,
  entityRules: [
    { tableName: 'cm_messages', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'or_set' },
    { tableName: 'cm_message_attachments', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'lww' },
    { tableName: 'cm_reactions', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'or_set' },
    { tableName: 'cm_profiles', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'or_set' },
    { tableName: 'cm_posts', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'lww' },
    { tableName: 'cm_post_tags', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'or_set' },
    { tableName: 'cm_post_lifecycle', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'lww' },
    { tableName: 'cm_read_state', defaultScope: 'personal_replica', maxScope: 'personal_replica', conflictStrategy: 'lww' },
    // Plan 19 (Public Social Layer) P0: cm_publications is the ONLY community-family
    // entity that may reach published_blob. cm_messages stays shared_workspace.
    { tableName: 'cm_publications', defaultScope: 'shared_workspace', maxScope: 'published_blob', conflictStrategy: 'lww' },
    { tableName: 'cm_public_reports', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'or_set' },
    { tableName: 'cm_public_directory_cache', defaultScope: 'device_local', maxScope: 'device_local', conflictStrategy: 'lww' },
    { tableName: 'cm_public_feed_cursor', defaultScope: 'device_local', maxScope: 'device_local', conflictStrategy: 'lww' },
  ],
};

const SOURCE_KEYS_SYNC_POLICY: ModuleSyncPolicy = {
  defaultScope: 'shared_workspace',
  shareable: true,
  entityRules: [
    { tableName: 'sync_workspace_keys', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'lww' },
  ],
};

const SOURCE_MEERKAT_SYNC_POLICIES = new Map<string, ModuleSyncPolicy>([
  [
    SOURCE_MEERKAT_SYNC_MODULE_ID,
    {
      defaultScope: 'personal_replica',
      shareable: true,
      entityRules: [
        { tableName: 'mp_pad', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
      ],
    },
  ],
  [SOURCE_COMMUNITY_MODULE_ID, SOURCE_COMMUNITY_SYNC_POLICY],
  [SOURCE_MEERKAT_KEYS_MODULE_ID, SOURCE_KEYS_SYNC_POLICY],
]);

describe('multi-node harness module-config drift guard (Task 5)', () => {
  it('harness module ids + prefix match the documented app source', () => {
    expect(HARNESS_MEERKAT_SYNC_MODULE_ID).toBe(SOURCE_MEERKAT_SYNC_MODULE_ID);
    expect(HARNESS_COMMUNITY_MODULE_ID).toBe(SOURCE_COMMUNITY_MODULE_ID);
    expect(HARNESS_COMMUNITY_PREFIX).toBe(SOURCE_COMMUNITY_PREFIX);
    expect(HARNESS_MEERKAT_KEYS_MODULE_ID).toBe(SOURCE_MEERKAT_KEYS_MODULE_ID);
  });

  it('harness key-wrap policy deep-equals the documented KEYS_SYNC_POLICY', () => {
    expect(HARNESS_KEYS_SYNC_POLICY).toEqual(SOURCE_KEYS_SYNC_POLICY);
  });

  it('harness prefixes deep-equal the documented MEERKAT_SYNC_PREFIXES', () => {
    expect([...HARNESS_MEERKAT_SYNC_PREFIXES.entries()].sort()).toEqual(
      [...SOURCE_MEERKAT_SYNC_PREFIXES.entries()].sort(),
    );
  });

  it('harness community policy deep-equals the documented COMMUNITY_SYNC_POLICY', () => {
    expect(HARNESS_COMMUNITY_SYNC_POLICY).toEqual(SOURCE_COMMUNITY_SYNC_POLICY);
  });

  it('harness policies deep-equal the documented MEERKAT_SYNC_POLICIES', () => {
    expect(mapToObject(HARNESS_MEERKAT_SYNC_POLICIES)).toEqual(mapToObject(SOURCE_MEERKAT_SYNC_POLICIES));
  });
});

function mapToObject(map: Map<string, ModuleSyncPolicy>): Record<string, ModuleSyncPolicy> {
  const out: Record<string, ModuleSyncPolicy> = {};
  for (const [key, value] of map.entries()) out[key] = value;
  return out;
}
