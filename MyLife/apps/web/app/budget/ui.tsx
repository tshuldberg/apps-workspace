import type { CSSProperties, ReactNode } from 'react';
import {
  BG_ACCENT,
  BG_ACCENT_LIGHT,
  BG_DANGER,
  BG_MONEY,
  BG_SURFACES,
  BG_TEXT,
  BG_TEXT_SECONDARY,
  BG_TEXT_TERTIARY,
  BG_TRANSFER,
} from '@mylife/budget/ui';

export const ACCENT = BG_ACCENT;
export const ACCENT_LIGHT = BG_ACCENT_LIGHT;
export const MONEY = BG_MONEY;
export const DANGER = BG_DANGER;
export const INFO = BG_TRANSFER;
export const BG = BG_SURFACES.lowest;
export const SURFACE = BG_SURFACES.base;
export const SURFACE_LOW = BG_SURFACES.low;
export const SURFACE_MID = BG_SURFACES.mid;
export const SURFACE_HIGH = BG_SURFACES.high;
export const SURFACE_TOP = BG_SURFACES.highest;
export const TEXT = BG_TEXT;
export const TEXT_SECONDARY = BG_TEXT_SECONDARY;
export const TEXT_TERTIARY = BG_TEXT_TERTIARY;
export const GLASS = 'rgba(255,255,255,0.04)';
export const GLASS_STRONG = 'rgba(255,255,255,0.08)';
export const GLASS_BORDER = 'rgba(255,255,255,0.10)';
export const BORDER = 'rgba(255,255,255,0.06)';

export const SIDEBAR_WIDTH = 280;
export const CONTENT_MAX_WIDTH = 1440;
export const DETAIL_MAX_WIDTH = 1280;
export const FORM_MAX_WIDTH = 1024;

export const BUDGET_PRIMARY_NAV = [
  { href: '/budget', label: 'Budget', icon: 'account_balance_wallet', exact: true },
  { href: '/budget/transactions', label: 'Transactions', icon: 'payments' },
  { href: '/budget/subscriptions', label: 'Subscriptions', icon: 'repeat' },
  { href: '/budget/reports', label: 'Reports', icon: 'pie_chart' },
  { href: '/budget/accounts', label: 'Accounts', icon: 'account_balance' },
] as const;

export const BUDGET_SECONDARY_NAV = [
  { href: '/budget/goals', label: 'Goals', icon: 'flag' },
  { href: '/budget/debt-payoff', label: 'Debt Payoff', icon: 'trending_down' },
  { href: '/budget/investments', label: 'Investments', icon: 'trending_up' },
  { href: '/budget/net-worth', label: 'Net Worth', icon: 'savings' },
  { href: '/budget/loan-planner', label: 'Loan Planner', icon: 'tune' },
] as const;

export const BUDGET_TERTIARY_NAV = [
  { href: '/budget/rules', label: 'Rules', icon: 'filter_list' },
  { href: '/budget/review', label: 'Review', icon: 'check_circle' },
  { href: '/budget/alerts', label: 'Alerts', icon: 'notifications' },
  { href: '/budget/currencies', label: 'Currencies', icon: 'currency_exchange' },
  { href: '/budget/income', label: 'Income', icon: 'arrow_upward' },
  { href: '/budget/family', label: 'Family', icon: 'group' },
  { href: '/budget/splitting', label: 'Split', icon: 'handshake' },
  { href: '/budget/weekly-digest', label: 'Weekly Digest', icon: 'schedule' },
  { href: '/budget/age-of-money', label: 'Age of Money', icon: 'calendar_today' },
  { href: '/budget/no-spend', label: 'No-Spend', icon: 'wallet' },
  { href: '/budget/help', label: 'Help', icon: 'flag' },
  { href: '/budget/onboarding', label: 'Onboarding', icon: 'check_circle' },
  { href: '/budget/settings', label: 'Settings', icon: 'tune' },
] as const;

export const BUDGET_GLOBAL_CSS = `
  .budget-symbol {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-family: 'Material Symbols Outlined';
    line-height: 1;
    letter-spacing: normal;
    white-space: nowrap;
    direction: ltr;
    -webkit-font-feature-settings: 'liga';
    -webkit-font-smoothing: antialiased;
    user-select: none;
  }

  .budget-shell {
    display: grid;
    grid-template-columns: ${SIDEBAR_WIDTH}px minmax(0, 1fr);
    min-height: 100vh;
  }

  .budget-sidebar {
    position: sticky;
    top: 0;
    align-self: start;
    min-height: 100vh;
  }

  .budget-topbar {
    position: sticky;
    top: 0;
    z-index: 20;
  }

  .budget-scroll::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }

  .budget-scroll::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: rgba(255,184,119,0.22);
  }

  @media (max-width: 1180px) {
    .budget-shell {
      grid-template-columns: 1fr;
    }

    .budget-sidebar {
      position: static;
      min-height: auto;
    }
  }

  @media (max-width: 760px) {
    .budget-topbar {
      position: static;
    }
  }
`;

