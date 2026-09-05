import { createFakePaymentsProviderBundle } from '../providers';
import {
  createPaymentsProviderClient,
  type PaymentsProviderClient,
  type PaymentsRuntimeContext,
  type ProviderDisputeRequest,
  type ProviderDisputeResult,
  type ProviderTransferRequest,
  type ProviderTransferResult,
  type RemittanceQuoteRequest,
  type RemittanceQuoteResult,
} from './provider';

export class FakePaymentsProvider implements PaymentsProviderClient {
  readonly kind = 'fake' as const;
  readonly #client = createPaymentsProviderClient(
    createFakePaymentsProviderBundle(),
  );

  async createTransfer(
    request: ProviderTransferRequest,
    context: PaymentsRuntimeContext,
  ): Promise<ProviderTransferResult> {
    return this.#client.createTransfer(request, context);
  }

  async createRemittanceQuote(
    request: RemittanceQuoteRequest,
    context: PaymentsRuntimeContext,
  ): Promise<RemittanceQuoteResult> {
    return this.#client.createRemittanceQuote(request, context);
  }

  async openDispute(
    request: ProviderDisputeRequest,
    context: PaymentsRuntimeContext,
  ): Promise<ProviderDisputeResult> {
    return this.#client.openDispute(request, context);
  }
}
