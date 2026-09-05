import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SAMPLE_EXPIRATION_OCR_TEXT,
  SAMPLE_GROCERY_PHOTO_JSON,
  SAMPLE_RECEIPT_OCR_TEXT,
} from '../kitchen';
import {
  getInitialExpirationOcrText,
  getInitialGroceryPhotoCandidates,
  getInitialReceiptOcrText,
} from '../demo-fixture-drafts';

const ROOT_ROUTE_DIR = path.resolve(process.cwd(), 'app', '(root)');

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('demo fixture draft policy', () => {
  it('returns empty photo and OCR drafts in a public build even when the dev flag is set', () => {
    // Arrange
    vi.stubGlobal('__DEV__', false);
    vi.stubEnv('EXPO_PUBLIC_USE_DEMO_FIXTURES', 'true');

    // Act
    const drafts = [
      getInitialGroceryPhotoCandidates(),
      getInitialReceiptOcrText(),
      getInitialExpirationOcrText(),
    ];

    // Assert
    expect(drafts).toEqual(['', '', '']);
  });

  it('returns empty drafts in development unless fixtures are explicitly enabled', () => {
    // Arrange
    vi.stubGlobal('__DEV__', true);
    vi.stubEnv('EXPO_PUBLIC_USE_DEMO_FIXTURES', 'false');

    // Act
    const drafts = [
      getInitialGroceryPhotoCandidates(),
      getInitialReceiptOcrText(),
      getInitialExpirationOcrText(),
    ];

    // Assert
    expect(drafts).toEqual(['', '', '']);
  });

  it('returns all three fixtures only in explicitly enabled development builds', () => {
    // Arrange
    vi.stubGlobal('__DEV__', true);
    vi.stubEnv('EXPO_PUBLIC_USE_DEMO_FIXTURES', 'true');

    // Act
    const drafts = [
      getInitialGroceryPhotoCandidates(),
      getInitialReceiptOcrText(),
      getInitialExpirationOcrText(),
    ];

    // Assert
    expect(drafts).toEqual([
      SAMPLE_GROCERY_PHOTO_JSON,
      SAMPLE_RECEIPT_OCR_TEXT,
      SAMPLE_EXPIRATION_OCR_TEXT,
    ]);
  });
});

describe('kitchen fixture screen contracts', () => {
  it.each([
    {
      file: 'kitchen-photo.tsx',
      helper: 'getInitialGroceryPhotoCandidates',
      submittedField: 'rawCandidateJson: submittedRawCandidates',
    },
    {
      file: 'kitchen-receipt.tsx',
      helper: 'getInitialReceiptOcrText',
      submittedField: "rawOcrText: ocrProvider === 'manual_text' ? submittedRawText : undefined",
    },
    {
      file: 'expiration-photo.tsx',
      helper: 'getInitialExpirationOcrText',
      submittedField: 'rawOcrText: submittedRawText',
    },
  ])('keeps every fixture prefill and reset gated in $file', ({ file, helper, submittedField }) => {
    // Arrange
    const source = readFileSync(path.join(ROOT_ROUTE_DIR, file), 'utf8');

    // Act
    const helperReferences = source.match(new RegExp(`\\b${helper}\\b`, 'g')) ?? [];

    // Assert
    expect(source).not.toMatch(/\b(?:SAMPLE|DEMO)_[A-Z0-9_]*\b/);
    expect(helperReferences.length).toBeGreaterThanOrEqual(3);
    expect(source).toContain('shouldUseDemoFixturesInDev()');
    expect(source).toContain(submittedField);
  });
});
