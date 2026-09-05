import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_DELETION_GRACE_DAYS,
  ACCOUNT_DELETION_REMOVED,
  ACCOUNT_DELETION_RETAINED,
} from './account';
import { DEFAULT_MYNEWS_CAPABILITIES } from './capabilities';
import {
  LEGAL_CLAIM_CAPABILITIES,
  createLegalContent,
} from './legal-content';

function flatten(bundle: ReturnType<typeof createLegalContent>): string {
  return [
    ...bundle.documents.flatMap((doc) => [
      doc.intro,
      doc.summary,
      ...doc.sections.flatMap((section) => [section.heading, ...section.paragraphs]),
    ]),
    ...bundle.promptSummary,
  ].join('\n');
}

describe('legal claim-to-capability parity', () => {
  it('asserts no disabled capability in the default unconfigured build', () => {
    const copy = flatten(createLegalContent(DEFAULT_MYNEWS_CAPABILITIES));
    for (const [capability, patterns] of Object.entries(LEGAL_CLAIM_CAPABILITIES)) {
      if (DEFAULT_MYNEWS_CAPABILITIES[capability as keyof typeof DEFAULT_MYNEWS_CAPABILITIES]) {
        continue;
      }
      for (const pattern of patterns) {
        expect(copy, `${capability} claim ${pattern} must be absent`).not.toMatch(pattern);
      }
    }
  });

  it('adds the direct-support terms only when payments are enabled', () => {
    const enabled = flatten(
      createLegalContent({ ...DEFAULT_MYNEWS_CAPABILITIES, payments: true }),
    );
    expect(enabled).toMatch(/support journalists directly/i);
    expect(enabled).toMatch(/2% platform fee/i);
    expect(enabled).toMatch(/support records/i);
  });

  it('adds controlled contact addresses only when email contact is enabled', () => {
    const enabled = flatten(
      createLegalContent(
        { ...DEFAULT_MYNEWS_CAPABILITIES, emailContact: true },
        {
          dsaContactEmail: 'legal@controlled.news',
          safetyEmail: 'safety@controlled.news',
          dmcaEmail: 'copyright@controlled.news',
        },
      ),
    );
    expect(enabled).toContain('legal@controlled.news');
    expect(enabled).toContain('safety@controlled.news');
    expect(enabled).toContain('copyright@controlled.news');
  });
});

describe('privacy policy account-rights disclosure', () => {
  const privacy = createLegalContent(DEFAULT_MYNEWS_CAPABILITIES).privacy;
  const section = (heading: string) =>
    privacy.sections.find((s) => s.heading === heading);

  it('discloses the export right', () => {
    const exportSection = section('Exporting your data');
    expect(exportSection).toBeDefined();
    const copy = exportSection!.paragraphs.join(' ');
    expect(copy).toMatch(/single JSON file/i);
    expect(copy).toMatch(/revision history/i);
    expect(copy).toMatch(/reports you filed/i);
  });

  it('discloses the grace window and both sides of the retention split', () => {
    const deletion = section('Deleting your account');
    expect(deletion).toBeDefined();
    const copy = deletion!.paragraphs.join(' ');
    expect(copy).toMatch(
      new RegExp(`${ACCOUNT_DELETION_GRACE_DAYS}-day grace period`, 'i'),
    );
    expect(copy).toMatch(/cancel/i);
    for (const line of [...ACCOUNT_DELETION_RETAINED, ...ACCOUNT_DELETION_REMOVED]) {
      expect(deletion!.paragraphs, line.slice(0, 40)).toContain(line);
    }
    // The two sides are labelled, so no reader has to infer which is which.
    expect(deletion!.paragraphs).toContain('What we keep:');
    expect(deletion!.paragraphs).toContain('What we delete:');
  });

  it('states the anonymized-retention rule that the disposition actually implements', () => {
    const copy = section('Deleting your account')!.paragraphs.join(' ').toLowerCase();
    expect(copy).toContain('anonymized');
    expect(copy).toContain('signing key');
    expect(copy).toContain('revoked');
  });
});

