'use client'

import { useState, useCallback } from 'react'
import { cn } from '../lib/utils.js'

export interface WatchlistTab {
  id: string
  name: string
}

export interface WatchlistTabsProps {
  tabs: WatchlistTab[]
  activeId: string | null
  onSelect: (id: string) => void
  onCreate: (name: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  className?: string
}

export function WatchlistTabs({
  tabs,
  activeId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  className,
}: WatchlistTabsProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')

  const startRename = useCallback((tab: WatchlistTab) => {
    setEditingId(tab.id)
    setEditValue(tab.name)
  }, [])

  const commitRename = useCallback(() => {
    if (editingId && editValue.trim()) {
      onRename(editingId, editValue.trim())
    }
    setEditingId(null)
    setEditValue('')
  }, [editingId, editValue, onRename])

  const commitCreate = useCallback(() => {
    if (newName.trim()) {
      onCreate(newName.trim())
    }
    setIsCreating(false)
    setNewName('')
  }, [newName, onCreate])

  return (
    <div className={cn('flex items-center gap-0.5 border-b border-border bg-navy-dark px-1', className)}>
      {tabs.map((tab) => (
        <div key={tab.id} className="group relative flex items-center">
          {editingId === tab.id ? (
            <input
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') {
                  setEditingId(null)
                  setEditValue('')
                }
              }}
              className="h-7 w-24 rounded-sm border border-accent bg-navy-mid px-2 text-xs text-text-primary outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => onSelect(tab.id)}
              onDoubleClick={() => startRename(tab)}
              className={cn(
                'flex h-8 items-center gap-1 rounded-t-md px-3 text-xs transition-colors',
                activeId === tab.id
                  ? 'bg-navy-mid text-text-primary'
                  : 'text-text-muted hover:bg-navy-light hover:text-text-secondary',
              )}
            >
              {tab.name}
              {/* Delete button — visible on hover */}
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(tab.id)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.stopPropagation()
                    onDelete(tab.id)
                  }
                }}
                className="ml-1 hidden rounded-sm p-0.5 text-text-muted hover:bg-navy-dark hover:text-text-primary group-hover:inline-flex"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </span>
            </button>
          )}
        </div>
      ))}

      {/* Create new tab */}
      {isCreating ? (
        <input
          autoFocus
          value={newName}
          placeholder="List name"
          onChange={(e) => setNewName(e.target.value)}
          onBlur={commitCreate}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitCreate()
            if (e.key === 'Escape') {
              setIsCreating(false)
              setNewName('')
            }
          }}
          className="h-7 w-24 rounded-sm border border-accent bg-navy-mid px-2 text-xs text-text-primary outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => setIsCreating(true)}
          className="flex h-8 w-8 items-center justify-center rounded-t-md text-text-muted hover:bg-navy-light hover:text-text-secondary"
          title="New watchlist"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
        </button>
      )}
    </div>
  )
}
