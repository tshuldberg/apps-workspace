import { encrypt, generateDeviceIdentity, extractSigningPrivateKeyHex } from '@mylife/sync';
import { describe, expect, it, vi } from 'vitest';
import {
  RECOVERY_CODE_CHARS,
  RECOVERY_CODE_ENTROPY_BITS,
  RECOVERY_CODE_ENTROPY_BYTES,
  RECOVERY_KIT_KDF_BUDGET_MS,
  RECOVERY_KIT_SALT_BYTES,
  RECOVERY_KIT_SCRYPT_N,
  RECOVERY_KIT_VERSION,
  createRecoveryKit,
  deriveRecoveryKitKey,
  formatRecoveryCode,
  generateRecoveryCode,
  isRecoveryCodeWellFormed,
  isRecoveryKitEnvelope,
  measureRecoveryKitKdfMs,
  openRecoveryKit,
  parseRecoveryKit,
  platformRandomBytes,
  privateKeyMatchesPubkey,
  recoveryCodesMatch,
  recoveryKitSaltPreimage,
  serializeRecoveryKit,
  type RecoveryKitEnvelope,
} from './recovery-kit';

function identity() {
  const device = generateDeviceIdentity('MyNews Author');
  return {
    pubkey: device.publicKey,
    privateKeyHex: extractSigningPrivateKeyHex(device.privateKeyRef),
  };
}

const PROFILE_ID = '11111111-1111-1111-1111-111111111111';
const CREATED_AT = '2026-07-30T00:00:00.000Z';

/** Deterministic CSPRNG seam for reproducible envelopes. */
function fixedRandom(fill: number) {
  return (byteCount: number) => new Uint8Array(byteCount).fill(fill);
}

function base64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function makeKit(overrides?: { code?: string; profileId?: string }) {
  const keys = identity();
  const code = overrides?.code ?? generateRecoveryCode(fixedRandom(9)).code;
  const envelope = createRecoveryKit({
    profileId: overrides?.profileId ?? PROFILE_ID,
    pubkey: keys.pubkey,
    privateKeyHex: keys.privateKeyHex,
    code,
    createdAt: CREATED_AT,
    randomBytes: fixedRandom(4),
  });
  return { keys, code, envelope };
}

describe('recovery code generation', () => {
  it('draws exactly 160 bits and encodes them as 32 base32 characters', () => {
    const spy = vi.fn(fixedRandom(1));
    const generated = generateRecoveryCode(spy);
    expect(spy).toHaveBeenCalledWith(RECOVERY_CODE_ENTROPY_BYTES);
    expect(RECOVERY_CODE_ENTROPY_BITS).toBe(160);
    expect(generated.entropyBits).toBe(160);
    expect(generated.code).toHaveLength(RECOVERY_CODE_CHARS);
    expect(generated.code).toMatch(/^[0-9A-HJKMNP-TV-Z]{32}$/);
  });

  it('displays the code as 8 groups of 4', () => {
    const generated = generateRecoveryCode(fixedRandom(0));
    expect(generated.display.split('-')).toHaveLength(8);
    for (const group of generated.display.split('-')) expect(group).toHaveLength(4);
    expect(formatRecoveryCode(generated.code)).toBe(generated.display);
  });

  it('refuses a CSPRNG seam that under-delivers instead of zero-padding it', () => {
    expect(() => generateRecoveryCode(() => new Uint8Array(8))).toThrow(/CSPRNG returned 8 bytes/);
  });

  it('reads entropy from the platform CSPRNG and never from Math.random', () => {
    const getRandomValues = vi.spyOn(globalThis.crypto, 'getRandomValues');
    const mathRandom = vi.spyOn(Math, 'random');
    try {
      generateRecoveryCode();
      expect(getRandomValues).toHaveBeenCalled();
      expect(mathRandom).not.toHaveBeenCalled();
    } finally {
      getRandomValues.mockRestore();
      mathRandom.mockRestore();
    }
  });

  it('throws rather than degrading when no platform CSPRNG exists', () => {
    const original = globalThis.crypto;
    try {
      Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
      expect(() => platformRandomBytes(20)).toThrow(/no platform CSPRNG/);
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: original, configurable: true });
    }
  });
});

