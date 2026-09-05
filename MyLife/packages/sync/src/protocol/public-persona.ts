/**
 * Public persona protocol (Plan 39, P1 -- Meerkat public tier identity).
 *
 * A PUBLIC PERSONA is a SECOND, deliberately-unlinkable identity a user creates for the
 * public tier (base feed, public communities, public profiles). It is a FRESH Ed25519
 * keypair, never the device key: the device identity (pairing, LAN sync, private
 * communities, DMs) and the persona never co-sign, cross-reference, or appear together in
 * any structure (NC-P2). Public posts are persona-signed; the private mesh tier never
 * learns the alias and never requires a persona (NC-P1).
 *
 * Trust model (mirrors humanity-credential.ts / community-profile.ts crypto discipline):
 *  - A PersonaClaim is the artifact the alias registry stores. It binds an ALIAS to a
 *    personaPubkey and to the HUMANITY TOKEN spent at issuance (a hash commitment, not the
 *    token itself), and is signed by the PERSONA key. The registry verifies the persona
 *    signature, redeems the bound humanity token, and confirms the commitment matches, so a
 *    claim cannot be replayed with a different token or a different persona.
 *  - Distinct signing domain 'meerkat-persona-v1' leads the canonical bytes, so a persona
 *    claim can NEVER cross-verify as a device signature, a community profile, a DM, a
 *    humanity token, or any other Meerkat event, and vice versa (TC domain separation).
 *    This is what makes the two identities unlinkable at the signature layer: the persona
 *    key's signatures are confined to the persona domain and never touch a private-tier
 *    payload.
 *  - No new crypto: Ed25519 sign/verify via the existing device-identity wrappers (NC-3);
 *    keypair generation via tweetnacl, exactly as generateDeviceIdentity does.
 *
 * Storage: the persona keypair is derived from a 32-byte SEED (nacl fromSeed, the same
 * primitive humanity-credential.ts uses), and only that seed is held in the SecretStore
 * under a DISTINCT namespace from the device key (a shared-secret ref tagged with
 * PERSONA_SECRET_NAMESPACE, never the device-identity secret ref), so retrieving one can
 * never surface the other. The 32-byte seed fits the shared-secret slot; the full 64-byte
 * signing key is reconstructed on demand and never persisted.
 *
 * Homoglyph policy (documented, enforced): an alias is NFKC-normalized then lowercased, and
 * must match [a-z0-9_]{3,20}. The ASCII-only charset is the homoglyph defense: no Cyrillic
 * 'а', no full-width digits, no zero-width joiners can survive the canonical form, so two
 * aliases that render alike cannot both register. Case is folded, so 'Alice' and 'alice'
 * collide. The registry enforces uniqueness on this exact canonical string.
 */

import nacl from 'tweetnacl';
import { bytesToHex, hexToBytes } from '../encryption/keys';
import { signMessage, verifySignature } from '../identity/device-identity';
import { getSharedSecretHex, storeSharedSecret } from '../secrets/sync-secret-store';

const encoder = new TextEncoder();

/** Distinct signing domain; leads the canonical bytes (never collides with other domains). */
export const PERSONA_CLAIM_DOMAIN = 'meerkat-persona-v1';

/**
 * The SecretStore namespace tag for persona private keys. Distinct from the device-identity
 * secret ref so a persona key and the device key never live in the same store slot and a
 * lookup for one can never return the other (NC-P2).
 */
export const PERSONA_SECRET_NAMESPACE = 'meerkat-persona-key';

export const PERSONA_ALIAS_MIN = 3;
export const PERSONA_ALIAS_MAX = 20;

/** The canonical alias charset: lowercase ASCII letters, digits, underscore, 3-20 chars. */
const ALIAS_CANONICAL_RE = /^[a-z0-9_]{3,20}$/;

/**
 * Canonicalize a user-entered alias to its unique, case-folded, ASCII form, or return null
 * when it is out of charset/length. NFKC folds width/compatibility variants BEFORE the
 * ASCII gate, so a full-width or homoglyph character normalizes and is then rejected by the
 * charset (it never becomes a lookalike ASCII letter). The registry stores and compares
 * this exact string, so uniqueness is case- and homoglyph-insensitive.
 */
export function canonicalizeAlias(raw: string): string | null {
  if (typeof raw !== 'string') return null;
  const folded = raw.normalize('NFKC').trim().toLowerCase();
  return ALIAS_CANONICAL_RE.test(folded) ? folded : null;
}

/** True iff `raw` is already in canonical alias form (used at verify time, fail-closed). */
export function isCanonicalAlias(raw: unknown): raw is string {
  return typeof raw === 'string' && ALIAS_CANONICAL_RE.test(raw);
}

const HEX_32_BYTES = /^[0-9a-f]{64}$/;
/** sha512 hex (64 bytes). The humanity-token commitment uses sha512Hex, the repo-wide hash. */
const HEX_64_BYTES = /^[0-9a-f]{128}$/;

