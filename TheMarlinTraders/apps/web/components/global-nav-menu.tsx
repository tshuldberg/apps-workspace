'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@marlin/ui/lib/utils'

interface NavItem {
  href: string
  label: string
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/chart/AAPL', label: 'Chart' },
  { href: '/trade/AAPL', label: 'Trade' },
  { href: '/scanner', label: 'Scanner' },
  { href: '/strategy', label: 'Strategy' },
  { href: '/options/AAPL', label: 'Options' },
  { href: '/heatmap', label: 'Heatmap' },
  { href: '/ideas', label: 'Ideas' },
  { href: '/chat', label: 'Chat' },
  { href: '/news', label: 'News' },
  { href: '/settings/profile', label: 'Settings' },
]

export function GlobalNavMenu() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <>
      <button
        type="button"
        aria-label="Open navigation menu"
        onClick={() => setOpen((v) => !v)}
        className="fixed left-3 top-3 z-[80] flex h-9 w-9 items-center justify-center rounded-md border border-border bg-navy-dark/90 text-text-secondary backdrop-blur transition-colors hover:text-text-primary"
      >
        <span className="text-base leading-none">≡</span>
      </button>

      {open && (
        <button
          type="button"
          aria-label="Close navigation overlay"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[70] bg-black/50"
        />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 z-[80] flex h-screen w-72 flex-col border-r border-border bg-navy-dark/95 backdrop-blur transition-transform duration-200',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-header-h items-center justify-between border-b border-border px-4">
          <span className="text-sm font-semibold text-text-primary">Navigate</span>
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setOpen(false)}
            className="rounded px-2 py-1 text-xs text-text-muted transition-colors hover:bg-navy-mid hover:text-text-primary"
          >
            Close
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
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
        </nav>

        <div className="border-t border-border px-4 py-3 text-[11px] text-text-muted">
          TheMarlinTraders Navigation
        </div>
      </aside>
    </>
  )
}