describe('recovery code normalization and confirmation', () => {
  it('accepts the grouped, lowercase, and whitespace-padded forms of one code', () => {
    const { code } = generateRecoveryCode(fixedRandom(2));
    expect(isRecoveryCodeWellFormed(code)).toBe(true);
    expect(isRecoveryCodeWellFormed(formatRecoveryCode(code))).toBe(true);
    expect(isRecoveryCodeWellFormed(formatRecoveryCode(code).toLowerCase())).toBe(true);
    expect(isRecoveryCodeWellFormed(` ${formatRecoveryCode(code)} `)).toBe(true);
  });

  it('rejects a code of the wrong length', () => {
    expect(isRecoveryCodeWellFormed('ABCD')).toBe(false);
    expect(isRecoveryCodeWellFormed(`${generateRecoveryCode(fixedRandom(3)).code}A`)).toBe(false);
  });

  it('rejects a 33rd character even though it decodes to the same 20 bytes', () => {
    // Base32 packs 5 bits per character, so 32 characters is exactly 160 bits and
    // a 33rd contributes 5 bits that never complete a 21st byte. The decoder
    // therefore returns the SAME key material for both strings. Without an
    // explicit width check, 'CODE' and 'CODEX' would be accepted as the same
    // recovery code, which is exactly the kind of quiet aliasing that makes a
    // code-entry UI untrustworthy.
    const { code } = generateRecoveryCode(fixedRandom(4));
    const overlong = `${code}B`;
    expect(isRecoveryCodeWellFormed(overlong)).toBe(false);
    expect(recoveryCodesMatch(code, overlong)).toBe(false);

    const salt16 = new Uint8Array(RECOVERY_KIT_SALT_BYTES).fill(1);
    const base = { version: 1, profileId: PROFILE_ID, pubkey: 'a'.repeat(64), salt16 };
    expect(() => deriveRecoveryKitKey({ ...base, code: overlong })).toThrow(
      /recovery code is malformed/,
    );
    // And the kit itself refuses to open with it.
    const { envelope } = makeKit({ code });
    expect(openRecoveryKit(envelope, overlong)).toEqual({ ok: false, reason: 'bad-code' });
  });

  it('confirms a re-entry that differs only in grouping or case', () => {
    const { code, display } = generateRecoveryCode(fixedRandom(5));
    expect(recoveryCodesMatch(code, display)).toBe(true);
    expect(recoveryCodesMatch(code, display.toLowerCase())).toBe(true);
  });

  it('rejects a re-entry with a mistyped character', () => {
    const { code } = generateRecoveryCode(fixedRandom(5));
    const mistyped = `${code.slice(0, 31)}${code[31] === 'Z' ? 'Y' : 'Z'}`;
    expect(recoveryCodesMatch(code, mistyped)).toBe(false);
  });

  it('rejects a truncated re-entry even when it is a prefix of the real code', () => {
    const { code } = generateRecoveryCode(fixedRandom(6));
    expect(recoveryCodesMatch(code, code.slice(0, 31))).toBe(false);
  });
});

