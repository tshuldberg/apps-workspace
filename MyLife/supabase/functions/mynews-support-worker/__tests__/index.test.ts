import { describe, expect, it } from 'vitest';
import {
  handleSupportWorkerRequest,
  MAX_RECORDED_FINDINGS,
  runSupportReconciliation,
} from '../index.ts';
import {
  createInMemoryMyNewsPaymentsStore,
  type MyNewsPaymentsStore,
  type SupportLedgerRow,
} from '../../_shared/mynews-payments-store.ts';

const SECRET = 'support-worker-secret';
const SUPPORTER = '11111111-1111-4111-8111-111111111111';
const JOURNALIST = '22222222-2222-4222-8222-222222222222';
const NOW = '2026-07-30T12:00:00.000Z';

function env(overrides: Record<string, string | undefined> = {}) {
  const values: Record<string, string | undefined> = {
    MYNEWS_SUPPORT_WORKER_SECRET: SECRET,
    ...overrides,
  };
  return (key: string) => values[key];
}

function row(overrides: Partial<SupportLedgerRow> = {}): SupportLedgerRow {
  return {
    id: 'ledger-1',
    supporterProfileId: SUPPORTER,
    journalistProfileId: JOURNALIST,
    kind: 'charge',
    amountCents: 1_000,
    currency: 'USD',
    provider: 'stripe',
    providerRef: 'pi_1',
    idempotencyKey: 'stripe:evt_1:charge',
    state: 'posted',
    createdAt: NOW,
    ...overrides,
  };
}

/** A conserving charge + fee pair: the ledger's happy path. */
const CLEAN_LEDGER: SupportLedgerRow[] = [
  row(),
  row({ id: 'ledger-2', kind: 'platform_fee', amountCents: 20, idempotencyKey: 'stripe:evt_1:fee' }),
];

function post(body: unknown = null, secret: string | null = SECRET): Request {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (secret) headers.set('X-MyNews-Worker-Secret', secret);
  return new Request('http://local/mynews-support-worker', {
    method: 'POST',
    headers,
    body: body === null ? undefined : JSON.stringify(body),
  });
}