export function withAlpha(color: string, alpha: number) {
  const value = color.trim();
  if (value.startsWith('rgba(')) {
    return value;
  }
  if (value.startsWith('rgb(')) {
    return value.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
  }
  const normalized = value.replace('#', '');
  if (normalized.length !== 6) {
    return color;
  }
  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function currentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

export function monthRange(month = currentMonthKey()) {
  const [year, rawMonth] = month.split('-').map(Number);
  const lastDay = new Date(year, rawMonth, 0).getDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(lastDay).padStart(2, '0')}`,
  };
}

export function formatBudgetCurrency(
  cents: number,
  options?: { compact?: boolean; signed?: boolean },
) {
  const absolute = Math.abs(cents) / 100;
  const formatted = new Intl.NumberFormat('en-US', {
    currency: 'USD',
    maximumFractionDigits: options?.compact ? 1 : 2,
    minimumFractionDigits: options?.compact ? 0 : 2,
    notation: options?.compact ? 'compact' : 'standard',
    style: 'currency',
  }).format(absolute);

  if (!options?.signed || cents === 0) {
    return formatted;
  }

  return `${cents > 0 ? '+' : '-'}${formatted}`;
}

export function formatBudgetPercent(value: number, digits = 1) {
  return `${value.toFixed(digits)}%`;
}

export function formatBudgetDate(
  value?: string | null,
  options?: Intl.DateTimeFormatOptions,
) {
  if (!value) {
    return 'No date';
  }

  const date = new Date(value.includes('T') ? value : `${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...options,
  });
}

