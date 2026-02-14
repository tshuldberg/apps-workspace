'use client'

import { useCallback } from 'react'
import type { DockviewApi } from 'dockview-react'

export interface ContextMenuPosition {
  x: number
  y: number
  panelId: string
}

interface PanelContextMenuProps {
  position: ContextMenuPosition
  api: DockviewApi
  onClose: () => void
}

interface MenuItem {
  label: string
  shortcut?: string
  action: () => void
  separator?: boolean
}

export function PanelContextMenu({ position, api, onClose }: PanelContextMenuProps) {
  const panel = api.getPanel(position.panelId)

  const handleClose = useCallback(() => {
    if (!panel) return
    api.removePanel(panel)
    onClose()
  }, [api, panel, onClose])

  const handleMaximize = useCallback(() => {
    if (!panel) return
    // Toggle maximize by checking if already maximized
    if (api.maximizedGroup === panel.group) {
      api.exitMaximizedGroup()
    } else {
      panel.group.api.maximize()
    }
    onClose()
  }, [api, panel, onClose])

  const handleSplitRight = useCallback(() => {
    if (!panel) return
    api.addPanel({
      id: `chart-split-${Date.now()}`,
      component: 'chart',
      title: 'Chart',
      params: { symbol: 'AAPL' },
      position: { referencePanel: panel, direction: 'right' },
    })
    onClose()
  }, [api, panel, onClose])

  const handleSplitDown = useCallback(() => {
    if (!panel) return
    api.addPanel({
      id: `chart-split-${Date.now()}`,
      component: 'chart',
      title: 'Chart',
      params: { symbol: 'AAPL' },
      position: { referencePanel: panel, direction: 'below' },
    })
    onClose()
  }, [api, panel, onClose])

  const handleMoveToNewGroup = useCallback(() => {
    if (!panel) return
    api.addPanel({
      id: panel.id + '-moved',
      component: panel.view.contentComponent,
      title: panel.title,
      params: panel.params,
      position: { referencePanel: panel, direction: 'right' },
    })
    api.removePanel(panel)
    onClose()
  }, [api, panel, onClose])

  if (!panel) return null

  const items: MenuItem[] = [
    { label: 'Split Right', action: handleSplitRight },
    { label: 'Split Down', action: handleSplitDown },
    { label: 'Move to New Group', action: handleMoveToNewGroup, separator: true },
    {
      label: api.maximizedGroup === panel.group ? 'Restore' : 'Maximize',
      action: handleMaximize,
    },
    { label: 'Close Panel', shortcut: 'Cmd+W', action: handleClose, separator: true },
  ]

  return (
    <div
      className="fixed z-50 min-w-[180px] rounded border border-border bg-navy-dark py-1 shadow-lg"
      style={{ left: position.x, top: position.y }}
    >
      {items.map((item, i) => (
        <div key={i}>
          {item.separator && i > 0 && <div className="my-1 border-t border-border" />}
          <button
            onClick={item.action}
            className="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs text-text-secondary hover:bg-navy-light hover:text-text-primary"
          >
            <span>{item.label}</span>
            {item.shortcut && (
              <span className="ml-4 text-text-muted">{item.shortcut}</span>
            )}
          </button>
        </div>
      ))}
    </div>
  )
}
