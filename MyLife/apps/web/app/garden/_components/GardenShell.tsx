'use client';

import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell,
  BookOpenText,
  Camera,
  CircleUserRound,
  Droplets,
  Flower2,
  Grid2X2,
  LayoutDashboard,
  Map,
  Search,
  Settings,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  Sprout,
  SunMedium,
  Trees,
  Wheat,
} from 'lucide-react';
import { GARDEN_CHROME, GARDEN_FONT, GARDEN_SIDEBAR_WIDTH, alpha } from '../_lib/design';

type NavItem = {
  href: string;
  label: string;
  title: string;
  icon: typeof LayoutDashboard;
};

const NAV_ITEMS: NavItem[] = [
  { href: '/garden', label: 'Dashboard', title: 'Garden Overview', icon: LayoutDashboard },
  { href: '/garden/plants', label: 'Inventory', title: 'Plant Inventory', icon: Flower2 },
  { href: '/garden/schedule', label: 'Schedule', title: 'Watering Schedule', icon: Droplets },
  { href: '/garden/seasonal', label: 'Tasks', title: 'Garden Tasks', icon: Grid2X2 },
  { href: '/garden/harvests', label: 'Harvests', title: 'Harvest Records', icon: Wheat },
  { href: '/garden/zones', label: 'Zones', title: 'Zone Atlas', icon: Map },
  { href: '/garden/companions', label: 'Companions', title: 'Companion Matrix', icon: Sparkles },
  { href: '/garden/layout-planner', label: 'Layouts', title: 'Layout Planner', icon: Trees },
  { href: '/garden/journal', label: 'Journal', title: 'Garden Journal', icon: BookOpenText },
  { href: '/garden/photos', label: 'Photos', title: 'Garden Photos', icon: Camera },
  { href: '/garden/frost', label: 'Weather & Frost', title: 'Weather & Frost', icon: SunMedium },
  { href: '/garden/seeds', label: 'Seeds', title: 'Seed Library', icon: Sprout },
  { href: '/garden/wishlist', label: 'Wishlist', title: 'Wish List', icon: ShoppingBag },
  { href: '/garden/zones', label: 'Light Levels', title: 'Light Levels', icon: ShieldAlert },
];

