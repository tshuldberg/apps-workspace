/**
 * Expiry checker for MyTravel logistics.
 *
 * Classifies documents and loyalty programs by urgency:
 *   expired  -- expiry_date < today
 *   critical -- expiry_date within 0..30 days from today
 *   warning  -- expiry_date within 31..windowDays (default 90) from today
 *   ok       -- expiry_date beyond windowDays
 *
 * Items without an expiry_date are excluded from every bucket.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type {
  DocumentRow,
  DocumentType,
  LoyaltyProgramRow,
  LoyaltyType,
} from '../models/schemas';

export type ExpiryUrgency = 'expired' | 'critical' | 'warning' | 'ok';

export interface ExpiryItem {
  id: string;
  source: 'document' | 'loyalty';
  type: DocumentType | LoyaltyType;
  name_or_provider: string;
  expiry_date: string;
  days_until_expiry: number;
  urgency: ExpiryUrgency;
}

export interface ExpiryReport {
  expired: ExpiryItem[];
  critical: ExpiryItem[];
  warning: ExpiryItem[];
  ok: ExpiryItem[];
}

export interface CheckExpiryOptions {
  windowDays?: number;
}

const DEFAULT_WINDOW_DAYS = 90;
const CRITICAL_THRESHOLD = 30;

// ── Helpers ─────────────────────────────────────────────────────────

function today(): Date {
  const d = new Date();
  // Normalize to UTC midnight to avoid timezone drift.
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

function parseDate(iso: string): Date | null {
  const hasTime = iso.includes('T');
  const base = hasTime ? iso : `${iso}T00:00:00.000Z`;
  const d = new Date(base);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

function daysBetween(fromUtc: Date, toUtc: Date): number {
  const ms = toUtc.getTime() - fromUtc.getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

export function getUrgencyLevel(
  daysUntil: number,
  windowDays = DEFAULT_WINDOW_DAYS,
): ExpiryUrgency {
  if (daysUntil < 0) return 'expired';
  if (daysUntil <= CRITICAL_THRESHOLD) return 'critical';
  if (daysUntil <= windowDays) return 'warning';
  return 'ok';
}

// ── Main entry ──────────────────────────────────────────────────────

export function checkExpiry(
  db: DatabaseAdapter,
  opts: CheckExpiryOptions = {},
): ExpiryReport {
  const windowDays = opts.windowDays ?? DEFAULT_WINDOW_DAYS;
  const now = today();
  const report: ExpiryReport = {
    expired: [],
    critical: [],
    warning: [],
    ok: [],
  };

  const documents = db.query<DocumentRow>(
    `SELECT * FROM tv_documents WHERE expiry_date IS NOT NULL`,
  );
  for (const doc of documents) {
    if (!doc.expiry_date) continue;
    const expiry = parseDate(doc.expiry_date);
    if (!expiry) continue;
    const days = daysBetween(now, expiry);
    const urgency = getUrgencyLevel(days, windowDays);
    report[urgency].push({
      id: doc.id,
      source: 'document',
      type: doc.type,
      name_or_provider: doc.name,
      expiry_date: doc.expiry_date,
      days_until_expiry: days,
      urgency,
    });
  }

  const programs = db.query<LoyaltyProgramRow>(
    `SELECT * FROM tv_loyalty_programs WHERE expiry_date IS NOT NULL`,
  );
  for (const prog of programs) {
    if (!prog.expiry_date) continue;
    const expiry = parseDate(prog.expiry_date);
    if (!expiry) continue;
    const days = daysBetween(now, expiry);
    const urgency = getUrgencyLevel(days, windowDays);
    report[urgency].push({
      id: prog.id,
      source: 'loyalty',
      type: prog.type,
      name_or_provider: prog.provider,
      expiry_date: prog.expiry_date,
      days_until_expiry: days,
      urgency,
    });
  }

  // Order each bucket by expiry_date ASC (soonest first).
  for (const key of ['expired', 'critical', 'warning', 'ok'] as const) {
    report[key].sort((a, b) =>
      a.expiry_date < b.expiry_date ? -1 : a.expiry_date > b.expiry_date ? 1 : 0,
    );
  }

  return report;
}
