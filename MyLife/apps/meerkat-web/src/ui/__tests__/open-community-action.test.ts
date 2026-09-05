// Plan 38 Phase 7 (web): layout-aware community open.
//
// openCommunityAction decides where selecting a community lands, honoring the
// SIGNED presentation layout: a library_first community opens on its Libraries
// home; every other (including a legacy descriptor with no layout) opens on its
// first non-library channel, unchanged.

import { beforeEach, describe, expect, it } from 'vitest';
import {
  configureSyncSecretStore,
  createCommunity,
  createInMemorySyncSecretStore,
  generateDeviceIdentity,
  type DeviceIdentity,
} from '@mylife/sync';
import { openCommunityAction } from '../navigation/view-state';

let owner: DeviceIdentity;

beforeEach(() => {
  configureSyncSecretStore(createInMemorySyncSecretStore());
  owner = generateDeviceIdentity('Owner');
});

describe('openCommunityAction', () => {
  it('opens a library_first community on its Libraries home', () => {
    const signed = createCommunity(owner, {
      name: 'Media',
      channels: [
        { id: 'general', name: 'General', kind: 'chat', order: 0 },
        { id: 'lib-movies', name: 'Movies', kind: 'library', order: 1 },
      ],
      layout: 'library_first',
    });
    expect(openCommunityAction(signed.descriptor)).toEqual({
      type: 'OPEN_LIBRARY_HOME',
      workspaceId: signed.descriptor.communityId,
    });
  });

  it('opens a chat_first community on its first non-library channel', () => {
    const signed = createCommunity(owner, {
      name: 'Club',
      channels: [
        { id: 'lib-files', name: 'Files', kind: 'library', order: 0 },
        { id: 'general', name: 'General', kind: 'chat', order: 1 },
      ],
      layout: 'chat_first',
    });
    expect(openCommunityAction(signed.descriptor)).toEqual({
      type: 'SELECT_COMMUNITY',
      communityId: signed.descriptor.communityId,
      channelId: 'general',
    });
  });

  it('opens a legacy descriptor (no layout, no kinds) on its first channel', () => {
    const signed = createCommunity(owner, {
      name: 'Legacy',
      channels: [{ id: 'general', name: 'general' }],
    });
    expect(openCommunityAction(signed.descriptor)).toEqual({
      type: 'SELECT_COMMUNITY',
      communityId: signed.descriptor.communityId,
      channelId: 'general',
    });
  });
});
