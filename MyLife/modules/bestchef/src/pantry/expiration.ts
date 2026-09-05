import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ExpirationDateCandidate,
  ExpirationOcrInput,
  ExpirationOcrProvider,
  ExpirationOcrResult,
  ExpirationStatus,
  PantryBatch,
} from '../types';
import { callVisionBroker } from '../cloud/provider-broker';

const DEFAULT_EXPIRING_SOON_DAYS = 3;
const MODEL = 'claude-haiku-4-5-20251001';
const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const EXPIRATION_OCR_PROMPT = `Transcribe the visible expiration, best-by, sell-by, use-by, packed-on, batch, and lot text in this grocery or pantry photo. Return plain text only. Do not infer a date that is not visible.`;

export const PANTRY_BATCH_SECTION_ORDER: ExpirationStatus[] = [
  'expired',
  'expiring_soon',
  'fresh',
  'no_date',
];

interface ClaudeResponse {
  content?: Array<{ text?: string }>;
}

const MONTH_INDEX: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function normalizeYear(value: number): number {
  if (value < 100) return value >= 70 ? 1900 + value : 2000 + value;
  return value;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function normalizeDate(year: number, month: number, day: number): string | null {
  const normalizedYear = normalizeYear(year);
  if (normalizedYear < 2000 || normalizedYear > 2100) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(normalizedYear, month - 1, day);
  if (
    date.getFullYear() !== normalizedYear ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return `${normalizedYear}-${pad(month)}-${pad(day)}`;
}

function surroundingText(rawText: string, index: number, length: number): string {
  return rawText.slice(Math.max(0, index - 20), Math.min(rawText.length, index + length + 20)).toLowerCase();
}

function visibleContext(rawText: string, index: number, length: number): string {
  return rawText
    .slice(Math.max(0, index - 24), Math.min(rawText.length, index + length + 24))
    .replace(/\s+/g, ' ')
    .trim();
}

function contextConfidence(rawText: string, index: number, length: number, base: number): number {
  const context = surroundingText(rawText, index, length);
  const hasExpirationSignal = /\b(exp|expires|expiration|best\s*by|use\s*by|sell\s*by|enjoy\s*by|bb)\b/.test(context);
  const hasLotSignal = /\b(lot|batch|packed|packed\s*on)\b/.test(context);
  if (hasExpirationSignal) return clampConfidence(base + 0.14);
  if (hasLotSignal) return clampConfidence(base - 0.04);
  return clampConfidence(base);
}

function addCandidate(
  candidates: Map<string, ExpirationDateCandidate>,
  rawText: string,
  matchText: string,
  index: number,
  normalizedDate: string | null,
  baseConfidence: number,
  reason: string,
  requiresManualSelection = false,
): void {
  if (!normalizedDate) return;
  const candidate: ExpirationDateCandidate = {
    id: `expiration-${normalizedDate}-${candidates.size + 1}`,
    rawText: matchText.trim(),
    normalizedDate,
    confidence: contextConfidence(rawText, index, matchText.length, baseConfidence),
    reason,
    context: visibleContext(rawText, index, matchText.length),
    requiresManualSelection,
    bounding_box: null,
    crop_uri: null,
  };
  const existing = candidates.get(normalizedDate);
  if (!existing || candidate.confidence > existing.confidence) {
    candidates.set(normalizedDate, candidate);
  }
}

export function parseExpirationDateCandidates(rawText: string): ExpirationDateCandidate[] {
  const candidates = new Map<string, ExpirationDateCandidate>();
  const text = rawText.trim();
  if (!text) return [];

  for (const match of text.matchAll(/\b((?:19|20)\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/g)) {
    addCandidate(
      candidates,
      text,
      match[0],
      match.index ?? 0,
      normalizeDate(Number(match[1]), Number(match[2]), Number(match[3])),
      0.86,
      'Detected ISO-style date.',
    );
  }

  for (const match of text.matchAll(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/g)) {
    const first = Number(match[1]);
    const second = Number(match[2]);
    const year = Number(match[3]);
    const index = match.index ?? 0;
    if (first <= 12 && second <= 12) {
      addCandidate(
        candidates,
        text,
        match[0],
        index,
        normalizeDate(year, first, second),
        0.8,
        'Ambiguous slash date interpreted as month/day/year.',
        true,
      );
      addCandidate(
        candidates,
        text,
        match[0],
        index,
        normalizeDate(year, second, first),
        0.72,
        'Ambiguous slash date interpreted as day/month/year.',
        true,
      );
    } else {
      const month = first > 12 ? second : first;
      const day = first > 12 ? first : second;
      addCandidate(
        candidates,
        text,
        match[0],
        index,
        normalizeDate(year, month, day),
        first > 12 ? 0.74 : 0.8,
        first > 12 ? 'Detected day/month/year date.' : 'Detected month/day/year date.',
      );
    }
  }

  const monthPattern = new RegExp(`\\b(${Object.keys(MONTH_INDEX).join('|')})\\.?\\s+(\\d{1,2})(?:,)?\\s+((?:19|20)?\\d{2})\\b`, 'gi');
  for (const match of text.matchAll(monthPattern)) {
    addCandidate(
      candidates,
      text,
      match[0],
      match.index ?? 0,
      normalizeDate(Number(match[3]), MONTH_INDEX[match[1]!.toLowerCase()] ?? 0, Number(match[2])),
      0.84,
      'Detected written month date.',
    );
  }

  for (const match of text.matchAll(/\b((?:19|20)\d{2})(\d{2})(\d{2})\b/g)) {
    addCandidate(
      candidates,
      text,
      match[0],
      match.index ?? 0,
      normalizeDate(Number(match[1]), Number(match[2]), Number(match[3])),
      0.72,
      'Detected compact year-month-day date.',
    );
  }

  return Array.from(candidates.values()).sort((left, right) => (
    right.confidence - left.confidence ||
    left.normalizedDate.localeCompare(right.normalizedDate)
  ));
}

function addInputEvidence(
  candidates: ExpirationDateCandidate[],
  input: ExpirationOcrInput,
): ExpirationDateCandidate[] {
  return candidates.map((candidate) => ({
    ...candidate,
    bounding_box: input.boundingBox ?? candidate.bounding_box ?? null,
    crop_uri: input.cropUri ?? candidate.crop_uri ?? null,
  }));
}

export function createStaticExpirationOcrProvider(rawText: string, confidence = 0.7): ExpirationOcrProvider {
  return {
    id: 'manual-expiration-ocr',
    async recognize() {
      return {
        rawText,
        confidence: rawText.trim().length > 0 ? confidence : 0,
        providerId: 'manual-expiration-ocr',
        providerStatus: 'manual',
      };
    },
  };
}

/**
 * Broker-backed expiration OCR provider. Public-launch builds use this
 * factory so the Anthropic key stays server-side. The broker returns
 * normalized text that flows into the same `parseExpirationDateCandidates`
 * pipeline as the BYO and manual paths.
 */
export function createBrokerExpirationOcrProvider(
  supabase: SupabaseClient,
): ExpirationOcrProvider {
  return {
    id: 'bestchef-vision-broker',
    async recognize(input: ExpirationOcrInput) {
      if (!input.imageBase64) {
        throw new Error('Expiration OCR broker requires an image.');
      }
      const result = await callVisionBroker(supabase, {
        task: 'expiration_ocr',
        imageBase64: input.imageBase64,
        photoMime: input.photoMime ?? 'image/jpeg',
      });
      if (!result.ok) {
        throw new Error(result.message);
      }
      const rawText = result.data.rawText.trim();
      return {
        rawText,
        confidence: rawText.length > 0 ? 0.72 : 0,
        providerId: 'bestchef-vision-broker',
        providerStatus: rawText.length > 0 ? 'parsed' : 'failed',
        providerError: rawText.length > 0 ? null : 'No expiration text was detected.',
      };
    },
  };
}

/**
 * INTERNAL-BETA ONLY. Public-launch builds must use
 * `createBrokerExpirationOcrProvider` so no Anthropic key enters the
 * Expo bundle. The app layer gates this on
 * `shouldAllowBestChefByoProviderKeys`.
 */
export function createClaudeExpirationOcrProvider(apiKey: string): ExpirationOcrProvider {
  return {
    id: 'claude-expiration-ocr',
    async recognize(input: ExpirationOcrInput) {
      if (!apiKey || !input.imageBase64) {
        throw new Error('Expiration OCR provider is not configured.');
      }

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': API_VERSION,
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 512,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: input.photoMime ?? 'image/jpeg',
                    data: input.imageBase64,
                  },
                },
                { type: 'text', text: EXPIRATION_OCR_PROMPT },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`Expiration OCR provider returned ${response.status}`);
      }

      const data = (await response.json()) as ClaudeResponse;
      const rawText = data?.content?.[0]?.text?.trim() ?? '';
      return {
        rawText,
        confidence: rawText.length > 0 ? 0.72 : 0,
        providerId: 'claude-expiration-ocr',
        providerStatus: rawText.length > 0 ? 'parsed' : 'failed',
        providerError: rawText.length > 0 ? null : 'No expiration text was detected.',
        providerRawJson: data,
      };
    },
  };
}

