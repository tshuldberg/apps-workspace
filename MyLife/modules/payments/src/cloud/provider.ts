import type { PaymentStatus } from '../types';
import type {
  DomesticTransferRequest,
  LegacyProviderTransferStatus,
  PaymentsProviderBundle,
  PaymentsProviderContext,
  PaymentsProviderProfile,
  ProviderDisputeRequest,
  ProviderDisputeResult,
  RemittanceQuoteRequest,
  RemittanceQuoteResult,
} from '../providers';

export type PaymentsRuntimeContext = PaymentsProviderContext;
export type ProviderTransferRequest = DomesticTransferRequest;
export type {
  PaymentsProviderBundle,
  PaymentsProviderContext,
  PaymentsProviderProfile,
  ProviderDisputeRequest,
  ProviderDisputeResult,
  RemittanceQuoteRequest,
  RemittanceQuoteResult,
} from '../providers';

export interface ProviderTransferResult {
  providerReference: string;
  status: Extract<PaymentStatus, 'pending' | 'posted' | 'held' | 'failed'>;
  submittedAt: string;
}

export interface PaymentsProviderClient {
  readonly kind: PaymentsProviderProfile;
  createTransfer(
    request: ProviderTransferRequest,
    context: PaymentsRuntimeContext,
  ): Promise<ProviderTransferResult>;
  createRemittanceQuote(
    request: RemittanceQuoteRequest,
    context: PaymentsRuntimeContext,
  ): Promise<RemittanceQuoteResult>;
  openDispute(
    request: ProviderDisputeRequest,
    context: PaymentsRuntimeContext,
  ): Promise<ProviderDisputeResult>;
}

function mapProviderTransferStatus(
  state:
    | 'pending_provider'
    | 'pending_review'
    | 'processing'
    | 'completed'
    | 'failed',
): LegacyProviderTransferStatus {
  switch (state) {
    case 'completed':
      return 'posted';
    case 'pending_review':
      return 'held';
    case 'pending_provider':
    case 'processing':
      return 'pending';
    case 'failed':
      return 'failed';
  }
}

function createCompatibilityError(
  code: string,
  message: string,
): Error {
  return new Error(`[${code}] ${message}`);
}

export function createPaymentsProviderClient(
  bundle: PaymentsProviderBundle,
): PaymentsProviderClient {
  return {
    kind: bundle.profile,

    async createTransfer(request, context) {
      const result = await bundle.domesticWallets.createTransfer(request, context);
      if (!result.ok) {
        throw createCompatibilityError(result.code, result.message);
      }

      return {
        providerReference: result.data.providerReference,
        status: mapProviderTransferStatus(result.data.state),
        submittedAt: result.data.submittedAt,
      };
    },

    async createRemittanceQuote(request, context) {
      const result = await bundle.remittances.quote(request, context);
      if (!result.ok) {
        throw createCompatibilityError(result.code, result.message);
      }

      return result.data;
    },

    async openDispute(request, context) {
      const result = await bundle.cardIssuing.openDispute(request, context);
      if (!result.ok) {
        throw createCompatibilityError(result.code, result.message);
      }

      return result.data;
    },
  };
}