/**
 * A public persona: the persona's public key, an opaque SecretStore ref to its private key
 * (distinct namespace from the device key), and its canonical alias. The device identity is
 * intentionally NOT referenced here (NC-P2).
 */
export interface PublicPersona {
  version: 1;
  /** The persona's Ed25519 public key (hex). This is the public-tier author id. */
  personaPubkey: string;
  /** Opaque SecretStore reference to the persona's Ed25519 private key. */
  privateKeyRef: string;
  /** The canonical alias this persona will register (case-folded, ASCII). */
  alias: string;
  createdAt: string;
}

/**
 * A persona-signed claim binding an alias + persona key + the humanity token spent at
 * issuance. This is what the client presents to the registry to register the alias.
 */
export interface PersonaClaim {
  version: 1;
  /** Canonical alias (case-folded, ASCII). */
  alias: string;
  /** The persona's Ed25519 public key (hex); the signer. */
  personaPubkey: string;
  /**
   * A hash commitment to the humanity token spent at issuance: sha512(tokenId) as hex, the
   * SAME value the humanity service records as spent. It carries no identity and binds the
   * claim to a genuine humanity check without embedding the (single-use, bearer) token.
   */
  humanityBinding: string;
  issuedAt: string;
  /** Ed25519 signature (hex) over the canonical form, by the PERSONA key. */
  signature: string;
}

export type UnsignedPersonaClaim = Omit<PersonaClaim, 'signature'>;

export type PersonaClaimVerdict = 'ok' | 'invalid' | 'malformed';

/**
 * Canonical byte form. The FIRST element is the persona domain string, distinct from every
 * other Meerkat protocol, so a claim and a device/community/DM/humanity payload can never
 * cross-verify (NC-P2 cross-domain confusion defense).
 */
export function canonicalPersonaClaimBytes(claim: UnsignedPersonaClaim): Uint8Array {
  return encoder.encode(
    JSON.stringify([
      PERSONA_CLAIM_DOMAIN,
      claim.version,
      claim.alias,
      claim.personaPubkey,
      claim.humanityBinding,
      claim.issuedAt,
    ]),
  );
}

/**
 * Generate a fresh persona keypair and persist its private key in the SecretStore under the
 * persona namespace (distinct from the device key). The returned persona references only its
 * own key material; the device identity is never touched (NC-P2). `alias` is canonicalized;
 * a bad alias throws before any key is stored.
 */
export function generatePublicPersona(alias: string, now: number = Date.now()): PublicPersona {
  const canonical = canonicalizeAlias(alias);
  if (!canonical) {
    throw new Error('Pick a public name using 3-20 letters, numbers, or underscores.');
  }
  // Derive the keypair from a fresh 32-byte seed (fromSeed, mirroring humanity-credential).
  // Only the 32-byte seed is persisted -- it fits the shared-secret slot and never reveals
  // the device key.
  const seed = nacl.randomBytes(32);
  const keypair = nacl.sign.keyPair.fromSeed(seed);
  const personaPubkey = bytesToHex(keypair.publicKey);
  // Distinct namespace: shared-secret ref tagged with PERSONA_SECRET_NAMESPACE, never the
  // device-identity secret ref. A device-key lookup can never return this slot.
  const privateKeyRef = storeSharedSecret(PERSONA_SECRET_NAMESPACE, personaPubkey, bytesToHex(seed));
  return {
    version: 1,
    personaPubkey,
    privateKeyRef,
    alias: canonical,
    createdAt: new Date(now).toISOString(),
  };
}

/**
 * Resolve a persona's full 64-byte Ed25519 signing key (hex) from its SecretStore ref by
 * reconstructing it from the stored seed. Throws if the seed is unavailable.
 *
 * SECURITY (fail-closed): the SecretStore's shared-secret refs are a shared namespace with
 * pairwise PEER secrets, and the ref does not expose its origin tag. So a corrupt persona
 * record -- or a caller that accidentally passes a peer `sharedSecretRef` -- must NOT be
 * allowed to derive a signing key from a secret a paired peer also knows (that peer could
 * then impersonate the persona). We defend by binding the seed to the persona: the seed MUST
 * reproduce exactly `expectedPersonaPubkey`, otherwise the ref is not this persona's key and
 * we refuse to sign. A pairwise peer secret can never reproduce the persona's public key, so
 * this closes the cross-namespace confusion codex flagged without needing ref introspection.
 */
export function extractPersonaPrivateKeyHex(privateKeyRef: string, expectedPersonaPubkey: string): string {
  const seedHex = getSharedSecretHex(privateKeyRef);
  if (!seedHex) {
    throw new Error('The public persona key is unavailable in secure storage.');
  }
  const keypair = nacl.sign.keyPair.fromSeed(hexToBytes(seedHex));
  if (bytesToHex(keypair.publicKey) !== expectedPersonaPubkey) {
    // The stored secret does not derive this persona's key: a wrong/peer/corrupt ref.
    throw new Error('The stored persona key does not match this persona; refusing to sign.');
  }
  return bytesToHex(keypair.secretKey);
}

