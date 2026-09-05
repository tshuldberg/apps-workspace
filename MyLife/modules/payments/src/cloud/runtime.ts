import {
  createPaymentsProviderBundle,
  type PaymentsProviderBundle,
  type PaymentsProviderOverrides,
} from '../providers';
import { hasRealMoneyRails, resolvePaymentsRuntimeConfig, type PaymentsRuntimeConfig } from './config';
import {
  createPaymentsProviderClient,
  type PaymentsProviderClient,
} from './provider';

export interface PaymentsRuntimeResponsibilities {
  nextRoutes: readonly string[];
  supabase: readonly string[];
}

export interface PaymentsRuntime {
  config: PaymentsRuntimeConfig;
  provider: PaymentsProviderClient;
  providers: PaymentsProviderBundle;
  responsibilities: PaymentsRuntimeResponsibilities;
  usesLiveMoneyRails: boolean;
}

const RUNTIME_RESPONSIBILITIES: Record<
  PaymentsRuntimeConfig['boundary'],
  PaymentsRuntimeResponsibilities
> = {
  next_routes: {
    nextRoutes: [
      'provider orchestration',
      'webhook verification',
      'operator APIs',
      'authentication boundary',
    ],
    supabase: ['append-only ledger writes', 'projections', 'job scheduling'],
  },
  supabase: {
    nextRoutes: ['authentication boundary', 'ops console shells'],
    supabase: [
      'provider orchestration',
      'webhook verification',
      'append-only ledger writes',
      'job scheduling',
      'projections',
    ],
  },
  split: {
    nextRoutes: [
      'provider orchestration',
      'webhook verification',
      'operator APIs',
      'authentication boundary',
    ],
    supabase: ['append-only ledger writes', 'jobs', 'projection fanout'],
  },
};

export function createPaymentsRuntime(options?: {
  env?: Record<string, string | undefined>;
  providers?: PaymentsProviderBundle;
  provider?: PaymentsProviderClient;
  providerOverrides?: PaymentsProviderOverrides;
}): PaymentsRuntime {
  const config = resolvePaymentsRuntimeConfig(options?.env);
  const providers =
    options?.providers ??
    createPaymentsProviderBundle(config, options?.providerOverrides);

  return {
    config,
    provider: options?.provider ?? createPaymentsProviderClient(providers),
    providers,
    responsibilities: RUNTIME_RESPONSIBILITIES[config.boundary],
    usesLiveMoneyRails: hasRealMoneyRails(config),
  };
}
