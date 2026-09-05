/**
 * Plaid Link configuration for MySubs bank sync.
 *
 * TODO(I12-3): Replace placeholder values after Plaid account setup:
 *   1. Create account at https://dashboard.plaid.com
 *   2. Get client_id and secret from Keys section
 *   3. Set PLAID_CLIENT_ID and PLAID_SECRET env vars
 *   4. Start with 'sandbox' environment for testing
 *   5. Apply for 'development' access for real bank connections
 *   6. Apply for 'production' access before launch
 */

export type PlaidEnvironment = 'sandbox' | 'development' | 'production';

/**
 * Plaid provider config shape. Structurally compatible with
 * @mylife/budget's PlaidProviderConfig without a hard import.
 */
export interface PlaidConfig {
  clientId: string;
  secret: string;
  environment: PlaidEnvironment;
  clientName: string;
  language: string;
  countryCodes: string[];
  products: string[];
  redirectUri?: string;
  webhookUrl?: string;
}

/** Plaid products requested during Link flow */
const PLAID_PRODUCTS = ['transactions'] as const;

/** Countries supported for bank connections */
const PLAID_COUNTRY_CODES = ['US'] as const;

/**
 * Build Plaid provider config from environment variables.
 * Falls back to sandbox placeholder values when env vars are not set.
 */
export function getPlaidConfig(): PlaidConfig {
  const environment = (process.env.PLAID_ENV ?? 'sandbox') as PlaidEnvironment;

  return {
    // TODO(I12-3): Replace with real Plaid credentials after account setup
    clientId: process.env.PLAID_CLIENT_ID ?? 'PLACEHOLDER_CLIENT_ID',
    secret: process.env.PLAID_SECRET ?? 'PLACEHOLDER_SECRET',
    environment,
    clientName: 'MySubs',
    language: 'en',
    countryCodes: [...PLAID_COUNTRY_CODES],
    products: [...PLAID_PRODUCTS],
    webhookUrl: process.env.PLAID_WEBHOOK_URL ?? undefined,
  };
}

/**
 * Check whether Plaid credentials have been configured.
 * Returns false when still using placeholder values.
 */
export function isPlaidConfigured(): boolean {
  const config = getPlaidConfig();
  return (
    config.clientId !== 'PLACEHOLDER_CLIENT_ID'
    && config.secret !== 'PLACEHOLDER_SECRET'
  );
}

/**
 * Plaid Link token request parameters for mobile/web SDK.
 * The link token is generated server-side and passed to the client SDK.
 */
export interface PlaidLinkParams {
  /** User identifier for Plaid (device or account ID) */
  userId: string;
  /** Platform requesting the link (affects redirect behavior) */
  platform: 'ios' | 'android' | 'web';
}

/**
 * Environment variable names used by Plaid integration.
 * Listed here for documentation and setup scripts.
 */
export const PLAID_ENV_VARS = {
  /** Plaid client ID from dashboard */
  clientId: 'PLAID_CLIENT_ID',
  /** Plaid secret from dashboard */
  secret: 'PLAID_SECRET',
  /** Environment: sandbox | development | production */
  environment: 'PLAID_ENV',
  /** Webhook URL for transaction sync updates */
  webhookUrl: 'PLAID_WEBHOOK_URL',
} as const;