export interface CreatePersonaClaimInput {
  persona: PublicPersona;
  /**
   * The hash commitment to the humanity token being spent at issuance: sha512(tokenId) hex.
   * The caller (onboarding flow) derives this from the humanity token it will present to the
   * registry, so the persona commits to the exact token it spends.
   */
  humanityBinding: string;
  issuedAt?: string;
  now?: number;
}

/**
 * Sign a PersonaClaim with the persona's private key. Binds the canonical alias, the persona
 * key, and the humanity-token commitment under the persona domain. Fail-closed on a bad
 * alias or a malformed binding.
 */
export function createPersonaClaim(input: CreatePersonaClaimInput): PersonaClaim {
  const { persona } = input;
  if (!isCanonicalAlias(persona.alias)) {
    throw new Error('The persona alias is not in canonical form.');
  }
  if (!HEX_64_BYTES.test(input.humanityBinding)) {
    throw new Error('The humanity binding must be a sha512 hex commitment.');
  }
  const now = input.now ?? Date.now();
  const unsigned: UnsignedPersonaClaim = {
    version: 1,
    alias: persona.alias,
    personaPubkey: persona.personaPubkey,
    humanityBinding: input.humanityBinding,
    issuedAt: input.issuedAt ?? new Date(now).toISOString(),
  };
  const privateKeyHex = extractPersonaPrivateKeyHex(persona.privateKeyRef, persona.personaPubkey);
  const signature = bytesToHex(signMessage(privateKeyHex, canonicalPersonaClaimBytes(unsigned)));
  return { ...unsigned, signature };
}

function isPersonaClaimShape(value: unknown): value is PersonaClaim {
  if (!value || typeof value !== 'object') return false;
  const c = value as Record<string, unknown>;
  return (
    c.version === 1
    && typeof c.alias === 'string'
    && typeof c.personaPubkey === 'string'
    && typeof c.humanityBinding === 'string'
    && typeof c.issuedAt === 'string'
    && typeof c.signature === 'string'
  );
}

/**
 * Verify a PersonaClaim fail-closed:
 *  - 'malformed' = wrong shape, non-canonical alias, non-hex persona key/binding.
 *  - 'invalid'   = a signature that does not verify against the claimed persona key (this
 *                  includes a claim whose bytes were signed under a DIFFERENT domain or by a
 *                  different key -- the domain-led canonical bytes make cross-domain reuse
 *                  fail here, which is the NC-P2 leakage guard).
 *  - 'ok'        = a well-formed claim whose signature verifies under the persona key.
 * The alias must already be canonical (the registry stores the canonical form), so a claim
 * carrying a non-canonical alias is rejected before the signature check.
 */
export function verifyPersonaClaim(claim: PersonaClaim): PersonaClaimVerdict {
  if (!isPersonaClaimShape(claim)) return 'malformed';
  if (!isCanonicalAlias(claim.alias)) return 'malformed';
  if (!HEX_32_BYTES.test(claim.personaPubkey)) return 'malformed';
  if (!HEX_64_BYTES.test(claim.humanityBinding)) return 'malformed';
  let ok = false;
  try {
    ok = verifySignature(
      claim.personaPubkey,
      canonicalPersonaClaimBytes({
        version: claim.version,
        alias: claim.alias,
        personaPubkey: claim.personaPubkey,
        humanityBinding: claim.humanityBinding,
        issuedAt: claim.issuedAt,
      }),
      hexToBytes(claim.signature),
    );
  } catch {
    return 'invalid';
  }
  return ok ? 'ok' : 'invalid';
}

// ---------------------------------------------------------------------------
// Persona-key proof BYTES shared by the client (which signs) and the accounts
// service (which verifies). Kept here, in the pure protocol layer, so the RN/web
// app and the server node build byte-identical messages from ONE definition (no
// duplicated protocol constant to drift). The server-only HMAC session bearer and
// the verify wrappers live in the relay package; these are only the signable bytes.
// ---------------------------------------------------------------------------

/** Domain for the session-issuance challenge the persona key signs to prove key possession. */
export const PERSONA_SESSION_CHALLENGE_DOMAIN = 'meerkat-persona-session-challenge-v1';
/** Domains for persona-signed GDPR requests. */
export const PERSONA_GDPR_DELETE_DOMAIN = 'meerkat-persona-gdpr-delete-v1';
export const PERSONA_GDPR_EXPORT_DOMAIN = 'meerkat-persona-gdpr-export-v1';

/** Canonical bytes the persona key signs to prove possession for a session challenge. */
export function personaSessionChallengeBytes(nonce: string, personaPubkey: string): Uint8Array {
  return encoder.encode(JSON.stringify([PERSONA_SESSION_CHALLENGE_DOMAIN, nonce, personaPubkey]));
}

/** Canonical bytes for a persona-signed request (GDPR delete/export), domain-separated. */
export function personaRequestBytes(domain: string, personaPubkey: string, issuedAtMs: number): Uint8Array {
  return encoder.encode(JSON.stringify([domain, personaPubkey, issuedAtMs]));
}