async function json(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe('runSupportReconciliation', () => {
  it('records a passing run for a conserving ledger', async () => {
    const { store, state } = createInMemoryMyNewsPaymentsStore({ ledgerRows: CLEAN_LEDGER });
    const result = await runSupportReconciliation({ env: env(), now: () => NOW, store });
    expect(result.ok).toBe(true);
    expect(result.ledgerRows).toBe(2);
    expect(result.pairCount).toBe(1);
    expect(result.mismatchCount).toBe(0);
    expect(result.findings).toEqual([]);
    expect(result.recorded).toBe(true);
    expect(state.reconciliationRuns).toEqual([
      expect.objectContaining({
        workerRef: 'support-reconcile-auto',
        ok: true,
        ledgerRows: 2,
        pairCount: 1,
        mismatchCount: 0,
        findings: [],
      }),
    ]);
  });

  it('surfaces and records an invariant violation instead of a passing run', async () => {
    const { store, state } = createInMemoryMyNewsPaymentsStore({
      ledgerRows: [
        row(),
        // A refund larger than the charge cannot be a real ledger state.
        row({ id: 'ledger-3', kind: 'refund', amountCents: 5_000, state: 'refunded' }),
      ],
    });
    const result = await runSupportReconciliation({ env: env(), now: () => NOW, store });
    expect(result.ok).toBe(false);
    expect(result.mismatchCount).toBeGreaterThan(0);
    expect(result.findings.join('\n')).toContain('refunds exceed charges');
    expect(state.reconciliationRuns[0]).toMatchObject({ ok: false });
  });

  it('flags an unknown ledger kind and a non-positive amount', async () => {
    const { store } = createInMemoryMyNewsPaymentsStore({
      ledgerRows: [
        row({ id: 'ledger-x', kind: 'mystery_kind' }),
        row({ id: 'ledger-y', amountCents: 0 }),
      ],
    });
    const result = await runSupportReconciliation({ env: env(), now: () => NOW, store });
    expect(result.findings).toContain('unknown ledger kind on ledger-x');
    expect(result.findings).toContain('non-positive amount on ledger-y');
    expect(result.ok).toBe(false);
  });

  it('records the true mismatch count while bounding the stored findings', async () => {
    const ledgerRows: SupportLedgerRow[] = [];
    for (let index = 0; index < MAX_RECORDED_FINDINGS + 25; index += 1) {
      ledgerRows.push(row({ id: `bad-${index}`, kind: 'mystery_kind' }));
    }
    const { store, state } = createInMemoryMyNewsPaymentsStore({ ledgerRows });
    const result = await runSupportReconciliation({ env: env(), now: () => NOW, store });
    expect(result.mismatchCount).toBe(MAX_RECORDED_FINDINGS + 25);
    expect(result.findings).toHaveLength(MAX_RECORDED_FINDINGS);
    expect(state.reconciliationRuns[0]?.findings).toHaveLength(MAX_RECORDED_FINDINGS);
    expect(state.reconciliationRuns[0]?.mismatchCount).toBe(MAX_RECORDED_FINDINGS + 25);
  });

  it('records nothing and reports not-ok when the ledger read fails', async () => {
    const { store: base, state } = createInMemoryMyNewsPaymentsStore({ ledgerRows: CLEAN_LEDGER });
    const store: MyNewsPaymentsStore = {
      ...base,
      listSupportLedgerRows: async () => {
        throw new Error('ledger unavailable');
      },
    };
    const result = await runSupportReconciliation({ env: env(), now: () => NOW, store });
    expect(result.ok).toBe(false);
    expect(result.recorded).toBe(false);
    expect(result.failures.join('\n')).toContain('ledger-read: ledger unavailable');
    expect(state.reconciliationRuns).toEqual([]);
  });

  it('is not ok when the durable run row cannot be written', async () => {
    const { store: base } = createInMemoryMyNewsPaymentsStore({ ledgerRows: CLEAN_LEDGER });
    const store: MyNewsPaymentsStore = {
      ...base,
      recordSupportReconciliationRun: async () => {
        throw new Error('insert refused');
      },
    };
    const result = await runSupportReconciliation({ env: env(), now: () => NOW, store });
    expect(result.mismatchCount).toBe(0);
    expect(result.recorded).toBe(false);
    expect(result.ok).toBe(false);
    expect(result.failures.join('\n')).toContain('run-record: insert refused');
  });

  it('clamps the requested batch size', async () => {
    const requested: number[] = [];
    const { store: base } = createInMemoryMyNewsPaymentsStore({ ledgerRows: CLEAN_LEDGER });
    const store: MyNewsPaymentsStore = {
      ...base,
      listSupportLedgerRows: async (limit) => {
        requested.push(limit);
        return [];
      },
    };
    const deps = { env: env(), now: () => NOW, store };
    await runSupportReconciliation(deps, 1_000_000);
    await runSupportReconciliation(deps, 0);
    await runSupportReconciliation(deps, 12.7);
    expect(requested).toEqual([20_000, 1, 12]);
  });
});

describe('handleSupportWorkerRequest', () => {
  it('rejects a missing or wrong worker secret', async () => {
    const { store } = createInMemoryMyNewsPaymentsStore({ ledgerRows: CLEAN_LEDGER });
    const deps = { env: env(), now: () => NOW, store };
    expect((await handleSupportWorkerRequest(post(null, null), deps)).status).toBe(401);
    expect((await handleSupportWorkerRequest(post(null, 'wrong'), deps)).status).toBe(401);
  });

  it('accepts the secret as a bearer token', async () => {
    const { store } = createInMemoryMyNewsPaymentsStore({ ledgerRows: CLEAN_LEDGER });
    const request = new Request('http://local/mynews-support-worker', {
      method: 'POST',
      headers: { Authorization: `Bearer ${SECRET}` },
    });
    const response = await handleSupportWorkerRequest(request, {
      env: env(),
      now: () => NOW,
      store,
    });
    expect(response.status).toBe(200);
    expect((await json(response)).ok).toBe(true);
  });

  it('fails closed with 503 when the worker secret is unconfigured', async () => {
    const { store, state } = createInMemoryMyNewsPaymentsStore({ ledgerRows: CLEAN_LEDGER });
    const response = await handleSupportWorkerRequest(post(), {
      env: env({ MYNEWS_SUPPORT_WORKER_SECRET: undefined }),
      now: () => NOW,
      store,
    });
    expect(response.status).toBe(503);
    expect((await json(response)).error).toBe('config');
    expect(state.reconciliationRuns).toEqual([]);
  });

  it('rejects non-POST and non-JSON bodies', async () => {
    const { store } = createInMemoryMyNewsPaymentsStore({ ledgerRows: CLEAN_LEDGER });
    const deps = { env: env(), now: () => NOW, store };
    const get = new Request('http://local/mynews-support-worker', { method: 'GET' });
    expect((await handleSupportWorkerRequest(get, deps)).status).toBe(405);

    const badBody = new Request('http://local/mynews-support-worker', {
      method: 'POST',
      headers: { 'X-MyNews-Worker-Secret': SECRET },
      body: '{not-json',
    });
    expect((await handleSupportWorkerRequest(badBody, deps)).status).toBe(400);
  });

  it('answers 207 with the findings when the ledger does not reconcile', async () => {
    const { store } = createInMemoryMyNewsPaymentsStore({
      ledgerRows: [row(), row({ id: 'ledger-3', kind: 'refund', amountCents: 5_000 })],
    });
    const response = await handleSupportWorkerRequest(post(), {
      env: env(),
      now: () => NOW,
      store,
    });
    expect(response.status).toBe(207);
    const payload = await json(response);
    expect(payload.ok).toBe(false);
    expect(String((payload.findings as string[]).join('\n'))).toContain('refunds exceed charges');
  });
});
