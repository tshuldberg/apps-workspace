import { describe, expect, it } from 'vitest';

import { createPaymentsRemittanceOrchestrator } from '..';

describe('payments remittance provider orchestrator', () => {
  it('delegates quote lock, send, polling, and cancellation to the configured adapter', async () => {
    const calls: string[] = [];
    const orchestrator = createPaymentsRemittanceOrchestrator({
      async quote(request) {
        calls.push(`quote:${request.corridor}`);
        return {
          ok: true,
          providerName: 'future_remittance_partner',
          data: {
            quoteId: 'quote_1',
            exchangeRate: '17.1000',
            feeCents: 300,
            destinationAmountCents: 17_100,
            expiresAt: '2026-04-24T18:00:00.000Z',
          },
        };
      },
      async settle(request) {
        calls.push(`send:${request.remittanceId}`);
        return {
          ok: true,
          providerName: 'future_remittance_partner',
          data: {
            providerRemittanceId: 'provider_remit_1',
            state: 'processing',
            submittedAt: '2026-04-24T17:00:00.000Z',
          },
        };
      },
      async poll(remittanceId) {
        calls.push(`poll:${remittanceId}`);
        return {
          ok: true,
          providerName: 'future_remittance_partner',
          data: {
            providerRemittanceId: 'provider_remit_1',
            state: 'completed',
            submittedAt: '2026-04-24T17:00:00.000Z',
          },
        };
      },
      async cancel(remittanceId) {
        calls.push(`cancel:${remittanceId}`);
        return {
          ok: true,
          providerName: 'future_remittance_partner',
          data: {
            providerRemittanceId: 'provider_remit_1',
            state: 'failed',
            submittedAt: '2026-04-24T17:00:00.000Z',
          },
        };
      },
    });

    const quote = await orchestrator.lockQuote({
      sourceAmountCents: 1_000,
      sourceCurrency: 'USD',
      destinationCurrency: 'MXN',
      corridor: 'US-MX',
      recipientCountryCode: 'MX',
    });
    const send = await orchestrator.send({
      remittanceId: 'remit_1',
      quoteId: 'quote_1',
      sourceAmountCents: 1_000,
      sourceCurrency: 'USD',
      destinationAmountCents: 17_100,
      destinationCurrency: 'MXN',
      recipientCountryCode: 'MX',
      idempotencyKey: 'remit_idem_1',
    });
    const poll = await orchestrator.pollDelivery('remit_1');
    const cancel = await orchestrator.cancel('remit_1');

    expect(quote.ok).toBe(true);
    expect(send.ok).toBe(true);
    expect(poll.ok && poll.data.state).toBe('completed');
    expect(cancel.ok && cancel.data.state).toBe('failed');
    expect(calls).toEqual([
      'quote:US-MX',
      'send:remit_1',
      'poll:remit_1',
      'cancel:remit_1',
    ]);
  });
});
