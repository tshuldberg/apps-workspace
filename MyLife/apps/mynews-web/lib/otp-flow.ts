/**
 * Email OTP sign-in state machine for the public site (plan 48 WP10, C10).
 *
 * The report card needs a reader session, and the reader must not lose the
 * report they were writing in order to get one. So sign-in happens inline, in
 * the card, without navigating: this reducer is the whole flow, and the client
 * component is a thin renderer over it.
 *
 * Pure and framework-free so the transitions are unit-tested rather than
 * clicked. The invariants that matter and are tested:
 *
 *  - a request never leaves while another is in flight (no double-send, which
 *    on the Supabase side means no second email and no burned rate budget);
 *  - a code is only submitted for the address it was sent to (editing the email
 *    invalidates the code stage);
 *  - a failure never advances the flow, and never claims a session exists.
 */

export type OtpStage =
  /** Collecting the email address. */
  | 'email'
  /** Send in flight. */
  | 'sending'
  /** Email accepted for sending; collecting the 6-digit code. */
  | 'code'
  /** Verify in flight. */
  | 'verifying'
  /** Verified; the caller now has a session cookie. */
  | 'signed-in';

export type OtpErrorCode =
  | 'invalid-email'
  | 'invalid-code'
  | 'send-failed'
  | 'not-configured'
  | 'network';

export interface OtpState {
  readonly stage: OtpStage;
  readonly email: string;
  readonly code: string;
  readonly error: OtpErrorCode | null;
}

export type OtpEvent =
  | { type: 'edit-email'; value: string }
  | { type: 'edit-code'; value: string }
  | { type: 'send' }
  | { type: 'send-ok' }
  | { type: 'send-failed'; error: OtpErrorCode }
  | { type: 'verify' }
  | { type: 'verify-ok' }
  | { type: 'verify-failed'; error: OtpErrorCode }
  | { type: 'restart' };

export const INITIAL_OTP_STATE: OtpState = {
  stage: 'email',
  email: '',
  code: '',
  error: null,
};

/** Supabase email OTP codes are six digits. */
export const OTP_CODE_LENGTH = 6;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Deliberately permissive: this is a typo guard, not an address validator. The
 * authority on whether an address exists is the mailbox, and the site must not
 * reject a legitimate address because of a clever regex.
 */
export function isPlausibleEmail(raw: string): boolean {
  const email = normalizeEmail(raw);
  if (email.length < 6 || email.length > 254) return false;
  if (/\s/.test(email)) return false;
  const at = email.indexOf('@');
  if (at < 1 || at !== email.lastIndexOf('@')) return false;
  const domain = email.slice(at + 1);
  return domain.includes('.') && !domain.startsWith('.') && !domain.endsWith('.');
}

/** Keeps only digits, capped at the code length, so paste-with-spaces works. */
export function normalizeCode(raw: string): string {
  return raw.replace(/\D+/g, '').slice(0, OTP_CODE_LENGTH);
}

export function isCompleteCode(raw: string): boolean {
  return normalizeCode(raw).length === OTP_CODE_LENGTH;
}

/** True while a request is in flight; the renderer disables inputs on this. */
export function isOtpBusy(state: OtpState): boolean {
  return state.stage === 'sending' || state.stage === 'verifying';
}

export function otpReducer(state: OtpState, event: OtpEvent): OtpState {
  switch (event.type) {
    case 'edit-email': {
      if (isOtpBusy(state)) return state;
      const email = event.value;
      // Changing the address invalidates a code that was sent to the old one.
      // Silently keeping the `code` stage here would let a reader submit a code
      // against an address that never received it and read the resulting
      // failure as "the code is wrong".
      const changed = normalizeEmail(email) !== normalizeEmail(state.email);
      if (!changed) return { ...state, email };
      return { stage: 'email', email, code: '', error: null };
    }

    case 'edit-code': {
      if (state.stage !== 'code') return state;
      return { ...state, code: normalizeCode(event.value), error: null };
    }

    case 'send': {
      if (isOtpBusy(state)) return state;
      if (!isPlausibleEmail(state.email)) {
        return { ...state, stage: 'email', error: 'invalid-email' };
      }
      return { ...state, stage: 'sending', code: '', error: null };
    }

    case 'send-ok': {
      if (state.stage !== 'sending') return state;
      return { ...state, stage: 'code', error: null };
    }

    case 'send-failed': {
      if (state.stage !== 'sending') return state;
      return { ...state, stage: 'email', error: event.error };
    }

    case 'verify': {
      if (isOtpBusy(state)) return state;
      if (state.stage !== 'code') return state;
      if (!isCompleteCode(state.code)) return { ...state, error: 'invalid-code' };
      return { ...state, stage: 'verifying', error: null };
    }

    case 'verify-ok': {
      if (state.stage !== 'verifying') return state;
      return { ...state, stage: 'signed-in', code: '', error: null };
    }

    case 'verify-failed': {
      if (state.stage !== 'verifying') return state;
      // Back to the code stage with the field cleared: the address is still
      // right, and a stale code in the box invites a second failed attempt.
      return { ...state, stage: 'code', code: '', error: event.error };
    }

    case 'restart':
      return INITIAL_OTP_STATE;
  }
}

const ERROR_COPY: Record<OtpErrorCode, string> = {
  'invalid-email': 'Enter the email address on your MyNews account.',
  'invalid-code': `Enter the ${OTP_CODE_LENGTH}-digit code from the email.`,
  'send-failed': 'Could not send the code. Try again in a moment.',
  'not-configured': 'Sign-in is not available on this deployment. Report from the MyNews app.',
  network: 'No connection. Check your network and try again.',
};

export function otpErrorMessage(code: OtpErrorCode): string {
  return ERROR_COPY[code];
}
