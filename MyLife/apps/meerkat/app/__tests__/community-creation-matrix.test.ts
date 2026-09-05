// Set 8 (2026-08-30): the community-CREATION VARIATION MATRIX. Not a single
// happy path: creation is exercised varied across every option the product
// offers, through the REAL creation cores (createCommunityFromTemplate over
// community-template-commit.ts), asserting per variation that the result is a
// coherent, honest, fully verifiable community:
//
//   - descriptor validity + owner signature verification (verifyCommunityDescriptor);
//   - channel composition (chat genesis channels with kind+order, library
//     channels appended one signed revision each, revision arithmetic);
//   - sync entityRule coverage: every table the variation RECORDS for
//     replication has an explicit COMMUNITY_SYNC_POLICY rule (an omitted cm_
//     table fails closed via the device_local default -- recording one would be
//     a silent replication bug);
//   - identity + retheme: owner-signed cm_community_identity rows resolve
//     through resolveActiveTheme (community_theme < high contrast / 'mine');
//   - zero-member honesty: a fresh community is owner-only with a real epoch,
//     never a fabricated member/peer count;
//   - invites minted at creation time round-trip previewInvite over the
//     org-extended (Plan 38 conditional canonical slot) descriptor;
//   - archived-at-creation vs archived-later, one-revision-per-save;
//   - degenerate inputs: empty / invisible-only (zero-width) / emoji / RTL /
//     very long / duplicate names, rapid sequential creates;
//   - purge-on-failure hygiene: a failed creation leaves NO ghost
//     sync_change_log rows for the purged epoch key wraps (Set 8 fix).

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { OPEN_BURROW, encodeThemeBlob, resolveProfile, type MkColors } from '@mylife/meerkat-theme';
import {
  ChangeTracker,
  communityLayout,
  configureSyncSecretStore,
  createCommunity,
  createCommunityInvite,
  createInMemorySyncSecretStore,
  ensureShareIntakeTables,
  ensureSyncBootstrap,
  getCommunity,
  getWorkspaceEpoch,
  listCommunities,
  reviseCommunity,
  upsertCommunity,
  verifyCommunityDescriptor,
  verifyDescriptorOwnerSignature,
  type DeviceIdentity,
} from '@mylife/sync';
import {
  COMMUNITY_SYNC_POLICY,
  ensureCommunityTables,
  getCommunityIdentity,
} from '../(root)/data/community-core';
import { MEERKAT_SYNC_PREFIXES, MEERKAT_SYNC_POLICIES } from '../(root)/data/sync-core';
import { ensureMeerkatTables } from '../(root)/data/db';
import { createCommunityFromTemplate } from '../(root)/data/community-template-commit';
import {
  COMMUNITY_TEMPLATES,
  findCommunityTemplate,
  visibleCommunityName,
} from '../(root)/data/community-templates';
import { listLibraries } from '../(root)/data/library-store-core';
import {
  addCategoryToDraft,
  buildOrganizationChanges,
  deleteCategoryFromDraft,
  draftFromDescriptor,
  groupChannelsForDisplay,
  setChannelArchivedInDraft,
} from '../(root)/data/community-org-core';
import { previewInvite } from '../(root)/data/join-flow';
import { resolveActiveTheme } from '../(root)/data/community-theme-core';

const BASE: MkColors = resolveProfile(OPEN_BURROW, 'light');
const RULED_TABLES = new Set(COMMUNITY_SYNC_POLICY.entityRules.map((r) => r.tableName));

let db: InMemoryTestDatabase;
let identity: DeviceIdentity;

beforeEach(() => {
  configureSyncSecretStore(createInMemorySyncSecretStore());
  db = createInMemoryTestDatabase();
  const boot = ensureSyncBootstrap(db.adapter);
  ensureMeerkatTables(db.adapter);
  ensureCommunityTables(db.adapter);
  ensureShareIntakeTables(db.adapter);
  identity = boot.identity;
});

afterEach(() => db.close());

/** A recordChange spy that captures every (table, rowId) the creation records. */
function recorder() {
  const records: Array<{ table: string; rowId: string }> = [];
  const record = (table: string, _op: string, rowId: string) => {
    records.push({ table, rowId });
  };
  return { records, record };
}

