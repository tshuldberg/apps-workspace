/**
 * Plan 19 (Meerkat Public Social Layer) P0 -- public-scope inbound policy.
 *
 * TC-1: cm_publications is the ONLY community-family entity that may reach
 *   published_blob. cm_messages stays capped at shared_workspace.
 * NC-1: nothing here lets a private cm_messages row escalate to published_blob;
 *   a cm_messages row claiming published_blob is REJECTED (scope_exceeds_cap).
 *
 * This drives the REAL resolution path -- ChangeTracker.resolveModule +
 * resolveEntityRule + the production cap derivation (sync-session computeModuleScopeCap)
 * + evaluateInboundChange -- so it is NOT a bypass. The community prefix is 'cm_';
 * a 'cp_' table would resolve to null and be rejected as unknown_table BEFORE the
 * scope cap is ever consulted (which is why the publication tables keep the cm_
 * prefix). The policy literal is transcribed from the three COMMUNITY_SYNC_POLICY
 * copies (the sync package cannot import the app config across the tsconfig rootDir
 * boundary); apps/meerkat/app/__tests__/community-core.test.ts pins the SAME caps
 * against the real shipped config.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import type { ModuleSyncPolicy } from '@mylife/module-registry/types';
import { SYNC_SCOPE_RANK, type SyncScope } from '../types';
import { ChangeTracker } from '../crdt/change-tracker';
import {
  evaluateInboundChange,
  type InboundChangeFacts,
  type InboundSessionAuth,
} from '../protocol/inbound-policy';

const COMMUNITY_MODULE_ID = 'community';
const COMMUNITY_PREFIX = 'cm_';

// Transcribed from COMMUNITY_SYNC_POLICY (community-core.ts / meerkat-data.ts /
// multi-node-harness.ts). cm_publications is the only entity allowed published_blob.
const COMMUNITY_SYNC_POLICY: ModuleSyncPolicy = {
  defaultScope: 'shared_workspace',
  shareable: true,
  entityRules: [
    { tableName: 'cm_messages', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'or_set' },
    { tableName: 'cm_publications', defaultScope: 'shared_workspace', maxScope: 'published_blob', conflictStrategy: 'lww' },
    { tableName: 'cm_public_reports', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'or_set' },
    { tableName: 'cm_public_directory_cache', defaultScope: 'device_local', maxScope: 'device_local', conflictStrategy: 'lww' },
    { tableName: 'cm_public_feed_cursor', defaultScope: 'device_local', maxScope: 'device_local', conflictStrategy: 'lww' },
  ],
};

// Real shipped prefix map (transcribed from sync-core.ts MEERKAT_SYNC_PREFIXES).
const PREFIXES = new Map<string, string>([
  ['meerkatpad', 'mp_'],
  [COMMUNITY_MODULE_ID, COMMUNITY_PREFIX],
  ['communitykeys', 'sync_workspace_keys'],
]);

const publishedSession: InboundSessionAuth = {
  peerRevoked: false,
  peerAuthorized: true,
  sessionScope: 'published_blob',
  sasVerified: true,
};

/** Mirror of sync-session.ts computeModuleScopeCap, driven by the real tracker. */
function computeCap(tracker: ChangeTracker, moduleId: string, table: string): SyncScope {
  const rule = tracker.resolveEntityRule(moduleId, table, COMMUNITY_SYNC_POLICY);
  const base = rule?.defaultScope ?? COMMUNITY_SYNC_POLICY.defaultScope;
  let cap: SyncScope = rule?.maxScope ?? base;
  if (!COMMUNITY_SYNC_POLICY.shareable && SYNC_SCOPE_RANK[cap] > SYNC_SCOPE_RANK.personal_replica) {
    cap = 'personal_replica';
  }
  return cap;
}

describe('Plan 19 P0 public-scope inbound policy (TC-1 / NC-1)', () => {
  let db: InMemoryTestDatabase;
  let tracker: ChangeTracker;

  beforeEach(() => {
    db = createInMemoryTestDatabase();
    tracker = new ChangeTracker({
      db: db.adapter,
      deviceId: 'device-local',
      modulePrefixes: PREFIXES,
      modulePolicies: new Map([[COMMUNITY_MODULE_ID, COMMUNITY_SYNC_POLICY]]),
    });
  });
  afterEach(() => { db.close(); });

  /** Build inbound facts from the REAL resolver, never hardcoded. */
  function realFacts(table: string): InboundChangeFacts {
    const resolvedModuleId = tracker.resolveModule(table);
    return {
      operation: 'INSERT',
      claimedModuleId: COMMUNITY_MODULE_ID,
      resolvedModuleId,
      moduleEnabled: true,
      moduleScopeCap: resolvedModuleId ? computeCap(tracker, resolvedModuleId, table) : null,
      moduleIsSensitive: false,
      moduleRequiresSasForShare: COMMUNITY_SYNC_POLICY.requiresSasForShare ?? false,
      incomingUpdatedAt: '2026-06-28T00:00:00.000Z',
      tombstoneDeletedAt: null,
    };
  }

  it('resolves cm_publications to the community module with a published_blob cap', () => {
    expect(tracker.resolveModule('cm_publications')).toBe(COMMUNITY_MODULE_ID);
    const rule = tracker.resolveEntityRule(COMMUNITY_MODULE_ID, 'cm_publications', COMMUNITY_SYNC_POLICY);
    expect(rule?.maxScope).toBe('published_blob');
  });

  it('accepts a cm_publications row at published_blob (the only public-eligible entity)', () => {
    const facts = realFacts('cm_publications');
    expect(facts.resolvedModuleId).toBe(COMMUNITY_MODULE_ID); // real resolution, not hardcoded
    expect(facts.moduleScopeCap).toBe('published_blob');
    expect(evaluateInboundChange(publishedSession, facts)).toEqual({ allowed: true });
  });

  it('REJECTS a cm_messages row claiming published_blob (scope exceeds its shared_workspace cap)', () => {
    const facts = realFacts('cm_messages');
    expect(facts.resolvedModuleId).toBe(COMMUNITY_MODULE_ID);
    expect(facts.moduleScopeCap).toBe('shared_workspace'); // fails if cm_messages were raised to published_blob
    expect(evaluateInboundChange(publishedSession, facts))
      .toEqual({ allowed: false, reason: 'scope_exceeds_cap' });
  });

  it('keeps the device-local public caches off the wire entirely', () => {
    for (const table of ['cm_public_directory_cache', 'cm_public_feed_cursor']) {
      const facts = realFacts(table);
      expect(facts.resolvedModuleId).toBe(COMMUNITY_MODULE_ID);
      expect(facts.moduleScopeCap).toBe('device_local');
      expect(evaluateInboundChange(publishedSession, facts))
        .toEqual({ allowed: false, reason: 'scope_device_local' });
    }
  });

  it('a cp_-prefixed publications table would NOT resolve (this is why we use cm_)', () => {
    // Documents the FIX 1 root cause: cp_ does not start with any registered prefix,
    // so it resolves to null and is rejected as unknown_table before the scope cap.
    expect(tracker.resolveModule('cp_publications')).toBeNull();
    const facts = realFacts('cp_publications');
    expect(facts.resolvedModuleId).toBeNull();
    expect(evaluateInboundChange(publishedSession, facts))
      .toEqual({ allowed: false, reason: 'unknown_table' });
  });
});
