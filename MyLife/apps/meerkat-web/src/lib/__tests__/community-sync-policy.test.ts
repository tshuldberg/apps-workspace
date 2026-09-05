/**
 * Plan 19 P0 (TC-1 / NC-1) permanent guard against the REAL shipped WEB policy.
 *
 * meerkat-data.ts holds the web copy of COMMUNITY_SYNC_POLICY (one of three copies
 * kept byte-aligned). This pins the security boundary on that real copy: only
 * cm_publications may reach published_blob, and cm_messages stays shared_workspace.
 */

import { describe, it, expect } from 'vitest';
import {
  COMMUNITY_SYNC_POLICY,
  CM_MESSAGES_TABLE,
  CM_PUBLIC_JOIN_REQUESTS_TABLE,
  MEERKAT_SYNC_PREFIXES,
} from '../meerkat-data';
import { COMMUNITY_DDL } from '../schema';

describe('web COMMUNITY_SYNC_POLICY public-scope boundary (Plan 19 P0)', () => {
  it('Wave-1 audit guard: every created cm_ table has an explicit sync rule + a fail-closed default', () => {
    const created = COMMUNITY_DDL
      .map((ddl) => ddl.match(/CREATE TABLE IF NOT EXISTS (cm_[a-z_]+)/)?.[1])
      .filter((t): t is string => Boolean(t));
    expect(created.length).toBeGreaterThanOrEqual(20);
    const ruled = new Set(COMMUNITY_SYNC_POLICY.entityRules.map((r) => r.tableName));
    const omitted = created.filter((t) => !ruled.has(t));
    expect(omitted).toEqual([]);
    // device_local default so a future omitted cm_ table fails closed (never leaks).
    expect(COMMUNITY_SYNC_POLICY.defaultScope).toBe('device_local');
    // The previously-web-omitted LOCAL-ONLY tables (incl. the web-vs-mobile drift) are
    // now explicitly device_local and never reach shared_workspace.
    const localOnly = ['cm_file_requests', 'cm_feed_cursor', 'cm_snapshots', 'cm_post_activity', 'cm_safety_actions', 'cm_publication_snapshots', 'cm_public_report_reviews', CM_PUBLIC_JOIN_REQUESTS_TABLE];
    for (const t of localOnly) {
      expect(COMMUNITY_SYNC_POLICY.entityRules.find((r) => r.tableName === t)?.maxScope).toBe('device_local');
    }
  });

  it('Plan 19 FF3: the owner local public-join review queue never escalates', () => {
    expect(COMMUNITY_SYNC_POLICY.entityRules).toContainEqual({
      tableName: CM_PUBLIC_JOIN_REQUESTS_TABLE,
      defaultScope: 'device_local',
      maxScope: 'device_local',
      conflictStrategy: 'lww',
    });
  });

  it('cm_publications is the ONLY published_blob entity', () => {
    expect(COMMUNITY_SYNC_POLICY.entityRules).toContainEqual({
      tableName: 'cm_publications',
      defaultScope: 'shared_workspace',
      maxScope: 'published_blob',
      conflictStrategy: 'lww',
    });
    const publishedBlobTables = COMMUNITY_SYNC_POLICY.entityRules
      .filter((r) => r.maxScope === 'published_blob')
      .map((r) => r.tableName);
    expect(publishedBlobTables).toEqual(['cm_publications']);
  });

  it('cm_messages stays capped at shared_workspace (NC-1 regression guard)', () => {
    const messagesRule = COMMUNITY_SYNC_POLICY.entityRules.find((r) => r.tableName === CM_MESSAGES_TABLE);
    expect(messagesRule?.maxScope).toBe('shared_workspace');
  });

  it('the cm_archive_* tables stay at or below personal_replica (Plan 19 P9 TC-9)', () => {
    const rules = COMMUNITY_SYNC_POLICY.entityRules;
    expect(rules).toContainEqual({
      tableName: 'cm_archive_jobs',
      defaultScope: 'device_local',
      maxScope: 'personal_replica',
      conflictStrategy: 'lww',
    });
    expect(rules).toContainEqual({
      tableName: 'cm_archive_moderation',
      defaultScope: 'device_local',
      maxScope: 'device_local',
      conflictStrategy: 'lww',
    });
    expect(rules).toContainEqual({
      tableName: 'cm_publication_rights',
      defaultScope: 'device_local',
      maxScope: 'device_local',
      conflictStrategy: 'lww',
    });
  });

  it('Plan 22 S0.8: hosted-storage keys never match a synced prefix (extends TC-8, web twin)', () => {
    const STORAGE_KEYS = [
      'storage_upload_manifest_json',
      'storage_upload_target',
      'storage_retention_pref',
      'storage_usage_snapshot_json',
      'storage_usage_fetched_at',
    ];
    const syncedPrefixes = Array.from(MEERKAT_SYNC_PREFIXES.values());
    for (const key of STORAGE_KEYS) {
      expect(syncedPrefixes.some((p) => key.startsWith(p))).toBe(false);
    }
  });
});
