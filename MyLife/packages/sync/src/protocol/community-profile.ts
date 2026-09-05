import type { DeviceIdentity } from '../types';
import {
  extractSigningPrivateKeyHex,
  signMessage,
  verifySignature,
} from '../identity/device-identity';
import { bytesToHex, hexToBytes } from '../encryption/keys';
import { sha512Hex } from '../node/hkdf';

const encoder = new TextEncoder();

/**
 * Hard cap on a DECODED avatar image (Plan 32 T2.1): 32 KB. The cap is computed
 * from the decoded byte length (the base64 string is also required to be a valid
 * multiple-of-4 length), not from a fixed character count. Enforced at BOTH create
 * and verify so an oversized image can never ride a signed v2 event (fail-closed).
 */
export const COMMUNITY_AVATAR_MAX_BYTES = 32 * 1024;

/** Plan 56 feature 53: closed name-color tokens (contrast-valid palette slots). */
export const PROFILE_NAME_COLOR_TOKENS = ['accent', 'success', 'warning', 'danger', 'info'] as const;
export type ProfileNameColorToken = (typeof PROFILE_NAME_COLOR_TOKENS)[number];

export const PROFILE_BIO_MAX_CHARS = 280;
export const PROFILE_PRONOUNS_MAX_CHARS = 40;

export interface CommunityProfileEvent {
  version: 1 | 2 | 3;
  id: string;
  communityId: string;
  memberDeviceId: string;
  displayName: string;
  avatarInitial: string | null;
  /**
   * v2+ base64 JPEG avatar (signature-covered ONLY when version >= 2; v1
   * events must never carry it). Downscaled + hard-capped before signing.
   */
  avatarImage?: string;
  /** v3-only persona fields (Plan 56 feature 53): signature-covered on v3. */
  bio?: string;
  pronouns?: string;
  /** Closed palette token (feature 6: contrast-valid by construction). */
  nameColor?: ProfileNameColorToken;
  updatedAt: string;
  signature: string;
}

export interface CommunityProfileInput {
  communityId: string;
  displayName: string;
  avatarInitial?: string | null;
  avatarImage?: string | null;
  bio?: string | null;
  pronouns?: string | null;
  nameColor?: ProfileNameColorToken | null;
  updatedAt?: string;
}

type UnsignedCommunityProfileEvent = Omit<CommunityProfileEvent, 'id' | 'signature'>;
type SignedCommunityProfileEventWithoutId = Omit<CommunityProfileEvent, 'id'>;

function normalizeDisplayName(displayName: string): string {
  return displayName.trim().replace(/\s+/g, ' ').slice(0, 48);
}

/**
 * The one display-name normalization shared by community profiles and the plan
 * 52 presentation profile (person-group.ts), exported so the two layers cannot
 * drift on what a "same name" means.
 */
export function normalizeProfileDisplayName(displayName: string): string {
  return normalizeDisplayName(displayName);
}

function normalizeAvatarInitial(initial: string | null | undefined, displayName: string): string | null {
  const value = (initial ?? '').trim();
  const source = value.length > 0 ? value : displayName.trim();
  const first = Array.from(source)[0];
  return first ? first.toUpperCase() : null;
}

/** Decoded byte length of a base64 string; Infinity when the length is not a valid base64 multiple. */
function base64DecodedByteLength(base64: string): number {
  const len = base64.length;
  if (len === 0 || len % 4 !== 0) return Number.POSITIVE_INFINITY;
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return (len / 4) * 3 - padding;
}

/**
 * A well-formed, in-cap base64 JPEG. The `/9j/` prefix is the base64 encoding of
 * the JPEG SOI magic bytes (FF D8 FF), so this is a data-shape gate without a
 * decoder dependency. Used at create AND verify (TC-5 / NC-6).
 *
 * Honesty boundary (by design): this checks byte size + the SOI prefix only. It
 * does NOT decode the JPEG or check pixel dimensions, so a signed-but-corrupt or
 * huge-dimension in-cap avatar is accepted here and simply renders BLANK on the
 * client (Avatar.tsx / RNImage) rather than crashing. The blast radius is bounded
 * by the 32 KB decoded cap.
 */
export function isValidCommunityAvatarImage(value: string): boolean {
  if (!value || value.length % 4 !== 0) return false;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return false;
  if (!value.startsWith('/9j/')) return false;
  return base64DecodedByteLength(value) <= COMMUNITY_AVATAR_MAX_BYTES;
}

function normalizeAvatarImage(value: string | null | undefined): string | undefined {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return undefined;
  if (!isValidCommunityAvatarImage(trimmed)) {
    throw new Error('That avatar image is too large or not a supported format.');
  }
  return trimmed;
}

