/**
 * Net worth calculation engine.
 *
 * Computes net worth from account balances (assets - liabilities), builds
 * a historical timeline from snapshots, and captures a new snapshot.
 *
 * In the hub, accounts are in the bg_accounts table with account_type
 * distinguishing assets (checking, savings, cash) from liabilities
 * (credit_card).
 *
 * All amounts in integer cents.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AccountInput {
  id: string;
  name: string;
  accountType: string; // 'checking' | 'savings' | 'credit_card' | 'cash'
  balance: number;     // cents
}

export interface NetWorthResult {
  totalAssets: number;      // cents
  totalLiabilities: number; // cents (positive = amount owed)
  netWorth: number;         // cents (assets - liabilities)
  assetAccounts: { id: string; name: string; balance: number }[];
  liabilityAccounts: { id: string; name: string; balance: number }[];
}

export interface NetWorthSnapshot {
  date: string;         // YYYY-MM-DD
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
}

export interface NetWorthTimelinePoint {
  date: string;
  netWorth: number;
  change: number;       // cents change from previous point
  changePercent: number; // percentage change from previous point
}

export interface SnapshotInput {
  accounts: AccountInput[];
  date: string; // YYYY-MM-DD
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ASSET_TYPES = new Set(['checking', 'savings', 'cash', 'investment']);
const LIABILITY_TYPES = new Set(['credit', 'credit_card', 'loan', 'mortgage']);

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Calculate current net worth from account balances.
 */
export function calculateNetWorth(accounts: AccountInput[]): NetWorthResult {
  let totalAssets = 0;
  let totalLiabilities = 0;
  const assetAccounts: { id: string; name: string; balance: number }[] = [];
  const liabilityAccounts: { id: string; name: string; balance: number }[] = [];

  for (const acct of accounts) {
    if (ASSET_TYPES.has(acct.accountType)) {
      totalAssets += acct.balance;
      assetAccounts.push({ id: acct.id, name: acct.name, balance: acct.balance });
    } else if (LIABILITY_TYPES.has(acct.accountType)) {
      totalLiabilities += Math.abs(acct.balance);
      liabilityAccounts.push({ id: acct.id, name: acct.name, balance: Math.abs(acct.balance) });
    }
  }

  return {
    totalAssets,
    totalLiabilities,
    netWorth: totalAssets - totalLiabilities,
    assetAccounts,
    liabilityAccounts,
  };
}

/**
 * Build a net worth timeline from historical snapshots with change tracking.
 */
export function buildNetWorthTimeline(snapshots: NetWorthSnapshot[]): NetWorthTimelinePoint[] {
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const points: NetWorthTimelinePoint[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const snap = sorted[i];
    const prev = i > 0 ? sorted[i - 1] : null;
    const change = prev ? snap.netWorth - prev.netWorth : 0;
    const changePercent = prev && prev.netWorth !== 0
      ? Math.round((change / Math.abs(prev.netWorth)) * 10000) / 100
      : 0;

    points.push({
      date: snap.date,
      netWorth: snap.netWorth,
      change,
      changePercent,
    });
  }

  return points;
}

/**
 * Capture a net worth snapshot from current account balances.
 */
export function captureSnapshot(input: SnapshotInput): NetWorthSnapshot {
  const result = calculateNetWorth(input.accounts);

  return {
    date: input.date,
    totalAssets: result.totalAssets,
    totalLiabilities: result.totalLiabilities,
    netWorth: result.netWorth,
  };
}
