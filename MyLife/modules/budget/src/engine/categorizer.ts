/**
 * ML auto-categorization engine.
 *
 * Uses weighted frequency analysis with recency bias to predict
 * which envelope a transaction should be assigned to based on
 * the user's transaction history. No external ML frameworks;
 * runs entirely on-device.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CategorizationInput {
  merchant: string;
  amount: number; // cents
  date: string;   // YYYY-MM-DD
}

export interface Prediction {
  envelopeId: string;
  confidence: number; // 0.0 - 1.0
}

export interface FeedbackRecord {
  merchantNormalized: string;
  envelopeId: string;
  wasAccepted: boolean;
  amount: number;
  date: string;
}

export interface AccuracyResult {
  accepted: number;
  rejected: number;
  total: number;
  accuracy: number; // 0.0 - 1.0
}

// ---------------------------------------------------------------------------
// Merchant normalization
// ---------------------------------------------------------------------------

const STRIP_PATTERNS = [
  /\s*#\d+.*$/,              // Store numbers
  /\s*\d{5,}.*$/,            // Long digit suffixes (zip codes, IDs)
  /\s*-\s*\d+$/,             // Trailing dash + number
  /\s+(sq|sqr|square)\s*\*.*$/i, // Square payment prefixes
  /\s+\d{1,2}\/\d{1,2}$/,   // Trailing dates
  /[^\w\s&']/g,              // Special chars except & and '
];

export function normalizeMerchant(raw: string): string {
  if (!raw || !raw.trim()) return '';
  let m = raw.trim();
  for (const pat of STRIP_PATTERNS) {
    m = m.replace(pat, '');
  }
  return m.replace(/\s+/g, ' ').trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Prediction engine
// ---------------------------------------------------------------------------

const RECENCY_DAYS = 30;
const RECENCY_WEIGHT = 2.0;
const MIN_HISTORY = 10;
const DEFAULT_THRESHOLD = 0.6;

export function predictCategory(
  input: CategorizationInput,
  history: FeedbackRecord[],
  options?: { threshold?: number; minHistory?: number },
): Prediction | null {
  const threshold = options?.threshold ?? DEFAULT_THRESHOLD;
  const minHistory = options?.minHistory ?? MIN_HISTORY;

  // Need minimum history to make predictions
  if (history.length < minHistory) return null;

  const normalized = normalizeMerchant(input.merchant);
  if (!normalized) return null;

  // Filter history to matching merchant
  const merchantHistory = history.filter(h => h.merchantNormalized === normalized);
  if (merchantHistory.length === 0) return null;

  // Build weighted frequency map
  const inputDate = new Date(input.date).getTime();
  const envelopeScores = new Map<string, number>();
  let totalWeight = 0;

  for (const record of merchantHistory) {
    const recordDate = new Date(record.date).getTime();
    const daysDiff = Math.max(0, (inputDate - recordDate) / (1000 * 60 * 60 * 24));
    const recencyWeight = daysDiff <= RECENCY_DAYS ? RECENCY_WEIGHT : 1.0;

    // Only count accepted feedback positively; rejected feedback reduces that envelope's weight
    const weight = record.wasAccepted ? recencyWeight : -recencyWeight * 0.5;

    const current = envelopeScores.get(record.envelopeId) ?? 0;
    envelopeScores.set(record.envelopeId, current + weight);
    totalWeight += Math.abs(weight);
  }

  if (totalWeight === 0) return null;

  // Find top envelope
  let bestEnvelope = '';
  let bestScore = -Infinity;
  for (const [envId, score] of envelopeScores) {
    if (score > bestScore) {
      bestScore = score;
      bestEnvelope = envId;
    }
  }

  if (!bestEnvelope || bestScore <= 0) return null;

  // Calculate confidence as proportion of total weight
  const confidence = Math.min(bestScore / totalWeight, 1.0);

  if (confidence < threshold) return null;

  return { envelopeId: bestEnvelope, confidence };
}

// ---------------------------------------------------------------------------
// Accuracy tracking
// ---------------------------------------------------------------------------

export function calculateAccuracy(
  accepted: number,
  rejected: number,
): AccuracyResult {
  const total = accepted + rejected;
  return {
    accepted,
    rejected,
    total,
    accuracy: total > 0 ? accepted / total : 0,
  };
}
