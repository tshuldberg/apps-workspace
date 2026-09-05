'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const SURF_SECTIONS = [
  { href: '/surf', label: 'Home' },
  { href: '/surf/map', label: 'Map' },
  { href: '/surf/sessions', label: 'Sessions' },
  { href: '/surf/favorites', label: 'Favorites' },
  { href: '/surf/account', label: 'Account' },
] as const;

interface SurfShellProps {
  subtitle: string;
  children: unknown;
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/surf') {
    return pathname === '/surf' || pathname.startsWith('/surf/spot/');
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SurfShell({ subtitle, children }: SurfShellProps) {
  const pathname = usePathname();

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>MySurf</h1>
        <p style={styles.subtitle}>{subtitle}</p>
      </div>

      <div style={styles.nav}>
        {SURF_SECTIONS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                ...styles.navItem,
                ...(active ? styles.navItemActive : {}),
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      {children as React.ReactNode}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 1080,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  header: {
    marginBottom: 2,
  },
  title: {
    fontSize: 30,
    fontWeight: 700,
    margin: 0,
    color: 'var(--text)',
  },
  subtitle: {
    marginTop: 4,
    color: 'var(--text-secondary)',
    fontSize: 14,
  },
  nav: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  navItem: {
    borderRadius: '999px',
    padding: '8px 12px',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--surface)',
    color: 'var(--text-secondary)',
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 600,
  },
  navItemActive: {
    borderColor: '#3B82F6',
    color: '#3B82F6',
    backgroundColor: 'rgba(59, 130, 246, 0.14)',
  },
};
