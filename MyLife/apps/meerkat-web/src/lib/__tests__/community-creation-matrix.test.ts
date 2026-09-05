// Set 8 (2026-08-30, web twin of the mobile community-creation-matrix): the
// creation VARIATION MATRIX over the real web commit core. Per variation it
// asserts a coherent, verifiable community; that every table the variation
// RECORDS for replication carries an explicit COMMUNITY_SYNC_POLICY rule; the
// result-union honesty of commitCommunityTemplate (never a throw for a domain
// failure); degenerate names (invisible-only rejected, emoji/RTL/long/duplicate
// allowed and distinct); and the Set 8 purge fix: a failed creation leaves NO
// ghost sync_change_log rows for the purged epoch key wraps.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { OPEN_BURROW, encodeThemeBlob } from '@mylife/meerkat-theme';
import {
  ChangeTracker,
  communityLayout,
  configureSyncSecretStore,
  createInMemorySyncSecretStore,
  ensureSyncBootstrap,
  getCommunity,
  getWorkspaceEpoch,
  listCommunities,
  verifyDescriptorOwnerSignature,
  type DeviceIdentity,
} from '@mylife/sync';
import { ensureSyncSchema } from '../schema';
import { listLibraries } from '../library-store';
import { COMMUNITY_SYNC_POLICY, MEERKAT_SYNC_PREFIXES, MEERKAT_SYNC_POLICIES } from '../meerkat-data';
import { commitCommunityTemplate } from '../community-template-commit';
import {
  COMMUNITY_TEMPLATES,
  findCommunityTemplate,
  templateGenesisCategories,
  templateGenesisChannels,
  visibleCommunityName,
  type CommunityTemplate,
} from '../community-templates';

const RULED_TABLES = new Set(COMMUNITY_SYNC_POLICY.entityRules.map((r) => r.tableName));

let db: InMemoryTestDatabase;
let identity: DeviceIdentity;

beforeEach(() => {
  configureSyncSecretStore(createInMemorySyncSecretStore());
  db = createInMemoryTestDatabase();
  const boot = ensureSyncBootstrap(db.adapter);
  ensureSyncSchema(db.adapter);
  identity = boot.identity;
});

afterEach(() => db.close());

type RecordCall = { table: string; rowId: string };

function commit(
  template: CommunityTemplate,
  name: string,
  options: {
    themeBlob?: string | null;
    record?: (table: string, op: 'INSERT' | 'UPDATE' | 'DELETE', rowId: string) => void;
  } = {},
) {
  return commitCommunityTemplate(
    db.adapter,
    identity,
    {
      name,
      description: template.description || null,
      accent: template.accent,
      themeBlob: options.themeBlob !== undefined
        ? options.themeBlob
        : template.themePresetId
          ? encodeThemeBlob(OPEN_BURROW)
          : null,
      layout: template.layout,
      categories: templateGenesisCategories(template),
      chatChannels: templateGenesisChannels(template),
      libraries: template.libraries.map((l) => ({ name: l.name, mediaType: l.mediaType })),
    },
    options.record,
  );
}

