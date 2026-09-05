// Plan 38 Phase 7 (amendment C.1 + E, MOBILE): community templates.
//
// Asserts:
//   - each preset composes ONLY the shipped channel kinds (chat via chatChannels,
//     library via libraries) and every library carries a known media type;
//   - templateGenesisChannels stamps kind:'chat' + positional order and never
//     includes library channels (they are provisioned by createLibrary);
//   - a template creation is all-or-nothing: a failure mid-commit leaves ZERO rows
//     (no community, no library, no identity) -- the community is purged;
//   - a successful creation writes the community + its library configs + its
//     identity in one go, with the template's layout on the signed descriptor;
//   - the layout toggle folds into ONE revision (buildOrganizationChanges carries
//     layout; reviseCommunity bumps revision by exactly one);
//   - the honest not-held availability line exists verbatim.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { PRESETS, encodeThemeBlob } from '@mylife/meerkat-theme';
import {
  communityLayout,
  configureSyncSecretStore,
  createInMemorySyncSecretStore,
  ensureShareIntakeTables,
  ensureSyncBootstrap,
  getCommunity,
  reviseCommunity,
  type DeviceIdentity,
} from '@mylife/sync';
import { ensureCommunityTables, getCommunityIdentity } from '../(root)/data/community-core';
import { ensureMeerkatTables } from '../(root)/data/db';
import { createCommunityFromTemplate } from '../(root)/data/community-template-commit';
import {
  COMMUNITY_TEMPLATES,
  findCommunityTemplate,
  templateGenesisChannels,
  TEMPLATE_PICKER_HEADING,
} from '../(root)/data/community-templates';
import { listLibraries } from '../(root)/data/library-store-core';
import {
  buildOrganizationChanges,
  draftFromDescriptor,
  setLayoutInDraft,
} from '../(root)/data/community-org-core';
import { LIBRARY_STRINGS } from '../(root)/data/library-view-core';

const KNOWN_MEDIA = new Set(['movie', 'show', 'music', 'photo', 'book', 'document', 'custom']);

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

describe('presets compose only shipped capabilities', () => {
  it('exposes six presets with the canonical names', () => {
    expect(TEMPLATE_PICKER_HEADING).toBe('Start from a template');
    expect(COMMUNITY_TEMPLATES.map((t) => t.name)).toEqual([
      'Family Space',
      'Media Library',
      'Club',
      'Course Hub',
      'Newsroom',
      'Blank',
    ]);
    expect(findCommunityTemplate('blank')?.name).toBe('Blank');
    expect(findCommunityTemplate('nope')).toBeUndefined();
  });

  it('every library carries a known media type', () => {
    for (const template of COMMUNITY_TEMPLATES) {
      for (const library of template.libraries) {
        expect(KNOWN_MEDIA.has(library.mediaType)).toBe(true);
      }
    }
  });

  it('templateGenesisChannels stamps kind:chat + order and omits library channels', () => {
    const media = findCommunityTemplate('media')!;
    const genesis = templateGenesisChannels(media);
    // Only the single chat channel is in the genesis; the 3 libraries are provisioned later.
    expect(genesis).toEqual([{ id: 'general', name: 'General', kind: 'chat', order: 0 }]);
    expect(genesis.every((c) => c.kind === 'chat')).toBe(true);
    expect(media.libraries).toHaveLength(3);
    expect(media.layout).toBe('library_first');
  });
});

