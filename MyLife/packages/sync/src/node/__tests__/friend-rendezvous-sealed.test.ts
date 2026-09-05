/**
 * Sealed friend-code rendezvous (Plan 23 D.5).
 *
 * Proves: publishing with the secret half of an extended code stores an OPAQUE
 * secretbox record on the relay (the relay can no longer read the identity from
 * it); resolving the extended code decrypts + verifies the bundle; the secret
 * half is never transmitted (only the rid crosses the wire); a legacy un-sealed
 * record still resolves through the fallback; and a wrong/absent secret half
 * fails closed instead of leaking the identity.
 */

import { describe, it, expect } from 'vitest';
import naclUtil from 'tweetnacl-util';
import {
  publishIdentityToRendezvous,
  resolveIdentityFromRendezvous,
  deriveRendezvousSealKey,
} from '../friend-rendezvous';
import {
  generateFriendCode,
  generateRendezvousSecretHalf,
  buildExtendedFriendCode,
  parseExtendedFriendCode,
  encodeFriendCode,
} from '../friend-code';
import { generateDeviceIdentity } from '../../identity/device-identity';
import { bytesToHex } from '../../encryption/keys';

const { encodeUTF8, decodeBase64 } = naclUtil;

function stubRendezvousRelay() {
  const store = new Map<string, string>();
  const sentFrames: { t?: string; rid?: string; rec?: string }[] = [];

  class StubWebSocket {
    readyState = 1;
    private handlers: Record<string, ((ev?: unknown) => void)[]> = {};
    constructor(_url: string) {
      setTimeout(() => this.emit('open'), 0);
    }
    addEventListener(type: string, handler: (ev?: unknown) => void) {
      (this.handlers[type] ??= []).push(handler);
    }
    private emit(type: string, ev?: unknown) {
      for (const h of this.handlers[type] ?? []) h(ev);
    }
    send(data: string) {
      let frame: { t?: string; rid?: string; rec?: string };
      try {
        frame = JSON.parse(data);
      } catch {
        return;
      }
      sentFrames.push(frame);
      if (frame.t === 'pub' && frame.rid && frame.rec) {
        store.set(frame.rid, frame.rec);
        setTimeout(() => this.emit('message', { data: JSON.stringify({ t: 'pubok', rid: frame.rid }) }), 0);
      } else if (frame.t === 'res' && frame.rid) {
        const rec = store.get(frame.rid);
        if (rec == null) {
          setTimeout(() => this.emit('message', { data: JSON.stringify({ t: 'err', code: 'not_found' }) }), 0);
        } else {
          store.delete(frame.rid);
          setTimeout(() => this.emit('message', { data: JSON.stringify({ t: 'rec', rid: frame.rid, rec }) }), 0);
        }
      }
    }
    close() {
      /* no-op */
    }
  }

  return {
    WebSocket: StubWebSocket as unknown as new (url: string) => unknown,
    record: (rid: string) => store.get(rid),
    sentFrames,
  };
}

