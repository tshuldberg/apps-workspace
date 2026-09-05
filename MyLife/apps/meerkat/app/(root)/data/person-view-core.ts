// person-view-core.ts (Plan 52 P4, MOBILE; web twin:
// apps/meerkat-web/src/lib/person-view-core.ts -- keep lockstep).
//
// The PURE collapse: given a community's member rows plus the verified
// device -> derived-group links, produce the rows the UI renders. Default
// rendering is ONE row per person under the community-chosen name; expanding
// a row reveals the individual devices, each honestly presented as its own
// cryptographic identity with its own short id and safety code.
//
// Honesty rules encoded here:
//  - a device with NO verified link renders as its own single-device row. An
//    unverifiable or absent announce NEVER produces a fabricated grouping;
//  - the person's displayed name comes from the devices' own signed community
//    profiles (already verified upstream), never from the announce, which
//    carries no names at all;
//  - when linked devices disagree on the name (mid-alignment), the row shows
//    the newest and the expansion shows every device's own name, so the UI
//    never invents consensus that does not exist;
//  - device count is always visible on a collapsed row: nothing hides that a
//    person is several devices.

/** One member device as the caller already resolves it today. */
export interface PersonMemberInput {
  deviceId: string;
  /** The verified signed-profile display name, or the caller's fallback. */
  displayName: string;
  avatarInitial: string | null;
  avatarImage: string | null;
  role: string;
  /** Short device id for the honest per-device line. */
  shortDeviceId: string;
  /** Safety code (SAS fingerprint) shown in the expanded device list. */
  safetyCode: string | null;
  isSelf: boolean;
  blocked: boolean;
  /** When this device's profile was last signed; newest wins the row name. */
  profileUpdatedAt: string | null;
}

/** device id -> derived group id, from verified announces only. */
export type PersonLinkMap = ReadonlyMap<string, string>;

/**
 * True when two devices are the SAME person, per verified links. Used by
 * message headers and DM surfaces so a message authored on your laptop reads
 * as you on your phone. Two devices with no link are never the same person,
 * so an absent announce degrades to today's per-device behavior.
 */
export function isSamePerson(
  links: PersonLinkMap,
  aDeviceId: string,
  bDeviceId: string,
): boolean {
  if (aDeviceId === bDeviceId) return true;
  const a = links.get(aDeviceId);
  const b = links.get(bDeviceId);
  return a !== undefined && a === b;
}

/**
 * The name to show for a device, resolved at PERSON granularity.
 *
 * A device we know by name uses that name. A device we do not know by name but
 * which a verified announce places in the same person as one we DO know shows
 * that person's known name, so a peer's second device stops appearing as a
 * stranger. With no verified link and no known name, the caller's fallback is
 * used -- nothing is ever inferred from an unverified source.
 */
export function resolvePersonName(
  links: PersonLinkMap,
  deviceId: string,
  knownNames: ReadonlyMap<string, string>,
  fallback: string,
): string {
  const direct = knownNames.get(deviceId);
  if (direct) return direct;
  const derived = links.get(deviceId);
  if (derived) {
    for (const [otherId, otherDerived] of links) {
      if (otherDerived !== derived || otherId === deviceId) continue;
      const siblingName = knownNames.get(otherId);
      if (siblingName) return siblingName;
    }
  }
  return fallback;
}

export interface PersonDeviceRow {
  deviceId: string;
  displayName: string;
  shortDeviceId: string;
  safetyCode: string | null;
  role: string;
  blocked: boolean;
  isSelf: boolean;
}

export interface PersonRow {
  /** The derived group id, or `device:<id>` for an ungrouped single device. */
  key: string;
  /** True when this row collapses a verified person group (2+ devices). */
  grouped: boolean;
  displayName: string;
  avatarInitial: string | null;
  avatarImage: string | null;
  /** The role to show: the strongest role any of the person's devices holds. */
  role: string;
  /** Every attested device, sorted for stable rendering. */
  devices: PersonDeviceRow[];
  deviceCount: number;
  /** True when ANY device in the row is this user's own device. */
  isSelf: boolean;
  /** True when EVERY device is blocked. */
  blocked: boolean;
  /**
   * True when SOME but not all devices are blocked. The row must say so:
   * otherwise some of this person's messages are hidden while the control
   * still reads "Block", which silently misstates what the user has done.
   */
  partiallyBlocked: boolean;
  /** True when linked devices disagree on the name right now. */
  nameDisagreement: boolean;
}

