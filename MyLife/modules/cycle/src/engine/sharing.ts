import type { SharedCycleView, CyclePhase, PartnerLink } from '../types';
import { SharedCycleViewSchema } from '../types';

// Safe alphabet: excludes 0/O, 1/I/L for readability
const SAFE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const CODE_LENGTH = 6;

/**
 * Generate a 6-character alphanumeric share code from a safe alphabet.
 * Excludes ambiguous characters: 0, O, 1, I, L.
 * Uses crypto.getRandomValues for better randomness than Math.random.
 */
export function generateShareCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += SAFE_ALPHABET[bytes[i] % SAFE_ALPHABET.length];
  }
  return code;
}

/**
 * Generate a SharedCycleView snapshot based on current cycle state
 * and the partner link's sharing preferences.
 */
export function generateSharedView(
  link: PartnerLink,
  data: {
    currentPhase?: CyclePhase | null;
    cycleDay?: number | null;
    predictedNextPeriod?: string | null;
    fertileWindowStart?: string | null;
    fertileWindowEnd?: string | null;
    symptomCount?: number | null;
    pregnancyWeek?: number | null;
    pregnancyDueDate?: string | null;
    displayName?: string | null;
  },
): SharedCycleView {
  return {
    version: 1,
    linkCode: link.linkCode,
    generatedAt: new Date().toISOString(),
    currentPhase: link.sharePhase ? (data.currentPhase ?? null) : null,
    cycleDay: link.sharePhase ? (data.cycleDay ?? null) : null,
    predictedNextPeriod: link.sharePredictions ? (data.predictedNextPeriod ?? null) : null,
    fertileWindowStart: link.shareFertileWindow ? (data.fertileWindowStart ?? null) : null,
    fertileWindowEnd: link.shareFertileWindow ? (data.fertileWindowEnd ?? null) : null,
    symptomSummary: link.shareSymptoms && data.symptomCount != null && data.symptomCount > 0
      ? `${data.symptomCount} symptom${data.symptomCount === 1 ? '' : 's'} logged today`
      : null,
    pregnancyWeek: link.sharePregnancy ? (data.pregnancyWeek ?? null) : null,
    pregnancyDueDate: link.sharePregnancy ? (data.pregnancyDueDate ?? null) : null,
    partnerName: data.displayName ?? null,
  };
}

/**
 * Validate an imported snapshot against the SharedCycleView schema
 * and verify the link code matches.
 */
export function validateSnapshot(
  json: unknown,
  expectedLinkCode: string,
): { valid: true; data: SharedCycleView } | { valid: false; error: string } {
  const parsed = SharedCycleViewSchema.safeParse(json);
  if (!parsed.success) {
    return { valid: false, error: 'Invalid snapshot format' };
  }

  if (parsed.data.linkCode !== expectedLinkCode) {
    return { valid: false, error: "This update doesn't match your link code" };
  }

  return { valid: true, data: parsed.data };
}

/**
 * Check if a snapshot is stale (older than 30 days).
 */
export function isSnapshotStale(generatedAt: string, now?: string): boolean {
  const generated = new Date(generatedAt).getTime();
  const current = now ? new Date(now).getTime() : Date.now();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  return (current - generated) > thirtyDays;
}
