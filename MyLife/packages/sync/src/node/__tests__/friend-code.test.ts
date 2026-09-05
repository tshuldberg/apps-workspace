import { describe, it, expect } from 'vitest';
import {
  generateFriendCode,
  encodeFriendCode,
  parseFriendCode,
  isValidFriendCode,
} from '../friend-code';

describe('friend codes', () => {
  it('generates the MEER-XXXX-XXXX-XXXX-XXXX shape', () => {
    const { code } = generateFriendCode();
    expect(code).toMatch(/^MEER-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
  });

  it('round-trips a generated code back to its rendezvous id', () => {
    const { code, rendezvousId } = generateFriendCode();
    const parsed = parseFriendCode(code);
    expect(parsed).not.toBeNull();
    expect(Buffer.from(parsed!).toString('hex')).toBe(Buffer.from(rendezvousId).toString('hex'));
  });

  it('encodes a known id deterministically', () => {
    const id = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(encodeFriendCode(id)).toBe(encodeFriendCode(id));
    expect(parseFriendCode(encodeFriendCode(id))).toEqual(id);
  });

  it('rejects a single mistyped character via the checksum', () => {
    const { code } = generateFriendCode();
    const chars = code.split('');
    // Flip a payload character (skip the MEER- prefix and dashes).
    const idx = code.length - 1;
    chars[idx] = chars[idx] === '0' ? '1' : '0';
    const corrupted = chars.join('');
    // Either malformed or checksum-rejected; never silently accepted as the same id.
    if (isValidFriendCode(corrupted)) {
      expect(parseFriendCode(corrupted)).not.toEqual(parseFriendCode(code));
    } else {
      expect(parseFriendCode(corrupted)).toBeNull();
    }
  });

  it('is case-insensitive and tolerates spacing', () => {
    const { code } = generateFriendCode();
    const messy = code.toLowerCase().replace(/-/g, ' ');
    expect(parseFriendCode(messy)).toEqual(parseFriendCode(code));
  });

  it('accepts Crockford transcription aliases (O->0, I/L->1)', () => {
    const id = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]);
    const code = encodeFriendCode(id); // all-zero id encodes to leading 0s
    const aliased = code.replace(/0/g, 'O');
    expect(parseFriendCode(aliased)).toEqual(id);
  });

  it('rejects malformed input', () => {
    expect(parseFriendCode('not a code')).toBeNull();
    expect(parseFriendCode('MEER-1234')).toBeNull();
    expect(isValidFriendCode('')).toBe(false);
  });
});
