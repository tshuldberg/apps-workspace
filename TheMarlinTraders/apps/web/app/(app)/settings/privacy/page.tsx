'use client'

import { useState, useCallback } from 'react'
import { Button } from '@marlin/ui/primitives/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@marlin/ui/primitives/card'
import { cn } from '@marlin/ui/lib/utils'

// ── Toggle Switch ────────────────────────────────────────────────────────────

interface ToggleSwitchProps {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}

function ToggleSwitch({ label, description, checked, onChange }: ToggleSwitchProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-navy-dark px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-text-primary">{label}</p>
        <p className="text-xs text-text-muted">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-navy-dark',
          checked ? 'bg-accent' : 'bg-navy-mid',
        )}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-5 w-5 rounded-full bg-text-primary shadow-lg ring-0 transition-transform duration-200 ease-in-out',
            checked ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </button>
    </div>
  )
}

// ── Page Component ───────────────────────────────────────────────────────────

export default function PrivacySettingsPage() {
  // Will be replaced with tRPC query:
  // trpc.profiles.getProfile.useQuery({ userId: currentUserId })
  const [showStats, setShowStats] = useState(true)
  const [showIdeas, setShowIdeas] = useState(true)
  const [showJournal, setShowJournal] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Will be replaced with tRPC mutation:
  // trpc.profiles.updatePrivacy.useMutation()
  const handleSave = useCallback(() => {
    setIsSaving(true)
    setSaved(false)

    // Simulated save -- will be replaced with tRPC mutation
    setTimeout(() => {
      setIsSaving(false)
      setSaved(true)
      console.log('Privacy settings saved:', { showStats, showIdeas, showJournal })

      // Clear saved indicator after 2s
      setTimeout(() => setSaved(false), 2000)
    }, 500)
  }, [showStats, showIdeas, showJournal])

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">Privacy</h1>
        <p className="text-sm text-text-secondary">
          Control what information is visible on your public profile
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile Visibility</CardTitle>
          <CardDescription>
            Choose which sections of your profile are visible to other traders.
            When disabled, the section will show a "private" placeholder to visitors.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ToggleSwitch
            label="Show trading stats publicly"
            description="Your win rate, Sharpe ratio, profit factor, and other performance metrics will be visible on your profile and leaderboard."
            checked={showStats}
            onChange={setShowStats}
          />

          <ToggleSwitch
            label="Show ideas publicly"
            description="Your published trading ideas will appear on your profile page. Draft ideas are always private."
            checked={showIdeas}
            onChange={setShowIdeas}
          />

          <ToggleSwitch
            label="Show journal publicly"
            description="Your journal entries and trade log will be visible to other users. Individual entries can still be marked private."
            checked={showJournal}
            onChange={setShowJournal}
          />

          <div className="flex items-center gap-3 pt-2">
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
            {saved && (
              <span className="text-xs text-trading-green">
                Settings saved successfully
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Leaderboard Participation</CardTitle>
          <CardDescription>
            Your ranking on leaderboards is tied to your stats visibility. If you hide your
            trading stats, you will not appear on any leaderboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-text-muted">
            Currently: {showStats ? (
              <span className="text-trading-green font-medium">Visible on leaderboards</span>
            ) : (
              <span className="text-text-secondary font-medium">Hidden from leaderboards</span>
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
