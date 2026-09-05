// Twin-parity guard: the server reconciliation twin in
// _shared/mynews-support-reconcile.ts must stay behaviorally identical to
// modules/mynews/src/data/support.ts. Runs in the monorepo where both sides are
// importable; the deployed function never imports the module.

import { describe, expect, it } from 'vitest';
import {
  reconcileSupportLedger as engineReconcile,
  SUPPORT_LEDGER_KINDS as ENGINE_KINDS,
  type SupportLedgerEntry as EngineEntry,
} from '../../../../modules/mynews/src/data/support';
import {
  reconcileSupportLedger,
  SUPPORT_LEDGER_KINDS,
  type ReconcileLedgerEntry,
} from '../../_shared/mynews-support-reconcile.ts';

const SUPPORTER_A = '11111111-1111-4111-8111-111111111111';
const SUPPORTER_B = '11111111-1111-4111-8111-111111111112';
const JOURNALIST_A = '22222222-2222-4222-8222-222222222221';
const JOURNALIST_B = '22222222-2222-4222-8222-222222222222';

function engineEntry(overrides: Partial<EngineEntry> = {}): EngineEntry {
  return {
    id: 'ledger-1',
    supporterProfileId: SUPPORTER_A,
    journalistProfileId: JOURNALIST_A,
    kind: 'charge',
    amountCents: 1_000,
    currency: 'USD',
    provider: 'stripe',
    providerRef: 'pi_1',
    idempotencyKey: 'stripe:evt_1:charge',
    state: 'posted',
    createdAt: '2026-07-30T00:00:00.000Z',
    ...overrides,
  };
}

/** The twin's entry shape is the engine shape minus the fields it never reads. */
function twinEntry(entry: EngineEntry): ReconcileLedgerEntry {
  return {
    id: entry.id,
    supporterProfileId: entry.supporterProfileId,
    journalistProfileId: entry.journalistProfileId,
    kind: entry.kind,
    amountCents: entry.amountCents,
    currency: entry.currency,
    state: entry.state,
  };
}

