import type { DatabaseAdapter } from '@mylife/db';
import { createAttachment, linkAttachment } from '@mylife/db';
import {
  parseReceiptText,
  redactReceiptPaymentLines,
  type ParsedReceipt,
  type RedactedReceiptText,
} from '@mylife/budget/engine/receipt-parser';
import type {
  ReceiptImport,
  ReceiptImportDraftOptions,
  ReceiptImportDraftInput,
  ReceiptImportLine,
  ReceiptImportReview,
  ReceiptOcrProvider,
  ReceiptOcrProviderStatus,
  ReceiptOcrResult,
  ReceiptReviewStatus,
} from '../types';
import { matchReceiptLineToPantry } from '../pantry/matching';
import { normalizeReceiptLineDescription } from '../pantry/name-normalizer';

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function stringifyJson(value: unknown, fallback: string): string {
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

function redactionMetadata(redacted: RedactedReceiptText): Array<{
  lineIndex: number;
  replacement: string;
  reason: 'payment';
}> {
  return redacted.redactions.map(({ lineIndex, replacement, reason }) => ({
    lineIndex,
    replacement,
    reason,
  }));
}

function receiptReviewStatus(providerStatus: ReceiptOcrProviderStatus, parsed: ParsedReceipt): ReceiptReviewStatus {
  if (providerStatus === 'failed') return 'failed';
  return parsed.lineItems.length > 0 ? 'needs_review' : 'needs_review';
}

function normalizePhotoMime(value: string | undefined): string {
  const mime = value?.trim();
  return mime && mime.length > 0 ? mime : 'image/jpeg';
}

function mapReceiptImport(row: ReceiptImport): ReceiptImport {
  return row;
}

function mapReceiptImportLine(row: ReceiptImportLine): ReceiptImportLine {
  return row;
}

export function createManualReceiptOcrProvider(rawText: string, confidence = 0.72): ReceiptOcrProvider {
  return {
    id: 'manual',
    async recognize(): Promise<ReceiptOcrResult> {
      return { rawText, confidence };
    },
  };
}

export function createStaticReceiptOcrProvider(
  id: string,
  result: ReceiptOcrResult,
): ReceiptOcrProvider {
  return {
    id,
    async recognize(): Promise<ReceiptOcrResult> {
      return result;
    },
  };
}

export async function createReceiptImportDraft(
  db: DatabaseAdapter,
  input: ReceiptImportDraftInput,
  provider?: ReceiptOcrProvider,
  options: ReceiptImportDraftOptions = {},
): Promise<ReceiptImportReview> {
  const receiptId = createId('receipt-import');
  const now = new Date().toISOString();
  const photoMime = normalizePhotoMime(input.photoMime);
  const rawInput = input.rawOcrText?.trim();
  let providerId = provider?.id ?? (rawInput ? 'manual' : 'unconfigured');
  let providerStatus: ReceiptOcrProviderStatus = rawInput ? 'manual' : 'pending';
  let providerError: string | null = null;
  let rawText = rawInput ?? '';
  let providerConfidence: number | null = rawInput ? 0.72 : null;

  if (!rawInput) {
    if (!provider) {
      providerStatus = 'failed';
      providerError = 'No OCR provider configured.';
    } else {
      providerId = provider.id;
      try {
        const result = await provider.recognize({
          photoUri: input.photoUri,
          photoMime,
          imageBase64: input.imageBase64,
        });
        rawText = result.rawText.trim();
        providerConfidence = result.confidence;
        if (rawText.length === 0) {
          providerStatus = 'failed';
          providerError = 'OCR provider returned no text.';
        } else {
          providerStatus = 'parsed';
        }
      } catch (error) {
        providerStatus = 'failed';
        providerError = error instanceof Error ? error.message : 'OCR provider failed.';
      }
    }
  }

  const redacted = redactReceiptPaymentLines(rawText);
  const parsed = rawText ? parseReceiptText(redacted.redactedText) : parseReceiptText('');
  const confidence = Math.max(parsed.confidence, providerConfidence ?? 0);
  const reviewStatus = receiptReviewStatus(providerStatus, parsed);
  const matches = await Promise.all(
    parsed.lineItems.map((line) => matchReceiptLineToPantry(db, {
      description: line.description,
      quantity: line.quantity,
      unitPriceCents: line.unitPrice,
      totalCents: line.total,
    }, options)),
  );
  const lineRows = parsed.lineItems.map((line, index) => {
    const match = matches[index]!;
    return {
      id: createId('receipt-line'),
      receipt_import_id: receiptId,
      line_index: index,
      raw_description: line.description,
      normalized_name: match.normalizedName || normalizeReceiptLineDescription(line.description),
      quantity: line.quantity,
      unit_price_cents: line.unitPrice,
      total_cents: line.total,
      product_id: match.candidates[0]?.product_id ?? null,
      pantry_item_id: match.candidates[0]?.pantry_item_id ?? null,
      nutrition_data_id: match.candidates[0]?.nutrition_data_id ?? null,
      match_status: match.status,
      match_confidence: match.confidence,
      match_reason: match.reason,
      candidate_json: stringifyJson(match.candidates, '[]'),
      created_at: now,
      updated_at: now,
    } satisfies ReceiptImportLine;
  });

  let attachmentId: string | null = null;
  db.transaction(() => {
    const attachment = createAttachment(db, {
      uri: input.photoUri,
      mime: photoMime,
      caption: parsed.merchant ? `${parsed.merchant} receipt` : 'BestChef receipt',
      takenAt: parsed.date ?? undefined,
    });
    attachmentId = attachment.id;
    linkAttachment(db, {
      attachmentId: attachment.id,
      moduleId: 'recipes',
      entityType: 'receipt_import',
      entityId: receiptId,
      role: 'receipt',
    });

    db.execute(
      `INSERT INTO rc_receipt_imports (
        id,
        attachment_id,
        photo_uri,
        photo_mime,
        ocr_provider,
        provider_status,
        provider_error,
        merchant,
        receipt_date,
        subtotal_cents,
        tax_cents,
        total_cents,
        currency,
        raw_ocr_text,
        redacted_ocr_text,
        redactions_json,
        parsed_json,
        confidence,
        review_status,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        receiptId,
        attachment.id,
        input.photoUri,
        photoMime,
        providerId,
        providerStatus,
        providerError,
        parsed.merchant,
        parsed.date,
        parsed.subtotal,
        parsed.tax,
        parsed.total,
        parsed.currency,
        rawText || null,
        redacted.redactedText || null,
        stringifyJson(redactionMetadata(redacted), '[]'),
        stringifyJson(parsed, '{}'),
        confidence,
        reviewStatus,
        now,
        now,
      ],
    );

    for (const line of lineRows) {
      db.execute(
        `INSERT INTO rc_receipt_import_lines (
          id,
          receipt_import_id,
          line_index,
          raw_description,
          normalized_name,
          quantity,
          unit_price_cents,
          total_cents,
          product_id,
          pantry_item_id,
          nutrition_data_id,
          match_status,
          match_confidence,
          match_reason,
          candidate_json,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          line.id,
          line.receipt_import_id,
          line.line_index,
          line.raw_description,
          line.normalized_name,
          line.quantity,
          line.unit_price_cents,
          line.total_cents,
          line.product_id,
          line.pantry_item_id,
          line.nutrition_data_id,
          line.match_status,
          line.match_confidence,
          line.match_reason,
          line.candidate_json,
          line.created_at,
          line.updated_at,
        ],
      );
    }
  });

  const review = getReceiptImportReview(db, receiptId);
  if (!review) {
    throw new Error(`Unable to load receipt import ${receiptId}.`);
  }
  if (!review.receipt.attachment_id && attachmentId) {
    return { ...review, receipt: { ...review.receipt, attachment_id: attachmentId } };
  }
  return review;
}

export function getReceiptImportReview(
  db: DatabaseAdapter,
  receiptImportId: string,
): ReceiptImportReview | null {
  const receipt = db.query<ReceiptImport>(
    `SELECT * FROM rc_receipt_imports WHERE id = ? LIMIT 1`,
    [receiptImportId],
  )[0];
  if (!receipt) return null;

  const lines = db.query<ReceiptImportLine>(
    `SELECT * FROM rc_receipt_import_lines
     WHERE receipt_import_id = ?
     ORDER BY line_index ASC`,
    [receiptImportId],
  );

  return {
    receipt: mapReceiptImport(receipt),
    lines: lines.map(mapReceiptImportLine),
  };
}

export function listReceiptImports(db: DatabaseAdapter, limit = 50): ReceiptImport[] {
  return db.query<ReceiptImport>(
    `SELECT * FROM rc_receipt_imports
     ORDER BY updated_at DESC
     LIMIT ?`,
    [Math.max(1, Math.min(200, limit))],
  ).map(mapReceiptImport);
}
