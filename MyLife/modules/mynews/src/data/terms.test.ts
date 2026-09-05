import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CURRENT_TERMS_VERSION,
  LEGAL_CONTACT,
  LEGAL_DOCUMENT_IDS,
  TERMS_NOT_ACCEPTED_ERROR,
  hasAcceptedCurrentTerms,
} from './terms';

describe('mynews terms constants', () => {
  it('pins the current terms version as a YYYY-MM-DD literal', () => {
    // A bump here MUST also update the edge mirror and the legal doc dates.
    expect(CURRENT_TERMS_VERSION).toBe('2026-07-05');
    expect(CURRENT_TERMS_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('stays byte-identical to the edge mirror (no drift)', () => {
    const edge = readFileSync(
      resolve(__dirname, '../../../../supabase/functions/_shared/mynews-terms.ts'),
      'utf8',
    );
    expect(edge).toContain(`export const EDGE_CURRENT_TERMS_VERSION = '${CURRENT_TERMS_VERSION}'`);
  });

  it('exposes the four legal document ids', () => {
    expect([...LEGAL_DOCUMENT_IDS]).toEqual(['terms', 'privacy', 'guidelines', 'dmca']);
  });

  it('publishes a DSA point of contact', () => {
    expect(LEGAL_CONTACT.dsaContactEmail).toContain('@');
    expect(LEGAL_CONTACT.dmcaEmail).toContain('@');
    expect(LEGAL_CONTACT.safetyEmail).toContain('@');
  });
});

describe('hasAcceptedCurrentTerms', () => {
  it('is false for empty, null, or undefined acceptance lists', () => {
    expect(hasAcceptedCurrentTerms([])).toBe(false);
    expect(hasAcceptedCurrentTerms(null)).toBe(false);
    expect(hasAcceptedCurrentTerms(undefined)).toBe(false);
  });

  it('is false when only an older version was accepted', () => {
    expect(hasAcceptedCurrentTerms(['2026-01-01'])).toBe(false);
  });

  it('is true only when the current version is present', () => {
    expect(hasAcceptedCurrentTerms([CURRENT_TERMS_VERSION])).toBe(true);
    expect(hasAcceptedCurrentTerms(['2026-01-01', CURRENT_TERMS_VERSION])).toBe(true);
  });

  it('exposes the typed gate error', () => {
    expect(TERMS_NOT_ACCEPTED_ERROR).toBe('terms-not-accepted');
  });
});