function canonicalCommunityProfile(event: UnsignedCommunityProfileEvent): Uint8Array {
  const base: unknown[] = [
    event.version === 3
      ? 'meerkat-community-profile-v3'
      : event.version === 2
        ? 'meerkat-community-profile-v2'
        : 'meerkat-community-profile-v1',
    event.version,
    event.communityId,
    event.memberDeviceId,
    event.displayName,
    event.avatarInitial,
    event.updatedAt,
  ];
  // Conditional canonical append (channel-message.ts P9.3b precedent): version
  // fields are signature-covered ONLY at their version, so older bytes stay
  // byte-identical and older signatures keep verifying.
  if (event.version >= 2) {
    base.push(event.avatarImage ?? null);
  }
  if (event.version === 3) {
    base.push(event.bio ?? null, event.pronouns ?? null, event.nameColor ?? null);
  }
  return encoder.encode(JSON.stringify(base));
}

export function communityProfileId(event: SignedCommunityProfileEventWithoutId): string {
  const { signature, ...unsigned } = event;
  const canonical = canonicalCommunityProfile(unsigned);
  const signatureBytes = encoder.encode(signature);
  const bytes = new Uint8Array(canonical.length + signatureBytes.length);
  bytes.set(canonical, 0);
  bytes.set(signatureBytes, canonical.length);
  return sha512Hex(bytes).slice(0, 32);
}

export function createCommunityProfileEvent(
  member: DeviceIdentity,
  input: CommunityProfileInput,
): CommunityProfileEvent {
  const displayName = normalizeDisplayName(input.displayName);
  if (!displayName) {
    throw new Error('Choose a community display name.');
  }
  const avatarImage = normalizeAvatarImage(input.avatarImage);
  const bio = (input.bio ?? '').trim().slice(0, PROFILE_BIO_MAX_CHARS) || undefined;
  const pronouns = (input.pronouns ?? '').trim().slice(0, PROFILE_PRONOUNS_MAX_CHARS) || undefined;
  const nameColor = input.nameColor ?? undefined;
  if (nameColor !== undefined && !(PROFILE_NAME_COLOR_TOKENS as readonly string[]).includes(nameColor)) {
    throw new Error('Unknown name color.');
  }
  const hasPersona = Boolean(bio || pronouns || nameColor);
  const version: 1 | 2 | 3 = hasPersona ? 3 : avatarImage ? 2 : 1;
  const unsigned: UnsignedCommunityProfileEvent = {
    version,
    communityId: input.communityId,
    memberDeviceId: member.publicKey,
    displayName,
    avatarInitial: normalizeAvatarInitial(input.avatarInitial, displayName),
    updatedAt: input.updatedAt ?? new Date().toISOString(),
    ...(avatarImage ? { avatarImage } : {}),
    ...(version === 3 && bio ? { bio } : {}),
    ...(version === 3 && pronouns ? { pronouns } : {}),
    ...(version === 3 && nameColor ? { nameColor } : {}),
  };
  const privateKeyHex = extractSigningPrivateKeyHex(member.privateKeyRef);
  const signature = bytesToHex(signMessage(privateKeyHex, canonicalCommunityProfile(unsigned)));
  const withoutId = { ...unsigned, signature };
  return { ...withoutId, id: communityProfileId(withoutId) };
}

export function verifyCommunityProfileEvent(event: CommunityProfileEvent): boolean {
  if (event.version !== 1 && event.version !== 2 && event.version !== 3) return false;
  if (!event.communityId || !event.memberDeviceId || !event.displayName || !event.updatedAt) {
    return false;
  }
  if (event.displayName !== normalizeDisplayName(event.displayName)) return false;
  const normalizedInitial = normalizeAvatarInitial(event.avatarInitial, event.displayName);
  if (event.avatarInitial !== normalizedInitial) return false;
  // A v1 event must never carry an avatar image (it would be outside the signature).
  // A v2 image must pass the same cap + data-shape gate as create, so an oversized
  // or malformed image fails verification before the signature check (fail-closed).
  if (event.version === 1) {
    if (event.avatarImage !== undefined) return false;
  } else if (event.avatarImage !== undefined && !isValidCommunityAvatarImage(event.avatarImage)) {
    return false;
  }
  // Persona fields ride ONLY a v3 signature (fail-closed both directions).
  if (event.version !== 3) {
    if (event.bio !== undefined || event.pronouns !== undefined || event.nameColor !== undefined) return false;
  } else {
    if (event.bio !== undefined && (typeof event.bio !== 'string' || event.bio.length === 0 || event.bio.length > PROFILE_BIO_MAX_CHARS)) return false;
    if (event.pronouns !== undefined && (typeof event.pronouns !== 'string' || event.pronouns.length === 0 || event.pronouns.length > PROFILE_PRONOUNS_MAX_CHARS)) return false;
    if (event.nameColor !== undefined && !(PROFILE_NAME_COLOR_TOKENS as readonly string[]).includes(event.nameColor)) return false;
  }
  if (event.id !== communityProfileId(event)) return false;
  try {
    const { id, signature, ...unsigned } = event;
    void id;
    return verifySignature(
      event.memberDeviceId,
      canonicalCommunityProfile(unsigned),
      hexToBytes(signature),
    );
  } catch {
    return false;
  }
}

export function compareCommunityProfileEvents(
  a: CommunityProfileEvent,
  b: CommunityProfileEvent,
): number {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt < b.updatedAt ? -1 : 1;
  if (a.memberDeviceId !== b.memberDeviceId) return a.memberDeviceId < b.memberDeviceId ? -1 : 1;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}
