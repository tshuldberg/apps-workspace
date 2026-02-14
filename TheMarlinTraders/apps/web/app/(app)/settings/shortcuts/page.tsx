'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { Button } from '@marlin/ui/primitives/button'
import { Card, CardContent, CardHeader, CardTitle } from '@marlin/ui/primitives/card'
import { Input } from '@marlin/ui/primitives/input'
import {
  DEFAULT_KEYBINDINGS,
  KEYBINDING_CATEGORIES,
  type Keybinding,
} from '@marlin/shared'
import { formatKeybinding } from '@marlin/ui/trading/hotkey-manager'

function KeyRecorder({
  onRecord,
  onCancel,
}: {
  onRecord: (keys: string) => void
  onCancel: () => void
}) {
  const [recorded, setRecorded] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ref.current?.focus()
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()

      if (e.key === 'Escape') {
        onCancel()
        return
      }

      const key = e.key.toLowerCase()
      if (['control', 'shift', 'alt', 'meta'].includes(key)) return

      const parts: string[] = []
      if (e.metaKey || e.ctrlKey) parts.push('mod')
      if (e.shiftKey) parts.push('shift')
      if (e.altKey) parts.push('alt')
      parts.push(key === ' ' ? 'space' : key)
      const combo = parts.join('+')
      setRecorded(combo)
    },
    [onCancel],
  )

  return (
    <div className="flex items-center gap-2">
      <div
        ref={ref}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="flex h-8 min-w-[120px] items-center justify-center rounded border border-accent bg-navy-mid px-3 font-mono text-xs text-text-primary outline-none ring-1 ring-accent"
      >
        {recorded ? (
          <span>{formatKeybinding(recorded)}</span>
        ) : (
          <span className="animate-pulse text-accent">Press keys...</span>
        )}
      </div>
      {recorded && (
        <Button size="sm" onClick={() => onRecord(recorded)}>
          Save
        </Button>
      )}
      <Button size="sm" variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  )
}

export default function ShortcutsSettingsPage() {
  const [bindings, setBindings] = useState<Keybinding[]>(() => [...DEFAULT_KEYBINDINGS])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search) return bindings
    const q = search.toLowerCase()
    return bindings.filter(
      (b) =>
        b.label.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q) ||
        b.keys.toLowerCase().includes(q),
    )
  }, [bindings, search])

  const grouped = useMemo(
    () =>
      KEYBINDING_CATEGORIES.map((cat) => ({
        ...cat,
        bindings: filtered.filter((b) => b.category === cat.id),
      })).filter((g) => g.bindings.length > 0),
    [filtered],
  )

  const handleRecord = useCallback((id: string, newKeys: string) => {
    setBindings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, keys: newKeys } : b)),
    )
    setEditingId(null)
  }, [])

  const handleReset = useCallback(() => {
    setBindings([...DEFAULT_KEYBINDINGS])
    setEditingId(null)
  }, [])

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">Keyboard Shortcuts</h1>
        <p className="text-sm text-text-secondary">
          Customize keybindings for trading, navigation, and tools
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Input
          placeholder="Search shortcuts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Button size="sm" variant="outline" onClick={handleReset}>
          Reset to Defaults
        </Button>
      </div>

      {grouped.map((group) => (
        <Card key={group.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{group.label}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left text-[11px] text-text-muted">
                  <th className="px-4 py-2 font-medium">Action</th>
                  <th className="px-4 py-2 font-medium">Description</th>
                  <th className="px-4 py-2 text-right font-medium">Shortcut</th>
                </tr>
              </thead>
              <tbody>
                {group.bindings.map((binding) => (
                  <tr
                    key={binding.id}
                    className="border-b border-border/50 last:border-0 hover:bg-navy-mid/30"
                  >
                    <td className="px-4 py-2.5 text-sm font-medium text-text-primary">
                      {binding.label}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-text-muted">
                      {binding.description}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {editingId === binding.id ? (
                        <KeyRecorder
                          onRecord={(keys) => handleRecord(binding.id, keys)}
                          onCancel={() => setEditingId(null)}
                        />
                      ) : (
                        <button
                          onClick={() => setEditingId(binding.id)}
                          className="inline-flex items-center rounded border border-border bg-navy-mid px-2 py-1 font-mono text-xs text-text-secondary transition-colors hover:border-accent hover:text-text-primary"
                          title="Click to rebind"
                        >
                          {formatKeybinding(binding.keys)}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}

      {grouped.length === 0 && (
        <div className="py-12 text-center text-sm text-text-muted">
          No shortcuts match &ldquo;{search}&rdquo;
        </div>
      )}
    </div>
  )
}
