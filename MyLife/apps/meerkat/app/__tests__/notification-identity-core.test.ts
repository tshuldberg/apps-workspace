/**
 * Per-community notification identity (Plan 38 C.10).
 *
 * Covers the honesty contract:
 *  - resolveNotificationIdentity uses the VERIFIED identity only; an unverified /
 *    null identity yields generic defaults, and the sound preset always resolves
 *    to a member of the fixed bundled set.
 *  - the sound preset list is the fixed bundled set (default + silent), never a
 *    fabricated tone.
 *  - buildCommunityNotifications fires for applied > 0 only and never for a muted
 *    community, and the per-community content carries the resolved title/sound.
 *  - the device-local sound pref round-trips and normalizes unknown ids.
 *  - tallyChannelMessages records only REAL inserted rows per community, so the
 *    emission path still requires applied > 0.
 */

import { describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase } from '@mylife/db';
import type { ApplyChannelEvents, ChannelMessageEvent } from '@mylife/sync';
import {
  NOTIFICATION_SOUND_PRESETS,
  GENERIC_NOTIFICATION_TITLE,
  buildCommunityNotifications,
  getNotificationSoundPreset,
  resolveNotificationIdentity,
} from '../(root)/data/notification-identity-core';
import {
  getCommunityNotificationSoundId,
  setCommunityNotificationSoundId,
} from '../(root)/data/notification-prefs';
import { tallyChannelMessages } from '../(root)/data/background-sync';
import { ensureMeerkatTables } from '../(root)/data/db';

describe('notification sound presets', () => {
  it('is the fixed bundled set (default + silent) with honest sound identifiers', () => {
    expect(NOTIFICATION_SOUND_PRESETS.map((p) => p.id)).toEqual(['default', 'none']);
    expect(getNotificationSoundPreset('default').sound).toBe('default');
    expect(getNotificationSoundPreset('none').sound).toBeNull();
  });

  it('normalizes an unknown or absent id to the default preset', () => {
    expect(getNotificationSoundPreset('bogus').id).toBe('default');
    expect(getNotificationSoundPreset(null).id).toBe('default');
    expect(getNotificationSoundPreset(undefined).id).toBe('default');
  });
});

describe('resolveNotificationIdentity (verified-only)', () => {
  it('uses the verified community name + accent + selected sound', () => {
    const resolved = resolveNotificationIdentity({
      identity: { name: 'Book Club', accentColor: '#0e7c66' },
      prefs: { soundPresetId: 'none' },
    });
    expect(resolved.title).toBe('Book Club');
    expect(resolved.accentColor).toBe('#0e7c66');
    expect(resolved.soundPreset.id).toBe('none');
    expect(resolved.soundPreset.sound).toBeNull();
  });

  it('falls back to generic defaults when the identity is null (unverified)', () => {
    const resolved = resolveNotificationIdentity({ identity: null, prefs: { soundPresetId: 'default' } });
    expect(resolved.title).toBe(GENERIC_NOTIFICATION_TITLE);
    expect(resolved.accentColor).toBeNull();
    expect(resolved.soundPreset.id).toBe('default');
  });

  it('treats an empty verified name as unverified (generic title, no accent)', () => {
    const resolved = resolveNotificationIdentity({ identity: { name: '   ', accentColor: '#111111' } });
    expect(resolved.title).toBe(GENERIC_NOTIFICATION_TITLE);
    expect(resolved.accentColor).toBeNull();
  });
});

describe('buildCommunityNotifications', () => {
  it('fires for applied > 0 non-muted communities only, with resolved content', () => {
    const out = buildCommunityNotifications([
      { communityId: 'a', applied: 2, identity: { name: 'Alpha', accentColor: '#123456' }, prefs: { soundPresetId: 'none' } },
      { communityId: 'b', applied: 0, identity: { name: 'Beta', accentColor: '#654321' } },
      { communityId: 'c', applied: 1, identity: { name: 'Gamma', accentColor: null }, muted: true },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      communityId: 'a',
      title: 'Alpha',
      body: '2 new messages received.',
      color: '#123456',
      sound: null,
    });
  });

  it('uses a singular body for exactly one applied message and generic title when unverified', () => {
    const out = buildCommunityNotifications([
      { communityId: 'x', applied: 1, identity: null },
    ]);
    expect(out[0]!.body).toBe('1 new message received.');
    expect(out[0]!.title).toBe(GENERIC_NOTIFICATION_TITLE);
    expect(out[0]!.color).toBeNull();
    expect(out[0]!.sound).toBe('default');
  });
});

describe('device-local notification sound prefs', () => {
  it('round-trips and normalizes unknown ids per community', () => {
    const test = createInMemoryTestDatabase();
    try {
      const db = test.adapter;
      ensureMeerkatTables(db);

      expect(getCommunityNotificationSoundId(db, 'cm_1')).toBe('default');

      setCommunityNotificationSoundId(db, 'cm_1', 'none');
      expect(getCommunityNotificationSoundId(db, 'cm_1')).toBe('none');
      // Independent per community.
      expect(getCommunityNotificationSoundId(db, 'cm_2')).toBe('default');

      // An unknown id normalizes to the default preset on write.
      setCommunityNotificationSoundId(db, 'cm_1', 'bogus');
      expect(getCommunityNotificationSoundId(db, 'cm_1')).toBe('default');
    } finally {
      test.close();
    }
  });
});

describe('tallyChannelMessages', () => {
  const event = (communityId: string): ChannelMessageEvent => ({ communityId } as ChannelMessageEvent);

  it('records only REAL inserted rows per community', () => {
    const tally = new Map<string, number>();
    // Inner handler: pretend every event but one inserts; return real counts.
    const inner: ApplyChannelEvents = (events) => {
      const inserted = events.filter((e) => e.communityId !== 'skip').length;
      return { inserted, skipped: events.length - inserted, invalid: 0 };
    };
    const wrapped = tallyChannelMessages(inner, tally);

    const r1 = wrapped([event('a'), event('a')]);
    expect(r1.inserted).toBe(2);
    const r2 = wrapped([event('b'), event('skip')]);
    expect(r2.inserted).toBe(1);

    expect(tally.get('a')).toBe(2);
    expect(tally.get('b')).toBe(1);
    expect(tally.has('skip')).toBe(false);
  });

  it('records nothing when the inner handler inserts nothing, so no notification fires', () => {
    const tally = new Map<string, number>();
    const inner: ApplyChannelEvents = (events) => ({ inserted: 0, skipped: events.length, invalid: 0 });
    const wrapped = tallyChannelMessages(inner, tally);

    wrapped([event('a'), event('b')]);
    expect(tally.size).toBe(0);

    // The emission path builds from the tally: an all-zero run notifies nothing.
    const notifications = buildCommunityNotifications(
      [...tally].map(([communityId, applied]) => ({ communityId, applied, identity: null })),
    );
    expect(notifications).toHaveLength(0);
  });
});
