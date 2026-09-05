'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { ModuleErrorBoundary } from '@/components/ModuleErrorBoundary';
import { ModuleLockGate } from '@/components/ModuleLockGate';
import {
  ACCENT,
  ACCENT_LIGHT,
  BG,
  BORDER,
  BUDGET_GLOBAL_CSS,
  BUDGET_PRIMARY_NAV,
  BUDGET_SECONDARY_NAV,
  BUDGET_TERTIARY_NAV,
  BudgetSymbol,
  GLASS,
  GLASS_BORDER,
  GLASS_STRONG,
  MONEY,
  SURFACE,
  SURFACE_LOW,
  TEXT,
  TEXT_SECONDARY,
  TEXT_TERTIARY,
  buttonStyle,
  getBreadcrumb,
  isNavActive,
  withAlpha,
} from './ui';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
});

export default function BudgetLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <section
      className={`${plusJakarta.className} budget-shell`}
      style={{
        margin: '-32px',
        background: [
          `radial-gradient(circle at 12% 0%, ${withAlpha(MONEY, 0.12)}, transparent 28%)`,
          `radial-gradient(circle at 100% 12%, ${withAlpha(ACCENT_LIGHT, 0.11)}, transparent 30%)`,
          `radial-gradient(circle at 80% 100%, ${withAlpha(ACCENT, 0.16)}, transparent 36%)`,
          BG,
        ].join(', '),
        color: TEXT,
      }}
    >
      <style>{BUDGET_GLOBAL_CSS}</style>

      <aside
        className="budget-sidebar"
        style={{
          padding: '28px 18px 20px',
          background: `linear-gradient(180deg, ${withAlpha(BG, 0.97)}, ${withAlpha(SURFACE, 0.92)})`,
          boxShadow: `inset -1.5px 0 0 ${GLASS_BORDER}`,
          display: 'grid',
          gap: 18,
        }}
      >
        <div style={{ display: 'grid', gap: 10 }}>
          <Link
            href="/budget"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 12,
              color: ACCENT_LIGHT,
              fontSize: 15,
              fontWeight: 800,
              letterSpacing: 2.2,
              textDecoration: 'none',
              textTransform: 'uppercase',
            }}
          >
            <span
              style={{
                display: 'grid',
                placeItems: 'center',
                width: 42,
                height: 42,
                borderRadius: 999,
                background: `linear-gradient(135deg, ${ACCENT_LIGHT}, ${ACCENT})`,
                color: BG,
                boxShadow: `0 18px 34px ${withAlpha(ACCENT, 0.32)}`,
              }}
            >
              <BudgetSymbol color={BG} name="payments" size={22} />
            </span>
            MyBudget
          </Link>
          <p style={{ margin: 0, color: TEXT_SECONDARY, fontSize: 13, lineHeight: 1.8 }}>
            Desktop mission control for envelopes, net cash, renewals, debt, and family-aware spending.
          </p>
        </div>

        <NavGroup title="Primary">
          {BUDGET_PRIMARY_NAV.map((item) => (
            <BudgetNavLink
              key={item.href}
              active={isNavActive(pathname, item.href, 'exact' in item ? item.exact : false)}
              href={item.href}
              icon={item.icon}
              label={item.label}
            />
          ))}
        </NavGroup>

        <NavGroup title="Strategy">
          {BUDGET_SECONDARY_NAV.map((item) => (
            <BudgetNavLink
              key={item.href}
              active={isNavActive(pathname, item.href)}
              href={item.href}
              icon={item.icon}
              label={item.label}
            />
          ))}
        </NavGroup>

        <NavGroup title="Operations">
          {BUDGET_TERTIARY_NAV.map((item) => (
            <BudgetNavLink
              key={item.href}
              active={isNavActive(pathname, item.href)}
              href={item.href}
              icon={item.icon}
              label={item.label}
            />
          ))}
        </NavGroup>

        <div
          style={{
            ...panelSurface(),
            alignSelf: 'end',
            display: 'grid',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 18,
                background: `linear-gradient(135deg, ${withAlpha(MONEY, 0.28)}, ${withAlpha(ACCENT_LIGHT, 0.24)})`,
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <BudgetSymbol color={ACCENT_LIGHT} name="trending_up" size={22} />
            </div>
            <div style={{ display: 'grid', gap: 3 }}>
              <strong style={{ fontSize: 14, color: TEXT }}>Cash Position</strong>
              <span style={{ fontSize: 12, color: TEXT_TERTIARY }}>Live envelope, renewal, and debt signals</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <StatusPill label="Live Data" />
            <StatusPill label="Desktop Parity" subtle />
          </div>

          <Link href="/budget/transactions" style={buttonStyle('primary')}>
            <BudgetSymbol color="#02260d" name="add" size={18} />
            Add Transaction
          </Link>
        </div>
      </aside>

      <main style={{ minWidth: 0 }}>
        <header
          className="budget-topbar"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            padding: '14px 24px',
            background: `linear-gradient(180deg, ${withAlpha(BG, 0.86)}, ${withAlpha(BG, 0.56)})`,
            backdropFilter: 'blur(20px)',
            boxShadow: `inset 0 -1.5px 0 ${withAlpha(ACCENT_LIGHT, 0.08)}`,
          }}
        >
          <div style={{ display: 'grid', gap: 4 }}>
            <span
              style={{
                color: TEXT_TERTIARY,
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
              }}
            >
              Breadcrumb
            </span>
            <strong style={{ fontSize: 20, color: TEXT, letterSpacing: '-0.04em' }}>
              {getBreadcrumb(pathname)}
            </strong>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <TopPill icon="search" label="Search budgets, payees, alerts" />
            <TopPill icon="notifications" label="Review thresholds" accent />
            <TopPill icon="account_balance" label="Household budget" />
          </div>
        </header>

        <div style={{ padding: '24px 24px 56px' }}>
          <ModuleErrorBoundary moduleId="budget" moduleName="MyBudget">
            <ModuleLockGate moduleId="budget" moduleName="MyBudget" moduleIcon={'\uD83D\uDCB0'} accentColor={MONEY}>
              <div style={{ margin: '0 auto', maxWidth: 1480 }}>{children}</div>
            </ModuleLockGate>
          </ModuleErrorBoundary>
        </div>
      </main>
    </section>
  );
}

