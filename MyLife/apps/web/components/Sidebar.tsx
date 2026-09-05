'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useModuleRegistry } from '@mylife/module-registry/hooks';
import { isWebSupportedModuleId } from '@/lib/modules';
import { MODULE_ICON_MAP } from '@/lib/module-icons';
import { BarChart2, Compass, Menu, Search, Settings, Users, X } from 'lucide-react';

const MODULE_ROUTES: Record<string, string> = {
  books: '/books',
  budget: '/budget',
  car: '/car',
  classes: '/classes',
  closet: '/closet',
  cycle: '/cycle',
  create: '/create',
  dining: '/dining',
  fast: '/fast',
  flash: '/flash',
  garden: '/garden',
  habits: '/habits',
  health: '/health',
  homes: '/homes',
  journal: '/journal',
  mail: '/mail',
  meds: '/meds',
  mood: '/mood',
  notes: '/notes',
  nutrition: '/nutrition',
  pets: '/pets',
  recipes: '/recipes',
  rsvp: '/rsvp',
  sleep: '/sleep',
  sports: '/sports',
  stars: '/stars',
  subs: '/subs',
  surf: '/surf',
  trails: '/trails',
  travel: '/travel',
  voice: '/voice',
  words: '/words',
  workouts: '/workouts',
};

