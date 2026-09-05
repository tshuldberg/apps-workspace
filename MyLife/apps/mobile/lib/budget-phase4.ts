import {
  calculateNetWorth,
  createNetWorthSnapshot,
  getAccount,
  getAccounts,
  getNetWorthSnapshotByMonth,
  getSetting,
  setSetting,
  updateNetWorthSnapshot,
  type Account,
} from '@mylife/budget';
import type { DatabaseAdapter } from '@mylife/db';
import { uuid } from './uuid';

export interface BudgetAccountMeta {
  institution?: string;
  last4?: string;
  includeInBudget?: boolean;
  includeInNetWorth?: boolean;
  aprPercent?: number | null;
  source?: 'manual' | 'bank';
}

function accountMetaKey(accountId: string) {
  return `budget:account-meta:${accountId}`;
}

export function getBudgetAccountMeta(
  db: DatabaseAdapter,
  accountId: string,
): BudgetAccountMeta {
  const raw = getSetting(db, accountMetaKey(accountId));
  if (!raw) {
    return {
      includeInBudget: true,
      includeInNetWorth: true,
      source: 'manual',
    };
  }

  try {
    const parsed = JSON.parse(raw) as BudgetAccountMeta;
    return {
      includeInBudget: true,
      includeInNetWorth: true,
      source: 'manual',
      ...parsed,
    };
  } catch {
    return {
      includeInBudget: true,
      includeInNetWorth: true,
      source: 'manual',
    };
  }
}

export function setBudgetAccountMeta(
  db: DatabaseAdapter,
  accountId: string,
  meta: BudgetAccountMeta,
) {
  setSetting(db, accountMetaKey(accountId), JSON.stringify(meta));
}

export function deleteBudgetAccountMeta(
  db: DatabaseAdapter,
  accountId: string,
) {
  db.execute('DELETE FROM bg_settings WHERE key = ?', [accountMetaKey(accountId)]);
}

export function syncBudgetNetWorthSnapshot(db: DatabaseAdapter) {
  const month = new Date().toISOString().slice(0, 7);
  const accounts = getAccounts(db, false).map((account) => ({
    id: account.id,
    name: account.name,
    accountType: normalizeNetWorthAccountType(account.type),
    balance: account.current_balance,
  }));

  const snapshot = calculateNetWorth(accounts);
  const accountBalances = JSON.stringify(
    getAccounts(db, true).map((account: Account) => ({
      id: account.id,
      name: account.name,
      type: account.type,
      balance: account.current_balance,
      archived: account.archived,
    })),
  );
  const existing = getNetWorthSnapshotByMonth(db, month);

  if (existing) {
    updateNetWorthSnapshot(db, existing.id, {
      account_balances: accountBalances,
      assets: snapshot.totalAssets,
      liabilities: snapshot.totalLiabilities,
      net_worth: snapshot.netWorth,
    });
    return existing.id;
  }

  const created = createNetWorthSnapshot(db, uuid(), {
    month,
    assets: snapshot.totalAssets,
    liabilities: snapshot.totalLiabilities,
    net_worth: snapshot.netWorth,
    account_balances: accountBalances,
  });

  return created.id;
}

export function normalizeNetWorthAccountType(type: Account['type']) {
  if (type === 'credit') {
    return 'credit_card';
  }
  return type;
}

export function getLinkedBankSummary(
  db: DatabaseAdapter,
  accountId: string,
): {
  bankAccountId: string;
  bankName: string | null;
  displayName: string;
  institutionName: string | null;
  lastSuccessfulSync: string | null;
  mask: string | null;
  status: string;
} | null {
  const account = getAccount(db, accountId);
  if (!account) {
    return null;
  }

  const rows = db.query<{
    bank_account_id: string;
    bank_name: string;
    display_name: string;
    institution_name: string | null;
    last_successful_sync: string | null;
    mask: string | null;
    status: string;
  }>(
    `SELECT
      ba.id AS bank_account_id,
      ba.name AS bank_name,
      c.display_name,
      c.institution_name,
      c.last_successful_sync,
      ba.mask,
      c.status
    FROM bg_bank_accounts ba
    JOIN bg_bank_connections c ON c.id = ba.connection_id
    WHERE ba.local_account_id = ? AND ba.is_active = 1
    ORDER BY ba.updated_at DESC
    LIMIT 1`,
    [accountId],
  );

  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    bankAccountId: row.bank_account_id,
    bankName: row.bank_name,
    displayName: row.display_name,
    institutionName: row.institution_name,
    lastSuccessfulSync: row.last_successful_sync,
    mask: row.mask,
    status: row.status,
  };
}