export function formatBudgetDateTime(value?: string | null) {
  if (!value) {
    return 'No date';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('en-US', {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
  });
}

export function formatBudgetMonth(value?: string | null) {
  if (!value) {
    return 'No date';
  }

  const normalized = value.length === 7 ? `${value}-01` : value;
  const date = new Date(`${normalized}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

export function relativeBudgetDate(value?: string | null, now = new Date()) {
  if (!value) {
    return 'No date';
  }

  const target = new Date(value.includes('T') ? value : `${value}T12:00:00`);
  if (Number.isNaN(target.getTime())) {
    return value;
  }

  const diffMs = target.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / 86_400_000);
  const absDays = Math.abs(diffDays);

  if (absDays <= 1) {
    if (diffDays === 0) return 'today';
    return diffDays > 0 ? 'tomorrow' : 'yesterday';
  }

  if (absDays <= 6) {
    return diffDays > 0 ? `in ${absDays}d` : `${absDays}d ago`;
  }

  return formatBudgetDate(value, { month: 'short', day: 'numeric' });
}

export function daysUntilBudgetDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const target = new Date(value.includes('T') ? value : `${value}T12:00:00`);
  if (Number.isNaN(target.getTime())) {
    return null;
  }

  return Math.ceil((target.getTime() - Date.now()) / 86_400_000);
}

export function isNavActive(pathname: string, href: string, exact = false) {
  if (exact) {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getBreadcrumb(pathname: string) {
  if (pathname === '/budget') return 'Mission Control';
  if (pathname.startsWith('/budget/transaction/')) return 'Transaction Detail';
  if (pathname.startsWith('/budget/transactions/')) return 'Transaction Detail';
  if (pathname.startsWith('/budget/transactions')) return 'Transactions';
  if (pathname.startsWith('/budget/subscriptions/')) return 'Subscription Detail';
  if (pathname.startsWith('/budget/subscriptions')) return 'Subscriptions';
  if (pathname.startsWith('/budget/reports')) return 'Reports';
  if (pathname.startsWith('/budget/accounts')) return 'Accounts';
  if (pathname.startsWith('/budget/goals/')) return 'Goal Detail';
  if (pathname.startsWith('/budget/goals')) return 'Goals';
  if (pathname.startsWith('/budget/debt-payoff/')) return 'Debt Detail';
  if (pathname.startsWith('/budget/debt-payoff')) return 'Debt Payoff';
  if (pathname.startsWith('/budget/investments')) return 'Investments';
  if (pathname.startsWith('/budget/net-worth')) return 'Net Worth';
  if (pathname.startsWith('/budget/loan-planner')) return 'Loan Planner';
  if (pathname.startsWith('/budget/currencies')) return 'Currencies';
  if (pathname.startsWith('/budget/income')) return 'Income';
  if (pathname.startsWith('/budget/family')) return 'Family Sharing';
  if (pathname.startsWith('/budget/splitting')) return 'Expense Splitting';
  if (pathname.startsWith('/budget/alerts')) return 'Alerts';
  if (pathname.startsWith('/budget/rules')) return 'Rules';
  if (pathname.startsWith('/budget/review')) return 'Review Queue';
  if (pathname.startsWith('/budget/weekly-digest')) return 'Weekly Digest';
  if (pathname.startsWith('/budget/age-of-money')) return 'Age of Money';
  if (pathname.startsWith('/budget/no-spend')) return 'No-Spend Streak';
  if (pathname.startsWith('/budget/help')) return 'Help Center';
  if (pathname.startsWith('/budget/onboarding')) return 'Onboarding';
  if (pathname.startsWith('/budget/settings')) return 'Settings';
  if (pathname.startsWith('/budget/envelope/')) return 'Envelope Detail';
  return 'MyBudget';
}

export function groupByDate<T extends { date?: string | null; occurred_on?: string | null }>(
  items: T[],
) {
  const map = new Map<string, T[]>();

  items.forEach((item) => {
    const key = item.occurred_on ?? item.date ?? 'Unknown';
    const bucket = map.get(key);
    if (bucket) {
      bucket.push(item);
    } else {
      map.set(key, [item]);
    }
  });

  return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
}

export function buttonStyle(
  tone: 'primary' | 'secondary' | 'ghost' | 'danger' = 'primary',
): CSSProperties {
  if (tone === 'secondary') {
    return {
      alignItems: 'center',
      background: `linear-gradient(135deg, ${withAlpha(ACCENT_LIGHT, 0.18)}, ${withAlpha(ACCENT, 0.12)})`,
      border: `1px solid ${withAlpha(ACCENT_LIGHT, 0.2)}`,
      borderRadius: 999,
      color: TEXT,
      cursor: 'pointer',
      display: 'inline-flex',
      fontSize: 13,
      fontWeight: 700,
      gap: 8,
      justifyContent: 'center',
      padding: '10px 16px',
      textDecoration: 'none',
    };
  }

  if (tone === 'ghost') {
    return {
      alignItems: 'center',
      background: 'transparent',
      border: `1px solid ${BORDER}`,
      borderRadius: 999,
      color: TEXT_SECONDARY,
      cursor: 'pointer',
      display: 'inline-flex',
      fontSize: 13,
      fontWeight: 700,
      gap: 8,
      justifyContent: 'center',
      padding: '10px 16px',
      textDecoration: 'none',
    };
  }

  if (tone === 'danger') {
    return {
      alignItems: 'center',
      background: withAlpha(DANGER, 0.14),
      border: `1px solid ${withAlpha(DANGER, 0.22)}`,
      borderRadius: 999,
      color: DANGER,
      cursor: 'pointer',
      display: 'inline-flex',
      fontSize: 13,
      fontWeight: 700,
      gap: 8,
      justifyContent: 'center',
      padding: '10px 16px',
      textDecoration: 'none',
    };
  }

  return {
    alignItems: 'center',
    background: `linear-gradient(135deg, ${MONEY}, ${ACCENT_LIGHT})`,
    border: 'none',
    borderRadius: 999,
    color: '#02260d',
    cursor: 'pointer',
    display: 'inline-flex',
    fontSize: 13,
    fontWeight: 800,
    gap: 8,
    justifyContent: 'center',
    padding: '10px 16px',
    textDecoration: 'none',
  };
}

export function inputStyle(): CSSProperties {
  return {
    background: `linear-gradient(180deg, ${withAlpha(SURFACE_LOW, 0.96)}, ${withAlpha(SURFACE, 0.98)})`,
    border: `1px solid ${GLASS_BORDER}`,
    borderRadius: 16,
    color: TEXT,
    fontSize: 14,
    outline: 'none',
    padding: '12px 14px',
    width: '100%',
  };
}

export function cardStyle(options?: {
  glow?: boolean;
  padding?: number;
  tone?: string;
}): CSSProperties {
  return {
    background: `linear-gradient(180deg, ${options?.tone ?? withAlpha(SURFACE_LOW, 0.9)}, ${withAlpha(SURFACE, 0.96)})`,
    border: `1px solid ${GLASS_BORDER}`,
    borderRadius: 28,
    boxShadow: options?.glow
      ? `0 22px 64px ${withAlpha(MONEY, 0.08)}, inset 0 1px 0 ${withAlpha('#ffffff', 0.04)}`
      : `inset 0 1px 0 ${withAlpha('#ffffff', 0.03)}`,
    padding: options?.padding ?? 20,
  };
}

export function eyebrowStyle(): CSSProperties {
  return {
    color: TEXT_TERTIARY,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 1.2,
    margin: 0,
    textTransform: 'uppercase',
  };
}

export function sectionHeadingStyle(): CSSProperties {
  return {
    color: TEXT,
    fontSize: 20,
    fontWeight: 800,
    letterSpacing: '-0.03em',
    margin: 0,
  };
}

export function BudgetSymbol({
  color = TEXT,
  filled,
  name,
  size = 20,
}: {
  color?: string;
  filled?: boolean;
  name: string;
  size?: number;
}) {
  return (
    <span
      className="budget-symbol"
      style={{
        color,
        fontSize: size,
        fontVariationSettings: filled ? "'FILL' 1" : undefined,
      }}
    >
      {name}
    </span>
  );
}

export function BudgetCard({
  children,
  glow,
  padding,
  tone,
}: {
  children: ReactNode;
  glow?: boolean;
  padding?: number;
  tone?: string;
}) {
  return <section style={cardStyle({ glow, padding, tone })}>{children}</section>;
}

export function BudgetPill({
  accent,
  children,
}: {
  accent?: string;
  children: ReactNode;
}) {
  const color = accent ?? TEXT_SECONDARY;
  return (
    <span
      style={{
        alignItems: 'center',
        background: withAlpha(color, 0.12),
        border: `1px solid ${withAlpha(color, 0.16)}`,
        borderRadius: 999,
        color,
        display: 'inline-flex',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.6,
        padding: '7px 10px',
        textTransform: 'uppercase',
      }}
    >
      {children}
    </span>
  );
}

export function BudgetMetricCard({
  label,
  tone,
  value,
  subvalue,
}: {
  label: string;
  subvalue?: ReactNode;
  tone?: 'accent' | 'danger' | 'money' | 'neutral' | 'info';
  value: ReactNode;
}) {
  const color =
    tone === 'money'
      ? MONEY
      : tone === 'danger'
        ? DANGER
        : tone === 'info'
          ? INFO
          : tone === 'accent'
            ? ACCENT_LIGHT
            : TEXT;

  return (
    <BudgetCard padding={18}>
      <div style={{ display: 'grid', gap: 10 }}>
        <p style={eyebrowStyle()}>{label}</p>
        <div style={{ color, fontSize: 30, fontWeight: 800, letterSpacing: '-0.05em' }}>
          {value}
        </div>
        {subvalue ? <div style={{ color: TEXT_SECONDARY, fontSize: 13 }}>{subvalue}</div> : null}
      </div>
    </BudgetCard>
  );
}

export function BudgetSectionHeader({
  action,
  description,
  title,
}: {
  action?: ReactNode;
  description?: ReactNode;
  title: string;
}) {
  return (
    <div
      style={{
        alignItems: 'flex-end',
        display: 'flex',
        gap: 12,
        justifyContent: 'space-between',
        marginBottom: 14,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'grid', gap: 6 }}>
        <p style={sectionHeadingStyle()}>{title}</p>
        {description ? (
          <p style={{ color: TEXT_SECONDARY, fontSize: 14, lineHeight: 1.7, margin: 0 }}>
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function BudgetEmptyState({
  action,
  description,
  icon,
  title,
}: {
  action?: ReactNode;
  description: string;
  icon: string;
  title: string;
}) {
  return (
    <BudgetCard padding={28} tone={withAlpha(SURFACE_MID, 0.95)}>
      <div style={{ display: 'grid', gap: 14, justifyItems: 'start' }}>
        <div
          style={{
            alignItems: 'center',
            background: `linear-gradient(135deg, ${withAlpha(ACCENT_LIGHT, 0.24)}, ${withAlpha(MONEY, 0.16)})`,
            borderRadius: 20,
            display: 'inline-flex',
            height: 52,
            justifyContent: 'center',
            width: 52,
          }}
        >
          <BudgetSymbol color={ACCENT_LIGHT} name={icon} size={26} />
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.04em', margin: 0 }}>
            {title}
          </h2>
          <p style={{ color: TEXT_SECONDARY, lineHeight: 1.7, margin: 0, maxWidth: 520 }}>
            {description}
          </p>
        </div>
        {action}
      </div>
    </BudgetCard>
  );
}
