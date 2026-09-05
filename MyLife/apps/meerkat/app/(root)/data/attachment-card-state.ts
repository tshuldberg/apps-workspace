// attachment-card-state.ts: pure view-model for the in-channel file card.
//
// Why this exists: the card's honesty-critical decisions (present vs removed vs
// checking, what the freed-space line says, that "Request again" is a disabled
// Phase 3 stub) must be testable without React Native. This module is pure: no
// IO, no native modules, no React. The card component renders over it; tests
// drive it directly.
//
// Presence is derived LIVE from a real ExpoBlobStore.has() check (passed in as
// `present`), never a stored flag and never read from the signed, immutable
// attachment metadata. The freed-space figure uses the SIGNED attachment.size,
// not on-disk (base64-inflated) bytes.

import { formatBytes } from '../theme/format';
import type { RemoveBlobResult } from './blob-store-core';

/**
 * The card's render mode.
 *   - 'checking': the on-this-device check has not resolved yet (present === null).
 *   - 'present':  the blob is on this device; show View / Save to... / Remove.
 *   - 'removed':  the blob is not on this device; show the dashed placeholder with
 *                 the (disabled) Request again control.
 */
export type AttachmentCardMode = 'checking' | 'present' | 'removed';

/**
 * "Request again" is the Phase 3 request/approve re-send protocol. It is now
 * LIVE: tapping it seals + parks a real FILE_REQUEST to the message author over
 * the pair-private mailbox, and the card reflects the real cm_file_requests row
 * state (requested -> restored | declined | failed). The control is only
 * interactive when a real request is actually possible (see
 * deriveRequestAgainAvailability): the author is a paired member and a relay is
 * configured. Otherwise it stays disabled with honest copy.
 */
export const REQUEST_AGAIN_LABEL = 'Request again';

/** Whether the Request-again protocol is built (Phase 3 shipped). */
export const REQUEST_AGAIN_ENABLED = true;

/**
 * Map a live presence value to the card's render mode. `null` means the async
 * has() check has not resolved; that is the only "checking" source.
 */
export function deriveAttachmentCardMode(present: boolean | null): AttachmentCardMode {
  if (present === null) return 'checking';
  return present ? 'present' : 'removed';
}

/**
 * The "on this device" meta line for the present-state card. The size is the
 * signed attachment size.
 */
export function presentMetaLabel(size: number): string {
  return `${formatBytes(size)} · on this device`;
}

// ---------------------------------------------------------------------------
// Request-again availability + status (Phase 3, all honest)
// ---------------------------------------------------------------------------

/**
 * Whether a real "request again" is possible for this card right now, and the
 * honest reason it is not when it isn't. The button is interactive ONLY when
 * `canRequest` is true; otherwise it stays disabled with `disabledReason`.
 */
export interface RequestAgainAvailability {
  canRequest: boolean;
  disabledReason: string | null;
}

export interface RequestAgainContext {
  /** Did THIS device author the message? You cannot request your own file back. */
  isOwnMessage: boolean;
  /** Is the message author currently a paired device (so a request can be sealed)? */
  authorPaired: boolean;
  /** Is a relay configured (the store-and-forward path the request rides)? */
  relayConfigured: boolean;
}

export function deriveRequestAgainAvailability(ctx: RequestAgainContext): RequestAgainAvailability {
  if (ctx.isOwnMessage) {
    return { canRequest: false, disabledReason: 'You shared this file. Re-add it from your own device.' };
  }
  if (!ctx.authorPaired) {
    return { canRequest: false, disabledReason: 'You can only request from a paired member.' };
  }
  if (!ctx.relayConfigured) {
    return { canRequest: false, disabledReason: 'Set a connection server before requesting files back.' };
  }
  return { canRequest: true, disabledReason: null };
}

/** The live request state for an attachment, mirrored from cm_file_requests. */
export type RequestAgainStatus =
  | 'none'
  | 'requesting'
  | 'requested'
  | 'restored'
  | 'declined'
  | 'failed';

