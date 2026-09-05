// Maps editing-desk envelope error codes to plain, honest user copy. Never
// claims success. `collapsed: true` is NOT an error (near-dupe endorsements
// are a success variant handled by the suggest flow) and has no row here.
// Actions let screens route: 'register' -> registration, 'refresh' -> refetch.

export type DeskErrorAction = 'register' | 'refresh' | 'keys';

export interface DeskErrorCopy {
  message: string;
  action?: DeskErrorAction;
}

export const DESK_ERROR_CODES = [
  'no-profile',
  'cap-exceeded',
  'citation-floor',
  'draft-access',
  'bad-signature',
  'not-author',
  'not-open',
  'rev-conflict',
  'changelog-mismatch',
  'batch-mixed-articles',
  'stale',
  'base-mismatch',
  'suspended',
  'terms-not-accepted',
  'not-signed-in',
  'rate-limited',
  'bounds',
  'unknown-suggestion',
  'comment-unavailable',
  'suggest-unavailable',
  'comment-network',
  'key-revoked',
  'key-unavailable',
  'recovery-pending',
  'reauth-required',
  'validation',
  'network',
  'unknown',
] as const;

export type DeskErrorCode = (typeof DESK_ERROR_CODES)[number];

const COPY: Record<DeskErrorCode, DeskErrorCopy> = {
  'no-profile': {
    message: 'You need a public profile to do this. Register a handle to continue.',
    action: 'register',
  },
  'cap-exceeded': {
    message: 'You have reached your open-suggestion cap. Wait for reviews before suggesting more.',
  },
  'citation-floor': {
    message: 'Corrections and context need at least one https citation.',
  },
  'draft-access': {
    message: 'This draft is only visible to its newsroom members.',
  },
  'bad-signature': {
    message: 'The server could not verify the signature. Please try again.',
  },
  'not-author': {
    message: 'Only the article author can apply changes to the article.',
  },
  'not-open': {
    message: 'This suggestion is no longer open.',
    action: 'refresh',
  },
  'rev-conflict': {
    message: 'The article already moved to a newer revision. Refresh and review again.',
    action: 'refresh',
  },
  'changelog-mismatch': {
    message: 'The changelog does not credit every accepted suggestion. Nothing was merged.',
  },
  'batch-mixed-articles': {
    message: 'Batch accept works on one article at a time. Nothing was merged.',
  },
  stale: {
    message: 'This suggestion no longer matches the current article text.',
    action: 'refresh',
  },
  'base-mismatch': {
    message: 'The article changed since this suggestion was written. Refresh to rebase it.',
    action: 'refresh',
  },
  suspended: {
    message: 'Your account is suspended and cannot publish, review, or suggest edits right now.',
  },
  'terms-not-accepted': {
    message: 'Please accept the current Terms and Community Guidelines before publishing or reviewing.',
  },
  'not-signed-in': {
    message: 'Sign in to suggest an edit.',
  },
  'rate-limited': {
    message: 'You are posting too quickly. Wait a moment and try again.',
  },
  bounds: {
    message: 'That is too long. Shorten it and try again.',
  },
  'unknown-suggestion': {
    message: 'That suggestion no longer exists.',
    action: 'refresh',
  },
  'comment-unavailable': {
    message: 'Comments are temporarily unavailable. Your comment was not posted. Try again shortly.',
  },
  'suggest-unavailable': {
    message:
      'Suggesting is temporarily unavailable. Your suggestion was not filed. Try again shortly.',
  },
  'comment-network': {
    message: 'Could not reach the MyNews server, so your comment was not posted. Try again.',
  },
  // Key custody (plan 48 WP6). The signature was fine; the KEY behind it is no
  // longer allowed to author. Saying "signature could not be verified" here
  // would send the author chasing a problem that does not exist, so this names
  // the real cause and points at the one screen that can fix it.
  'key-revoked': {
    message:
      'This device signing key was rotated or revoked, so it can no longer publish or review. Set up a signing key on this device to continue.',
    action: 'keys',
  },
  'key-unavailable': {
    message:
      'The server could not check your signing key, so nothing was saved. Try again shortly.',
  },
  'recovery-pending': {
    message:
      'An account recovery is waiting on this profile, so signing is paused until it completes or is cancelled.',
    action: 'keys',
  },
  'reauth-required': {
    message: 'Sign in again, then retry this key action.',
  },
  validation: {
    message: 'Check the form: something in it is not valid.',
  },
  network: {
    message: 'Could not reach the MyNews server. Check your connection and try again.',
  },
  unknown: {
    message: 'Something went wrong.',
  },
};

/**
 * Unknown codes fall through to the honest generic row. The server detail is
 * appended for cap-exceeded (it carries the real cap), bounds (it names the
 * field and the limit), validation, and unknown; the other messages already
 * name the exact failure.
 */
export function deskErrorMessage(code: string, detail?: string): DeskErrorCopy {
  const base = COPY[code as DeskErrorCode] ?? COPY.unknown;
  const wantsDetail =
    code === 'cap-exceeded' ||
    code === 'bounds' ||
    code === 'validation' ||
    code === 'unknown' ||
    !(code in COPY);
  if (detail && wantsDetail) {
    return { ...base, message: `${base.message} ${detail}` };
  }
  return base;
}