describe('template variation matrix (web commit core)', () => {
  for (const template of COMMUNITY_TEMPLATES) {
    it(`${template.id} creates a coherent, verifiable community with ruled replication`, () => {
      const records: RecordCall[] = [];
      const result = commit(template, `W ${template.id}`, {
        record: (table, _op, rowId) => records.push({ table, rowId }),
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const stored = getCommunity(db.adapter, result.communityId);
      expect(stored).not.toBeNull();
      expect(verifyDescriptorOwnerSignature({ descriptor: stored!.descriptor, signature: stored!.signature })).toBe(true);
      expect(stored!.myRole).toBe('owner');
      expect(communityLayout(stored!.descriptor)).toBe(template.layout);
      expect(result.firstChannelId).toBe(template.chatChannels[0]!.id);

      // One signed revision per provisioned library on top of the genesis.
      expect(stored!.descriptor.revision).toBe(1 + template.libraries.length);
      expect(stored!.descriptor.channels.filter((c) => c.kind === 'library')).toHaveLength(template.libraries.length);
      expect(listLibraries(db.adapter, result.communityId)).toHaveLength(template.libraries.length);

      // Zero-member honesty: owner-only roster, one real minted epoch.
      expect(stored!.descriptor.members).toHaveLength(1);
      expect(getWorkspaceEpoch(db.adapter, result.communityId)).toBe(1);

      // Every recorded cm_ table has an explicit sync rule; the epoch wraps
      // ride their own sync_workspace_keys policy.
      for (const { table } of records) {
        if (table.startsWith('cm_')) expect(RULED_TABLES.has(table)).toBe(true);
        else expect(table).toBe('sync_workspace_keys');
      }
      const recorded = new Set(records.map((r) => r.table));
      if (template.libraries.length > 0) expect(recorded.has('cm_libraries')).toBe(true);
      const seeds = Boolean(template.description || template.accent || template.themePresetId);
      if (seeds) expect(recorded.has('cm_community_identity')).toBe(true);
    });
  }
});

describe('degenerate names (web)', () => {
  it('rejects an invisible-only (zero-width) name as a result union, with zero rows', () => {
    const blank = findCommunityTemplate('blank')!;
    const result = commit(blank, '\u200b\u200b\u200d');
    expect(result).toEqual({ ok: false, error: 'Give the community a name.' });
    expect(db.adapter.query<{ n: number }>('SELECT COUNT(*) AS n FROM sync_communities')[0]!.n).toBe(0);
  });

  it('visibleCommunityName strips invisibles but keeps real text (incl. RTL) intact', () => {
    expect(visibleCommunityName('\u200b \ufeff\u202e ')).toBe('');
    // The classic invisible-name fillers beyond zero-width: hangul fillers,
    // variation selectors, soft hyphen, braille blank, and the astral tag block.
    expect(visibleCommunityName('\u3164\u3164')).toBe('');
    expect(visibleCommunityName('\ufe0f\ufe0e')).toBe('');
    expect(visibleCommunityName('\u00ad\u034f\u2800\uffa0')).toBe('');
    expect(visibleCommunityName('\u{e0041}\u{e0042}')).toBe('');
    // Real emoji keep their base code points (ZWJ sequences and VS16 pass).
    expect(visibleCommunityName('\u2764\ufe0f').length).toBeGreaterThan(0);
    expect(visibleCommunityName('👨\u200d👩\u200d👧').length).toBeGreaterThan(0);
    expect(visibleCommunityName('My\u200bTeam')).toBe('MyTeam');
    expect(visibleCommunityName('🦫 Burrow')).toBe('🦫 Burrow');
  });

  it('emoji, RTL, long, and duplicate names create distinct coherent communities', () => {
    const blank = findCommunityTemplate('blank')!;
    const names = ['🦫🦫', 'مجتمع العائلة', `L${'o'.repeat(400)}ng`, 'Twins', 'Twins'];
    const ids = names.map((name) => {
      const result = commit(blank, name);
      expect(result.ok).toBe(true);
      return result.ok ? result.communityId : '';
    });
    expect(new Set(ids).size).toBe(names.length);
    expect(listCommunities(db.adapter)).toHaveLength(names.length);
  });
});

describe('purge-on-failure leaves no ghost change-log rows (Set 8 fix, web)', () => {
  it('a failed creation purges the epoch key-wrap records the self-transacted mint committed', () => {
    const media = findCommunityTemplate('media')!;
    // The REAL tracker (it persists into sync_change_log; a spy would make the
    // ghost-row assertion vacuous), with the failure injected around it.
    const tracker = new ChangeTracker({
      db: db.adapter,
      deviceId: identity.publicKey,
      modulePrefixes: MEERKAT_SYNC_PREFIXES,
      modulePolicies: MEERKAT_SYNC_POLICIES,
    });
    const keyWrapRowIds: string[] = [];
    const result = commit(media, 'Doomed', {
      record: (table, op, rowId) => {
        tracker.recordChange(table, op, rowId, null);
        if (table === 'sync_workspace_keys') keyWrapRowIds.push(rowId);
        if (table === 'cm_community_identity') throw new Error('injected mid-commit failure');
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('injected mid-commit failure');

    expect(keyWrapRowIds.length).toBeGreaterThan(0);
    const workspaceId = keyWrapRowIds[0]!.split(':')[0]!;
    expect(
      db.adapter.query<{ n: number }>(
        `SELECT COUNT(*) AS n FROM sync_change_log WHERE table_name = 'sync_workspace_keys' AND row_id LIKE ?`,
        [`${workspaceId}:%`],
      )[0]!.n,
    ).toBe(0);
    expect(
      db.adapter.query<{ n: number }>('SELECT COUNT(*) AS n FROM sync_workspace_keys WHERE workspace_id = ?', [workspaceId])[0]!.n,
    ).toBe(0);
    expect(db.adapter.query<{ n: number }>('SELECT COUNT(*) AS n FROM sync_communities')[0]!.n).toBe(0);
    expect(db.adapter.query<{ n: number }>('SELECT COUNT(*) AS n FROM cm_libraries')[0]!.n).toBe(0);
  });

  it('positive control: a SUCCESSFUL creation leaves its key-wrap change records in the log', () => {
    const media = findCommunityTemplate('media')!;
    const tracker = new ChangeTracker({
      db: db.adapter,
      deviceId: identity.publicKey,
      modulePrefixes: MEERKAT_SYNC_PREFIXES,
      modulePolicies: MEERKAT_SYNC_POLICIES,
    });
    const result = commit(media, 'Alive', {
      record: (table, op, rowId) => tracker.recordChange(table, op, rowId, null),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      db.adapter.query<{ n: number }>(
        `SELECT COUNT(*) AS n FROM sync_change_log WHERE table_name = 'sync_workspace_keys' AND row_id LIKE ?`,
        [`${result.communityId}:%`],
      )[0]!.n,
    ).toBeGreaterThan(0);
  });
});