export interface RequestAgainView {
  /** Tone for the status line. */
  tone: 'info' | 'success' | 'error';
  /** Honest user-facing message, or null when there is nothing to show. */
  message: string | null;
  /** Whether the button should currently read "Requesting...". */
  busy: boolean;
}

/**
 * Map a live request status (the cm_file_requests row status, or a transient
 * 'requesting' while the seal+park is in flight) to honest UI. NEVER claims
 * delivery or restoration the row does not assert.
 */
export function deriveRequestAgainView(
  status: RequestAgainStatus,
  detail?: string | null,
): RequestAgainView {
  switch (status) {
    case 'requesting':
      return { tone: 'info', message: 'Sending request to the owner…', busy: true };
    case 'requested':
      return {
        tone: 'info',
        message: 'Waiting for the owner to approve. They will see your request the next time they are online.',
        busy: false,
      };
    case 'restored':
      // The card flips back via live presence; this line is a brief confirmation.
      return { tone: 'success', message: 'Restored to this device.', busy: false };
    case 'declined':
      return { tone: 'error', message: detail?.trim() || 'Owner declined.', busy: false };
    case 'failed':
      return {
        tone: 'error',
        message: detail?.trim() || 'Could not send the request. You can try again.',
        busy: false,
      };
    case 'none':
    default:
      return { tone: 'info', message: null, busy: false };
  }
}

/** Honest copy for a queue-request failure reason from SyncProvider. */
export function requestQueueFailureMessage(
  reason:
    | 'not_paired'
    | 'no_relay'
    | 'revoked'
    | 'not_a_member'
    | 'park_failed'
    | 'self_author',
): string {
  switch (reason) {
    case 'not_paired':
      return 'You can only request from a paired member.';
    case 'no_relay':
      return 'Set a connection server before requesting files back.';
    case 'revoked':
      return 'That member is revoked on this device.';
    case 'not_a_member':
      return 'The owner is no longer a member of this community.';
    case 'park_failed':
      return 'Could not reach the connection server to send the request. Try again when you are online.';
    case 'self_author':
      return 'You shared this file. Re-add it from your own device.';
    default: {
      const _exhaustive: never = reason;
      return _exhaustive;
    }
  }
}

/**
 * The placeholder sub-line after a successful local removal, e.g.
 * "Removed from this device to free 2.1 MB". Uses the SIGNED size so the figure
 * is honest (on-disk base64 bytes are larger and must not be reported).
 */
export function freedBytesLabel(size: number): string {
  return `Removed from this device to free ${formatBytes(size)}`;
}

/** The placeholder sub-line for a blob that is simply absent (no fresh removal). */
export const REMOVED_META_LABEL = 'Removed from this device';

/**
 * Turn a removeLocal() result into honest UI feedback. Only a `freed: true`
 * result reports that space was freed; a kept (still-referenced) blob says so
 * plainly, and any failure surfaces a real error instead of a false success.
 */
export interface RemoveFeedback {
  /** True only when the on-disk bytes were confirmed gone. Drives the placeholder. */
  removed: boolean;
  /** Tone for the status line. */
  tone: 'success' | 'info' | 'error';
  /** User-facing message. */
  message: string;
}

export function summarizeRemoveResult(result: RemoveBlobResult, size: number): RemoveFeedback {
  if (result.freed) {
    return { removed: true, tone: 'success', message: freedBytesLabel(size) };
  }
  switch (result.reason) {
    case 'not-present':
      // The file was already gone; treat the card as removed without claiming we
      // freed anything new.
      return { removed: true, tone: 'info', message: REMOVED_META_LABEL };
    case 'still-referenced':
      return {
        removed: false,
        tone: 'info',
        message: 'Kept on this device: another file in this community still uses these bytes.',
      };
    case 'verify-failed':
      return {
        removed: false,
        tone: 'error',
        message: 'Could not confirm the file was deleted. Your local copy is still here.',
      };
    case 'error':
      return {
        removed: false,
        tone: 'error',
        message: `Could not remove the local copy: ${result.message}`,
      };
    default: {
      const _exhaustive: never = result;
      return _exhaustive;
    }
  }
}