describe('recovery kit envelope', () => {
  it('roundtrips a signing key through create and open', () => {
    const { keys, code, envelope } = makeKit();
    expect(envelope.v).toBe(RECOVERY_KIT_VERSION);
    expect(envelope.pubkey).toBe(keys.pubkey);
    expect(envelope.profileId).toBe(PROFILE_ID);
    expect(envelope.createdAt).toBe(CREATED_AT);

    const opened = openRecoveryKit(envelope, code);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.privateKeyHex).toBe(keys.privateKeyHex);
    expect(opened.pubkey).toBe(keys.pubkey);
    expect(opened.profileId).toBe(PROFILE_ID);
  });

  it('opens from the grouped display form of the code', () => {
    const { code, envelope } = makeKit();
    expect(openRecoveryKit(envelope, formatRecoveryCode(code)).ok).toBe(true);
  });

  it('never stores the private key in the clear', () => {
    const { keys, envelope } = makeKit();
    expect(serializeRecoveryKit(envelope)).not.toContain(keys.privateKeyHex);
  });

  it('rejects a wrong code', () => {
    const { envelope } = makeKit();
    const other = generateRecoveryCode(fixedRandom(11)).code;
    expect(openRecoveryKit(envelope, other)).toEqual({ ok: false, reason: 'wrong-code' });
  });

  it('rejects a malformed code before spending a derivation', () => {
    const { envelope } = makeKit();
    expect(openRecoveryKit(envelope, 'not-a-code')).toEqual({ ok: false, reason: 'bad-code' });
  });

  it('rejects tampered ciphertext (secretbox authentication)', () => {
    const { code, envelope } = makeKit();
    const bytes = atob(envelope.ciphertext).split('');
    bytes[0] = String.fromCharCode(bytes[0]!.charCodeAt(0) ^ 0xff);
    const tampered: RecoveryKitEnvelope = { ...envelope, ciphertext: btoa(bytes.join('')) };
    expect(openRecoveryKit(tampered, code)).toEqual({ ok: false, reason: 'wrong-code' });
  });

  it('rejects a tampered profileId: metadata is bound through the KDF salt', () => {
    const { code, envelope } = makeKit();
    const tampered: RecoveryKitEnvelope = {
      ...envelope,
      profileId: '22222222-2222-2222-2222-222222222222',
    };
    expect(openRecoveryKit(tampered, code)).toEqual({ ok: false, reason: 'wrong-code' });
  });

  it('rejects a tampered pubkey claim: also bound through the salt', () => {
    const { code, envelope } = makeKit();
    const tampered: RecoveryKitEnvelope = { ...envelope, pubkey: 'b'.repeat(64) };
    expect(openRecoveryKit(tampered, code)).toEqual({ ok: false, reason: 'wrong-code' });
  });

  it('rejects a tampered salt16', () => {
    const { code, envelope } = makeKit();
    const tampered: RecoveryKitEnvelope = {
      ...envelope,
      salt16: btoa(String.fromCharCode(...new Uint8Array(RECOVERY_KIT_SALT_BYTES).fill(99))),
    };
    expect(openRecoveryKit(tampered, code)).toEqual({ ok: false, reason: 'wrong-code' });
  });

  it('rejects a ciphertext transplanted from another kit as a wrong code', () => {
    // Cross-kit ciphertext transplant. The salt binds the claimed pubkey, so the
    // two kits derive DIFFERENT keys and secretbox authentication fails before
    // the post-decrypt check is even reached. That ordering is the salt binding
    // working, and the reason a transplant is indistinguishable from a bad code.
    const a = makeKit();
    const b = makeKit();
    const swapped: RecoveryKitEnvelope = { ...b.envelope, ciphertext: a.envelope.ciphertext };
    expect(openRecoveryKit(swapped, b.code)).toEqual({ ok: false, reason: 'wrong-code' });
    // Three real scrypt derivations; instrumented CI runners need more than the
    // 5s default (2026-08-01 coverage-job timeout).
  }, 30_000);

  it('reports pubkey-mismatch when the sealed key opens but is the wrong key', () => {
    // The only way to reach the post-decrypt assertion: seal the WRONG private
    // key under the envelope's OWN derived key, which is what a corrupt or
    // hand-edited kit looks like. secretbox opens cleanly here, so nothing but
    // the pubkey assertion can catch it, and without that assertion a restore
    // would strand the user under a key the chain does not know.
    const claimed = identity();
    const wrong = identity();
    const code = generateRecoveryCode(fixedRandom(13)).code;
    const salt16 = new Uint8Array(RECOVERY_KIT_SALT_BYTES).fill(4);
    const key = deriveRecoveryKitKey({
      code,
      version: RECOVERY_KIT_VERSION,
      profileId: PROFILE_ID,
      pubkey: claimed.pubkey,
      salt16,
    });
    const sealed = encrypt(new TextEncoder().encode(wrong.privateKeyHex), key);
    const forged: RecoveryKitEnvelope = {
      v: RECOVERY_KIT_VERSION,
      profileId: PROFILE_ID,
      pubkey: claimed.pubkey,
      salt16: base64(salt16),
      nonce: base64(sealed.nonce),
      ciphertext: base64(sealed.ciphertext),
      createdAt: CREATED_AT,
    };
    expect(openRecoveryKit(forged, code)).toEqual({ ok: false, reason: 'pubkey-mismatch' });
  });

  it('refuses to create a kit whose private key does not match the claimed pubkey', () => {
    const a = identity();
    const b = identity();
    expect(() =>
      createRecoveryKit({
        profileId: PROFILE_ID,
        pubkey: a.pubkey,
        privateKeyHex: b.privateKeyHex,
        code: generateRecoveryCode(fixedRandom(1)).code,
        createdAt: CREATED_AT,
      }),
    ).toThrow(/does not derive the claimed pubkey/);
  });

  it('rejects a non-v1 or structurally invalid envelope', () => {
    const { code, envelope } = makeKit();
    expect(openRecoveryKit({ ...envelope, v: 2 }, code)).toEqual({
      ok: false,
      reason: 'bad-envelope',
    });
    expect(openRecoveryKit({ ...envelope, pubkey: 'nope' }, code)).toEqual({
      ok: false,
      reason: 'bad-envelope',
    });
    expect(openRecoveryKit(null, code)).toEqual({ ok: false, reason: 'bad-envelope' });
    expect(openRecoveryKit({ ...envelope, salt16: btoa('short') }, code)).toEqual({
      ok: false,
      reason: 'bad-envelope',
    });
  });

  it('serializes and parses through the file/QR form', () => {
    const { code, envelope } = makeKit();
    const parsed = parseRecoveryKit(serializeRecoveryKit(envelope));
    expect(parsed).not.toBeNull();
    expect(openRecoveryKit(parsed, code).ok).toBe(true);
    expect(parseRecoveryKit('{not json')).toBeNull();
    expect(parseRecoveryKit('{"v":1}')).toBeNull();
  });

  it('validates envelope shape independently of any crypto', () => {
    const { envelope } = makeKit();
    expect(isRecoveryKitEnvelope(envelope)).toBe(true);
    expect(isRecoveryKitEnvelope({ ...envelope, profileId: '' })).toBe(false);
  });
});

