'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Grid3x3,
  CalendarDays,
  Users,
  UserCircle,
  Megaphone,
  BarChart3,
  CreditCard,
  Settings,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/floor-plan', label: 'Floor Plan', icon: Grid3x3 },
  { href: '/reservations', label: 'Reservations', icon: CalendarDays },
  { href: '/waitlist', label: 'Waitlist', icon: Users },
  { href: '/guests', label: 'Guests', icon: UserCircle },
  { href: '/marketing', label: 'Marketing', icon: Megaphone },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/payments', label: 'Payments', icon: CreditCard },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const;

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside
        style={{
          width: '240px',
          background: 'var(--surface)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.5rem 0',
          flexShrink: 0,
        }}
      >
        <div style={{ padding: '0 1.25rem', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--accent-light)' }}>
            Reservations
          </h2>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0 0.75rem' }}>
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.625rem 0.75rem',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: active ? 500 : 400,
                  color: active ? 'var(--text)' : 'var(--text-secondary)',
                  background: active ? 'var(--glass-strong)' : 'transparent',
                  transition: 'background 0.15s',
                }}
              >
                <Icon size={18} strokeWidth={active ? 2 : 1.5} />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, padding: '2rem', overflow: 'auto' }}>
        {children}
      </main>
    </div>
  );
}