describe('all-or-nothing creation', () => {
  it('creates the community, its library configs, and its identity in one commit', () => {
    const media = findCommunityTemplate('media')!;
    const { communityId } = createCommunityFromTemplate(db.adapter, identity, { name: 'Our Media', template: media });

    const stored = getCommunity(db.adapter, communityId);
    expect(stored).not.toBeNull();
    expect(communityLayout(stored!.descriptor)).toBe('library_first');
    // 3 library channels appended + 1 chat channel from the genesis.
    expect(stored!.descriptor.channels.filter((c) => c.kind === 'library')).toHaveLength(3);
    // 3 verified cm_libraries config rows.
    expect(listLibraries(db.adapter, communityId)).toHaveLength(3);
    // The identity row carries the template's description + accent.
    const ident = getCommunityIdentity(db.adapter, communityId);
    expect(ident?.description).toBe(media.description);
    expect(ident?.accentColor).toBe(media.accent);
    // 'serious' preset resolves to a stored theme blob.
    expect(ident?.themeBlob).toBeTruthy();
  });

  it('adopts the caller theme blob into the community identity on create', () => {
    const media = findCommunityTemplate('media')!;
    const blob = encodeThemeBlob(PRESETS[0]);
    const { communityId } = createCommunityFromTemplate(
      db.adapter,
      identity,
      { name: 'Themed', template: media, adoptThemeBlob: blob },
    );
    expect(getCommunityIdentity(db.adapter, communityId)?.themeBlob).toBe(blob);
  });

  it('rolls back everything when a write fails mid-commit (zero rows persist)', () => {
    const media = findCommunityTemplate('media')!;
    const baselineWorkspaces = db.adapter.query<{ n: number }>('SELECT COUNT(*) AS n FROM sync_workspaces')[0]!.n;
    const baselineCommunities = db.adapter.query<{ n: number }>('SELECT COUNT(*) AS n FROM sync_communities')[0]!.n;

    // Inject a failure at the identity insert -- AFTER the library rows are written
    // inside the transaction, proving the transaction rollback AND the compensating
    // community purge together leave nothing behind.
    const boom = (table: string) => {
      if (table === 'cm_community_identity') throw new Error('injected mid-commit failure');
    };

    expect(() =>
      createCommunityFromTemplate(db.adapter, identity, { name: 'Doomed', template: media }, boom),
    ).toThrow('injected mid-commit failure');

    // No community, no libraries, no identity, and no leftover workspace rows.
    expect(db.adapter.query<{ n: number }>('SELECT COUNT(*) AS n FROM sync_communities')[0]!.n).toBe(baselineCommunities);
    expect(db.adapter.query<{ n: number }>('SELECT COUNT(*) AS n FROM sync_workspaces')[0]!.n).toBe(baselineWorkspaces);
    expect(db.adapter.query<{ n: number }>('SELECT COUNT(*) AS n FROM cm_libraries')[0]!.n).toBe(0);
    expect(db.adapter.query<{ n: number }>('SELECT COUNT(*) AS n FROM cm_community_identity')[0]!.n).toBe(0);
  });

  it('rejects an empty name before any write', () => {
    const blank = findCommunityTemplate('blank')!;
    expect(() =>
      createCommunityFromTemplate(db.adapter, identity, { name: '   ', template: blank }),
    ).toThrow();
    expect(db.adapter.query<{ n: number }>('SELECT COUNT(*) AS n FROM sync_communities')[0]!.n).toBe(0);
  });
});

describe('layout toggle folds into one revision', () => {
  it('buildOrganizationChanges carries layout and reviseCommunity bumps by one', () => {
    const blank = findCommunityTemplate('blank')!;
    const { communityId } = createCommunityFromTemplate(db.adapter, identity, { name: 'Chat First', template: blank });
    const stored = getCommunity(db.adapter, communityId)!;
    expect(communityLayout(stored.descriptor)).toBe('chat_first');

    // The owner flips 'Open on Library' on the draft; Save commits ONE revision.
    const draft = setLayoutInDraft(draftFromDescriptor(stored.descriptor), 'library_first');
    const changes = buildOrganizationChanges(draft);
    expect(changes.layout).toBe('library_first');

    const revised = reviseCommunity(
      identity,
      { descriptor: stored.descriptor, signature: stored.signature },
      changes,
    );
    expect(revised.descriptor.revision).toBe(stored.descriptor.revision + 1);
    expect(communityLayout(revised.descriptor)).toBe('library_first');
  });
});

describe('honest availability copy', () => {
  it('exposes the exact community not-held state line', () => {
    expect(LIBRARY_STRINGS.availableFromMembers).toBe(
      'Available from members who have it, when a sync connects.',
    );
  });
});