export async function recognizeExpirationDates(
  input: ExpirationOcrInput,
  provider?: ExpirationOcrProvider,
): Promise<ExpirationOcrResult> {
  if (input.rawText?.trim()) {
    const rawText = input.rawText.trim();
    return {
      rawText,
      confidence: 0.7,
      candidates: addInputEvidence(parseExpirationDateCandidates(rawText), input),
      providerId: 'manual-expiration-ocr',
      providerStatus: 'manual',
      providerError: null,
    };
  }

  if (!provider) {
    return {
      rawText: '',
      confidence: 0,
      candidates: [],
      providerId: null,
      providerStatus: 'unavailable',
      providerError: 'No expiration OCR provider selected.',
    };
  }

  try {
    const recognized = await provider.recognize(input);
    return {
      ...recognized,
      candidates: addInputEvidence(parseExpirationDateCandidates(recognized.rawText), input),
      providerId: recognized.providerId ?? provider.id,
      providerStatus: recognized.providerStatus ?? (recognized.rawText.trim() ? 'parsed' : 'failed'),
      providerError: recognized.providerError ?? (recognized.rawText.trim() ? null : 'No expiration text was detected.'),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Expiration OCR provider failed.';
    return {
      rawText: '',
      confidence: 0,
      candidates: [],
      providerId: provider.id,
      providerStatus: 'failed',
      providerError: message,
      providerRawJson: {
        error: message,
      },
    };
  }
}

export function classifyExpiration(expirationDate: string | null, now?: Date): ExpirationStatus {
  if (expirationDate === null) return 'no_date';

  const days = daysUntilExpiration(expirationDate, now);
  if (days < 0) return 'expired';
  if (days <= DEFAULT_EXPIRING_SOON_DAYS) return 'expiring_soon';
  return 'fresh';
}

export function daysUntilExpiration(expirationDate: string, now?: Date): number {
  const today = now ?? new Date();
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const [year, month, day] = expirationDate.split('-').map(Number);
  const expiration = new Date(year, month - 1, day);
  return Math.round((expiration.getTime() - todayDate.getTime()) / 86_400_000);
}

export function comparePantryBatchesForUse(
  left: PantryBatch,
  right: PantryBatch,
  now?: Date,
): number {
  const leftStatus = classifyExpiration(left.expiration_date, now);
  const rightStatus = classifyExpiration(right.expiration_date, now);
  const statusDelta =
    PANTRY_BATCH_SECTION_ORDER.indexOf(leftStatus) - PANTRY_BATCH_SECTION_ORDER.indexOf(rightStatus);
  if (statusDelta !== 0) return statusDelta;

  if (left.expiration_date !== right.expiration_date) {
    if (left.expiration_date === null) return 1;
    if (right.expiration_date === null) return -1;
    return left.expiration_date.localeCompare(right.expiration_date);
  }

  if (left.purchase_date !== right.purchase_date) {
    if (left.purchase_date === null) return 1;
    if (right.purchase_date === null) return -1;
    return left.purchase_date.localeCompare(right.purchase_date);
  }

  return left.created_at.localeCompare(right.created_at);
}

export function getPantryUseNextBatch(batches: PantryBatch[], now?: Date): PantryBatch | null {
  if (batches.length === 0) return null;
  const active = batches.filter((batch) => batch.quantity === null || batch.quantity > 0);
  return [...(active.length > 0 ? active : batches)].sort((left, right) => (
    comparePantryBatchesForUse(left, right, now)
  ))[0] ?? null;
}

export function groupPantryBatchesByExpiration(
  batches: PantryBatch[],
  now?: Date,
): Array<{ status: ExpirationStatus; batches: PantryBatch[] }> {
  return PANTRY_BATCH_SECTION_ORDER.map((status) => ({
    status,
    batches: batches
      .filter((batch) => classifyExpiration(batch.expiration_date, now) === status)
      .sort((left, right) => comparePantryBatchesForUse(left, right, now)),
  }));
}

export function getExpirationColor(status: ExpirationStatus): string {
  switch (status) {
    case 'fresh':
      return '#4ECDC4';
    case 'expiring_soon':
      return '#F5A623';
    case 'expired':
      return '#FF6B6B';
    case 'no_date':
      return '#6B6B8A';
  }
}

export function getExpirationLabel(status: ExpirationStatus, daysLeft: number): string {
  switch (status) {
    case 'fresh':
      return `Fresh (${daysLeft} day${daysLeft === 1 ? '' : 's'} left)`;
    case 'expiring_soon':
      return `Expiring soon (${daysLeft} day${daysLeft === 1 ? '' : 's'} left)`;
    case 'expired': {
      const daysAgo = Math.abs(daysLeft);
      return `Expired (${daysAgo} day${daysAgo === 1 ? '' : 's'} ago)`;
    }
    case 'no_date':
      return 'No expiration date';
  }
}
