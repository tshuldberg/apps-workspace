// Pure view-model helpers for the account deletion and export screens (plan 48
// WP5). All display decisions live here so they can be tested without JSX and so
// the screens never invent a state the server did not report.

import type { AccountDeletionView } from '@mylife/mynews';

export interface DeletionScreenModel {
  /** Headline state for the card. */
  headline: string;
  /** One-line explanation of what happens next. */
  detail: string;
  /** Whether the confirm form should be shown. */
  showConfirmForm: boolean;
  /** Whether the cancel button should be shown. */
  showCancel: boolean;
  /** Countdown copy while a grace window is open, else null. */
  countdown: string | null;
  /** Per-step outcomes to render verbatim, empty until a pass has run. */
  steps: Array<{ label: string; state: AccountDeletionView['authUserDeletionState'] }>;
}

/**
 * Whole-day countdown, rounded UP so the copy never claims less time than the
 * user actually has. Returns null once the window has elapsed.
 */
export function graceRemainingLabel(graceEndsAt: string, nowMs: number): string | null {
  const remainingMs = Date.parse(graceEndsAt) - nowMs;
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return null;
  const days = Math.ceil(remainingMs / 86_400_000);
  if (days > 1) return `${days} days left to change your mind`;
  const hours = Math.ceil(remainingMs / 3_600_000);
  if (hours > 1) return `${hours} hours left to change your mind`;
  const minutes = Math.max(1, Math.ceil(remainingMs / 60_000));
  return `${minutes} minutes left to change your mind`;
}

export function buildDeletionScreenModel(
  request: AccountDeletionView | null,
  nowMs: number,
  graceDays: number,
): DeletionScreenModel {
  if (!request) {
    return {
      headline: 'Delete your account',
      detail: `Deletion starts a ${graceDays}-day grace period. You can cancel any time before it ends, and nothing is removed until then.`,
      showConfirmForm: true,
      showCancel: false,
      countdown: null,
      steps: [],
    };
  }

  const steps = [
    { label: 'Sign-in account removed', state: request.authUserDeletionState },
    { label: 'Payment processor cleanup', state: request.processorCleanupState },
  ];

  switch (request.status) {
    case 'grace':
      return {
        headline: 'Deletion scheduled',
        detail:
          'Your account and content are still here. When the grace period ends we remove them in one step.',
        showConfirmForm: false,
        showCancel: true,
        countdown: graceRemainingLabel(request.graceEndsAt, nowMs),
        steps,
      };
    case 'processing':
      return {
        headline: 'Deletion in progress',
        detail: 'The grace period has ended and deletion has started. It can no longer be cancelled.',
        showConfirmForm: false,
        showCancel: false,
        countdown: null,
        steps,
      };
    case 'completed':
      return {
        headline: 'Account deleted',
        detail:
          'Your account is gone. Published work stays online under an anonymized profile, as the privacy policy describes.',
        showConfirmForm: false,
        showCancel: false,
        countdown: null,
        steps,
      };
    case 'cancelled':
      return {
        headline: 'Deletion cancelled',
        detail: 'Nothing was removed. You can start a new deletion request at any time.',
        showConfirmForm: true,
        showCancel: false,
        countdown: null,
        steps: [],
      };
    case 'failed':
      return {
        headline: 'Deletion did not finish',
        detail:
          'Part of the deletion could not complete. It is queued for another attempt; the details are below.',
        showConfirmForm: false,
        showCancel: false,
        countdown: null,
        steps,
      };
  }
}

/** Human file size for the export byte count. */
export function exportSizeLabel(byteCount: number): string {
  if (!Number.isFinite(byteCount) || byteCount <= 0) return '0 KB';
  if (byteCount < 1024) return `${byteCount} B`;
  if (byteCount < 1024 * 1024) return `${Math.round(byteCount / 1024)} KB`;
  return `${(byteCount / (1024 * 1024)).toFixed(1)} MB`;
}

/** Stable filename for a shared export. */
export function exportFileName(nowIso: string): string {
  const day = nowIso.slice(0, 10);
  return `mynews-export-${day}.json`;
}
