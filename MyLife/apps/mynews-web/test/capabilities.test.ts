import { describe, expect, it } from 'vitest';
import {
  buildWebLegalContext,
  detectWebCapabilities,
  readLegalContacts,
  resolveFunctionsUrl,
  type WebEnv,
} from '../lib/capabilities';

const PROJECT = 'https://abcdefghijklmnopqrst.supabase.co';

const CONFIGURED: WebEnv = {
  MYNEWS_SUPABASE_URL: PROJECT,
  MYNEWS_SUPABASE_ANON_KEY: 'sb_publishable_live_1234567890',
  MYNEWS_PAYMENTS_ENABLED: 'true',
  MYNEWS_PAYMENTS_PROVIDER: 'stripe',
  MYNEWS_LEGAL_EMAIL: 'legal@controlled-domain.net',
  MYNEWS_SAFETY_EMAIL: 'safety@controlled-domain.net',
  MYNEWS_DMCA_EMAIL: 'dmca@controlled-domain.net',
};

function allText(context: ReturnType<typeof buildWebLegalContext>): string {
  return context.legal.documents
    .flatMap((doc) => [doc.intro, ...doc.sections.flatMap((section) => section.paragraphs)])
    .concat(context.legal.promptSummary)
    .join('\n');
}

describe('resolveFunctionsUrl', () => {
  it('models the adapter default instead of treating an unset override as missing', () => {
    expect(resolveFunctionsUrl({ MYNEWS_SUPABASE_URL: PROJECT })).toBe(`${PROJECT}/functions/v1`);
    expect(resolveFunctionsUrl({ MYNEWS_SUPABASE_URL: `${PROJECT}///` })).toBe(
      `${PROJECT}/functions/v1`,
    );
  });

  it('prefers an explicit override', () => {
    expect(
      resolveFunctionsUrl({
        MYNEWS_SUPABASE_URL: PROJECT,
        MYNEWS_FUNCTIONS_URL: 'https://edge.controlled-domain.net',
      }),
    ).toBe('https://edge.controlled-domain.net');
  });

  it('returns null for a missing or non-https project URL', () => {
    expect(resolveFunctionsUrl({})).toBeNull();
    expect(resolveFunctionsUrl({ MYNEWS_SUPABASE_URL: 'http://localhost:54321' })).toBeNull();
    expect(resolveFunctionsUrl({ MYNEWS_SUPABASE_URL: '   ' })).toBeNull();
  });
});

describe('detectWebCapabilities', () => {
  it('turns everything off for an unconfigured deployment', () => {
    expect(detectWebCapabilities({})).toEqual({
      payments: false,
      subscriptions: false,
      emailContact: false,
      webReporting: false,
    });
  });

  it('reports the payments rail only when the flag, provider, and cloud all agree', () => {
    expect(detectWebCapabilities(CONFIGURED).payments).toBe(true);
    expect(
      detectWebCapabilities({ ...CONFIGURED, MYNEWS_PAYMENTS_ENABLED: 'false' }).payments,
    ).toBe(false);
    expect(
      detectWebCapabilities({ ...CONFIGURED, MYNEWS_PAYMENTS_PROVIDER: 'paypal' }).payments,
    ).toBe(false);
    expect(
      detectWebCapabilities({ ...CONFIGURED, MYNEWS_SUPABASE_URL: undefined }).payments,
    ).toBe(false);
    expect(
      detectWebCapabilities({ ...CONFIGURED, MYNEWS_SUPABASE_ANON_KEY: 'REPLACE_ME' }).payments,
    ).toBe(false);
  });

  it('never claims a web subscription rail, which does not exist', () => {
    expect(detectWebCapabilities(CONFIGURED).subscriptions).toBe(false);
  });

  it('requires every contact address to be controlled and non-placeholder', () => {
    expect(detectWebCapabilities(CONFIGURED).emailContact).toBe(true);
    expect(
      detectWebCapabilities({ ...CONFIGURED, MYNEWS_SAFETY_EMAIL: 'safety@mynews.app' })
        .emailContact,
    ).toBe(false);
    expect(
      detectWebCapabilities({ ...CONFIGURED, MYNEWS_DMCA_EMAIL: 'dmca@placeholder.net' })
        .emailContact,
    ).toBe(false);
    // An unset address falls back to the @mynews.app module constant, which is
    // deliberately classified as uncontrolled.
    expect(
      detectWebCapabilities({ ...CONFIGURED, MYNEWS_LEGAL_EMAIL: undefined }).emailContact,
    ).toBe(false);
  });

  it('gates web reporting on both the flag and the cloud', () => {
    expect(
      detectWebCapabilities({ ...CONFIGURED, MYNEWS_WEB_REPORTING_ENABLED: 'true' }).webReporting,
    ).toBe(true);
    expect(detectWebCapabilities(CONFIGURED).webReporting).toBe(false);
    expect(
      detectWebCapabilities({
        MYNEWS_WEB_REPORTING_ENABLED: 'true',
      }).webReporting,
    ).toBe(false);
  });
});

describe('readLegalContacts', () => {
  it('falls back to the module constants so an unconfigured deployment fails the capability check', () => {
    expect(readLegalContacts({})).toEqual({
      dsaContactEmail: 'legal@mynews.app',
      safetyEmail: 'safety@mynews.app',
      dmcaEmail: 'dmca@mynews.app',
    });
  });

  it('uses the configured addresses when present', () => {
    expect(readLegalContacts(CONFIGURED)).toEqual({
      dsaContactEmail: 'legal@controlled-domain.net',
      safetyEmail: 'safety@controlled-domain.net',
      dmcaEmail: 'dmca@controlled-domain.net',
    });
  });
});

describe('buildWebLegalContext', () => {
  it('omits the fee and support claims from an unconfigured bundle', () => {
    const text = allText(buildWebLegalContext({}));
    expect(text).not.toMatch(/2% platform fee/i);
    expect(text).not.toMatch(/support journalists directly/i);
    expect(text).not.toMatch(/Supporting journalists and fees/i);
    expect(text).not.toMatch(/@[a-z0-9.-]+\.[a-z]{2,}/i);
  });

  it('publishes the fee and support claims when the rail is configured', () => {
    const context = buildWebLegalContext(CONFIGURED);
    const text = allText(context);
    expect(context.capabilities.payments).toBe(true);
    expect(text).toMatch(/2% platform fee/i);
    expect(text).toMatch(/support journalists directly/i);
    expect(text).toContain('legal@controlled-domain.net');
    expect(text).toContain('safety@controlled-domain.net');
    expect(text).toContain('dmca@controlled-domain.net');
  });

  it('publishes contact channels without the fee claim when contacts are live but payments are not', () => {
    const context = buildWebLegalContext({
      ...CONFIGURED,
      MYNEWS_PAYMENTS_ENABLED: undefined,
      MYNEWS_PAYMENTS_PROVIDER: undefined,
    });
    const text = allText(context);
    expect(context.capabilities.payments).toBe(false);
    expect(context.capabilities.emailContact).toBe(true);
    expect(text).not.toMatch(/2% platform fee/i);
    expect(text).toContain('legal@controlled-domain.net');
  });
});
