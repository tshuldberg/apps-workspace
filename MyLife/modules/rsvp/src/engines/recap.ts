/**
 * Event recap engine for RSVP module.
 * Generates post-event summaries from existing data.
 */

import type { EventRecap, RecapHighlight } from '../types';
import type { DatabaseAdapter } from '@mylife/db';

/**
 * Check if a recap is available (event start_at is in the past).
 */
export function isRecapAvailable(startAt: string): boolean {
  return new Date(startAt) < new Date();
}

/**
 * Calculate event duration in minutes.
 * Defaults to 120 minutes (2 hours) if no end time.
 */
export function calculateDurationMinutes(startAt: string, endAt: string | null): number {
  if (!endAt) return 120;
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  return Math.max(0, Math.round((end - start) / 60000));
}

/**
 * Format duration in minutes to a human-readable string.
 */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Generate a complete event recap from the database.
 */
export function generateRecap(db: DatabaseAdapter, eventId: string): EventRecap | null {
  const eventRows = db.query<Record<string, unknown>>(
    'SELECT * FROM rv_events WHERE id = ?',
    [eventId],
  );
  if (eventRows.length === 0) return null;
  const event = eventRows[0];

  const startAt = event.start_at as string;
  const endAt = (event.end_at as string) ?? null;

  const rsvpStats = db.query<{
    going: number;
    maybe: number;
    plus_ones: number;
    total_invited: number;
    total_responded: number;
  }>(`SELECT
      SUM(CASE WHEN response = 'going' THEN 1 ELSE 0 END) AS going,
      SUM(CASE WHEN response = 'maybe' THEN 1 ELSE 0 END) AS maybe,
      SUM(plus_ones_count) AS plus_ones,
      COUNT(*) AS total_responded,
      (SELECT COUNT(*) FROM rv_invites WHERE event_id = ?) AS total_invited
    FROM rv_rsvps WHERE event_id = ?`,
    [eventId, eventId],
  );

  const stats = rsvpStats[0] ?? { going: 0, maybe: 0, plus_ones: 0, total_invited: 0, total_responded: 0 };
  const attendeeCount = (stats.going ?? 0) + (stats.maybe ?? 0);
  const plusOnesCount = stats.plus_ones ?? 0;
  const totalInvited = stats.total_invited ?? 0;
  const totalResponded = stats.total_responded ?? 0;
  const responseRate = totalInvited > 0 ? Number(((totalResponded / totalInvited) * 100).toFixed(1)) : 0;

  const photoRows = db.query<{ count: number }>(
    'SELECT COUNT(*) AS count FROM rv_photos WHERE event_id = ?',
    [eventId],
  );
  const photoCount = photoRows[0]?.count ?? 0;

  const firstResponderRows = db.query<{ guest_name: string }>(
    `SELECT guest_name FROM rv_rsvps
     WHERE event_id = ? AND response IN ('going', 'maybe')
     ORDER BY responded_at ASC LIMIT 1`,
    [eventId],
  );
  const firstResponder = firstResponderRows[0]?.guest_name ?? null;

  const expenseRows = db.query<{ total: number }>(
    'SELECT SUM(amount_cents) AS total FROM rv_expenses WHERE event_id = ?',
    [eventId],
  );
  const expenseTotalCents = expenseRows[0]?.total ?? 0;

  // Build highlights
  const highlights: RecapHighlight[] = [];

  if (firstResponder) {
    highlights.push({ label: 'First to RSVP', value: firstResponder, icon: 'user-check' });
  }

  if (expenseTotalCents > 0) {
    const perPerson = attendeeCount > 0
      ? `($${(expenseTotalCents / attendeeCount / 100).toFixed(2)}/person)`
      : '';
    highlights.push({
      label: 'Total cost',
      value: `$${(expenseTotalCents / 100).toFixed(2)} ${perPerson}`.trim(),
      icon: 'dollar-sign',
    });
  }

  const commentRows = db.query<{ count: number }>(
    'SELECT COUNT(*) AS count FROM rv_comments WHERE event_id = ?',
    [eventId],
  );
  const commentCount = commentRows[0]?.count ?? 0;
  if (commentCount > 0) {
    highlights.push({ label: 'Comments', value: `${commentCount}`, icon: 'message-circle' });
  }

  // Poll winner
  const pollWinnerRows = db.query<{ question: string; label: string; vote_count: number }>(
    `SELECT p.question, pv.option_id, COUNT(*) AS vote_count,
       json_extract(p.options_json, '$[0].label') AS label
     FROM rv_poll_votes pv
     JOIN rv_polls p ON p.id = pv.poll_id
     WHERE p.event_id = ?
     GROUP BY pv.poll_id, pv.option_id
     ORDER BY vote_count DESC LIMIT 1`,
    [eventId],
  );
  if (pollWinnerRows.length > 0) {
    const pw = pollWinnerRows[0];
    highlights.push({
      label: 'Top poll answer',
      value: `${pw.label ?? 'Option'} (${pw.vote_count} votes)`,
      icon: 'bar-chart',
    });
  }

  const location = [event.location_name, event.location_address].filter(Boolean).join(', ') || null;

  return {
    eventId,
    title: event.title as string,
    date: startAt,
    location: location as string | null,
    durationMinutes: calculateDurationMinutes(startAt, endAt),
    attendeeCount,
    plusOnesCount,
    photoCount,
    highlights,
    firstResponder,
    responseRate,
    expenseTotalCents,
  };
}
