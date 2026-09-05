// Plan 38 Phase 7 (web): the community template commit + the pure preset data.
//
// Against the REAL shipped web substrate (commitCommunityTemplate over the db,
// createCommunity/createLibrary/publishCommunityIdentity), this pins:
//   - staged creation is all-or-nothing: a failure mid-commit persists NOTHING;
//   - every preset composes ONLY the shipped kinds (chat baked into the genesis
//     descriptor, library appended as owner-signed rows) -- no other channel kind;
//   - a library_first preset stamps the descriptor layout, chat_first does not;
//   - the layout toggle is exactly ONE descriptor revision.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import {
  channelKind,
  communityLayout,
  configureSyncSecretStore,
  createInMemorySyncSecretStore,
  ensureSyncBootstrap,
  getCommunity,
  listCommunities,
  reviseCommunity,
  type DeviceIdentity,
} from '@mylife/sync';
import { ensureSyncSchema } from '../schema';
import { listLibraries } from '../library-store';
import { commitCommunityTemplate } from '../community-template-commit';
import {
  COMMUNITY_TEMPLATES,
  TEMPLATE_PICKER_HEADING,
  findCommunityTemplate,
  templateGenesisCategories,
  templateGenesisChannels,
  type CommunityTemplate,
} from '../community-templates';
import { MEDIA_TYPE_REGISTRY, type KnownMediaType } from '../library-metadata-core';

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

function commit(template: CommunityTemplate, name = template.name) {
  return commitCommunityTemplate(db.adapter, identity, {
    name,
    description: template.description || null,
    accent: template.accent,
    themeBlob: template.themePresetId ? `theme-blob:${template.themePresetId}` : null,
    layout: template.layout,
    categories: templateGenesisCategories(template),
    chatChannels: templateGenesisChannels(template),
    libraries: template.libraries.map((l) => ({ name: l.name, mediaType: l.mediaType })),
  });
}

describe('community template presets (pure data)', () => {
  it('exposes exactly the six named presets and the picker heading', () => {
    expect(COMMUNITY_TEMPLATES.map((t) => t.name)).toEqual([
      'Family Space',
      'Media Library',
      'Club',
      'Course Hub',
      'Newsroom',
      'Blank',
    ]);
    expect(TEMPLATE_PICKER_HEADING).toBe('Start from a template');
  });

  it('composes ONLY shipped kinds: chat channels + known library media types', () => {
    for (const template of COMMUNITY_TEMPLATES) {
      expect(template.chatChannels.length).toBeGreaterThan(0);
      for (const lib of template.libraries) {
        expect(MEDIA_TYPE_REGISTRY[lib.mediaType as KnownMediaType]).toBeDefined();
      }
      // Genesis channels are all chat (library channels are appended at commit).
      for (const channel of templateGenesisChannels(template)) {
        expect(channelKind(channel)).toBe('chat');
      }
    }
  });

  it('findCommunityTemplate is total (unknown id -> undefined)', () => {
    expect(findCommunityTemplate('media')?.name).toBe('Media Library');
    expect(findCommunityTemplate('nope')).toBeUndefined();
  });
});

