import { describe, expect, it } from 'vitest';
import { generateDeviceIdentity } from '@mylife/sync';
import { resolveRoomLaunch, roomUnavailableCopy, type ResolveRoomLaunchInput } from '../room-entry';

const identity = generateDeviceIdentity('Member');

const ready: ResolveRoomLaunchInput = {
  identity,
  communityId: 'cm_1',
  roomId: 'channel_1',
  descriptorRevision: 4,
  epoch: 2,
  communityNodeBaseUrl: 'https://community.example',
  livekitUrl: 'wss://livekit.example',
};

describe('resolveRoomLaunch', () => {
  it('produces a ready plan when identity, membership, node, and SFU are all present', () => {
    const r = resolveRoomLaunch(ready);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.plan.descriptorRevision).toBe(4);
      expect(r.plan.epoch).toBe(2);
      expect(r.plan.livekitWsUrl).toBe('wss://livekit.example');
      expect(r.plan.requestedPermissions).toContain('publish_audio');
    }
  });

  it('is unavailable without an identity', () => {
    expect(resolveRoomLaunch({ ...ready, identity: null })).toEqual({ ok: false, reason: 'no_identity' });
  });

  it('is unavailable when no descriptor revision is held (not a member)', () => {
    expect(resolveRoomLaunch({ ...ready, descriptorRevision: null })).toEqual({ ok: false, reason: 'not_a_member' });
  });

  it('is unavailable when the member holds no current epoch key', () => {
    expect(resolveRoomLaunch({ ...ready, epoch: null })).toEqual({ ok: false, reason: 'no_epoch' });
    expect(resolveRoomLaunch({ ...ready, epoch: 0 })).toEqual({ ok: false, reason: 'no_epoch' });
  });

  it('is unavailable when the community has no https node host', () => {
    expect(resolveRoomLaunch({ ...ready, communityNodeBaseUrl: null })).toEqual({ ok: false, reason: 'no_community_node' });
  });

  it('is unavailable when no LiveKit URL is configured in the build', () => {
    expect(resolveRoomLaunch({ ...ready, livekitUrl: '   ' })).toEqual({ ok: false, reason: 'no_livekit' });
  });

  it('is unavailable when the room channel is archived (read-only everywhere)', () => {
    expect(resolveRoomLaunch({ ...ready, archived: true })).toEqual({ ok: false, reason: 'archived' });
  });

  it('gives honest copy for every unavailable reason', () => {
    for (const reason of ['no_identity', 'not_a_member', 'no_epoch', 'no_community_node', 'no_livekit', 'archived'] as const) {
      expect(roomUnavailableCopy(reason).length).toBeGreaterThan(0);
    }
    expect(roomUnavailableCopy('no_livekit')).toContain('not available');
    expect(roomUnavailableCopy('archived')).toBe('Archived channel. Content is preserved and read-only here.');
  });
});
