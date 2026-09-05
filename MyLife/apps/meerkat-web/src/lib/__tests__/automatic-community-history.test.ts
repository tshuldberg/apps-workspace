import { describe, expect, it, vi } from 'vitest';
import { createInMemoryTestDatabase } from '@mylife/db';
import {
  createChannelMessage,
  createCommunity,
  generateDeviceIdentity,
  HISTORY_HOST_SNAPSHOT_VERSION,
  sealCommunityHistoryHost,
  type HistoryPullResult,
} from '@mylife/sync';
import {
  getFeedCursor,
  listChannelMessageEvents,
  storeOwnedCommunity,
  syncAutomaticCommunityHistory,
} from '../meerkat-data';
import { ensureMeerkatTables, ensureSyncSchema } from '../schema';

const NOW = '2026-07-15T12:00:00.000Z';

function fixture() {
  const database = createInMemoryTestDatabase();
  ensureSyncSchema(database.adapter);
  ensureMeerkatTables(database.adapter);
  const owner = generateDeviceIdentity('History owner');
  const community = createCommunity(owner, {
    name: 'History', channels: [{ id: 'general', name: 'General' }], now: NOW,
  });
  storeOwnedCommunity(database.adapter, owner, community, NOW);
  const event = createChannelMessage(owner, {
    communityId: community.descriptor.communityId,
    channelId: 'general',
    body: 'Recovered history',
    hlc: { wall: '2026-07-15T12:01:00.000Z', counter: 0 },
  });
  const record = {
    communityId: community.descriptor.communityId,
    hostUrl: 'https://history.example',
    descriptorRevision: community.descriptor.revision,
    snapshotVersion: HISTORY_HOST_SNAPSHOT_VERSION,
    maxObjectBytes: 8 * 1024 * 1024,
    expiresAt: '2026-07-16T12:00:00.000Z',
  };
  const resolveHosts = vi.fn(async () => [
    sealCommunityHistoryHost(community.descriptor.genesisNonce, record),
  ]);
  const pullHost = vi.fn(async (): Promise<HistoryPullResult> => ({
    ok: true,
    channels: [{ channelId: 'general', events: [event], newEvents: [event] }],
  }));
  return { database, owner, community, event, resolveHosts, pullHost };
}

describe('syncAutomaticCommunityHistory web composition', () => {
  it('commits verified events, advances the cursor, replicates after commit, and throttles', async () => {
    const f = fixture();
    const recordLocalChange = vi.fn();
    const result = await syncAutomaticCommunityHistory(
      f.database.adapter,
      f.owner,
      f.community.descriptor.communityId,
      { relayUrl: 'wss://relay.example', now: new Date(NOW), resolveHosts: f.resolveHosts, pullHost: f.pullHost, recordLocalChange },
    );
    expect(result).toMatchObject({ outcome: 'imported', applied: 1, hostUrl: 'https://history.example' });
    expect(listChannelMessageEvents(f.database.adapter, f.community.descriptor.communityId, 'general'))
      .toHaveLength(1);
    expect(getFeedCursor(f.database.adapter, f.community.descriptor.communityId, 'general')).toEqual(f.event.hlc);
    expect(recordLocalChange).toHaveBeenCalledTimes(1);
    await expect(syncAutomaticCommunityHistory(
      f.database.adapter,
      f.owner,
      f.community.descriptor.communityId,
      { relayUrl: 'wss://relay.example', now: new Date(NOW), resolveHosts: f.resolveHosts, pullHost: f.pullHost },
    )).resolves.toMatchObject({ outcome: 'throttled', applied: 0 });
    f.database.close();
  });

  it('rolls back the merge and emits no replication when the final setting write fails', async () => {
    const f = fixture();
    f.database.adapter.execute(`CREATE TRIGGER reject_history_pull BEFORE INSERT ON mk_settings
      WHEN NEW.key LIKE 'last_pulled:%' BEGIN SELECT RAISE(ABORT, 'forced rollback'); END`);
    const recordLocalChange = vi.fn();
    const result = await syncAutomaticCommunityHistory(
      f.database.adapter,
      f.owner,
      f.community.descriptor.communityId,
      { relayUrl: 'wss://relay.example', now: new Date(NOW), force: true, resolveHosts: f.resolveHosts, pullHost: f.pullHost, recordLocalChange },
    );
    expect(result).toMatchObject({ outcome: 'manual_fallback', applied: 0, reason: 'all_hosts_failed' });
    expect(listChannelMessageEvents(f.database.adapter, f.community.descriptor.communityId, 'general')).toEqual([]);
    expect(getFeedCursor(f.database.adapter, f.community.descriptor.communityId, 'general')).toBeNull();
    expect(recordLocalChange).not.toHaveBeenCalled();
    f.database.close();
  });
});
