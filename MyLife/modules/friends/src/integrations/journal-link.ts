// ── Journal Integration ─────────────────────────────────────────────
// Provides deep links and pre-filled context for journaling about friends.

/**
 * Get a deep link path for starting a journal entry about a person.
 * The journal module can use the person name as context for the entry.
 */
export function getJournalDeepLink(personName: string): string {
  const encoded = encodeURIComponent(personName);
  return `/journal/new?context=friend&name=${encoded}`;
}

/**
 * Generate pre-filled prompt text for a journal entry about a friend.
 * Useful for "write about this hangout" flows.
 */
export function getJournalContext(personName: string, lastHangout?: string): string {
  if (lastHangout) {
    return `Reflecting on time with ${personName} (${lastHangout})...`;
  }
  return `Thinking about ${personName}...`;
}