describe('template x theme-adoption variation matrix', () => {
  const adoptBlob = encodeThemeBlob(OPEN_BURROW);

  for (const template of COMMUNITY_TEMPLATES) {
    for (const adopt of [false, true]) {
      it(`${template.id} (adopt theme: ${adopt}) creates a coherent, verifiable community`, () => {
        const rec = recorder();
        const { communityId } = createCommunityFromTemplate(
          db.adapter,
          identity,
          { name: `M ${template.id} ${adopt}`, template, adoptThemeBlob: adopt ? adoptBlob : null },
          rec.record,
        );

        // Descriptor: stored, owner-signed, and cryptographically valid. The
        // stored head may be revision 1 + libraries, so the standalone check is
        // the owner-signature verify (the same cold-start posture nodes use).
        const stored = getCommunity(db.adapter, communityId);
        expect(stored).not.toBeNull();
        expect(verifyDescriptorOwnerSignature({ descriptor: stored!.descriptor, signature: stored!.signature })).toBe(true);
        expect(stored!.myRole).toBe('owner');
        expect(communityLayout(stored!.descriptor)).toBe(template.layout);

        // Channel composition: template chat channels with kind + positional
        // order, then one kind:'library' channel per template library, each
        // appended as its own signed revision (revision arithmetic locks it).
        const chat = stored!.descriptor.channels.filter((c) => (c.kind ?? 'chat') === 'chat');
        expect(chat.map((c) => ({ id: c.id, name: c.name, order: c.order }))).toEqual(
          template.chatChannels.map((c, i) => ({ id: c.id, name: c.name, order: i })),
        );
        const libraryChannels = stored!.descriptor.channels.filter((c) => c.kind === 'library');
        expect(libraryChannels).toHaveLength(template.libraries.length);
        expect(stored!.descriptor.revision).toBe(1 + template.libraries.length);

        // Verified library config rows, media types intact.
        const libraries = listLibraries(db.adapter, communityId);
        expect(libraries).toHaveLength(template.libraries.length);
        expect(libraries.map((l) => l.mediaType).sort()).toEqual(
          template.libraries.map((l) => l.mediaType).sort(),
        );

        // Zero-member honesty: owner-only roster, one real minted epoch.
        expect(stored!.descriptor.members).toHaveLength(1);
        expect(stored!.descriptor.members[0]!.deviceId).toBe(identity.publicKey);
        expect(getWorkspaceEpoch(db.adapter, communityId)).toBe(1);

        // Identity + retheme: seeded templates resolve to the community theme;
        // the blank template with no adopted blob seeds NOTHING.
        const ident = getCommunityIdentity(db.adapter, communityId);
        const seeds = Boolean(template.description || template.accent || template.themePresetId || adopt);
        if (!seeds) {
          expect(ident).toBeNull();
          expect(
            db.adapter.query<{ n: number }>(
              'SELECT COUNT(*) AS n FROM cm_community_identity WHERE community_id = ?',
              [communityId],
            )[0]!.n,
          ).toBe(0);
        } else {
          expect(ident).not.toBeNull();
          expect(ident!.description ?? null).toBe(template.description || null);
          expect(ident!.accentColor ?? null).toBe(template.accent);
          if (adopt) expect(ident!.themeBlob).toBe(adoptBlob);
          const resolved = resolveActiveTheme({
            communityThemeBlob: ident!.themeBlob ?? null,
            communityAccent: ident!.accentColor ?? null,
            memberMode: 'community',
            highContrastEnabled: false,
            mode: 'light',
            baseTheme: BASE,
          });
          expect(['community_theme', 'community_accent']).toContain(resolved.source);
          // High contrast and member 'mine' ALWAYS win back to the base theme.
          for (const override of [
            { highContrastEnabled: true, memberMode: 'community' as const, source: 'high_contrast' },
            { highContrastEnabled: false, memberMode: 'mine' as const, source: 'mine' },
          ]) {
            const r = resolveActiveTheme({
              communityThemeBlob: ident!.themeBlob ?? null,
              communityAccent: ident!.accentColor ?? null,
              memberMode: override.memberMode,
              highContrastEnabled: override.highContrastEnabled,
              mode: 'light',
              baseTheme: BASE,
            });
            expect(r.source).toBe(override.source);
            expect(r.theme).toEqual(BASE);
          }
        }

        // entityRule coverage: every cm_ table this variation RECORDS for
        // replication has an explicit rule (device_local default means an
        // omitted table would silently never replicate -- recording one is a
        // bug either way). sync_workspace_keys rides its own KEYS policy.
        for (const { table } of rec.records) {
          if (table.startsWith('cm_')) expect(RULED_TABLES.has(table)).toBe(true);
          else expect(table).toBe('sync_workspace_keys');
        }
        // Seeded identity + libraries actually recorded for replication.
        const recorded = new Set(rec.records.map((r) => r.table));
        if (template.libraries.length > 0) expect(recorded.has('cm_libraries')).toBe(true);
        if (seeds) expect(recorded.has('cm_community_identity')).toBe(true);
      });
    }
  }
});

