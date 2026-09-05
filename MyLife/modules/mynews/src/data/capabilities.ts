export interface MyNewsCapabilities {
  payments: boolean;
  subscriptions: boolean;
  emailContact: boolean;
  webReporting: boolean;
}

export interface MyNewsCapabilityInputs {
  paymentsEnabled?: boolean | string | null;
  paymentProvider?: string | null;
  supabaseUrl?: string | null;
  supabaseAnonKey?: string | null;
  functionsUrl?: string | null;
  revenueCatApiKey?: string | null;
  subscriptionPlatform?: 'ios' | 'android' | null;
  contactEmails?: readonly (string | null | undefined)[] | null;
  webReportingEnabled?: boolean | string | null;
}

export const DEFAULT_MYNEWS_CAPABILITIES: Readonly<MyNewsCapabilities> = Object.freeze({
  payments: false,
  subscriptions: false,
  emailContact: false,
  webReporting: false,
});

function isEnabled(value: boolean | string | null | undefined): boolean {
  if (typeof value === 'boolean') return value;
  return value?.trim().toLowerCase() === 'true';
}

function isHttpsUrl(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  try {
    return new URL(value.trim()).protocol === 'https:';
  } catch {
    return false;
  }
}

function isConfiguredValue(value: string | null | undefined): boolean {
  const normalized = value?.trim().toLowerCase() ?? '';
  return normalized.length > 0 && !/(placeholder|example|replace[-_ ]?me|your[-_])/.test(normalized);
}

function isRevenueCatKey(
  value: string | null | undefined,
  platform: MyNewsCapabilityInputs['subscriptionPlatform'],
): boolean {
  const key = value?.trim() ?? '';
  if (!key || !isConfiguredValue(key)) return false;
  if (platform === 'ios') return key.startsWith('appl_');
  if (platform === 'android') return key.startsWith('goog_');
  return key.startsWith('appl_') || key.startsWith('goog_');
}

function isControlledEmail(value: string | null | undefined): boolean {
  const email = value?.trim().toLowerCase() ?? '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  return !email.endsWith('@mynews.app') && !/(example|placeholder|replace[-_ ]?me)/.test(email);
}

/**
 * Derives user-visible capabilities from runtime inputs. Every capability is
 * affirmative: missing, malformed, or placeholder configuration stays off.
 */
export function detectMyNewsCapabilities(input: MyNewsCapabilityInputs): MyNewsCapabilities {
  const hasCloud =
    isHttpsUrl(input.supabaseUrl) &&
    isConfiguredValue(input.supabaseAnonKey) &&
    isHttpsUrl(input.functionsUrl);
  const contacts = input.contactEmails ?? [];

  return {
    payments:
      isEnabled(input.paymentsEnabled) &&
      input.paymentProvider?.trim().toLowerCase() === 'stripe' &&
      hasCloud,
    subscriptions: isRevenueCatKey(input.revenueCatApiKey, input.subscriptionPlatform),
    emailContact: contacts.length > 0 && contacts.every(isControlledEmail),
    webReporting: isEnabled(input.webReportingEnabled) && hasCloud,
  };
}
