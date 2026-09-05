/**
 * Queue-status vocabularies shared by the fetchers, the overview counts, and
 * the action bookkeeping so the surfaces can never disagree about what
 * "open" means (review finding: duplicated literal lists drift).
 */

/** bc_moderation_queue rows a moderator still needs to look at. */
export const PROOF_QUEUE_OPEN_STATUSES = ['queued', 'processing', 'failed'] as const;

/** bc_flags / bc_photo_reports rows that are still live. */
export const REPORT_OPEN_STATUSES = ['open', 'noted'] as const;

export function isReportOpenStatus(status: string): boolean {
  return (REPORT_OPEN_STATUSES as readonly string[]).includes(status);
}