describe('recovery kit salt binding', () => {
  it('separates fields so a shifted boundary cannot collide', () => {
    const salt = new Uint8Array(RECOVERY_KIT_SALT_BYTES).fill(1);
    const left = recoveryKitSaltPreimage({
      version: 1,
      profileId: 'a',
      pubkey: 'bc',
      salt16: salt,
    });
    const right = recoveryKitSaltPreimage({
      version: 1,
      profileId: 'ab',
      pubkey: 'c',
      salt16: salt,
    });
    expect(Array.from(left)).not.toEqual(Array.from(right));
  });

  it('derives a different key for every metadata field', () => {
    const salt = new Uint8Array(RECOVERY_KIT_SALT_BYTES).fill(1);
    const code = generateRecoveryCode(fixedRandom(7)).code;
    const base = { code, version: 1, profileId: PROFILE_ID, pubkey: 'a'.repeat(64), salt16: salt };
    const baseline = Array.from(deriveRecoveryKitKey(base));
    expect(Array.from(deriveRecoveryKitKey({ ...base, version: 2 }))).not.toEqual(baseline);
    expect(Array.from(deriveRecoveryKitKey({ ...base, profileId: 'other' }))).not.toEqual(baseline);
    expect(Array.from(deriveRecoveryKitKey({ ...base, pubkey: 'b'.repeat(64) }))).not.toEqual(
      baseline,
    );
    expect(
      Array.from(
        deriveRecoveryKitKey({ ...base, salt16: new Uint8Array(RECOVERY_KIT_SALT_BYTES).fill(2) }),
      ),
    ).not.toEqual(baseline);
    // Five real scrypt derivations; see the transplant test's timeout note.
  }, 30_000);

  it('refuses to derive from a malformed code', () => {
    expect(() =>
      deriveRecoveryKitKey({
        code: 'short',
        version: 1,
        profileId: PROFILE_ID,
        pubkey: 'a'.repeat(64),
        salt16: new Uint8Array(RECOVERY_KIT_SALT_BYTES),
      }),
    ).toThrow(/recovery code is malformed/);
  });
});

describe('pubkey correspondence probe', () => {
  it('accepts a real pair and rejects a mismatched or malformed one', () => {
    const a = identity();
    const b = identity();
    expect(privateKeyMatchesPubkey(a.privateKeyHex, a.pubkey)).toBe(true);
    expect(privateKeyMatchesPubkey(a.privateKeyHex, b.pubkey)).toBe(false);
    expect(privateKeyMatchesPubkey('deadbeef', a.pubkey)).toBe(false);
    expect(privateKeyMatchesPubkey(a.privateKeyHex, 'not-hex')).toBe(false);
  });
});

describe('KDF cost self-test', () => {
  it('keeps one derivation inside the mobile-safe budget at the configured cost', () => {
    expect(RECOVERY_KIT_SCRYPT_N).toBe(32768);
    const elapsed = measureRecoveryKitKdfMs();
    // Shared CI runners under coverage instrumentation run scrypt several times
    // slower than any phone-class device (measured 2298ms on 2026-08-01). Scale
    // the budget there so the test still catches a cost misconfiguration (an N
    // bump blows even the scaled bound) without measuring the runner itself.
    const budget = process.env.CI
      ? RECOVERY_KIT_KDF_BUDGET_MS * 4
      : RECOVERY_KIT_KDF_BUDGET_MS;
    expect(elapsed).toBeLessThan(budget);
  }, 30_000);

  it('measures with the injected clock rather than assuming one', () => {
    let t = 0;
    const elapsed = measureRecoveryKitKdfMs(() => {
      t += 5;
      return t;
    });
    expect(elapsed).toBe(5);
  });
});
