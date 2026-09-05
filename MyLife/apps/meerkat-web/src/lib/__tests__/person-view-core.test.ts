/**
 * Plan 52 P4 pure collapse. AC-2 lives here: a 3-device person renders as ONE
 * row under the community-chosen name, and expanding it lists all 3 devices
 * with distinct ids and safety codes. Also pins the honesty floors: no link =
 * no group, and a mid-alignment name disagreement is surfaced rather than
 * papered over.
 */

import { describe, expect, it } from 'vitest';
import {
  CONNECTED_DEVICES_HEADING,
  collapseMembersIntoPersons,
  personDeviceCountLabel,
  personRemovalDeviceLine,
  type PersonMemberInput,
} from '../person-view-core';

function member(overrides: Partial<PersonMemberInput> & { deviceId: string }): PersonMemberInput {
  return {
    displayName: 'River',
    avatarInitial: 'R',
    avatarImage: null,
    role: 'member',
    shortDeviceId: overrides.deviceId.slice(0, 8),
    safetyCode: `sas-${overrides.deviceId.slice(0, 4)}`,
    isSelf: false,
    blocked: false,
    profileUpdatedAt: '2026-07-29T12:00:00.000Z',
    ...overrides,
  };
}

describe('person collapse (P4)', () => {
  it('AC-2: three linked devices become ONE row that expands to all three', () => {
    const members = [
      member({ deviceId: 'aaa1' }),
      member({ deviceId: 'bbb2' }),
      member({ deviceId: 'ccc3' }),
    ];
    const links = new Map([['aaa1', 'g1'], ['bbb2', 'g1'], ['ccc3', 'g1']]);
    const rows = collapseMembersIntoPersons(members, links);

    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.grouped).toBe(true);
    expect(row.displayName).toBe('River');
    expect(row.deviceCount).toBe(3);
    expect(personDeviceCountLabel(row)).toBe('3 devices');
    // Expanding shows every device with a DISTINCT id and safety code.
    expect(row.devices.map((d) => d.deviceId)).toEqual(['aaa1', 'bbb2', 'ccc3']);
    expect(new Set(row.devices.map((d) => d.safetyCode)).size).toBe(3);
    expect(CONNECTED_DEVICES_HEADING).toBe('Connected devices');
  });

  it('a device with NO verified link stays its own row (never a fabricated group)', () => {
    const members = [
      member({ deviceId: 'aaa1' }),
      member({ deviceId: 'bbb2', displayName: 'Otter' }),
    ];
    const rows = collapseMembersIntoPersons(members, new Map());
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => !r.grouped)).toBe(true);
    expect(rows.every((r) => r.deviceCount === 1)).toBe(true);
    expect(personDeviceCountLabel(rows[0]!)).toBeNull();
  });

  it('devices in DIFFERENT groups never merge', () => {
    const members = [member({ deviceId: 'aaa1' }), member({ deviceId: 'bbb2' })];
    const rows = collapseMembersIntoPersons(members, new Map([['aaa1', 'g1'], ['bbb2', 'g2']]));
    expect(rows).toHaveLength(2);
  });

  it('a lone device carrying a group link is not "grouped" (one device is not a collapse)', () => {
    const rows = collapseMembersIntoPersons([member({ deviceId: 'aaa1' })], new Map([['aaa1', 'g1']]));
    expect(rows[0]!.grouped).toBe(false);
    expect(rows[0]!.deviceCount).toBe(1);
  });

  it('the row shows the NEWEST signed name and flags a disagreement', () => {
    const members = [
      member({ deviceId: 'aaa1', displayName: 'Old Name', profileUpdatedAt: '2026-07-29T10:00:00.000Z' }),
      member({ deviceId: 'bbb2', displayName: 'New Name', profileUpdatedAt: '2026-07-29T14:00:00.000Z' }),
    ];
    const rows = collapseMembersIntoPersons(members, new Map([['aaa1', 'g1'], ['bbb2', 'g1']]));
    expect(rows[0]!.displayName).toBe('New Name');
    expect(rows[0]!.nameDisagreement).toBe(true);
    // Both devices keep their OWN names in the expansion (no invented consensus).
    expect(rows[0]!.devices.map((d) => d.displayName)).toEqual(['Old Name', 'New Name']);
  });

  it('the row carries the strongest role any device holds', () => {
    const members = [
      member({ deviceId: 'aaa1', role: 'member' }),
      member({ deviceId: 'bbb2', role: 'owner' }),
    ];
    const rows = collapseMembersIntoPersons(members, new Map([['aaa1', 'g1'], ['bbb2', 'g1']]));
    expect(rows[0]!.role).toBe('owner');
  });

  it('L-1: a partially blocked person SAYS so instead of reading as unblocked', () => {
    const rows = collapseMembersIntoPersons([
      member({ deviceId: 'aaa1', blocked: true }),
      member({ deviceId: 'bbb2', blocked: false }),
    ], new Map([['aaa1', 'g1'], ['bbb2', 'g1']]));
    expect(rows[0]!.blocked).toBe(false);
    expect(rows[0]!.partiallyBlocked).toBe(true);
    // Fully blocked and fully unblocked are NOT partial.
    const full = collapseMembersIntoPersons([
      member({ deviceId: 'aaa1', blocked: true }),
      member({ deviceId: 'bbb2', blocked: true }),
    ], new Map([['aaa1', 'g1'], ['bbb2', 'g1']]));
    expect(full[0]!.partiallyBlocked).toBe(false);
    const none = collapseMembersIntoPersons([member({ deviceId: 'aaa1' })], new Map());
    expect(none[0]!.partiallyBlocked).toBe(false);
  });

  it('blocked is true only when EVERY device is blocked', () => {
    const partly = collapseMembersIntoPersons([
      member({ deviceId: 'aaa1', blocked: true }),
      member({ deviceId: 'bbb2', blocked: false }),
    ], new Map([['aaa1', 'g1'], ['bbb2', 'g1']]));
    expect(partly[0]!.blocked).toBe(false);

    const fully = collapseMembersIntoPersons([
      member({ deviceId: 'aaa1', blocked: true }),
      member({ deviceId: 'bbb2', blocked: true }),
    ], new Map([['aaa1', 'g1'], ['bbb2', 'g1']]));
    expect(fully[0]!.blocked).toBe(true);
  });

  it('a person containing one of my own devices sorts first and reads as self', () => {
    const rows = collapseMembersIntoPersons([
      member({ deviceId: 'zzz9', displayName: 'Zoe' }),
      member({ deviceId: 'aaa1', displayName: 'Me', isSelf: true }),
    ], new Map());
    expect(rows[0]!.isSelf).toBe(true);
    expect(rows[0]!.displayName).toBe('Me');
  });

  it('P5 copy states the real device count, plural honest', () => {
    const one = collapseMembersIntoPersons([member({ deviceId: 'aaa1' })], new Map())[0]!;
    expect(personRemovalDeviceLine(one)).toBe('This removes their device from the community.');
    const three = collapseMembersIntoPersons([
      member({ deviceId: 'aaa1' }), member({ deviceId: 'bbb2' }), member({ deviceId: 'ccc3' }),
    ], new Map([['aaa1', 'g1'], ['bbb2', 'g1'], ['ccc3', 'g1']]))[0]!;
    expect(personRemovalDeviceLine(three)).toBe('This removes all 3 of their devices from the community.');
  });

  it('is stable: the same input always produces the same order', () => {
    const members = [
      member({ deviceId: 'ccc3', displayName: 'C' }),
      member({ deviceId: 'aaa1', displayName: 'A' }),
      member({ deviceId: 'bbb2', displayName: 'B' }),
    ];
    const first = collapseMembersIntoPersons(members, new Map()).map((r) => r.key);
    const second = collapseMembersIntoPersons([...members].reverse(), new Map()).map((r) => r.key);
    expect(first).toEqual(second);
  });
});
