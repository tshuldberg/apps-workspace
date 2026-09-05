import { describe, expect, it } from 'vitest';
import { NCMEC_FILING_SQL } from '../migrations/0015-ncmec-filing';

describe('NCMEC filing migration SQL', () => {
  it('normalizes legacy filed state before validating provider-evidence coherence', () => {
    const backfill = NCMEC_FILING_SQL.indexOf("SET status = 'exported'");
    const constraint = NCMEC_FILING_SQL.indexOf('ADD CONSTRAINT moderation_ncmec_filed_coherent');
    const validation = NCMEC_FILING_SQL.indexOf('VALIDATE CONSTRAINT moderation_ncmec_filed_coherent');

    expect(backfill).toBeGreaterThanOrEqual(0);
    expect(constraint).toBeGreaterThan(backfill);
    expect(validation).toBeGreaterThan(constraint);
    expect(NCMEC_FILING_SQL).toContain('legacy_filed_without_provider_evidence');
    expect(NCMEC_FILING_SQL).toContain('next_filing_attempt_at = next_attempt_at');
  });

  it('keeps old writers online while preventing evidence-free filed rows', () => {
    expect(NCMEC_FILING_SQL).toContain('CREATE TRIGGER moderation_normalize_legacy_ncmec_filed');
    expect(NCMEC_FILING_SQL).toContain(
      "NEW.status = 'filed' AND (NEW.provider_ref IS NULL OR NEW.filed_at IS NULL)",
    );
    expect(NCMEC_FILING_SQL).toContain("NEW.status := 'exported'");
    expect(NCMEC_FILING_SQL).toContain('provider_ref IS NOT NULL');
    expect(NCMEC_FILING_SQL).toContain('filed_at IS NOT NULL');
  });
});