describe('invite minted at creation time (org-extended descriptor)', () => {
  it('round-trips previewInvite over a fresh family community (categories/layout/library channels)', () => {
    const family = findCommunityTemplate('family')!;
    const { communityId } = createCommunityFromTemplate(db.adapter, identity, { name: 'Us', template: family });
    const stored = getCommunity(db.adapter, communityId)!;
    const { link } = createCommunityInvite(identity, { descriptor: stored.descriptor, signature: stored.signature });
    const preview = previewInvite(link);
    expect(preview.ok).toBe(true);
    if (preview.ok) {
      expect(preview.name).toBe('Us');
      expect(preview.memberCount).toBe(1);
      expect(preview.channelCount).toBe(stored.descriptor.channels.length);
      expect(preview.inviterRole).toBe('owner');
    }
  });
});

describe('archived channels: at creation and later, one revision per save', () => {
  it('a genesis descriptor with an archived channel signs, verifies, and hides it from display', () => {
    const signed = createCommunity(identity, {
      name: 'Pre-archived',
      channels: [
        { id: 'general', name: 'General', kind: 'chat', order: 0 },
        { id: 'old', name: 'Old', kind: 'chat', order: 1, archived: true },
      ],
    });
    expect(verifyCommunityDescriptor(signed)).toBe(true);
    const display = groupChannelsForDisplay(signed.descriptor);
    expect(display.groups.flatMap((g) => g.channels.map((c) => c.id))).toEqual(['general']);
    expect(display.archived.map((c) => c.id)).toEqual(['old']);
  });

  it('archive-later folds into ONE signed revision and the chain verifies', () => {
    const club = findCommunityTemplate('club')!;
    const { communityId } = createCommunityFromTemplate(db.adapter, identity, { name: 'Club', template: club });
    const stored = getCommunity(db.adapter, communityId)!;
    const before = stored.descriptor.revision;

    const draft = setChannelArchivedInDraft(draftFromDescriptor(stored.descriptor), 'events', true);
    const revised = reviseCommunity(
      identity,
      { descriptor: stored.descriptor, signature: stored.signature },
      buildOrganizationChanges(draft),
    );
    expect(revised.descriptor.revision).toBe(before + 1);
    expect(
      verifyCommunityDescriptor(revised, { descriptor: stored.descriptor, signature: stored.signature }),
    ).toBe(true);
    upsertCommunity(db.adapter, revised, identity.publicKey);

    const display = groupChannelsForDisplay(getCommunity(db.adapter, communityId)!.descriptor);
    expect(display.archived.map((c) => c.id)).toEqual(['events']);
    expect(display.groups.flatMap((g) => g.channels.map((c) => c.id))).not.toContain('events');
    // Library channels survived the manager save untouched.
    expect(listLibraries(db.adapter, communityId)).toHaveLength(club.libraries.length);
  });
});