const CASES: Array<{ name: string; entries: EngineEntry[] }> = [
  { name: 'empty ledger', entries: [] },
  {
    name: 'conserving charge and fee',
    entries: [
      engineEntry(),
      engineEntry({ id: 'l2', kind: 'platform_fee', amountCents: 20 }),
    ],
  },
  {
    name: 'partial refund with proportional fee reversal',
    entries: [
      engineEntry(),
      engineEntry({ id: 'l2', kind: 'platform_fee', amountCents: 20 }),
      engineEntry({ id: 'l3', kind: 'refund', amountCents: 490, state: 'refunded' }),
      engineEntry({ id: 'l4', kind: 'platform_fee', amountCents: 10, state: 'reversed' }),
    ],
  },
  {
    name: 'dispute hold and release',
    entries: [
      engineEntry(),
      engineEntry({ id: 'l2', kind: 'platform_fee', amountCents: 20 }),
      engineEntry({ id: 'l3', kind: 'dispute_hold', amountCents: 980, state: 'held' }),
      engineEntry({ id: 'l4', kind: 'dispute_release', amountCents: 980, state: 'released' }),
    ],
  },
  {
    name: 'refunds exceed charges',
    entries: [engineEntry(), engineEntry({ id: 'l2', kind: 'refund', amountCents: 5_000 })],
  },
  {
    name: 'fee reversals exceed fees',
    entries: [
      engineEntry(),
      engineEntry({ id: 'l2', kind: 'platform_fee', amountCents: 20 }),
      engineEntry({ id: 'l3', kind: 'platform_fee', amountCents: 50, state: 'reversed' }),
    ],
  },
  {
    name: 'releases exceed holds',
    entries: [
      engineEntry(),
      engineEntry({ id: 'l2', kind: 'dispute_release', amountCents: 10, state: 'released' }),
    ],
  },
  {
    name: 'fees exceed charges',
    entries: [engineEntry({ kind: 'platform_fee', amountCents: 5_000 })],
  },
  {
    name: 'payout rows are journalist-wide and never grouped into a pair',
    entries: [
      engineEntry(),
      engineEntry({ id: 'l2', kind: 'platform_fee', amountCents: 20 }),
      engineEntry({
        id: 'l3',
        kind: 'payout',
        supporterProfileId: null,
        amountCents: 980,
        state: 'paid',
      }),
      engineEntry({
        id: 'l4',
        kind: 'payout_reversal',
        supporterProfileId: null,
        amountCents: 980,
        state: 'reversed',
      }),
    ],
  },
  {
    name: 'unknown kind and non-positive amount',
    entries: [
      engineEntry({ id: 'lx', kind: 'mystery' as EngineEntry['kind'] }),
      engineEntry({ id: 'ly', amountCents: 0 }),
      engineEntry({ id: 'lz', amountCents: -5 }),
    ],
  },
  {
    name: 'invalid currency',
    entries: [engineEntry({ id: 'lc', currency: 'usd' })],
  },
  {
    name: 'multiple pairs sort deterministically',
    entries: [
      engineEntry({ id: 'p1', supporterProfileId: SUPPORTER_B, journalistProfileId: JOURNALIST_B }),
      engineEntry({ id: 'p2', supporterProfileId: SUPPORTER_A, journalistProfileId: JOURNALIST_B }),
      engineEntry({ id: 'p3', supporterProfileId: SUPPORTER_B, journalistProfileId: JOURNALIST_A }),
      engineEntry({ id: 'p4' }),
      engineEntry({ id: 'p5', currency: 'EUR' }),
    ],
  },
  {
    name: 'null supporter on a pair-scoped kind is ungroupable',
    entries: [engineEntry({ id: 'ln', supporterProfileId: null })],
  },
];

describe('support reconciliation twin parity', () => {
  it('pins the ledger kind vocabulary to the module', () => {
    expect([...SUPPORT_LEDGER_KINDS]).toEqual([...ENGINE_KINDS]);
  });

  it.each(CASES)('agrees with the module engine on $name', ({ entries }) => {
    const expected = engineReconcile(entries);
    const actual = reconcileSupportLedger(entries.map(twinEntry));
    expect(actual.ok).toBe(expected.ok);
    expect(actual.issues).toEqual(expected.issues);
    expect(actual.pairs).toEqual(expected.pairs);
  });

  it('agrees on seeded random ledgers', () => {
    let seed = 20260730;
    const next = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const kinds = [...ENGINE_KINDS, 'mystery' as EngineEntry['kind']];
    for (let run = 0; run < 200; run += 1) {
      const entries: EngineEntry[] = [];
      const count = 1 + Math.floor(next() * 8);
      for (let index = 0; index < count; index += 1) {
        entries.push(
          engineEntry({
            id: `r${run}-${index}`,
            supporterProfileId:
              next() < 0.1 ? null : next() < 0.5 ? SUPPORTER_A : SUPPORTER_B,
            journalistProfileId: next() < 0.5 ? JOURNALIST_A : JOURNALIST_B,
            kind: kinds[Math.floor(next() * kinds.length)]!,
            amountCents: Math.floor(next() * 2_000) - 100,
            currency: next() < 0.2 ? 'EUR' : next() < 0.05 ? 'us' : 'USD',
            state: next() < 0.3 ? 'reversed' : 'posted',
          }),
        );
      }
      const expected = engineReconcile(entries);
      const actual = reconcileSupportLedger(entries.map(twinEntry));
      expect(actual.ok, `run ${run}`).toBe(expected.ok);
      expect(actual.issues, `run ${run}`).toEqual(expected.issues);
      expect(actual.pairs, `run ${run}`).toEqual(expected.pairs);
    }
  });
});
