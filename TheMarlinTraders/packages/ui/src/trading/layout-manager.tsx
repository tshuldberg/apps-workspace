'use client'

import { useState, useCallback } from 'react'
import { cn } from '../lib/utils.js'
import { Button } from '../primitives/button.js'
import { Input } from '../primitives/input.js'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '../primitives/dropdown-menu.js'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../primitives/dialog.js'

export interface SavedLayout {
  id: string
  name: string
  isDefault: boolean
  createdAt: string
}

export interface LayoutPresetOption {
  id: string
  name: string
  description: string
  shortcut?: string
}

export interface LayoutManagerProps {
  presets: LayoutPresetOption[]
  savedLayouts: SavedLayout[]
  currentLayoutName?: string
  onSelectPreset: (presetId: string) => void
  onSaveLayout: (name: string) => void
  onLoadLayout: (id: string) => void
  onRenameLayout: (id: string, name: string) => void
  onDeleteLayout: (id: string) => void
  onSetDefault: (id: string) => void
  className?: string
}

export function LayoutManager({
  presets,
  savedLayouts,
  currentLayoutName,
  onSelectPreset,
  onSaveLayout,
  onLoadLayout,
  onRenameLayout,
  onDeleteLayout,
  onSetDefault,
  className,
}: LayoutManagerProps) {
  const [isSaveOpen, setIsSaveOpen] = useState(false)
  const [isRenameOpen, setIsRenameOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameName, setRenameName] = useState('')

  const handleSave = useCallback(() => {
    if (!saveName.trim()) return
    onSaveLayout(saveName.trim())
    setSaveName('')
    setIsSaveOpen(false)
  }, [saveName, onSaveLayout])

  const handleRename = useCallback(() => {
    if (!renameId || !renameName.trim()) return
    onRenameLayout(renameId, renameName.trim())
    setRenameId(null)
    setRenameName('')
    setIsRenameOpen(false)
  }, [renameId, renameName, onRenameLayout])

  const openRename = useCallback((layout: SavedLayout) => {
    setRenameId(layout.id)
    setRenameName(layout.name)
    setIsRenameOpen(true)
  }, [])

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className={cn('gap-1.5 text-xs', className)}>
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 5h16M4 12h16M4 19h7"
              />
            </svg>
            {currentLayoutName ?? 'Layout'}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-56">
          {/* Presets */}
          <DropdownMenuLabel>Presets</DropdownMenuLabel>
          {presets.map((preset) => (
            <DropdownMenuItem
              key={preset.id}
              onClick={() => onSelectPreset(preset.id)}
            >
              <div className="flex w-full items-center justify-between">
                <span>{preset.name}</span>
                {preset.shortcut && (
                  <span className="text-xs text-text-muted">{preset.shortcut}</span>
                )}
              </div>
            </DropdownMenuItem>
          ))}

          {/* Saved layouts */}
          {savedLayouts.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Saved Layouts</DropdownMenuLabel>
              {savedLayouts.map((layout) => (
                <DropdownMenuItem key={layout.id} className="group">
                  <div className="flex w-full items-center justify-between">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onLoadLayout(layout.id)
                      }}
                      className="flex items-center gap-1 text-left"
                    >
                      {layout.isDefault && (
                        <span className="text-accent" title="Default layout">*</span>
                      )}
                      <span>{layout.name}</span>
                    </button>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onSetDefault(layout.id)
                        }}
                        title="Set as default"
                        className="rounded px-1 text-xs text-text-muted hover:text-accent"
                      >
                        D
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          openRename(layout)
                        }}
                        title="Rename"
                        className="rounded px-1 text-xs text-text-muted hover:text-text-primary"
                      >
                        R
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onDeleteLayout(layout.id)
                        }}
                        title="Delete"
                        className="rounded px-1 text-xs text-text-muted hover:text-trading-red"
                      >
                        X
                      </button>
                    </div>
                  </div>
                </DropdownMenuItem>
              ))}
            </>
          )}

          {/* Save current */}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setIsSaveOpen(true)}>
            Save Current Layout...
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Save dialog */}
      <Dialog open={isSaveOpen} onOpenChange={setIsSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Layout</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Layout name"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setIsSaveOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!saveName.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Layout</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="New name"
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
          />
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setIsRenameOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleRename} disabled={!renameName.trim()}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