describe('category ids stay unique across delete-then-add (Set 8 fix)', () => {
  it('re-adding after a delete can never mint a duplicate category id', () => {
    const blank = findCommunityTemplate('blank')!;
    const { communityId } = createCommunityFromTemplate(db.adapter, identity, { name: 'Cats', template: blank });
    const stored = getCommunity(db.adapter, communityId)!;

    let draft = draftFromDescriptor(stored.descriptor);
    const a = addCategoryToDraft(draft, 'Alpha');
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    const b = addCategoryToDraft(a.draft, 'Beta');
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    // Delete Alpha; the survivor Beta holds the position-2 suffix. Re-adding a
    // name that slugs to the SAME base must not reuse Beta's id.
    draft = deleteCategoryFromDraft(b.draft, a.categoryId);
    const c = addCategoryToDraft(draft, 'Beta!');
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    const ids = c.draft.categories.map((cat) => cat.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('a replicated descriptor carrying a pre-fix duplicate category id renders one group per id', () => {
    // Old owner code could sign a descriptor with two categories sharing one id;
    // the fix stops NEW mints but signed old descriptors still arrive over sync.
    // Display tolerance: one group per id, channels never duplicated.
    const signed = createCommunity(identity, {
      name: 'Legacy dup',
      channels: [
        { id: 'general', name: 'General', kind: 'chat', order: 0, categoryId: 'cat-b-2' },
      ],
      categories: [
        { id: 'cat-b-2', name: 'B', order: 0 },
        { id: 'cat-b-2', name: 'B!', order: 1 },
      ],
    });
    const display = groupChannelsForDisplay(signed.descriptor);
    const withCategory = display.groups.filter((g) => g.category !== null);
    expect(withCategory.map((g) => g.category!.id)).toEqual(['cat-b-2']);
    expect(display.groups.flatMap((g) => g.channels.map((ch) => ch.id))).toEqual(['general']);
  });
});

describe('degenerate names', () => {
  it('rejects an invisible-only (zero-width) name before any write', () => {
    const blank = findCommunityTemplate('blank')!;
    expect(() =>
      createCommunityFromTemplate(db.adapter, identity, { name: '\u200b\u200b\u200d', template: blank }),
    ).toThrow('Enter a community name.');
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
    expect(visibleCommunityName('  مجتمع  ')).toBe('مجتمع');
    expect(visibleCommunityName('🦫 Burrow')).toBe('🦫 Burrow');
  });

  it('emoji-only, RTL, long, and duplicate names all create distinct coherent communities', () => {
    const blank = findCommunityTemplate('blank')!;
    const longName = `L${'o'.repeat(400)}ng`;
    const names = ['🦫🦫', 'مجتمع العائلة', longName, 'Twins', 'Twins'];
    const ids = names.map(
      (name) => createCommunityFromTemplate(db.adapter, identity, { name, template: blank }).communityId,
    );
    expect(new Set(ids).size).toBe(names.length);
    const all = listCommunities(db.adapter);
    expect(all).toHaveLength(names.length);
    for (const community of all) {
      expect(verifyDescriptorOwnerSignature({ descriptor: community.descriptor, signature: community.signature })).toBe(true);
      expect(getWorkspaceEpoch(db.adapter, community.communityId)).toBe(1);
    }
    expect(all.filter((c) => c.descriptor.name === 'Twins')).toHaveLength(2);
  });

  it('rapid sequential creates of every template coexist coherently in one store', () => {
    const ids = COMMUNITY_TEMPLATES.map(
      (template) =>
        createCommunityFromTemplate(db.adapter, identity, { name: `Rapid ${template.id}`, template })
          .communityId,
    );
    expect(new Set(ids).size).toBe(COMMUNITY_TEMPLATES.length);
    expect(listCommunities(db.adapter)).toHaveLength(COMMUNITY_TEMPLATES.length);
    for (const [i, template] of COMMUNITY_TEMPLATES.entries()) {
      expect(listLibraries(db.adapter, ids[i]!)).toHaveLength(template.libraries.length);
    }
  });
});

describe('purge-on-failure leaves no ghost change-log rows (Set 8 fix)', () => {
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
    const boom: typeof tracker.recordChange = (table, op, rowId, data) => {
      tracker.recordChange(table, op, rowId, data);
      if (table === 'sync_workspace_keys') keyWrapRowIds.push(rowId);
      if (table === 'cm_community_identity') throw new Error('injected mid-commit failure');
    };
    expect(() =>
      createCommunityFromTemplate(db.adapter, identity, { name: 'Doomed', template: media }, (t, o, r, d) => boom(t, o, r, d)),
    ).toThrow('injected mid-commit failure');

    // The epoch mint committed BEFORE the failure and recorded its wraps; the
    // purge must have removed both the rows and their change-log records, or a
    // later session ships key wraps for a community that no longer exists.
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
    // And nothing else persisted (the existing all-or-nothing invariant).
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
    const { communityId } = createCommunityFromTemplate(
      db.adapter,
      identity,
      { name: 'Alive', template: media },
      (t, o, r, d) => tracker.recordChange(t, o, r, d),
    );
    expect(
      db.adapter.query<{ n: number }>(
        `SELECT COUNT(*) AS n FROM sync_change_log WHERE table_name = 'sync_workspace_keys' AND row_id LIKE ?`,
        [`${communityId}:%`],
      )[0]!.n,
    ).toBeGreaterThan(0);
  });
});
