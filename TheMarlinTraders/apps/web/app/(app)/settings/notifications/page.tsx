'use client'

import { useState } from 'react'
import { Button } from '@marlin/ui/primitives/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@marlin/ui/primitives/card'

interface NotificationPref {
  id: string
  label: string
  description: string
  enabled: boolean
}

const DEFAULT_PREFS: NotificationPref[] = [
  {
    id: 'price-alerts',
    label: 'Price Alerts',
    description: 'Get notified when your price alerts trigger',
    enabled: true,
  },
  {
    id: 'order-fills',
    label: 'Order Fills',
    description: 'Notifications when your paper orders are filled',
    enabled: true,
  },
  {
    id: 'daily-summary',
    label: 'Daily Summary',
    description: 'End-of-day portfolio performance summary',
    enabled: false,
  },
  {
    id: 'market-news',
    label: 'Market News',
    description: 'Breaking news for symbols in your watchlists',
    enabled: false,
  },
  {
    id: 'product-updates',
    label: 'Product Updates',
    description: 'New features and platform announcements',
    enabled: true,
  },
]

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
        checked ? 'bg-accent' : 'bg-navy-light'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-text-primary shadow-sm transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

export default function NotificationSettingsPage() {
  const [prefs, setPrefs] = useState(DEFAULT_PREFS)

  function togglePref(id: string) {
    setPrefs((prev) =>
      prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p)),
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">Notifications</h1>
        <p className="text-sm text-text-secondary">Configure how you receive notifications</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>Choose which notifications you want to receive</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {prefs.map((pref) => (
            <div key={pref.id} className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-text-primary">{pref.label}</p>
                <p className="text-xs text-text-muted">{pref.description}</p>
              </div>
              <Toggle checked={pref.enabled} onChange={() => togglePref(pref.id)} />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button size="sm">Save Preferences</Button>
      </div>
    </div>
  )
}
