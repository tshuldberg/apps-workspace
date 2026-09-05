import type { BillingCycle, SubscriptionStatus } from '@mylife/subs';

export function formatCurrency(cents: number): string {
  const abs = Math.abs(cents);
  const dollars = (abs / 100).toFixed(2);
  return cents < 0 ? `-$${dollars}` : `$${dollars}`;
}

export function formatCycleShort(cycle: BillingCycle): string {
  const map: Record<BillingCycle, string> = {
    weekly: 'wk',
    monthly: 'mo',
    quarterly: 'qtr',
    yearly: 'yr',
    lifetime: 'once',
  };
  return map[cycle];
}

export function formatCycleFull(cycle: BillingCycle): string {
  const map: Record<BillingCycle, string> = {
    weekly: 'Weekly',
    monthly: 'Monthly',
    quarterly: 'Quarterly',
    yearly: 'Yearly',
    lifetime: 'Lifetime',
  };
  return map[cycle];
}

export function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = date.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 0) return `in ${diffDays} days`;
  return `${Math.abs(diffDays)} days ago`;
}

export function formatDate(dateStr: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${months[m - 1]} ${d}, ${y}`;
}

export function formatPriceChange(newCents: number, oldCents: number): string {
  const diff = newCents - oldCents;
  const pct = oldCents > 0 ? Math.round((diff / oldCents) * 100) : 0;
  const sign = diff >= 0 ? '+' : '';
  return `${sign}${formatCurrency(diff)} (${sign}${pct}%)`;
}

export function getStatusConfig(status: SubscriptionStatus): { color: string; label: string } {
  const map: Record<SubscriptionStatus, { color: string; label: string }> = {
    active: { color: 'var(--success)', label: 'Active' },
    paused: { color: 'var(--warning)', label: 'Paused' },
    cancelled: { color: 'var(--danger)', label: 'Cancelled' },
    trial: { color: 'var(--accent-meds)', label: 'Trial' },
    expired: { color: 'var(--text-tertiary)', label: 'Expired' },
  };
  return map[status];
}
