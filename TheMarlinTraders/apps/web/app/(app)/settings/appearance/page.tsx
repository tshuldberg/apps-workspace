'use client'

import { useState } from 'react'
import { Button } from '@marlin/ui/primitives/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@marlin/ui/primitives/card'
import { cn } from '@marlin/ui/lib/utils'

type Theme = 'dark' | 'light' | 'system'

interface ThemeOption {
  id: Theme
  label: string
  description: string
  preview: string
}

const THEMES: ThemeOption[] = [
  {
    id: 'dark',
    label: 'Dark',
    description: 'Navy-black theme (default)',
    preview: 'bg-navy-black',
  },
  {
    id: 'light',
    label: 'Light',
    description: 'Light theme for daytime trading',
    preview: 'bg-slate-100',
  },
  {
    id: 'system',
    label: 'System',
    description: 'Follow your OS preference',
    preview: 'bg-gradient-to-r from-navy-black to-slate-100',
  },
]

export default function AppearanceSettingsPage() {
  const [theme, setTheme] = useState<Theme>('dark')

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">Appearance</h1>
        <p className="text-sm text-text-secondary">Customize the look and feel</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <CardDescription>Select your preferred color theme</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-md border p-3 transition-colors',
                  theme === t.id
                    ? 'border-accent bg-navy-mid'
                    : 'border-border hover:border-border-hover',
                )}
              >
                <div
                  className={cn(
                    'h-16 w-full rounded border border-border',
                    t.preview,
                  )}
                />
                <span className="text-xs font-medium text-text-primary">{t.label}</span>
                <span className="text-center text-[10px] text-text-muted">{t.description}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Chart Colors</CardTitle>
          <CardDescription>Customize candle and indicator colors</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">Bullish candle</span>
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded border border-border bg-trading-green" />
              <span className="font-mono text-xs text-text-muted">#22c55e</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">Bearish candle</span>
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded border border-border bg-trading-red" />
              <span className="font-mono text-xs text-text-muted">#ef4444</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button size="sm">Save</Button>
      </div>
    </div>
  )
}
