import { describe, expect, it } from 'vitest';
import {
  INITIAL_OTP_STATE,
  isCompleteCode,
  isOtpBusy,
  isPlausibleEmail,
  normalizeCode,
  normalizeEmail,
  otpErrorMessage,
  otpReducer,
  OTP_CODE_LENGTH,
  type OtpEvent,
  type OtpState,
} from '../lib/otp-flow';

/**
 * Plan 48 WP10. The reducer is the whole sign-in flow, so the properties that
 * protect the reader are asserted here rather than clicked: no double send, no
 * code submitted against the wrong address, and no state that claims a session
 * the server never granted.
 */

function run(events: OtpEvent[], from: OtpState = INITIAL_OTP_STATE): OtpState {
  return events.reduce(otpReducer, from);
}

const VALID = 'reader@example.com';

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Reader@Example.COM ')).toBe('reader@example.com');
  });
});

describe('isPlausibleEmail', () => {
  it('accepts ordinary addresses', () => {
    for (const email of ['a@b.co', 'reader@example.com', 'first.last+tag@sub.example.org']) {
      expect(isPlausibleEmail(email), email).toBe(true);
    }
  });

  it('rejects what cannot be an address', () => {
    for (const email of [
      '',
      'reader',
      'reader@',
      '@example.com',
      'reader@example',
      'reader@@example.com',
      'reader @example.com',
      'reader@.com',
      'reader@example.',
      `${'a'.repeat(250)}@example.com`,
    ]) {
      expect(isPlausibleEmail(email), JSON.stringify(email)).toBe(false);
    }
  });
});

describe('normalizeCode', () => {
  it('keeps digits only and caps at the code length', () => {
    expect(normalizeCode(' 12 34-56 ')).toBe('123456');
    expect(normalizeCode('1234567890')).toBe('123456');
    expect(normalizeCode('abc')).toBe('');
  });

  it('treats only a full-length code as complete', () => {
    expect(isCompleteCode('12345')).toBe(false);
    expect(isCompleteCode('123456')).toBe(true);
    expect(OTP_CODE_LENGTH).toBe(6);
  });
});

describe('otpReducer: sending', () => {
  it('refuses to send an implausible address and reports why', () => {
    const state = run([{ type: 'edit-email', value: 'nope' }, { type: 'send' }]);
    expect(state.stage).toBe('email');
    expect(state.error).toBe('invalid-email');
  });

  it('enters sending for a plausible address', () => {
    const state = run([{ type: 'edit-email', value: VALID }, { type: 'send' }]);
    expect(state.stage).toBe('sending');
    expect(state.error).toBeNull();
  });

  it('ignores a second send while one is in flight, so no second email goes out', () => {
    const sending = run([{ type: 'edit-email', value: VALID }, { type: 'send' }]);
    expect(otpReducer(sending, { type: 'send' })).toBe(sending);
  });

  it('advances to the code stage only from sending', () => {
    const sending = run([{ type: 'edit-email', value: VALID }, { type: 'send' }]);
    expect(otpReducer(sending, { type: 'send-ok' }).stage).toBe('code');
    // A send-ok that does not correspond to a send in flight is a stale response.
    expect(otpReducer(INITIAL_OTP_STATE, { type: 'send-ok' }).stage).toBe('email');
  });

  it('returns to the email stage on a send failure and keeps the address typed', () => {
    const state = run([
      { type: 'edit-email', value: VALID },
      { type: 'send' },
      { type: 'send-failed', error: 'send-failed' },
    ]);
    expect(state.stage).toBe('email');
    expect(state.email).toBe(VALID);
    expect(state.error).toBe('send-failed');
  });
});

