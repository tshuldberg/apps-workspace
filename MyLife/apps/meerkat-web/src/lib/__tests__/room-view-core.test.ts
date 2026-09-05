import { describe, expect, it } from 'vitest';
import {
  canUseControl,
  initialRoomViewState,
  reduceRoomView,
  roomSecurityCopy,
  type RoomEvent,
  type RoomViewState,
} from '../room-view-core';

function run(events: RoomEvent[], start: RoomViewState = initialRoomViewState()): RoomViewState {
  return events.reduce(reduceRoomView, start);
}

const p = (id: string, over: Partial<{ isLocal: boolean; micOn: boolean; camOn: boolean; screenOn: boolean; handRaised: boolean }> = {}) => ({
  id,
  isLocal: over.isLocal ?? false,
  micOn: over.micOn ?? false,
  camOn: over.camOn ?? false,
  screenOn: over.screenOn ?? false,
  handRaised: over.handRaised,
});

describe('room view core - NC-25.1 joined only on a real connected event', () => {
  it('does not reach joined from authorizing/connecting or a participant list alone', () => {
    const state = run([
      { type: 'authorizing' },
      { type: 'connecting', localParticipantId: 'lp', localPermissions: ['subscribe', 'publish_audio'] },
      { type: 'participants', participants: [p('lp', { isLocal: true }), p('a')] },
      { type: 'activeSpeakers', speakingIds: ['a'] },
    ]);
    expect(state.phase).toBe('connecting');
    expect(state.participants).toHaveLength(2);
  });

  it('reaches joined only when a connected connection-state event arrives', () => {
    const state = run([
      { type: 'connecting', localParticipantId: 'lp', localPermissions: ['subscribe'] },
      { type: 'connectionState', state: 'connected' },
    ]);
    expect(state.phase).toBe('joined');
  });

  it('a bare connecting connection-state never promotes to joined', () => {
    const state = run([{ type: 'connectionState', state: 'connecting' }]);
    expect(state.phase).toBe('connecting');
  });
});

describe('room view core - reconnect and terminal transitions', () => {
  it('joined -> reconnecting -> joined on real events', () => {
    const s1 = run([
      { type: 'connecting', localParticipantId: 'lp', localPermissions: [] },
      { type: 'connectionState', state: 'connected' },
      { type: 'connectionState', state: 'reconnecting' },
    ]);
    expect(s1.phase).toBe('reconnecting');
    const s2 = reduceRoomView(s1, { type: 'connectionState', state: 'connected' });
    expect(s2.phase).toBe('joined');
  });

  it('reconnecting is not entered before a room was ever joined', () => {
    const s = run([{ type: 'connecting', localParticipantId: 'lp', localPermissions: [] }, { type: 'connectionState', state: 'reconnecting' }]);
    expect(s.phase).toBe('connecting');
  });

  it('disconnected ends the room and terminal states are sticky', () => {
    const s = run([
      { type: 'connectionState', state: 'connected' },
      { type: 'connectionState', state: 'disconnected' },
      { type: 'connectionState', state: 'connected' },
    ]);
    expect(s.phase).toBe('left');
  });

  it('failed carries the reason and ignores later events', () => {
    const s = run([{ type: 'failed', reason: 'token_rejected' }, { type: 'connectionState', state: 'connected' }]);
    expect(s.phase).toBe('failed');
    expect(s.endReason).toBe('token_rejected');
  });
});

describe('room view core - NC-25.4 / NC-25.10 security badge', () => {
  it('defaults to room_server and only claims end_to_end when every participant is encrypted', () => {
    const base = run([
      { type: 'connectionState', state: 'connected' },
      { type: 'participants', participants: [p('lp', { isLocal: true }), p('a'), p('b')] },
    ]);
    expect(base.securityMode).toBe('room_server');

    const allEncrypted = reduceRoomView(base, { type: 'e2ee', allParticipantsEncrypted: true });
    expect(allEncrypted.securityMode).toBe('end_to_end');
    expect(roomSecurityCopy(allEncrypted.securityMode)).toContain('End-to-end');
  });

  it('a single un-encrypted participant keeps the whole room at room_server (no inherited badge)', () => {
    const s = run([
      { type: 'connectionState', state: 'connected' },
      { type: 'participants', participants: [p('lp', { isLocal: true }), p('a'), p('web')] },
      { type: 'e2ee', allParticipantsEncrypted: false, perParticipant: { lp: true, a: true, web: false } },
    ]);
    expect(s.securityMode).toBe('room_server');
    expect(roomSecurityCopy(s.securityMode)).toContain('not end-to-end');
  });

  it('per-participant truth overrides an over-optimistic aggregate flag', () => {
    const s = run([
      { type: 'connectionState', state: 'connected' },
      { type: 'participants', participants: [p('lp', { isLocal: true }), p('a')] },
      // aggregate says all encrypted, but per-participant shows a gap: trust the members.
      { type: 'e2ee', allParticipantsEncrypted: true, perParticipant: { lp: true, a: false } },
    ]);
    expect(s.securityMode).toBe('room_server');
  });

  it('an empty room never claims end-to-end', () => {
    const s = run([{ type: 'connectionState', state: 'connected' }, { type: 'e2ee', allParticipantsEncrypted: true }]);
    expect(s.securityMode).toBe('room_server');
  });
});

describe('room view core - participant state from events only', () => {
  it('tracks speaking, hand raise, and preserves mic/cam across snapshots', () => {
    const s = run([
      { type: 'connectionState', state: 'connected' },
      { type: 'participants', participants: [p('a', { micOn: true }), p('b')] },
      { type: 'activeSpeakers', speakingIds: ['a'] },
      { type: 'handRaise', participantId: 'b', raised: true },
    ]);
    const a = s.participants.find((x) => x.id === 'a');
    const b = s.participants.find((x) => x.id === 'b');
    expect(a?.speaking).toBe(true);
    expect(a?.micOn).toBe(true);
    expect(b?.handRaised).toBe(true);
    expect(b?.speaking).toBe(false);
  });

  it('canUseControl gates each publish control on the granted permission', () => {
    expect(canUseControl(['subscribe', 'publish_audio'], 'mic')).toBe(true);
    expect(canUseControl(['subscribe', 'publish_audio'], 'camera')).toBe(false);
    expect(canUseControl(['subscribe', 'publish_audio', 'publish_video', 'publish_screen'], 'screen')).toBe(true);
    expect(canUseControl(['subscribe'], 'screen')).toBe(false);
  });
});