function isActivePath(pathname: string, href: string): boolean {
  if (href === '/garden') return pathname === '/garden';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getPageTitle(pathname: string): string {
  if (/^\/garden\/[^/]+$/.test(pathname) && !NAV_ITEMS.some((item) => item.href === pathname)) {
    return 'Specimen Dossier';
  }
  return NAV_ITEMS.find((item) => isActivePath(pathname, item.href))?.title ?? 'MyGarden';
}

export function GardenShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const title = getPageTitle(pathname);

  return (
    <section
      style={{
        minHeight: '100vh',
        background: `radial-gradient(circle at top right, ${alpha(GARDEN_CHROME.accent, 0.12)}, transparent 34%), ${GARDEN_CHROME.surfaceDepth}`,
        color: GARDEN_CHROME.text,
        fontFamily: GARDEN_FONT,
      }}
    >
      <aside style={styles.sidebar}>
        <div style={styles.brandBlock}>
          <Link href="/garden" style={styles.brandLink}>
            <span style={styles.brandWordmark}>MyGarden</span>
            <span style={styles.brandSubtitle}>The Obsidian Library</span>
          </Link>
        </div>

        <nav style={styles.navScroll}>
          {NAV_ITEMS.map((item) => {
            const active = isActivePath(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={`${item.href}-${item.label}`}
                href={item.href}
                style={{
                  ...styles.navLink,
                  ...(active ? styles.navLinkActive : null),
                }}
              >
                <Icon size={17} strokeWidth={active ? 2.2 : 1.8} style={{ color: active ? GARDEN_CHROME.accent : GARDEN_CHROME.textDim }} />
                <span style={{ color: active ? GARDEN_CHROME.text : GARDEN_CHROME.textMuted }}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div style={styles.sidebarFooter}>
          <Link href="/garden/journal?composer=1" style={styles.newEntryButton}>
            New Entry
          </Link>
          <Link href="/settings" style={styles.settingsLink}>
            <Settings size={16} />
            <span>Settings</span>
          </Link>
        </div>
      </aside>

      <header style={styles.header}>
        <div style={styles.headerTitle}>{title}</div>
        <div style={styles.headerActions}>
          <label style={styles.searchWrap}>
            <Search size={16} style={{ color: GARDEN_CHROME.textDim }} />
            <input
              aria-label="Search cultivars"
              placeholder="Search cultivars..."
              style={styles.searchInput}
            />
          </label>
          <button type="button" style={styles.iconButton} aria-label="Notifications">
            <Bell size={18} />
            <span style={styles.notificationDot} />
          </button>
          <div style={styles.avatarPill}>
            <span style={styles.avatarCircle}>
              <CircleUserRound size={16} />
            </span>
            <span style={styles.avatarLabel}>Curator</span>
          </div>
        </div>
      </header>

      <main style={styles.content}>{children}</main>
    </section>
  );
}

const baseInteractive: CSSProperties = {
  transition: 'transform 180ms ease, background-color 180ms ease, color 180ms ease, border-color 180ms ease, box-shadow 180ms ease',
};

const styles: Record<string, CSSProperties> = {
  sidebar: {
    position: 'fixed',
    inset: '0 auto 0 0',
    width: GARDEN_SIDEBAR_WIDTH,
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    padding: '28px 18px 24px',
    background: 'rgba(19, 19, 24, 0.74)',
    backdropFilter: 'blur(24px)',
    boxShadow: `inset -1px 0 0 ${alpha('#FFFFFF', 0.03)}`,
    zIndex: 20,
  },
  brandBlock: {
    padding: '4px 12px 8px',
  },
  brandLink: {
    display: 'grid',
    gap: 4,
    textDecoration: 'none',
  },
  brandWordmark: {
    fontSize: 32,
    fontWeight: 800,
    lineHeight: 1,
    letterSpacing: -1.2,
    color: GARDEN_CHROME.gold,
  },
  brandSubtitle: {
    fontSize: 10,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: GARDEN_CHROME.textDim,
  },
  navScroll: {
    flex: 1,
    overflowY: 'auto',
    display: 'grid',
    gap: 4,
    paddingRight: 4,
  },
  navLink: {
    ...baseInteractive,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    minHeight: 44,
    padding: '0 14px',
    borderRadius: 16,
    textDecoration: 'none',
    textTransform: 'uppercase',
    letterSpacing: 1.3,
    fontSize: 12,
    fontWeight: 700,
  },
  navLinkActive: {
    background: alpha(GARDEN_CHROME.accent, 0.12),
    boxShadow: `inset -2px 0 0 ${GARDEN_CHROME.accent}`,
  },
  sidebarFooter: {
    display: 'grid',
    gap: 18,
    padding: '8px 10px 0',
  },
  newEntryButton: {
    ...baseInteractive,
    display: 'grid',
    placeItems: 'center',
    minHeight: 52,
    borderRadius: 999,
    textDecoration: 'none',
    textTransform: 'uppercase',
    letterSpacing: 1.8,
    fontSize: 12,
    fontWeight: 800,
    color: '#081105',
    background: `linear-gradient(135deg, ${GARDEN_CHROME.accentLight}, ${GARDEN_CHROME.accent})`,
    boxShadow: `0 18px 34px ${alpha(GARDEN_CHROME.accent, 0.28)}`,
  },
  settingsLink: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '8px 6px',
    textDecoration: 'none',
    color: GARDEN_CHROME.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    fontSize: 12,
    fontWeight: 700,
  },
  header: {
    position: 'fixed',
    top: 0,
    left: GARDEN_SIDEBAR_WIDTH,
    right: 0,
    height: 80,
    padding: '18px 32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 24,
    background: 'rgba(14, 14, 19, 0.44)',
    backdropFilter: 'blur(18px)',
    zIndex: 18,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: -0.8,
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    minWidth: 320,
    minHeight: 44,
    padding: '0 16px',
    borderRadius: 999,
    background: alpha('#FFFFFF', 0.08),
    boxShadow: `inset 0 0 0 1px ${alpha('#FFFFFF', 0.04)}`,
  },
  searchInput: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: GARDEN_CHROME.text,
    fontFamily: GARDEN_FONT,
    fontSize: 14,
  },
  iconButton: {
    ...baseInteractive,
    position: 'relative',
    width: 42,
    height: 42,
    borderRadius: 999,
    border: 'none',
    background: alpha('#FFFFFF', 0.07),
    color: GARDEN_CHROME.text,
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
  },
  notificationDot: {
    position: 'absolute',
    top: 11,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 999,
    background: GARDEN_CHROME.accent,
    boxShadow: `0 0 0 3px ${GARDEN_CHROME.surfaceDepth}`,
  },
  avatarPill: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    minHeight: 42,
    padding: '0 10px 0 8px',
    borderRadius: 999,
    background: alpha('#FFFFFF', 0.07),
  },
  avatarCircle: {
    width: 26,
    height: 26,
    borderRadius: 999,
    display: 'grid',
    placeItems: 'center',
    background: `linear-gradient(135deg, ${GARDEN_CHROME.gold}, ${GARDEN_CHROME.goldDeep})`,
    color: '#2E1600',
  },
  avatarLabel: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  content: {
    marginLeft: GARDEN_SIDEBAR_WIDTH,
    padding: '104px 32px 32px',
    minHeight: '100vh',
  },
};
