import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase, type DatabaseAdapter } from '@mylife/db';
import { configureSyncSecretStore, createInMemorySyncSecretStore, ensureSyncBootstrap, getCommunity, listCommunities, communityLayout, verifyCommunityLayoutEvent, type DeviceIdentity } from '@mylife/sync';
import { decodeLayoutBlob } from '@mylife/meerkat-layout';
import { PRESETS, decodeThemeBlob } from '@mylife/meerkat-theme';
import { ensureSyncSchema, ensureMeerkatTables } from '../schema';
import { commitCommunityTemplate } from '../community-template-commit';
import { getSetting, getCommunityIdentity, getCommunityLayoutEvent } from '../meerkat-data';
import { buildOnboardingExperience, ONBOARDING_EXPERIENCES, type ExperienceId } from '../onboarding-experience-core';
import { draftLayoutProblems } from '../community-layout-core';

let db: InMemoryTestDatabase;
let identity: DeviceIdentity;
beforeEach(() => {
  configureSyncSecretStore(createInMemorySyncSecretStore());
  db = createInMemoryTestDatabase();
  identity = ensureSyncBootstrap(db.adapter).identity;
  ensureMeerkatTables(db.adapter);
  ensureSyncSchema(db.adapter);
});
afterEach(() => db.close());

function commit(adapter: DatabaseAdapter, id: string): string {
  const draft = buildOnboardingExperience('Our community', id, 'calm');
  const result = commitCommunityTemplate(adapter, identity, {
    name: draft.name, description: null, accent: null, themeBlob: draft.themeBlob,
    layout: draft.template.layout, layoutBlob: draft.layoutBlob, categories: [],
    chatChannels: draft.channels, libraries: draft.template.libraries, completeOnboarding: true, localLayoutDefault: { profile: 'mobile', choice: id as ExperienceId },
  });
  if (!result.ok) throw new Error(result.error);
  return result.communityId;
}

describe('onboarding layout and theme draft', () => {
  it('every available layout works with every theme without writing preview state', () => {
    for (const experience of ONBOARDING_EXPERIENCES) {
      for (const theme of PRESETS) {
        const draft = buildOnboardingExperience('Our community', experience.id, theme.id);
        const decoded = decodeThemeBlob(draft.themeBlob);
        expect(decoded.success).toBe(true);
        if (decoded.success) expect(decoded.theme.id).toBe(theme.id);
        if (draft.layoutBlob) {
          const layout = decodeLayoutBlob(draft.layoutBlob);
          expect(layout.success).toBe(true);
          if (layout.success) expect(draftLayoutProblems(layout.layout)).toEqual([]);
        }
      }
    }
    expect(listCommunities(db.adapter)).toEqual([]);
    expect(getSetting(db.adapter, 'onboarding_complete')).not.toBe('1');
  });
  it.each(['unknown'])('refuses unknown layout %s', (id) => {
    expect(() => buildOnboardingExperience('Friends', id, 'open-burrow')).toThrow('known layout');
  });
  it.each(['', '   ', '\u200b', 'x'.repeat(81)])('rejects an invalid name', (name) => {
    expect(() => buildOnboardingExperience(name, 'standard', 'open-burrow')).toThrow('community name');
  });
  it('rejects an unknown theme and isolates mutable drafts', () => {
    expect(() => buildOnboardingExperience('Friends', 'standard', 'missing')).toThrow('available theme');
    const draft = buildOnboardingExperience('Friends', 'standard', 'open-burrow');
    draft.channels[1].postRoles?.push('member');
    expect(buildOnboardingExperience('Friends', 'standard', 'open-burrow').channels[1].postRoles).toEqual(['owner', 'admin']);
  });
});

describe('onboarding creation commits the actual experience', () => {
  it.each(['standard', 'discussion', 'library', 'video', 'shorts', 'live'])('persists %s with theme, permissions, and restart completion', (id) => {
    const communityId = commit(db.adapter, id);
    const stored = getCommunity(db.adapter, communityId)!;
    expect(stored.descriptor.name).toBe('Our community');
    expect(stored.descriptor.channels.find((channel) => channel.id === 'announcements')?.postRoles).toEqual(['owner', 'admin']);
    expect(communityLayout(stored.descriptor)).toBe(id === 'library' ? 'library_first' : 'chat_first');
    const theme = getCommunityIdentity(db.adapter, communityId);
    expect(theme?.themeBlob).toBe(buildOnboardingExperience('Our community', id, 'calm').themeBlob);
    expect(getSetting(db.adapter, 'onboarding_complete')).toBe('1');
    expect(getSetting(db.adapter, 'layout_default:mobile')).toBe(id);
    expect(getSetting(db.adapter, 'layout_default:desktop')).toBeNull();
    expect(db.adapter.query('SELECT * FROM cm_libraries WHERE community_id = ?', [communityId])).toHaveLength(id === 'library' ? 3 : ['video', 'shorts'].includes(id) ? 1 : 0);
    const layout = getCommunityLayoutEvent(db.adapter, communityId);
    if (['discussion', 'video', 'shorts', 'live'].includes(id)) {
      expect(layout).not.toBeNull();
      expect(verifyCommunityLayoutEvent(layout!, identity.publicKey)).toBe(true);
      expect(layout?.layoutBlob).toBe(buildOnboardingExperience('Our community', id, 'calm').layoutBlob);
    } else expect(layout).toBeNull();
  });
  it('rolls back layout, completion, theme and community if the final identity write fails', () => {
    const adapter = {
      ...db.adapter,
      execute: (sql: string, params?: Parameters<typeof db.adapter.execute>[1]) => {
        if (/INSERT.*cm_community_identity/i.test(sql)) throw new Error('Injected identity write failure');
        db.adapter.execute(sql, params);
      },
    };
    expect(() => commit(adapter, 'discussion')).toThrow('Injected identity write failure');
    expect(listCommunities(db.adapter)).toEqual([]);
    expect(db.adapter.query('SELECT * FROM cm_layout')).toHaveLength(0);
    expect(db.adapter.query('SELECT * FROM cm_community_identity')).toHaveLength(0);
    expect(getSetting(db.adapter, 'onboarding_complete')).not.toBe('1');
    expect(getSetting(db.adapter, 'layout_default:mobile')).toBeNull();
  });
});
