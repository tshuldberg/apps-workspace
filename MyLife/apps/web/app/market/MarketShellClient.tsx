'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  MARKET_CATEGORY_NAV,
  MARKET_GLOBAL_CSS,
  MARKET_PRIMARY_NAV,
  MARKET_ROOT_VARS,
  MARKET_TERTIARY_NAV,
  MarketIcon,
  MarketPill,
  formatLongDate,
} from './ui';

const SHELL_CSS = `
  .mk-shell {
    min-height: 100vh;
    background:
      radial-gradient(circle at top left, rgba(45, 212, 191, 0.14), transparent 26%),
      radial-gradient(circle at 80% 0, rgba(255, 184, 119, 0.12), transparent 22%),
      #0E0E13;
  }
  .mk-shell-frame {
    width: min(1440px, calc(100vw - 48px));
    margin: 0 auto;
    padding: 0 0 48px;
  }
  .mk-shell-grid {
    display: grid;
    grid-template-columns: 280px minmax(0, 1fr);
    gap: 24px;
    align-items: start;
  }
  .mk-sidebar {
    position: sticky;
    top: 88px;
    min-height: calc(100vh - 112px);
    display: grid;
    grid-template-rows: auto auto 1fr auto auto;
    gap: 18px;
    padding: 20px 18px 18px;
    border-radius: 30px;
    background: #0E0E13;
    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.32);
  }
  .mk-shell-topbar {
    position: sticky;
    top: 0;
    z-index: 50;
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    background: rgba(19, 19, 24, 0.7);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }
  .mk-shell-topbar-inner {
    width: min(1440px, calc(100vw - 48px));
    margin: 0 auto;
    min-height: 64px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
  }
  .mk-shell-main {
    display: grid;
    gap: 24px;
    padding-top: 24px;
  }
  .mk-sidebar-nav {
    display: grid;
    gap: 6px;
  }
  .mk-sidebar-link {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 42px;
    padding: 10px 14px;
    border-radius: 999px;
    color: var(--market-text-secondary);
    transition: color 0.16s ease, background 0.16s ease, transform 0.16s ease;
  }
  .mk-sidebar-link:hover {
    color: var(--market-text);
    background: rgba(255, 255, 255, 0.04);
    transform: translateX(2px);
  }
  .mk-sidebar-link.mk-active {
    color: var(--market-text);
    background: rgba(255, 255, 255, 0.06);
    box-shadow: inset -3px 0 0 var(--market-accent);
  }
  .mk-topbar-search {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 320px;
    max-width: 440px;
    width: 100%;
    border-radius: 999px;
    padding: 10px 14px;
    background: rgba(255, 255, 255, 0.05);
  }
  .mk-topbar-search input {
    width: 100%;
    border: none;
    background: transparent;
    color: var(--market-text);
    font: inherit;
    outline: none;
  }
  .mk-topbar-search input::placeholder {
    color: var(--market-text-tertiary);
  }
  .mk-topbar-controls {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .mk-topbar-button {
    width: 40px;
    height: 40px;
    border: none;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.05);
    display: grid;
    place-items: center;
    cursor: pointer;
  }
  .mk-mobile-nav {
    display: none;
  }
  @media (max-width: 1180px) {
    .mk-shell-grid {
      grid-template-columns: 1fr;
    }
    .mk-sidebar {
      display: none;
    }
    .mk-mobile-nav {
      display: flex;
      gap: 10px;
      overflow-x: auto;
      padding-bottom: 4px;
      scrollbar-width: none;
    }
    .mk-mobile-nav::-webkit-scrollbar {
      display: none;
    }
  }
  @media (max-width: 780px) {
    .mk-shell-topbar-inner,
    .mk-shell-frame {
      width: min(100vw - 24px, 1440px);
    }
    .mk-shell-topbar-inner {
      flex-wrap: wrap;
      align-items: center;
      padding: 10px 0;
    }
    .mk-topbar-search {
      min-width: 0;
      order: 3;
      width: 100%;
    }
  }
`;

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function formatSegment(segment: string) {
  if (segment === 'saved-searches') return 'Saved Searches';
  if (segment === 'seller') return 'Seller';
  if (segment === 'messages') return 'Messages';
  if (segment === 'orders') return 'Orders';
  if (segment === 'disputes') return 'Disputes';
  return segment
    .split('-')
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}

function buildBreadcrumbs(pathname: string) {
  const parts = pathname.split('/').filter(Boolean).slice(1);
  const crumbs = [{ href: '/market', label: 'MyMarket' }];
  let current = '/market';
  for (const part of parts) {
    current += `/${part}`;
    crumbs.push({ href: current, label: formatSegment(part) });
  }
  return crumbs;
}