describe('otpReducer: verifying', () => {
  const atCode = run([
    { type: 'edit-email', value: VALID },
    { type: 'send' },
    { type: 'send-ok' },
  ]);

  it('will not verify an incomplete code', () => {
    const state = run([{ type: 'edit-code', value: '123' }, { type: 'verify' }], atCode);
    expect(state.stage).toBe('code');
    expect(state.error).toBe('invalid-code');
  });

  it('verifies a complete code', () => {
    const state = run([{ type: 'edit-code', value: '123456' }, { type: 'verify' }], atCode);
    expect(state.stage).toBe('verifying');
  });

  it('ignores a second verify while one is in flight', () => {
    const verifying = run([{ type: 'edit-code', value: '123456' }, { type: 'verify' }], atCode);
    expect(otpReducer(verifying, { type: 'verify' })).toBe(verifying);
  });

  it('reaches signed-in only from verifying', () => {
    const verifying = run([{ type: 'edit-code', value: '123456' }, { type: 'verify' }], atCode);
    expect(otpReducer(verifying, { type: 'verify-ok' }).stage).toBe('signed-in');
    // A stray verify-ok must never mint a signed-in state.
    expect(otpReducer(atCode, { type: 'verify-ok' }).stage).toBe('code');
    expect(otpReducer(INITIAL_OTP_STATE, { type: 'verify-ok' }).stage).toBe('email');
  });

  it('clears the code and returns to the code stage on failure', () => {
    const state = run(
      [
        { type: 'edit-code', value: '123456' },
        { type: 'verify' },
        { type: 'verify-failed', error: 'invalid-code' },
      ],
      atCode,
    );
    expect(state.stage).toBe('code');
    expect(state.code).toBe('');
    expect(state.error).toBe('invalid-code');
    expect(state.email).toBe(VALID);
  });

  it('will not verify before a code has been requested', () => {
    expect(otpReducer(INITIAL_OTP_STATE, { type: 'verify' })).toBe(INITIAL_OTP_STATE);
  });
});

describe('otpReducer: email changes invalidate the code stage', () => {
  const atCode = run([
    { type: 'edit-email', value: VALID },
    { type: 'send' },
    { type: 'send-ok' },
    { type: 'edit-code', value: '123456' },
  ]);

  it('drops back to the email stage when the address actually changes', () => {
    const state = otpReducer(atCode, { type: 'edit-email', value: 'other@example.com' });
    expect(state.stage).toBe('email');
    expect(state.code).toBe('');
  });

  it('stays on the code stage when the change is only case or whitespace', () => {
    const state = otpReducer(atCode, { type: 'edit-email', value: ' Reader@Example.com ' });
    expect(state.stage).toBe('code');
    expect(state.code).toBe('123456');
  });

  it('ignores edits while a request is in flight', () => {
    const sending = run([{ type: 'edit-email', value: VALID }, { type: 'send' }]);
    expect(otpReducer(sending, { type: 'edit-email', value: 'x@y.co' })).toBe(sending);
    expect(otpReducer(sending, { type: 'edit-code', value: '111111' })).toBe(sending);
  });

  it('only accepts code edits on the code stage', () => {
    expect(otpReducer(INITIAL_OTP_STATE, { type: 'edit-code', value: '111111' }).code).toBe('');
  });
});

describe('otpReducer: restart and busy', () => {
  it('restart returns to the initial state', () => {
    const dirty = run([
      { type: 'edit-email', value: VALID },
      { type: 'send' },
      { type: 'send-ok' },
      { type: 'edit-code', value: '123456' },
    ]);
    expect(otpReducer(dirty, { type: 'restart' })).toEqual(INITIAL_OTP_STATE);
  });

  it('reports busy for exactly the in-flight stages', () => {
    const stages: Array<[OtpState['stage'], boolean]> = [
      ['email', false],
      ['sending', true],
      ['code', false],
      ['verifying', true],
      ['signed-in', false],
    ];
    for (const [stage, busy] of stages) {
      expect(isOtpBusy({ ...INITIAL_OTP_STATE, stage }), stage).toBe(busy);
    }
  });
});

describe('otpErrorMessage', () => {
  it('has non-empty copy for every error code', () => {
    for (const code of [
      'invalid-email',
      'invalid-code',
      'send-failed',
      'not-configured',
      'network',
    ] as const) {
      expect(otpErrorMessage(code).length, code).toBeGreaterThan(10);
    }
  });

  it('tells an unconfigured deployment the truth instead of blaming the reader', () => {
    expect(otpErrorMessage('not-configured')).toContain('not available');
  });
});