describe('commitCommunityTemplate (staged, all-or-nothing)', () => {
  it('creates the full library_first community in one commit: chat + library channels, cm_libraries rows, identity', () => {
    const media = findCommunityTemplate('media')!;
    const result = commit(media);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const stored = getCommunity(db.adapter, result.communityId)!;
    expect(stored).not.toBeNull();
    expect(communityLayout(stored.descriptor)).toBe('library_first');

    // Every descriptor channel is one of the two shipped kinds, and the library
    // channels match the preset's library count.
    const kinds = stored.descriptor.channels.map((c) => channelKind(c));
    for (const k of kinds) expect(['chat', 'library']).toContain(k);
    const libraryChannels = stored.descriptor.channels.filter((c) => channelKind(c) === 'library');
    expect(libraryChannels).toHaveLength(media.libraries.length);

    // One owner-signed cm_libraries row per library.
    expect(listLibraries(db.adapter, result.communityId)).toHaveLength(media.libraries.length);
  });

  it('leaves the descriptor layout absent (chat_first) for a chat_first preset', () => {
    const club = findCommunityTemplate('club')!;
    const result = commit(club);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const stored = getCommunity(db.adapter, result.communityId)!;
    expect(communityLayout(stored.descriptor)).toBe('chat_first');
    expect(result.firstChannelId).toBe('general');
  });

  it('rolls back EVERYTHING when a library fails mid-commit (nothing persists)', () => {
    const before = listCommunities(db.adapter).length;
    const countRows = (sql: string): number => db.adapter.query(sql).length;
    const membersBefore = countRows('SELECT workspace_id FROM sync_workspace_members');
    const keysBefore = countRows('SELECT workspace_id FROM sync_workspace_keys');
    const communitiesBefore = countRows('SELECT community_id FROM sync_communities');
    const librariesBefore = countRows('SELECT community_id FROM cm_libraries');
    const family = findCommunityTemplate('family')!;
    const result = commitCommunityTemplate(db.adapter, identity, {
      name: 'Doomed',
      description: family.description,
      accent: family.accent,
      themeBlob: null,
      layout: family.layout,
      categories: [],
      chatChannels: templateGenesisChannels(family),
      // Second library has an unknown media type -> createLibrary throws.
      libraries: [
        { name: 'Photos', mediaType: 'photo' },
        { name: 'Bad', mediaType: 'not-a-media-type' as KnownMediaType },
      ],
    });
    expect(result.ok).toBe(false);
    // No community, no workspace rows, no library rows leaked through the rollback.
    expect(listCommunities(db.adapter).length).toBe(before);
    expect(db.adapter.query('SELECT id FROM sync_workspaces WHERE display_name = ?', ['Doomed'])).toHaveLength(0);
    // The purge also removes the pre-transaction storeOwnedCommunity writes
    // (membership, epoch wraps, community row, library rows) -- rc13 defect 1.
    expect(countRows('SELECT workspace_id FROM sync_workspace_members')).toBe(membersBefore);
    expect(countRows('SELECT workspace_id FROM sync_workspace_keys')).toBe(keysBefore);
    expect(countRows('SELECT community_id FROM sync_communities')).toBe(communitiesBefore);
    expect(countRows('SELECT community_id FROM cm_libraries')).toBe(librariesBefore);
  });

  it('never opens a nested transaction (raw BEGIN semantics, the shipped browser adapter)', () => {
    // The browser adapter issues a raw BEGIN with no savepoint support; a
    // nested db.transaction inside commitCommunityTemplate throws "cannot start
    // a transaction within a transaction". Wrap the adapter to enforce exactly
    // that, so this suite fails if the mobile-mirrored ordering ever regresses.
    let depth = 0;
    const strict: typeof db.adapter = {
      execute: (sql, params) => db.adapter.execute(sql, params),
      query: (sql, params) => db.adapter.query(sql, params),
      transaction: (fn) => {
        if (depth > 0) throw new Error('cannot start a transaction within a transaction');
        depth += 1;
        try {
          db.adapter.transaction(fn);
        } finally {
          depth -= 1;
        }
      },
    };
    const media = findCommunityTemplate('media')!;
    const result = commitCommunityTemplate(strict, identity, {
      name: 'Strict',
      description: media.description,
      accent: media.accent,
      themeBlob: null,
      layout: media.layout,
      categories: templateGenesisCategories(media),
      chatChannels: templateGenesisChannels(media),
      libraries: media.libraries.map((l) => ({ name: l.name, mediaType: l.mediaType })),
    });
    expect(result.ok).toBe(true);
  });

  it('every preset commits to a descriptor with only chat/library channels', () => {
    for (const template of COMMUNITY_TEMPLATES) {
      const result = commit(template, `${template.id}-instance`);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      const stored = getCommunity(db.adapter, result.communityId)!;
      for (const channel of stored.descriptor.channels) {
        expect(['chat', 'library']).toContain(channelKind(channel));
      }
    }
  });
});

describe('layout toggle is exactly one revision', () => {
  it('reviseCommunity({ layout }) bumps the revision by one and flips communityLayout', () => {
    const blank = findCommunityTemplate('blank')!;
    const result = commit(blank);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const stored = getCommunity(db.adapter, result.communityId)!;
    expect(communityLayout(stored.descriptor)).toBe('chat_first');

    const revised = reviseCommunity(
      identity,
      { descriptor: stored.descriptor, signature: stored.signature },
      { layout: 'library_first' },
    );
    expect(revised.descriptor.revision).toBe(stored.descriptor.revision + 1);
    expect(communityLayout(revised.descriptor)).toBe('library_first');
  });
});