export function MarketShellClient({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const breadcrumbs = buildBreadcrumbs(pathname);

  return (
    <div className="mk-shell" style={MARKET_ROOT_VARS}>
      <style>{MARKET_GLOBAL_CSS + SHELL_CSS}</style>

      <div className="mk-shell-topbar">
        <div className="mk-shell-topbar-inner">
          <div style={{ display: 'grid', gap: 6 }}>
            <Link href="/market" style={{ color: 'var(--market-accent-light)', fontSize: 11, fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase' }}>
              MyMarket
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {breadcrumbs.map((crumb, index) => (
                <span key={crumb.href} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: index === breadcrumbs.length - 1 ? 'var(--market-text)' : 'var(--market-text-secondary)', fontSize: 14 }}>
                  <Link href={crumb.href}>{crumb.label}</Link>
                  {index < breadcrumbs.length - 1 ? <MarketIcon name="chevron_right" color="var(--market-text-tertiary)" size={16} /> : null}
                </span>
              ))}
            </div>
          </div>

          <div className="mk-topbar-controls">
            <form action="/market/browse" className="mk-topbar-search">
              <MarketIcon name="search" color="var(--market-text-tertiary)" />
              <input name="q" placeholder="Search products, services, or sellers" />
            </form>
            <button type="button" className="mk-topbar-button" aria-label="Notifications">
              <MarketIcon name="notifications" color="var(--market-text)" />
            </button>
            <button type="button" className="mk-topbar-button" aria-label="Account">
              <MarketIcon name="person" color="var(--market-text)" />
            </button>
          </div>
        </div>
      </div>

      <div className="mk-shell-frame">
        <div className="mk-mobile-nav" style={{ paddingTop: 20 }}>
          {MARKET_PRIMARY_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                borderRadius: 999,
                background: isActive(pathname, item.href, 'exact' in item ? item.exact : false) ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.04)',
                color: isActive(pathname, item.href, 'exact' in item ? item.exact : false) ? 'var(--market-text)' : 'var(--market-text-secondary)',
                whiteSpace: 'nowrap',
              }}
            >
              <MarketIcon name={item.icon} color={isActive(pathname, item.href, 'exact' in item ? item.exact : false) ? 'var(--market-accent-light)' : 'var(--market-text-tertiary)'} size={18} />
              {item.label}
            </Link>
          ))}
        </div>

        <div className="mk-shell-grid">
          <aside className="mk-sidebar">
            <div style={{ display: 'grid', gap: 6 }}>
              <span style={{ color: 'var(--market-accent-light)', fontSize: 13, fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                MyMarket
              </span>
              <span style={{ color: 'var(--market-text-secondary)', fontSize: 13 }}>
                Active trader / {formatLongDate('2023-09-18T08:00:00.000Z')}
              </span>
            </div>

            <nav className="mk-sidebar-nav">
              {MARKET_PRIMARY_NAV.map((item) => {
                const active = isActive(pathname, item.href, 'exact' in item ? item.exact : false);
                return (
                  <Link key={item.href} href={item.href} className={`mk-sidebar-link${active ? ' mk-active' : ''}`}>
                    <MarketIcon name={item.icon} color={active ? 'var(--market-accent-light)' : 'var(--market-text-tertiary)'} size={20} />
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <details open style={{ display: 'grid', gap: 10 }}>
              <summary style={{ cursor: 'pointer', color: 'var(--market-text-tertiary)', fontSize: 12, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                Categories
              </summary>
              <nav className="mk-sidebar-nav">
                {MARKET_CATEGORY_NAV.map((item) => (
                  <Link key={item.href} href={item.href} className={`mk-sidebar-link${pathname === '/market/browse' && item.href.includes('category=') && item.href.includes(pathname.split('?')[0] ?? '') ? '' : ''}`}>
                    <MarketIcon name={item.icon} color="var(--market-text-tertiary)" size={18} />
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{item.label}</span>
                  </Link>
                ))}
              </nav>
            </details>

            <nav className="mk-sidebar-nav" style={{ alignContent: 'start' }}>
              {MARKET_TERTIARY_NAV.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link key={item.href} href={item.href} className={`mk-sidebar-link${active ? ' mk-active' : ''}`}>
                    <MarketIcon name={item.icon} color={active ? 'var(--market-accent-light)' : 'var(--market-text-tertiary)'} size={18} />
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div
              style={{
                display: 'grid',
                gap: 12,
                padding: 16,
                borderRadius: 24,
                background: 'rgba(255, 255, 255, 0.04)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 18,
                    background: 'linear-gradient(135deg, rgba(45, 212, 191, 0.9), rgba(20, 184, 166, 0.8))',
                    color: '#002A23',
                    fontWeight: 900,
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  AL
                </div>
                <div style={{ display: 'grid', gap: 4 }}>
                  <strong style={{ fontSize: 15 }}>Avery Lane</strong>
                  <span style={{ color: 'var(--market-text-secondary)', fontSize: 13 }}>Los Angeles</span>
                </div>
              </div>
              <MarketPill label="Trusted Seller" icon="verified" />
            </div>

            <Link
              href="/market/sell"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                minHeight: 48,
                borderRadius: 999,
                background: 'linear-gradient(135deg, var(--market-accent-light), var(--market-accent))',
                color: '#002A23',
                fontSize: 13,
                fontWeight: 900,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                boxShadow: '0 18px 40px rgba(20, 184, 166, 0.24)',
              }}
            >
              <MarketIcon name="add_circle" color="#002A23" filled />
              Sell
            </Link>
          </aside>

          <main className="mk-shell-main">{children}</main>
        </div>
      </div>
    </div>
  );
}
