import { describe, expect, it } from 'vitest';
import {
  DMCA_ATTESTATION_VERSION,
  DMCA_COUNTER_JURISDICTION_ATTESTATION_TEXT,
  DMCA_COUNTER_MISTAKE_ATTESTATION_TEXT,
  DMCA_COUNTER_SERVICE_ATTESTATION_TEXT,
  DMCA_TAKEDOWN_ACCURACY_ATTESTATION_TEXT,
  DMCA_TAKEDOWN_GOOD_FAITH_ATTESTATION_TEXT,
  DMCA_URL_RESOLUTION_FIXTURES,
  classifyDmcaPublicUrl,
  dmcaErrorMessage,
  validateDmcaCounterNotice,
  validateDmcaNotice,
  validateDmcaTakedown,
} from './dmca';

const TAKEDOWN = {
  kind: 'takedown' as const,
  complainantName: 'Ada Rights',
  complainantEmail: 'ada@example.com',
  complainantAddress: '1 Main St, Springfield',
  copyrightedWork: 'My photo essay, published 2025',
  infringingUrl: 'https://mynews.app/article/owens-valley',
  goodFaith: true as const,
  goodFaithAttestationText: DMCA_TAKEDOWN_GOOD_FAITH_ATTESTATION_TEXT,
  goodFaithAttestationVersion: DMCA_ATTESTATION_VERSION,
  accuracyUnderPenalty: true as const,
  accuracyAttestationText: DMCA_TAKEDOWN_ACCURACY_ATTESTATION_TEXT,
  accuracyAttestationVersion: DMCA_ATTESTATION_VERSION,
  signature: 'Ada Rights',
};

const COUNTER = {
  kind: 'counter' as const,
  originalNoticeReference: '11111111-1111-1111-1111-111111111111',
  counterNotifierName: 'Jordan Author',
  counterNotifierAddress: '2 Oak St, Springfield',
  counterNotifierPhone: '+1 555 0100',
  counterNotifierEmail: 'jordan@example.com',
  removedMaterial: 'My article and photograph',
  materialLocationBeforeRemoval: 'https://mynews.app/article/owens-valley',
  goodFaithMistakeOrMisidentification: true as const,
  statementUnderPenaltyOfPerjury: true as const,
  mistakeAttestationText: DMCA_COUNTER_MISTAKE_ATTESTATION_TEXT,
  mistakeAttestationVersion: DMCA_ATTESTATION_VERSION,
  consentToFederalJurisdiction: true as const,
  jurisdictionAttestationText: DMCA_COUNTER_JURISDICTION_ATTESTATION_TEXT,
  jurisdictionAttestationVersion: DMCA_ATTESTATION_VERSION,
  acceptanceOfServiceOfProcess: true as const,
  serviceAttestationText: DMCA_COUNTER_SERVICE_ATTESTATION_TEXT,
  serviceAttestationVersion: DMCA_ATTESTATION_VERSION,
  signature: 'Jordan Author',
};

describe('DMCA takedown validation', () => {
  it('accepts every 512(c)(3) field with versioned exact attestations', () => {
    const result = validateDmcaTakedown(TAKEDOWN);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.notice.complainantName).toBe('Ada Rights');
      expect(result.notice.goodFaithAttestationVersion).toBe('2026-07-12');
      expect(result.notice.accuracyAttestationText).toBe(
        DMCA_TAKEDOWN_ACCURACY_ATTESTATION_TEXT,
      );
    }
  });

  it('rejects missing or false takedown attestations', () => {
    expect(validateDmcaTakedown({ ...TAKEDOWN, goodFaith: false }).ok).toBe(false);
    expect(validateDmcaTakedown({ ...TAKEDOWN, accuracyUnderPenalty: false }).ok).toBe(false);
    expect(
      validateDmcaTakedown({ ...TAKEDOWN, goodFaithAttestationText: 'I agree' }).ok,
    ).toBe(false);
    expect(
      validateDmcaTakedown({ ...TAKEDOWN, accuracyAttestationVersion: 'old' }).ok,
    ).toBe(false);
  });

  it('rejects invalid contact, non-HTTPS locations, and blank signatures', () => {
    expect(validateDmcaTakedown({ ...TAKEDOWN, complainantEmail: 'not-an-email' }).ok).toBe(
      false,
    );
    expect(validateDmcaTakedown({ ...TAKEDOWN, infringingUrl: 'http://mynews.app/a/x' }).ok).toBe(
      false,
    );
    expect(validateDmcaTakedown({ ...TAKEDOWN, signature: '' }).ok).toBe(false);
  });
});