function panelSurface() {
  return {
    padding: 16,
    borderRadius: 24,
    background: `linear-gradient(180deg, ${withAlpha(SURFACE_LOW, 0.92)}, ${withAlpha(SURFACE, 0.96)})`,
    boxShadow: `inset 0 0 0 1.5px ${GLASS_BORDER}`,
  };
}

function NavGroup({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <span
        style={{
          color: TEXT_TERTIARY,
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 1.1,
          textTransform: 'uppercase',
        }}
      >
        {title}
      </span>
      <div style={{ display: 'grid', gap: 8 }}>{children}</div>
    </div>
  );
}

function BudgetNavLink({
  active,
  href,
  icon,
  label,
}: {
  active: boolean;
  href: string;
  icon: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        borderRadius: '18px 999px 999px 18px',
        textDecoration: 'none',
        color: active ? TEXT : TEXT_SECONDARY,
        fontSize: 14,
        fontWeight: active ? 700 : 600,
        background: active
          ? `linear-gradient(90deg, ${withAlpha(ACCENT, 0.22)}, ${withAlpha(GLASS_STRONG, 0.14)})`
          : 'transparent',
        boxShadow: active
          ? `inset -3px 0 0 ${ACCENT}, 0 0 28px ${withAlpha(ACCENT, 0.18)}`
          : undefined,
      }}
    >
      <BudgetSymbol color={active ? ACCENT_LIGHT : TEXT_TERTIARY} filled={active} name={icon} size={20} />
      <span>{label}</span>
    </Link>
  );
}

function StatusPill({ label, subtle }: { label: string; subtle?: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '7px 10px',
        borderRadius: 999,
        color: subtle ? TEXT_SECONDARY : BG,
        background: subtle ? GLASS : `linear-gradient(135deg, ${MONEY}, ${ACCENT_LIGHT})`,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: subtle ? TEXT_TERTIARY : BG,
        }}
      />
      {label}
    </span>
  );
}

function TopPill({
  accent,
  icon,
  label,
}: {
  accent?: boolean;
  icon: string;
  label: string;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 12px',
        borderRadius: 999,
        background: accent
          ? `linear-gradient(135deg, ${withAlpha(ACCENT_LIGHT, 0.22)}, ${withAlpha(ACCENT, 0.16)})`
          : withAlpha(SURFACE_LOW, 0.76),
        boxShadow: `inset 0 0 0 1px ${accent ? withAlpha(ACCENT_LIGHT, 0.18) : BORDER}`,
      }}
    >
      <BudgetSymbol color={accent ? ACCENT_LIGHT : TEXT_TERTIARY} name={icon} size={18} />
      <span style={{ color: accent ? TEXT : TEXT_SECONDARY, fontSize: 13, fontWeight: 600 }}>
        {label}
      </span>
    </span>
  );
}
