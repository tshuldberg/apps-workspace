'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@marlin/ui/lib/utils'

const NAV_ITEMS = [
  { href: '/settings/profile', label: 'Profile' },
  { href: '/settings/privacy', label: 'Privacy' },
  { href: '/settings/billing', label: 'Billing' },
  { href: '/settings/broker', label: 'Broker' },
  { href: '/settings/notifications', label: 'Notifications' },
  { href: '/settings/appearance', label: 'Appearance' },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex h-full">
      {/* Settings sidebar nav */}
      <nav className="hidden w-56 shrink-0 border-r border-border bg-navy-dark md:block">
        <div className="flex h-header-h items-center border-b border-border px-4">
          <span className="text-sm font-semibold text-text-primary">Settings</span>
        </div>
        <div className="flex flex-col gap-1 p-2">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'rounded-md px-3 py-2 text-sm transition-colors',
                pathname === item.href || pathname?.startsWith(item.href + '/')
                  ? 'bg-navy-light text-text-primary'
                  : 'text-text-secondary hover:bg-navy-mid hover:text-text-primary',
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>

      {/* Settings content */}
      <div className="flex-1 overflow-y-auto p-6">{children}</div>
    </div>
  )
}
