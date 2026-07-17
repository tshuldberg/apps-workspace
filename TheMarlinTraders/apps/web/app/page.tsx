import Link from 'next/link'
import { GlobalNavMenu } from '../components/global-nav-menu.js'

export default function HomePage() {
  const quickLinks = [
    { href: '/chart/AAPL', label: 'Open Chart (AAPL)' },
    { href: '/trade/AAPL', label: 'Trade Ticket' },
    { href: '/scanner', label: 'Scanner' },
    { href: '/strategy', label: 'Strategy' },
    { href: '/options/AAPL', label: 'Options Chain' },
    { href: '/heatmap', label: 'Heatmap' },
    { href: '/ideas', label: 'Ideas' },
    { href: '/chat', label: 'Chat Rooms' },
    { href: '/news', label: 'News' },
    { href: '/settings', label: 'Settings' },
  ]

  return (
    <>
      <GlobalNavMenu />
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="w-full max-w-4xl text-center">
          <h1 className="text-4xl font-bold tracking-tight">
            TheMarlin<span className="text-accent">Traders</span>
          </h1>
          <p className="mt-4 text-lg text-text-secondary">
            All-in-one trading platform — charting, strategy, execution, journaling, and community.
          </p>

          <div className="mt-8 flex justify-center">
            <Link
              href="/chart/AAPL"
              className="rounded-panel border border-border bg-navy-dark px-6 py-3 text-sm text-text-secondary transition-colors hover:bg-navy-mid hover:text-text-primary"
            >
              Phase 1: Core Charting Platform
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-3 text-left sm:grid-cols-2">
            {quickLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-panel border border-border bg-navy-dark px-4 py-3 text-sm text-text-secondary transition-colors hover:bg-navy-mid hover:text-text-primary"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </main>
    </>
  )
}