describe('sealed friend-code rendezvous (D.5)', () => {
  it('seals the record so the relay cannot read the identity, and the secret half never leaves', async () => {
    const relay = stubRendezvousRelay();
    const identity = generateDeviceIdentity('Sealed Person');
    const { code, rendezvousId } = generateFriendCode();
    const secretHalf = generateRendezvousSecretHalf();
    const extendedCode = buildExtendedFriendCode(code, secretHalf);

    const publishedCode = await publishIdentityToRendezvous({
      url: 'ws://relay.test',
      identity,
      rendezvousId,
      secretHalf,
      webSocketImpl: relay.WebSocket as never,
    });
    // Finding #3: a sealed publish returns the EXTENDED code to share, not the
    // bare public code (which could not decrypt the sealed record).
    expect(publishedCode).toBe(extendedCode);

    const ridHex = bytesToHex(rendezvousId);
    const stored = relay.record(ridHex)!;
    // The stored record is a secretbox payload (nonce.ct), not plain base64 JSON.
    expect(stored).toContain('.');
    // A curious relay operator base64-decoding the record learns nothing: the
    // device public key is NOT present in any naive decode of the stored record.
    let leaked = '';
    try {
      leaked = encodeUTF8(decodeBase64(stored));
    } catch {
      leaked = '';
    }
    expect(leaked).not.toContain(identity.publicKey);
    expect(stored).not.toContain(identity.publicKey);

    // TC-3: only the rid (hex of the public half) crossed the wire; the secret
    // half never appears in any transmitted frame.
    const secretHex = bytesToHex(secretHalf);
    for (const frame of relay.sentFrames) {
      expect(frame.rid).not.toBe(secretHex);
      expect(JSON.stringify(frame)).not.toContain(secretHex);
    }

    // Resolving the extended code decrypts + verifies the correct identity.
    const result = await resolveIdentityFromRendezvous({
      url: 'ws://relay.test',
      code: extendedCode,
      webSocketImpl: relay.WebSocket as never,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.bundle.bundle.deviceId).toBe(identity.publicKey);
      expect(result.bundle.bundle.displayName).toBe('Sealed Person');
    }
  });

  it('still resolves a legacy un-sealed record when allowLegacyUnsealed (default)', async () => {
    const relay = stubRendezvousRelay();
    const identity = generateDeviceIdentity('Legacy Person');
    const { code, rendezvousId } = generateFriendCode();

    // Publish WITHOUT a secret half -> legacy base64 record.
    await publishIdentityToRendezvous({
      url: 'ws://relay.test',
      identity,
      rendezvousId,
      webSocketImpl: relay.WebSocket as never,
    });

    // Resolve with the plain (non-extended) code still works.
    const result = await resolveIdentityFromRendezvous({
      url: 'ws://relay.test',
      code,
      webSocketImpl: relay.WebSocket as never,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.bundle.bundle.deviceId).toBe(identity.publicKey);
  });

  it('a sealed record cannot be read by a public-only code (fails closed, no leak)', async () => {
    const relay = stubRendezvousRelay();
    const identity = generateDeviceIdentity('Private Person');
    const { code, rendezvousId } = generateFriendCode();
    const secretHalf = generateRendezvousSecretHalf();

    await publishIdentityToRendezvous({
      url: 'ws://relay.test',
      identity,
      rendezvousId,
      secretHalf,
      webSocketImpl: relay.WebSocket as never,
    });

    // Resolving with only the PUBLIC code (no secret half) cannot decrypt the
    // sealed record: it fails closed as invalid_bundle, never returning identity.
    const result = await resolveIdentityFromRendezvous({
      url: 'ws://relay.test',
      code,
      webSocketImpl: relay.WebSocket as never,
    });
    expect(result).toEqual({ ok: false, reason: 'invalid_bundle' });
  });

  it('an EXTENDED code refuses a legacy un-sealed record (no silent downgrade, finding #1)', async () => {
    const relay = stubRendezvousRelay();
    const identity = generateDeviceIdentity('Downgrade Target');
    const { rendezvousId } = generateFriendCode();
    const secretHalf = generateRendezvousSecretHalf();

    // A hostile/legacy relay serves an UN-SEALED base64 record under this rid.
    await publishIdentityToRendezvous({
      url: 'ws://relay.test',
      identity,
      rendezvousId,
      // no secretHalf => legacy base64 record
      webSocketImpl: relay.WebSocket as never,
    });

    // Resolving with an EXTENDED code (secret half present) must NOT fall back to
    // the plaintext record: it fails closed rather than accept a downgrade.
    const extendedCode = buildExtendedFriendCode(encodeFriendCode(rendezvousId), secretHalf);
    const result = await resolveIdentityFromRendezvous({
      url: 'ws://relay.test',
      code: extendedCode,
      webSocketImpl: relay.WebSocket as never,
    });
    expect(result).toEqual({ ok: false, reason: 'invalid_bundle' });
  });

  it('round-trips the extended code parse and derives a stable seal key', () => {
    const { code } = generateFriendCode();
    const secretHalf = generateRendezvousSecretHalf();
    const extended = buildExtendedFriendCode(code, secretHalf);
    const parsed = parseExtendedFriendCode(extended);
    expect(parsed).not.toBeNull();
    expect(bytesToHex(parsed!.secretHalf)).toBe(bytesToHex(secretHalf));
    // The seal key is a deterministic function of the secret half.
    expect(bytesToHex(deriveRendezvousSealKey(parsed!.secretHalf))).toBe(
      bytesToHex(deriveRendezvousSealKey(secretHalf)),
    );
  });
});
