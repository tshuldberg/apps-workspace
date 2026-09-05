import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..');

describe('mynews-web DMCA + legal surface', () => {
  it('ships the DMCA route, form component, and published legal pages', () => {
    for (const file of [
      'app/api/dmca/route.ts',
      'app/legal/dmca/DmcaForm.tsx',
      'app/legal/dmca/page.tsx',
      'app/legal/page.tsx',
    ]) {
      expect(existsSync(join(root, file)), file).toBe(true);
    }
  });

  it('the DMCA form is a client component', () => {
    const src = readFileSync(join(root, 'app/legal/dmca/DmcaForm.tsx'), 'utf8');
    expect(src.startsWith("'use client'")).toBe(true);
  });

  it('imports runtime DMCA values only from the cloud-fetch subpath', () => {
    for (const file of [
      'app/legal/dmca/DmcaForm.tsx',
      'app/legal/dmca/page.tsx',
      'app/legal/page.tsx',
      'app/api/dmca/route.ts',
    ]) {
      const src = readFileSync(join(root, file), 'utf8');
      expect(/from\s+['"]@mylife\/mynews['"]/.test(src), `${file} must not use the package barrel`).toBe(
        false,
      );
    }
  });

  it('the DMCA route signs the deployment-declared trusted IP, rejects cross-site, and fails closed', () => {
    const src = readFileSync(join(root, 'app/api/dmca/route.ts'), 'utf8');
    expect(src.includes('functions/v1/mynews-dmca')).toBe(true);
    expect(src.includes("error: 'not-configured'")).toBe(true);
    expect(src.includes('MYNEWS_DMCA_RATE_SALT')).toBe(true);
    // The trusted client-IP header is deployment-declared, not a grab-bag of
    // client-controllable headers.
    expect(src.includes('MYNEWS_TRUSTED_CLIENT_IP_HEADER')).toBe(true);
    expect(src.includes("'X-MyNews-Client-IP': clientIp")).toBe(true);
    expect(src.includes("'X-MyNews-Proxy-Signature': signature")).toBe(true);
    expect(src.includes("error: 'temporarily-unavailable'")).toBe(true);
    // CSRF guard on this state-changing legal-intake endpoint.
    expect(src.includes('isSameOriginRequest')).toBe(true);
    // The forward to the edge is bounded (no unbounded hold on a slow function).
    expect(src.includes('createBoundedFetch') || src.includes('dmcaEdgeFetch')).toBe(true);
    expect(src.includes('await fetch(')).toBe(false);
  });

  it('the form captures separate takedown and counter-notice contracts', () => {
    const src = readFileSync(join(root, 'app/legal/dmca/DmcaForm.tsx'), 'utf8');
    for (const field of [
      'complainantName',
      'complainantEmail',
      'copyrightedWork',
      'infringingUrl',
      'goodFaith',
      'accuracyUnderPenalty',
      'goodFaithAttestationText',
      'accuracyAttestationText',
      'counterNotifierName',
      'counterNotifierAddress',
      'counterNotifierPhone',
      'counterNotifierEmail',
      'removedMaterial',
      'materialLocationBeforeRemoval',
      'statementUnderPenaltyOfPerjury',
      'consentToFederalJurisdiction',
      'acceptanceOfServiceOfProcess',
      'signature',
    ]) {
      expect(src.includes(field), `form must capture ${field}`).toBe(true);
    }
    // Client-side validation runs before the POST.
    expect(src.includes('validateDmcaNotice')).toBe(true);
    expect(src.includes('<option value="takedown">')).toBe(true);
    expect(src.includes('<option value="counter">')).toBe(true);
    expect(src.includes('targetKind')).toBe(false);
    expect(src.includes('targetId')).toBe(false);
  });

  it('shows a truthful queue receipt with reference and unresolved status', () => {
    const src = readFileSync(join(root, 'app/legal/dmca/DmcaForm.tsx'), 'utf8');
    expect(src.includes('Submission queued')).toBe(true);
    expect(src.includes('receipt.referenceId')).toBe(true);
    expect(src.includes("receipt.resolutionStatus === 'needs-resolution'")).toBe(true);
    expect(src.includes('remains queued with status')).toBe(true);
  });

  it('the DMCA page publishes the contact, SLA, and repeat-infringer policy honestly', () => {
    // T11 restructure: /legal is the hub; the copyright policy detail lives on
    // /legal/dmca alongside the notice form.
    const src = readFileSync(join(root, 'app/legal/dmca/page.tsx'), 'utf8');
    expect(src.includes('DMCA_DESIGNATED_AGENT_EMAIL')).toBe(true);
    expect(src.includes('DMCA_RESPONSE_SLA_HOURS')).toBe(true);
    expect(src.includes('DMCA_REPEAT_INFRINGER_THRESHOLD')).toBe(true);
    // Honesty: it must NOT claim a completed Copyright Office registration.
    expect(src.includes('in the process of registering')).toBe(true);
  });

  it('the legal hub links every document and publishes the DSA section', () => {
    const src = readFileSync(join(root, 'app/legal/page.tsx'), 'utf8');
    for (const href of ['/legal/terms', '/legal/privacy', '/legal/guidelines', '/legal/dmca']) {
      expect(src.includes(href), `legal hub must link ${href}`).toBe(true);
    }
    // EU DSA disclosures: notice-and-action, statement of reasons, contact.
    expect(src.includes('Digital Services Act')).toBe(true);
    expect(src.includes('Statement of reasons')).toBe(true);
    expect(src.includes('Single point of contact')).toBe(true);
    // Contacts come from the per-request capability context, not a frozen
    // constant, so an unconfigured deployment publishes no address at all.
    expect(src.includes('readWebLegalContext')).toBe(true);
    expect(src.includes('contacts.dsaContactEmail')).toBe(true);
    expect(src.includes('capabilities.emailContact')).toBe(true);
  });
});
