import type {
  PaymentsProviderResult,
  RemittanceQuoteRequest,
  RemittanceQuoteResult,
  RemittanceSettlementRequest,
  RemittanceSettlementResult,
} from '../types';

export interface PaymentsRemittanceOrchestrator {
  lockQuote(request: RemittanceQuoteRequest): Promise<PaymentsProviderResult<RemittanceQuoteResult>>;
  send(request: RemittanceSettlementRequest): Promise<PaymentsProviderResult<RemittanceSettlementResult>>;
  pollDelivery(remittanceId: string): Promise<PaymentsProviderResult<RemittanceSettlementResult>>;
  cancel(remittanceId: string): Promise<PaymentsProviderResult<RemittanceSettlementResult>>;
}

export function createPaymentsRemittanceOrchestrator(input: {
  quote: (request: RemittanceQuoteRequest) => Promise<PaymentsProviderResult<RemittanceQuoteResult>>;
  settle: (request: RemittanceSettlementRequest) => Promise<PaymentsProviderResult<RemittanceSettlementResult>>;
  poll: (remittanceId: string) => Promise<PaymentsProviderResult<RemittanceSettlementResult>>;
  cancel: (remittanceId: string) => Promise<PaymentsProviderResult<RemittanceSettlementResult>>;
}): PaymentsRemittanceOrchestrator {
  return {
    lockQuote: input.quote,
    send: input.settle,
    pollDelivery: input.poll,
    cancel: input.cancel,
  };
}
