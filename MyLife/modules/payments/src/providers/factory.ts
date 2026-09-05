import type { PaymentsRuntimeConfig } from '../cloud/config';
import { createFakePaymentsProviderBundle } from './fake';
import {
  createLivePaymentsProviderBundle,
  type PaymentsProviderOverrides,
} from './live';
import { createSandboxPaymentsProviderBundle } from './sandbox';
import type { PaymentsProviderBundle } from './types';

export function createPaymentsProviderBundle(
  config: PaymentsRuntimeConfig,
  overrides?: PaymentsProviderOverrides,
): PaymentsProviderBundle {
  if (config.providerMode === 'fake') {
    return createFakePaymentsProviderBundle();
  }

  if (config.environment === 'sandbox') {
    return createSandboxPaymentsProviderBundle(config.providerMode);
  }

  return createLivePaymentsProviderBundle({
    profile: config.providerMode,
    overrides,
  });
}

