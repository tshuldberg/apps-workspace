/**
 * Server-side capability detection for the public site.
 *
 * The site used to pin the frozen unconfigured legal export set while its own
 * `/legal` hub hardcoded a "direct reader support with a 2% platform fee"
 * claim. That combination published a fee claim for a rail the deployment may
 * not have and, when the rail WAS live, published terms that never mentioned
 * it. Both surfaces now derive from one detector.
 *
 * `detectMyNewsCapabilities` from the module is the single source of the
 * semantics (affirmative only: missing, malformed, or placeholder configuration
 * stays off). This file only maps the site's server env onto its inputs. Pure
 * functions take env explicitly so they are unit-testable without process.env.
 */

import {
  createLegalContent,
  detectMyNewsCapabilities,
  LEGAL_CONTACT,
  type LegalContentBundle,
  type LegalContentContacts,
  type MyNewsCapabilities,
} from '@mylife/mynews/cloud-fetch';

export type WebEnv = Record<string, string | undefined>;

function trimmed(value: string | undefined): string {
  return (value ?? '').trim();
}

/**
 * The functions origin the site would actually call. `createMyNewsCloudAdapter`
 * defaults to `${baseUrl}/functions/v1`, so capability detection has to model
 * the same default rather than treat an unset override as "no functions".
 */
export function resolveFunctionsUrl(env: WebEnv): string | null {
  const explicit = trimmed(env.MYNEWS_FUNCTIONS_URL);
  if (explicit) return explicit;
  const baseUrl = trimmed(env.MYNEWS_SUPABASE_URL).replace(/\/+$/, '');
  if (!/^https:\/\/[^\s]+$/i.test(baseUrl)) return null;
  return `${baseUrl}/functions/v1`;
}

/**
 * Published contact addresses for this deployment. Falls back to the module
 * constants, which `detectMyNewsCapabilities` classifies as uncontrolled
 * placeholders, so an unconfigured deployment reports emailContact = false and
 * the legal bundle omits every contact line instead of publishing an address
 * that receives nothing.
 */
export function readLegalContacts(env: WebEnv): LegalContentContacts {
  return {
    dsaContactEmail: trimmed(env.MYNEWS_LEGAL_EMAIL) || LEGAL_CONTACT.dsaContactEmail,
    safetyEmail: trimmed(env.MYNEWS_SAFETY_EMAIL) || LEGAL_CONTACT.safetyEmail,
    dmcaEmail: trimmed(env.MYNEWS_DMCA_EMAIL) || LEGAL_CONTACT.dmcaEmail,
  };
}

export function detectWebCapabilities(env: WebEnv): MyNewsCapabilities {
  const contacts = readLegalContacts(env);
  return detectMyNewsCapabilities({
    paymentsEnabled: env.MYNEWS_PAYMENTS_ENABLED,
    paymentProvider: env.MYNEWS_PAYMENTS_PROVIDER,
    supabaseUrl: env.MYNEWS_SUPABASE_URL,
    supabaseAnonKey: env.MYNEWS_SUPABASE_ANON_KEY,
    functionsUrl: resolveFunctionsUrl(env),
    // The website has no purchase rail: subscriptions are bought in the app
    // through the device store. Passing no key keeps `subscriptions` false
    // rather than implying a web checkout that does not exist.
    revenueCatApiKey: null,
    subscriptionPlatform: null,
    contactEmails: [contacts.dsaContactEmail, contacts.safetyEmail, contacts.dmcaEmail],
    webReportingEnabled: env.MYNEWS_WEB_REPORTING_ENABLED,
  });
}

export interface WebLegalContext {
  capabilities: MyNewsCapabilities;
  contacts: LegalContentContacts;
  legal: LegalContentBundle;
}

/** Builds the per-request legal context from an explicit env map. */
export function buildWebLegalContext(env: WebEnv): WebLegalContext {
  const capabilities = detectWebCapabilities(env);
  const contacts = readLegalContacts(env);
  return { capabilities, contacts, legal: createLegalContent(capabilities, contacts) };
}

/** Per-request legal context from the live server environment. */
export function readWebLegalContext(): WebLegalContext {
  return buildWebLegalContext(process.env as WebEnv);
}
