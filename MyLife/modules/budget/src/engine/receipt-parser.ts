/**
 * Receipt OCR text parser.
 *
 * Takes raw OCR text output and extracts structured receipt data:
 * merchant name, date, line items, subtotal, tax, and total.
 * All monetary values are returned as integer cents.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number; // cents
  total: number;     // cents
}

export interface ParsedReceipt {
  merchant: string | null;
  date: string | null;         // YYYY-MM-DD
  subtotal: number | null;     // cents
  tax: number | null;          // cents
  total: number | null;        // cents
  currency: string | null;
  lineItems: LineItem[];
  confidence: number;          // 0.0 - 1.0
}

export interface ReceiptTextRedaction {
  lineIndex: number;
  original: string;
  replacement: string;
  reason: 'payment';
}

export interface RedactedReceiptText {
  rawText: string;
  redactedText: string;
  redactions: ReceiptTextRedaction[];
}

// ---------------------------------------------------------------------------
// Merchant extraction
// ---------------------------------------------------------------------------

/** Common suffixes to strip from merchant names. */
const MERCHANT_SUFFIXES = /\s*[#\d]+.*$/;
const LOCATION_PATTERN = /\s+(st|ave|blvd|rd|dr|ct|ln|way|hwy)\b.*$/i;
const STATE_ZIP = /\s+[A-Z]{2}\s+\d{5}(-\d{4})?$/;

export function normalizeMerchant(raw: string): string {
  if (!raw || !raw.trim()) return '';
  let m = raw.trim();
  // Remove store numbers (#123, Store 456)
  m = m.replace(MERCHANT_SUFFIXES, '');
  // Remove address suffixes
  m = m.replace(LOCATION_PATTERN, '');
  // Remove state + zip
  m = m.replace(STATE_ZIP, '');
  // Collapse whitespace
  m = m.replace(/\s+/g, ' ').trim();
  return m.toLowerCase();
}

// ---------------------------------------------------------------------------
// Amount parsing
// ---------------------------------------------------------------------------

const CURRENCY_SYMBOLS: Record<string, string> = {
  $: 'USD', '\u00A3': 'GBP', '\u20AC': 'EUR', '\u00A5': 'JPY', 'C$': 'CAD',
};

function parseAmount(text: string): { cents: number; currency: string | null } | null {
  if (!text) return null;
  // Match optional currency symbol + number
  const match = text.match(/([£€¥$]|C\$)?\s*([\d,]+\.?\d*)/);
  if (!match) return null;
  const symbol = match[1] || null;
  const numStr = match[2].replace(/,/g, '');
  const value = parseFloat(numStr);
  if (isNaN(value)) return null;
  const currency = symbol ? CURRENCY_SYMBOLS[symbol] ?? null : null;
  return { cents: Math.round(value * 100), currency };
}

// ---------------------------------------------------------------------------
// Date parsing
// ---------------------------------------------------------------------------

const DATE_PATTERNS = [
  // MM/DD/YYYY or MM-DD-YYYY
  { regex: /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/, parse: (m: RegExpMatchArray) => `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` },
  // YYYY-MM-DD
  { regex: /(\d{4})-(\d{2})-(\d{2})/, parse: (m: RegExpMatchArray) => `${m[1]}-${m[2]}-${m[3]}` },
  // DD/MM/YYYY (European)
  { regex: /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/, parse: (m: RegExpMatchArray) => {
    const year = parseInt(m[3]) + 2000;
    return `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }},
];

function parseDate(text: string): string | null {
  for (const { regex, parse } of DATE_PATTERNS) {
    const match = text.match(regex);
    if (match) {
      const result = parse(match);
      // Basic validation
      const [y, mo, d] = result.split('-').map(Number);
      if (y >= 2000 && y <= 2099 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
        return result;
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Line item parsing
// ---------------------------------------------------------------------------

const LINE_ITEM_PATTERN = /^(.+?)\s+(\d+)\s*[xX@]\s*\$?([\d.]+)\s+\$?([\d,.]+)$/;
const SIMPLE_ITEM_PATTERN = /^(.{3,40})\s+\$?([\d,]+\.\d{2})$/;
const PAYMENT_KEYWORDS =
  /\b(visa|mastercard|amex|discover|debit|credit|card|acct|account|authorization|auth|approval|transaction|trans|trace|payment|tender|gift card|apple pay|google pay|contactless|chip|aid|tvr|tsi|cash|change)\b/i;
const MASKED_CARD_PATTERN =
  /(\*{2,}|x{2,}|•{2,})\s*\d{4}\b|\bending\s+in\s+\d{4}\b/i;
const LONG_CARD_NUMBER_PATTERN = /\b(?:\d[ -]?){12,19}\b/i;
const PAYMENT_AMOUNT_PATTERN = /\$?\d{1,5}\.\d{2}\b/;

export function isReceiptPaymentLine(line: string): boolean {
  const normalized = line.trim();
  if (!normalized) return false;
  if (MASKED_CARD_PATTERN.test(normalized)) return true;
  const hasPaymentKeyword = PAYMENT_KEYWORDS.test(normalized);
  if (LONG_CARD_NUMBER_PATTERN.test(normalized) && hasPaymentKeyword) return true;
  if (!hasPaymentKeyword) return false;
  return PAYMENT_AMOUNT_PATTERN.test(normalized) || /\b(approved|approval|auth|tender|change|contactless|chip)\b/i.test(normalized);
}

export function redactReceiptPaymentLines(
  text: string,
  replacement = '[redacted payment line]',
): RedactedReceiptText {
  const lines = text.split('\n');
  const redactions: ReceiptTextRedaction[] = [];
  const redactedLines = lines.map((line, lineIndex) => {
    if (!isReceiptPaymentLine(line)) return line;
    redactions.push({
      lineIndex,
      original: line,
      replacement,
      reason: 'payment',
    });
    return replacement;
  });

  return {
    rawText: text,
    redactedText: redactedLines.join('\n'),
    redactions,
  };
}

function parseLineItems(lines: string[]): LineItem[] {
  const items: LineItem[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (isReceiptPaymentLine(trimmed)) continue;

    // Try qty x price pattern first
    const qtyMatch = trimmed.match(LINE_ITEM_PATTERN);
    if (qtyMatch) {
      const unitPrice = Math.round(parseFloat(qtyMatch[3]) * 100);
      const total = Math.round(parseFloat(qtyMatch[4].replace(/,/g, '')) * 100);
      items.push({
        description: qtyMatch[1].trim(),
        quantity: parseInt(qtyMatch[2]),
        unitPrice,
        total,
      });
      continue;
    }
    // Try simple description + price pattern
    const simpleMatch = trimmed.match(SIMPLE_ITEM_PATTERN);
    if (simpleMatch) {
      const desc = simpleMatch[1].trim();
      // Skip known non-item lines
      if (/subtotal|total|tax|change|cash|credit|debit|visa|mastercard|amex/i.test(desc)) continue;
      const total = Math.round(parseFloat(simpleMatch[2].replace(/,/g, '')) * 100);
      items.push({ description: desc, quantity: 1, unitPrice: total, total });
    }
  }
  return items;
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

const TOTAL_KEYWORDS = /\b(total|amount due|balance due|grand total)\b/i;
const SUBTOTAL_KEYWORDS = /\b(subtotal|sub-total|sub total)\b/i;
const TAX_KEYWORDS = /\b(tax|vat|gst|hst)\b/i;

export function parseReceiptText(text: string): ParsedReceipt {
  if (!text || !text.trim()) {
    return { merchant: null, date: null, subtotal: null, tax: null, total: null, currency: null, lineItems: [], confidence: 0 };
  }

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Merchant: typically the first non-empty line(s)
  let merchant: string | null = null;
  if (lines.length > 0) {
    // Take up to first 2 lines as merchant if they look like a name
    const candidateLines = lines.slice(0, 3);
    const merchantLines: string[] = [];
    for (const cl of candidateLines) {
      if (/^\d/.test(cl) || /subtotal|total|tax/i.test(cl)) break;
      if (cl.length > 2 && cl.length < 60) merchantLines.push(cl);
    }
    if (merchantLines.length > 0) {
      merchant = merchantLines.join(' ');
    }
  }

  // Date: scan all lines for date patterns
  let date: string | null = null;
  for (const line of lines) {
    date = parseDate(line);
    if (date) break;
  }

  // Amounts: scan for total, subtotal, tax
  let total: { cents: number; currency: string | null } | null = null;
  let subtotal: { cents: number; currency: string | null } | null = null;
  let tax: { cents: number; currency: string | null } | null = null;

  for (const line of lines) {
    if (TOTAL_KEYWORDS.test(line) && !SUBTOTAL_KEYWORDS.test(line)) {
      const amt = parseAmount(line);
      if (amt) total = amt;
    } else if (SUBTOTAL_KEYWORDS.test(line)) {
      const amt = parseAmount(line);
      if (amt) subtotal = amt;
    } else if (TAX_KEYWORDS.test(line)) {
      const amt = parseAmount(line);
      if (amt) tax = amt;
    }
  }

  // Line items
  const lineItems = parseLineItems(lines);

  // If no total found, sum line items
  if (!total && lineItems.length > 0) {
    const sum = lineItems.reduce((s, li) => s + li.total, 0);
    total = { cents: sum, currency: null };
  }

  // Currency: prefer from total, fall back to subtotal
  const currency = total?.currency ?? subtotal?.currency ?? null;

  // Confidence calculation
  let conf = 0;
  if (merchant) conf += 0.25;
  if (date) conf += 0.2;
  if (total) conf += 0.3;
  if (lineItems.length > 0) conf += 0.15;
  if (subtotal && tax) conf += 0.1;

  return {
    merchant,
    date,
    subtotal: subtotal?.cents ?? null,
    tax: tax?.cents ?? null,
    total: total?.cents ?? null,
    currency,
    lineItems,
    confidence: Math.min(conf, 1),
  };
}

export function calculateConfidence(text: string): number {
  if (!text || !text.trim()) return 0;
  return parseReceiptText(text).confidence;
}
