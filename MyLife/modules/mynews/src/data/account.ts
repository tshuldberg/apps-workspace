// Account rights (plan 48 WP5): the deletion/export contract shared by the app,
// the public web, and the mynews-account edge function. Pure constants, one
// view type, and one error-copy mapper. No imports, so this stays safe for RSC
// and for the web-safe cloud-fetch subpath.

/** Deletion-request status as the client sees it. Mirrors the edge fn view. */
export interface AccountDeletionView {
  requestId: string;
  status: 'grace' | 'processing' | 'completed' | 'cancelled' | 'failed';
  requestedAt: string;
  graceEndsAt: string;
  graceDays: number;
  cancellable: boolean;
  cancelledAt: string | null;
  completedAt: string | null;
  failureDetail: string | null;
  /**
   * Side-effect outcomes, surfaced verbatim. 'skipped-unconfigured' means the
   * step is not wired in this deployment; the UI must say so rather than imply
   * the step succeeded.
   */
  authUserDeletionState: AccountDeletionSideEffectState;
  processorCleanupState: AccountDeletionSideEffectState;
}

export type AccountDeletionSideEffectState =
  | 'pending'
  | 'done'
  | 'skipped-unconfigured'
  | 'failed';

/** The exact phrase the deletion flow requires. Mirrored by the edge function. */
export const DELETION_CONFIRMATION_PHRASE = 'DELETE MY ACCOUNT';

/**
 * Disclosed grace window in days. The server is authoritative (every request
 * view carries graceDays); this constant backs copy shown before a request
 * exists, and is pinned to the SQL interval by the mynews-account drift test.
 */
export const ACCOUNT_DELETION_GRACE_DAYS = 7;

/**
 * What deletion retains versus removes. This is the disclosure the account
 * screens and the privacy policy both render, so the two can never drift.
 */
export const ACCOUNT_DELETION_RETAINED: readonly string[] = [
  'Published articles, their revision history, accepted edit suggestions and the credibility ledger stay online under an anonymized profile. Removing them would rewrite other contributors public record and break signature verification of the archive.',
  'Reports, copyright notices, counter-notices and safety case records are kept for the legal retention period.',
  'Payment records kept for tax and accounting: past support charges, receipts and transfers. Recurring support is cancelled.',
];

export const ACCOUNT_DELETION_REMOVED: readonly string[] = [
  'Your handle, display name, bio, beats, region and signing key. The key is revoked, so nothing new can ever be published as you.',
  'Your drafts, your open and rejected edit suggestions, and your comments on editing threads.',
  'Your follows, blocks and mutes, your newsroom memberships, your verification evidence, and your record of accepting the terms.',
  'Your login: the account itself is deleted, so you can no longer sign in.',
];

/** Honest inline copy for every typed error the mynews-account function returns. */
export function accountErrorMessage(code: string): string {
  switch (code) {
    case 'not-signed-in':
      return 'Sign in first. Account actions need a session.';
    case 'confirmation-mismatch':
      return `Type ${DELETION_CONFIRMATION_PHRASE} exactly to confirm.`;
    case 'reauth-required':
      return 'For your safety this needs a fresh sign-in. Sign in again, then confirm.';
    case 'no-deletion-request':
      return 'There is no deletion request to cancel.';
    case 'not-cancellable':
      return 'This deletion has already started and can no longer be cancelled.';
    case 'export-too-large':
      return 'Your export is too large to download in the app. Contact us and we will send you a copy.';
    case 'export-unavailable':
      return 'Could not build your export. Nothing was changed; try again.';
    case 'deletion-unavailable':
    case 'account-unavailable':
      return 'The server could not be reached. Nothing was changed; try again.';
    case 'bad-payload':
      return 'That request was not understood.';
    default:
      return 'Something went wrong. Nothing was changed.';
  }
}

/**
 * Human summary of one side-effect state. Never claims success for a step the
 * deployment has not wired.
 */
export function accountDeletionStepLabel(state: AccountDeletionSideEffectState): string {
  switch (state) {
    case 'done':
      return 'Done';
    case 'pending':
      return 'Waiting';
    case 'skipped-unconfigured':
      return 'Not configured on this server';
    case 'failed':
      return 'Failed, will retry';
  }
}
