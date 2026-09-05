import { z } from 'zod';

const RuntimeBoundarySchema = z.enum(['next_routes', 'supabase', 'split']);
const ProviderModeSchema = z.enum(['fake', 'unit', 'stripe_treasury', 'synctera']);
const RuntimeEnvironmentSchema = z.enum(['sandbox', 'production']);

function readEnv(
  env?: Record<string, string | undefined>,
): Record<string, string | undefined> {
  if (env) return env;
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
}

function parseBooleanFlag(
  rawValue: string | undefined,
  fallback: boolean,
): boolean {
  if (rawValue == null || rawValue.trim() === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(rawValue.trim().toLowerCase());
}

export interface PaymentsFeatureFlags {
  wallet: boolean;
  cards: boolean;
  remittances: boolean;
  disputes: boolean;
  fakeFunding: boolean;
}

export interface PaymentsRuntimeConfig {
  boundary: z.infer<typeof RuntimeBoundarySchema>;
  providerMode: z.infer<typeof ProviderModeSchema>;
  environment: z.infer<typeof RuntimeEnvironmentSchema>;
  supabaseUrl: string | null;
  supabaseServiceRoleKey: string | null;
  stripeSecretKey: string | null;
  stripeWebhookSecret: string | null;
  operatorApprovalRequired: boolean;
  featureFlags: PaymentsFeatureFlags;
}

export function resolvePaymentsRuntimeConfig(
  env?: Record<string, string | undefined>,
): PaymentsRuntimeConfig {
  const source = readEnv(env);
  const boundary = RuntimeBoundarySchema.parse(source.MYPAY_RUNTIME_BOUNDARY ?? 'split');
  const providerMode = ProviderModeSchema.parse(
    source.MYPAY_PROVIDER_MODE === 'stripe'
      ? 'stripe_treasury'
      : source.MYPAY_PROVIDER_MODE ?? 'fake',
  );
  const environment = RuntimeEnvironmentSchema.parse(
    source.MYPAY_RUNTIME_ENVIRONMENT ?? 'sandbox',
  );

  const config: PaymentsRuntimeConfig = {
    boundary,
    providerMode,
    environment,
    supabaseUrl: source.SUPABASE_URL ?? null,
    supabaseServiceRoleKey: source.SUPABASE_SERVICE_ROLE_KEY ?? null,
    stripeSecretKey: source.MYPAY_STRIPE_SECRET_KEY ?? null,
    stripeWebhookSecret: source.MYPAY_STRIPE_WEBHOOK_SECRET ?? null,
    operatorApprovalRequired: parseBooleanFlag(
      source.MYPAY_OPERATOR_APPROVAL_REQUIRED,
      environment === 'production',
    ),
    featureFlags: {
      wallet: parseBooleanFlag(source.MYPAY_ENABLE_WALLET, true),
      cards: parseBooleanFlag(source.MYPAY_ENABLE_CARDS, true),
      remittances: parseBooleanFlag(source.MYPAY_ENABLE_REMITTANCES, false),
      disputes: parseBooleanFlag(source.MYPAY_ENABLE_DISPUTES, true),
      fakeFunding: parseBooleanFlag(source.MYPAY_ENABLE_FAKE_FUNDING, providerMode === 'fake'),
    },
  };

  if ((boundary === 'supabase' || boundary === 'split') && (!config.supabaseUrl || !config.supabaseServiceRoleKey)) {
    throw new Error(
      `MyPay runtime boundary "${boundary}" requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.`,
    );
  }

  if (
    providerMode === 'stripe_treasury' &&
    (!config.stripeSecretKey || !config.stripeWebhookSecret)
  ) {
    throw new Error(
      'MyPay provider mode "stripe_treasury" requires MYPAY_STRIPE_SECRET_KEY and MYPAY_STRIPE_WEBHOOK_SECRET.',
    );
  }

  if (providerMode !== 'fake' && environment === 'sandbox' && config.featureFlags.fakeFunding) {
    throw new Error('Fake funding may be enabled only when MYPAY_PROVIDER_MODE=fake.');
  }

  return config;
}

export function hasRealMoneyRails(config: PaymentsRuntimeConfig): boolean {
  return config.providerMode !== 'fake' && config.environment === 'production';
}