describe('DMCA counter-notice validation', () => {
  it('accepts the complete distinct 512(g)(3) contract', () => {
    const result = validateDmcaCounterNotice(COUNTER);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.notice.counterNotifierPhone).toBe('+1 555 0100');
      expect(result.notice.removedMaterial).toBe('My article and photograph');
      expect(result.notice.consentToFederalJurisdiction).toBe(true);
      expect(result.notice.acceptanceOfServiceOfProcess).toBe(true);
    }
  });

  it('requires name, address, phone, email, removed material, and its former location', () => {
    for (const field of [
      'counterNotifierName',
      'counterNotifierAddress',
      'counterNotifierPhone',
      'counterNotifierEmail',
      'removedMaterial',
      'materialLocationBeforeRemoval',
    ] as const) {
      expect(validateDmcaCounterNotice({ ...COUNTER, [field]: '' }).ok, field).toBe(false);
    }
  });

  it('requires the mistake statement under penalty of perjury', () => {
    expect(
      validateDmcaCounterNotice({ ...COUNTER, goodFaithMistakeOrMisidentification: false }).ok,
    ).toBe(false);
    expect(
      validateDmcaCounterNotice({ ...COUNTER, statementUnderPenaltyOfPerjury: false }).ok,
    ).toBe(false);
    expect(
      validateDmcaCounterNotice({ ...COUNTER, mistakeAttestationText: 'wrong text' }).ok,
    ).toBe(false);
  });

  it('requires federal-jurisdiction consent and service-of-process acceptance', () => {
    expect(
      validateDmcaCounterNotice({ ...COUNTER, consentToFederalJurisdiction: false }).ok,
    ).toBe(false);
    expect(
      validateDmcaCounterNotice({ ...COUNTER, acceptanceOfServiceOfProcess: false }).ok,
    ).toBe(false);
    expect(
      validateDmcaCounterNotice({ ...COUNTER, serviceAttestationVersion: 'old' }).ok,
    ).toBe(false);
  });

  it('does not accept a takedown-shaped payload as a counter-notice', () => {
    expect(validateDmcaNotice({ ...TAKEDOWN, kind: 'counter' }).ok).toBe(false);
  });
});

describe('backward-compatible generic DMCA validation', () => {
  it('dispatches both distinct schemas', () => {
    expect(validateDmcaNotice(TAKEDOWN).ok).toBe(true);
    expect(validateDmcaNotice(COUNTER).ok).toBe(true);
  });

  it('defaults a missing kind to takedown', () => {
    const { kind: _kind, ...rest } = TAKEDOWN;
    const result = validateDmcaNotice(rest);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.notice.kind).toBe('takedown');
  });
});

describe('dmcaErrorMessage', () => {
  it('maps every typed code to honest, em-dash-free copy', () => {
    for (const code of [
      'validation',
      'rate-limited',
      'network',
      'not-configured',
      'temporarily-unavailable',
      'unknown',
    ] as const) {
      const msg = dmcaErrorMessage(code).message;
      expect(msg.length).toBeGreaterThan(0);
      expect(msg).not.toContain('—');
      expect(msg.toLowerCase()).not.toContain('registered agent');
    }
  });
});

describe('classifyDmcaPublicUrl + shared resolution fixtures', () => {
  it('classifies every shared fixture exactly as the server resolver vocabulary', () => {
    for (const fixture of DMCA_URL_RESOLUTION_FIXTURES) {
      expect(
        classifyDmcaPublicUrl(`https://mynews.app${fixture.path}`),
        fixture.path,
      ).toBe(fixture.kind);
    }
  });

  it('covers every live public content route family from mynews-web', () => {
    const kinds = new Map(DMCA_URL_RESOLUTION_FIXTURES.map((f) => [f.path, f.kind]));
    expect(kinds.get('/a/my-article-slug')).toBe('article');
    expect(kinds.get('/a/my-article-slug/suggestions')).toBe('article');
    expect(kinds.get('/j/some_handle')).toBe('profile');
    expect(kinds.get('/e/some_handle')).toBe('profile');
  });

  it('rejects non-https and malformed URLs', () => {
    expect(classifyDmcaPublicUrl('http://mynews.app/a/my-article-slug')).toBeNull();
    expect(classifyDmcaPublicUrl('not a url')).toBeNull();
    expect(classifyDmcaPublicUrl('ftp://mynews.app/a/x')).toBeNull();
  });
});