function SidebarContent({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const registry = useModuleRegistry();
  const enabled = registry.getEnabled().filter((mod) => isWebSupportedModuleId(mod.id));

  return (
    <>
      {/* Logo */}
      <Link href="/" style={styles.logo} onClick={onNavigate}>
        <span style={styles.logoIcon}>M</span>
        <span style={styles.logoText}>MyLife</span>
      </Link>

      {/* Search trigger */}
      <button
        onClick={() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
        }}
        style={styles.searchTrigger}
      >
        <Search size={14} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, textAlign: 'left' }}>Search</span>
        <kbd style={styles.searchKbd}>⌘K</kbd>
      </button>

      <div style={styles.divider} />

      {/* Enabled module links */}
      <div style={styles.moduleList}>
        {enabled.map((mod) => {
          const route = MODULE_ROUTES[mod.id] ?? `/${mod.id}`;
          const isActive = pathname.startsWith(route);
          const IconComponent = MODULE_ICON_MAP[mod.id];
          return (
            <Link
              key={mod.id}
              href={route}
              onClick={onNavigate}
              style={{
                ...styles.moduleLink,
                ...(isActive ? styles.moduleLinkActive : {}),
              }}
            >
              <span style={styles.moduleIcon}>
                {IconComponent && (
                  <IconComponent
                    size={16}
                    style={{ color: `var(--accent-${mod.id})` }}
                  />
                )}
              </span>
              <span
                style={{
                  ...styles.moduleName,
                  color: isActive ? `var(--accent-${mod.id})` : 'var(--text-secondary)',
                }}
              >
                {mod.name}
              </span>
            </Link>
          );
        })}

        {enabled.length === 0 && (
          <p style={styles.emptyText}>No modules enabled</p>
        )}
      </div>

      <div style={{ flex: 1 }} />
      <div style={styles.divider} />

      {/* Bottom links */}
      <Link
        href="/discover"
        onClick={onNavigate}
        style={{
          ...styles.bottomLink,
          ...(pathname === '/discover' ? { color: 'var(--text)' } : {}),
        }}
      >
        <span style={styles.bottomLinkContent}>
          <Compass size={16} />
          Discover
        </span>
      </Link>
      <Link
        href="/insights"
        onClick={onNavigate}
        style={{
          ...styles.bottomLink,
          ...(pathname === '/insights' ? { color: 'var(--text)' } : {}),
        }}
      >
        <span style={styles.bottomLinkContent}>
          <BarChart2 size={16} />
          Insights
        </span>
      </Link>
      <Link
        href="/settings"
        onClick={onNavigate}
        style={{
          ...styles.bottomLink,
          ...(pathname === '/settings' ? { color: 'var(--text)' } : {}),
        }}
      >
        <span style={styles.bottomLinkContent}>
          <Settings size={16} />
          Settings
        </span>
      </Link>
      <Link
        href="/social"
        onClick={onNavigate}
        style={{
          ...styles.bottomLink,
          ...(pathname.startsWith('/social')
            ? { color: 'var(--accent-social)' }
            : {}),
        }}
      >
        <span style={styles.bottomLinkContent}>
          <Users size={16} />
          Social
        </span>
      </Link>
    </>
  );
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <nav style={styles.sidebar} data-sidebar>
        <SidebarContent />
      </nav>

      {/* Mobile top bar */}
      <header style={styles.mobileHeader} data-mobile-header>
        <Link href="/" style={styles.mobileHeaderLogo}>
          <span style={styles.logoIcon}>M</span>
          <span style={styles.logoText}>MyLife</span>
        </Link>
        <button
          onClick={() => setMobileOpen(true)}
          style={styles.hamburger}
          aria-label="Open navigation"
        >
          <Menu size={24} />
        </button>
      </header>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          style={styles.overlay}
          data-mobile-overlay
          onClick={() => setMobileOpen(false)}
        >
          <nav
            style={styles.drawer}
            data-mobile-drawer
            onClick={(e) => e.stopPropagation()}
          >
            <div style={styles.drawerHeader}>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                Navigation
              </span>
              <button
                onClick={() => setMobileOpen(false)}
                style={styles.closeButton}
                aria-label="Close navigation"
              >
                <X size={20} />
              </button>
            </div>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </nav>
        </div>
      )}
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 'var(--sidebar-width)',
    minWidth: 'var(--sidebar-width)',
    height: '100vh',
    position: 'fixed',
    top: 0,
    left: 0,
    backgroundColor: 'var(--surface)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    padding: '16px 0',
    overflow: 'hidden',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '0 20px',
    marginBottom: '8px',
    textDecoration: 'none',
  },
  logoIcon: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: '18px',
    color: '#0A0A0F',
  },
  logoText: {
    fontSize: '20px',
    fontWeight: 700,
    color: 'var(--text)',
  },
  searchTrigger: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    margin: '0 12px 8px',
    padding: '8px 10px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--glass)',
    color: 'var(--text-tertiary)',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'border-color 0.15s',
  },
  searchKbd: {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--text-tertiary)',
    backgroundColor: 'var(--glass)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    padding: '1px 5px',
    lineHeight: '16px',
  },
  divider: {
    height: '1px',
    backgroundColor: 'var(--border)',
    margin: '12px 20px',
  },
  moduleList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    overflow: 'auto',
  },
  moduleLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 20px',
    borderRadius: '0',
    textDecoration: 'none',
    transition: 'background-color 0.15s',
  },
  moduleLinkActive: {
    backgroundColor: 'var(--glass-strong)',
  },
  moduleIcon: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    flexShrink: 0,
    backgroundColor: 'var(--glass)',
  },
  moduleName: {
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--text-secondary)',
    transition: 'color 0.15s',
  },
  emptyText: {
    padding: '8px 20px',
    fontSize: '13px',
    color: 'var(--text-tertiary)',
  },
  bottomLink: {
    padding: '8px 20px',
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--text-tertiary)',
    textDecoration: 'none',
    transition: 'color 0.15s',
  },
  bottomLinkContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  // Mobile styles
  mobileHeader: {
    display: 'none',
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    height: '56px',
    backgroundColor: 'var(--surface)',
    borderBottom: '1px solid var(--border)',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px',
    zIndex: 100,
  },
  mobileHeaderLogo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    textDecoration: 'none',
  },
  hamburger: {
    background: 'none',
    border: 'none',
    color: 'var(--text)',
    cursor: 'pointer',
    padding: '8px',
    borderRadius: '8px',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    zIndex: 200,
  },
  drawer: {
    position: 'fixed',
    top: 0,
    left: 0,
    bottom: 0,
    width: '280px',
    backgroundColor: 'var(--surface)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    padding: '16px 0',
    overflow: 'auto',
    zIndex: 201,
  },
  drawerHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 20px 12px',
    borderBottom: '1px solid var(--border)',
    marginBottom: '12px',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '6px',
  },
};