const ROLE_RANK: Record<string, number> = { owner: 3, admin: 2, member: 1 };

function strongestRole(roles: readonly string[]): string {
  let best = roles[0] ?? 'member';
  for (const role of roles) {
    if ((ROLE_RANK[role] ?? 0) > (ROLE_RANK[best] ?? 0)) best = role;
  }
  return best;
}

/** Newest signed profile wins the row name; ties break on device id. */
function pickNameSource(devices: readonly PersonMemberInput[]): PersonMemberInput {
  let best = devices[0]!;
  for (const device of devices) {
    const a = device.profileUpdatedAt ?? '';
    const b = best.profileUpdatedAt ?? '';
    if (a > b || (a === b && device.deviceId < best.deviceId)) best = device;
  }
  return best;
}

/**
 * Collapse member devices into person rows. Devices with no verified link (or
 * a link nobody else shares) stay single-device rows, so an absent or
 * unverifiable announce degrades to today's per-device rendering rather than
 * inventing a person.
 */
export function collapseMembersIntoPersons(
  members: readonly PersonMemberInput[],
  links: PersonLinkMap,
): PersonRow[] {
  const byGroup = new Map<string, PersonMemberInput[]>();
  for (const member of members) {
    const derived = links.get(member.deviceId);
    const key = derived ? `group:${derived}` : `device:${member.deviceId}`;
    const bucket = byGroup.get(key);
    if (bucket) bucket.push(member);
    else byGroup.set(key, [member]);
  }

  const rows: PersonRow[] = [];
  for (const [key, devices] of byGroup) {
    const sorted = [...devices].sort((a, b) => (a.deviceId < b.deviceId ? -1 : 1));
    const nameSource = pickNameSource(sorted);
    const names = new Set(sorted.map((d) => d.displayName));
    rows.push({
      key,
      grouped: key.startsWith('group:') && sorted.length > 1,
      displayName: nameSource.displayName,
      avatarInitial: nameSource.avatarInitial,
      avatarImage: nameSource.avatarImage,
      role: strongestRole(sorted.map((d) => d.role)),
      devices: sorted.map((d) => ({
        deviceId: d.deviceId,
        displayName: d.displayName,
        shortDeviceId: d.shortDeviceId,
        safetyCode: d.safetyCode,
        role: d.role,
        blocked: d.blocked,
        isSelf: d.isSelf,
      })),
      deviceCount: sorted.length,
      isSelf: sorted.some((d) => d.isSelf),
      blocked: sorted.every((d) => d.blocked),
      partiallyBlocked: sorted.some((d) => d.blocked) && !sorted.every((d) => d.blocked),
      nameDisagreement: names.size > 1,
    });
  }

  // Stable presentation order: self first, then by name, then by key.
  return rows.sort((a, b) => {
    if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1;
    if (a.displayName !== b.displayName) return a.displayName < b.displayName ? -1 : 1;
    return a.key < b.key ? -1 : 1;
  });
}

/** The device-count affordance on a collapsed row. Never hidden. */
export function personDeviceCountLabel(row: PersonRow): string | null {
  if (row.deviceCount <= 1) return null;
  return `${row.deviceCount} devices`;
}

/** The expanded-section heading (verbatim on both platforms). */
export const CONNECTED_DEVICES_HEADING = 'Connected devices';

/** The honest explainer under the expanded device list. */
export const CONNECTED_DEVICES_HINT =
  'Each device is its own identity with its own safety code. They are shown together because every one of them signed that they belong to the same person.';

/** Shown when linked devices have not converged on one name yet. */
export const NAME_DISAGREEMENT_HINT =
  'These devices are still syncing a name change, so they do not all show the same name yet.';

/** The honest label for a person whose devices are only partly blocked. */
export const PARTIAL_BLOCK_LABEL = 'Some devices blocked';

/** The person-scoped removal confirm body (P5). */
export function personRemovalDeviceLine(row: PersonRow): string {
  if (row.deviceCount <= 1) return 'This removes their device from the community.';
  return `This removes all ${row.deviceCount} of their devices from the community.`;
}
