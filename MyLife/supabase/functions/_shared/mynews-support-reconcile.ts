/**
 * Server twin of `reconcileSupportLedger` from
 * modules/mynews/src/data/support.ts. The deployed edge function cannot import
 * the TS package, so the accounting invariants are mirrored here verbatim and
 * pinned by a twin-parity test (mynews-support-worker/__tests__/reconcile-parity.test.ts)
 * that runs both sides over the same inputs. The two must never drift.
 */

export const SUPPORT_LEDGER_KINDS = [
  'charge',
  'platform_fee',
  'refund',
  'dispute_hold',
  'dispute_release',
  'payout',
  'payout_reversal',
] as const;

export type SupportLedgerKind = (typeof SUPPORT_LEDGER_KINDS)[number];

export interface ReconcileLedgerEntry {
  id: string;
  supporterProfileId: string | null;
  journalistProfileId: string;
  kind: string;
  amountCents: number;
  currency: string;
  state: string;
}

export interface SupportReconciliationPair {
  supporterProfileId: string;
  journalistProfileId: string;
  currency: string;
  chargeCents: number;
  platformFeeCents: number;
  platformFeeReversalCents: number;
  netCents: number;
  refundCents: number;
  grossRefundCents: number;
  balanceCents: number;
}

export interface SupportReconciliationResult {
  ok: boolean;
  issues: string[];
  pairs: SupportReconciliationPair[];
}

function pairKey(entry: ReconcileLedgerEntry): string | null {
  if (!entry.supporterProfileId) return null;
  return `${entry.supporterProfileId}\u0000${entry.journalistProfileId}\u0000${entry.currency}`;
}

function isKnownKind(kind: string): kind is SupportLedgerKind {
  return (SUPPORT_LEDGER_KINDS as readonly string[]).includes(kind);
}

export function reconcileSupportLedger(
  entries: readonly ReconcileLedgerEntry[],
): SupportReconciliationResult {
  const issues: string[] = [];
  const groups = new Map<string, ReconcileLedgerEntry[]>();

  for (const entry of entries) {
    if (!isKnownKind(entry.kind)) {
      issues.push(`unknown ledger kind on ${entry.id}`);
      continue;
    }
    if (!Number.isSafeInteger(entry.amountCents) || entry.amountCents <= 0) {
      issues.push(`non-positive amount on ${entry.id}`);
      continue;
    }
    if (!/^[A-Z]{3}$/.test(entry.currency)) issues.push(`invalid currency on ${entry.id}`);
    const key = pairKey(entry);
    if (!key || entry.kind === 'payout' || entry.kind === 'payout_reversal') continue;
    const rows = groups.get(key) ?? [];
    rows.push(entry);
    groups.set(key, rows);
  }

  const pairs: SupportReconciliationPair[] = [];
  for (const [key, rows] of groups) {
    const [supporterProfileId, journalistProfileId, currency] = key.split('\u0000') as [
      string,
      string,
      string,
    ];
    const amount = (kind: SupportLedgerKind) =>
      rows.filter((row) => row.kind === kind).reduce((sum, row) => sum + row.amountCents, 0);
    const chargeCents = amount('charge');
    const platformFeeCents = rows
      .filter((row) => row.kind === 'platform_fee' && row.state !== 'reversed')
      .reduce((sum, row) => sum + row.amountCents, 0);
    const platformFeeReversalCents = rows
      .filter((row) => row.kind === 'platform_fee' && row.state === 'reversed')
      .reduce((sum, row) => sum + row.amountCents, 0);
    const refundCents = amount('refund');
    const grossRefundCents = refundCents + platformFeeReversalCents;
    const heldCents = amount('dispute_hold');
    const releasedCents = amount('dispute_release');
    const netCents = chargeCents - platformFeeCents;
    const balanceCents = netCents - refundCents - heldCents + releasedCents;

    if (platformFeeCents > chargeCents) {
      issues.push(`platform fees exceed charges for ${supporterProfileId}/${journalistProfileId}/${currency}`);
    }
    if (platformFeeReversalCents > platformFeeCents) {
      issues.push(`platform fee reversals exceed fees for ${supporterProfileId}/${journalistProfileId}/${currency}`);
    }
    if (grossRefundCents > chargeCents) {
      issues.push(`refunds exceed charges for ${supporterProfileId}/${journalistProfileId}/${currency}`);
    }
    if (releasedCents > heldCents) {
      issues.push(`dispute releases exceed holds for ${supporterProfileId}/${journalistProfileId}/${currency}`);
    }
    if (chargeCents !== platformFeeCents + netCents) {
      issues.push(`charge split does not conserve cents for ${supporterProfileId}/${journalistProfileId}/${currency}`);
    }
    if (balanceCents < 0) {
      issues.push(`negative pair balance for ${supporterProfileId}/${journalistProfileId}/${currency}`);
    }

    pairs.push({
      supporterProfileId,
      journalistProfileId,
      currency,
      chargeCents,
      platformFeeCents,
      platformFeeReversalCents,
      netCents,
      refundCents,
      grossRefundCents,
      balanceCents,
    });
  }

  pairs.sort((left, right) =>
    `${left.supporterProfileId}/${left.journalistProfileId}/${left.currency}`.localeCompare(
      `${right.supporterProfileId}/${right.journalistProfileId}/${right.currency}`,
    ),
  );
  return { ok: issues.length === 0, issues, pairs };
}
