import type {
  Account,
  BudgetGoal,
  BudgetSubscription,
  BudgetTransaction,
  DebtPayoffDebt,
  Envelope,
  Holding,
  NetWorthSnapshot,
} from '@mylife/budget';

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function currentMonthKey() {
  return todayIso().slice(0, 7);
}

export function weekStartIso(reference = new Date()) {
  const current = new Date(Date.UTC(reference.getFullYear(), reference.getMonth(), reference.getDate()));
  const day = current.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  current.setUTCDate(current.getUTCDate() + diff);
  return current.toISOString().slice(0, 10);
}

export function parseCurrencyField(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? '').replace(/[^0-9.-]/g, '');
  const parsed = Number(raw || '0');
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

export function parseNumberField(formData: FormData, key: string, fallback = 0) {
  const parsed = Number(formData.get(key) ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function stringField(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

export function nullableField(formData: FormData, key: string) {
  const value = stringField(formData, key);
  return value || null;
}

export function accountNetWorthValue(account: Account) {
  return account.type === 'credit' || account.type === 'loan' || account.type === 'mortgage'
    ? -Math.abs(account.current_balance)
    : account.current_balance;
}

export function totalAssets(accounts: Account[]) {
  return accounts
    .filter((account) => !['credit', 'loan', 'mortgage'].includes(account.type))
    .reduce((sum, account) => sum + Math.max(account.current_balance, 0), 0);
}

export function totalLiabilities(accounts: Account[]) {
  return accounts
    .filter((account) => ['credit', 'loan', 'mortgage'].includes(account.type))
    .reduce((sum, account) => sum + Math.abs(account.current_balance), 0);
}

export function activeCash(accounts: Account[]) {
  return accounts
    .filter((account) => account.archived === 0 && ['cash', 'checking', 'savings'].includes(account.type))
    .reduce((sum, account) => sum + account.current_balance, 0);
}

export function goalToEngine(goal: BudgetGoal) {
  return {
    createdAt: goal.created_at.slice(0, 10),
    currentAmount: goal.completed_amount,
    id: goal.id,
    name: goal.name,
    targetAmount: goal.target_amount,
    targetDate: goal.target_date,
  };
}

export function subscriptionMonthlyCost(subscription: BudgetSubscription) {
  switch (subscription.billing_cycle) {
    case 'weekly':
      return Math.round(subscription.price * 4.33);
    case 'monthly':
      return subscription.price;
    case 'quarterly':
      return Math.round(subscription.price / 3);
    case 'semi_annual':
      return Math.round(subscription.price / 6);
    case 'annual':
      return Math.round(subscription.price / 12);
    case 'custom':
      return subscription.custom_days
        ? Math.round(subscription.price * (30.437 / subscription.custom_days))
        : subscription.price;
  }
}

export function buildReportTransactions(transactions: BudgetTransaction[]) {
  return transactions.map((transaction) => ({
    amount: transaction.direction === 'outflow' ? -Math.abs(transaction.amount) : Math.abs(transaction.amount),
    categoryId: transaction.envelope_id,
    date: transaction.occurred_on,
    id: transaction.id,
    isTransfer: transaction.direction === 'transfer',
    payee: transaction.merchant ?? '',
  }));
}

export function buildReportCategories(envelopes: Envelope[]) {
  return envelopes.map((envelope) => ({ id: envelope.id, name: envelope.name }));
}

export function buildReportAllocations(envelopes: Envelope[]) {
  return envelopes.map((envelope) => ({ amount: envelope.monthly_budget, categoryId: envelope.id }));
}

export function debtToEngine(debt: DebtPayoffDebt) {
  return {
    balance: debt.balance,
    id: debt.id,
    interestRate: debt.interest_rate,
    minimumPayment: debt.minimum_payment,
    name: debt.name,
  };
}

export function holdingsToEngine(holdings: Holding[]) {
  return holdings.map((holding) => ({
    assetClass: holding.asset_class,
    costBasis: holding.cost_basis,
    currentPrice:
      holding.current_price ??
      Math.round(holding.cost_basis / Math.max(holding.shares, 1)),
    id: holding.id,
    isActive: holding.is_active === 1,
    name: holding.name,
    shares: holding.shares,
    symbol: holding.symbol,
  }));
}

export function monthLabel(month: string) {
  const date = new Date(`${month}-01T12:00:00`);
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

export function parseAccountBalances(snapshot: NetWorthSnapshot) {
  try {
    const parsed = JSON.parse(snapshot.account_balances ?? '[]') as Array<{
      balance: number;
      id: string;
      name: string;
      type: string;
    }>;
    return parsed;
  } catch {
    return [];
  }
}
