'use client'

import { useRef, useCallback, useEffect, useState } from 'react'
import {
  DockviewReact,
  type DockviewReadyEvent,
  type DockviewApi,
  type IDockviewPanelProps,
  type SerializedDockview,
} from 'dockview-react'
import 'dockview-react/dist/styles/dockview.css'
import { PANEL_REGISTRY, type PanelType } from './panels/index.js'
import { LAYOUT_PRESETS } from './layout-presets.js'
import { useWorkspaceHotkeys } from './workspace-hotkeys.js'
import { PanelContextMenu, type ContextMenuPosition } from './panel-context-menu.js'

const LOCAL_STORAGE_KEY = 'marlin-workspace-layout'

let panelCounter = 0
function nextPanelId(type: PanelType): string {
  panelCounter++
  return `${type}-${panelCounter}`
}

function buildComponents(): Record<string, React.ComponentType<IDockviewPanelProps<Record<string, unknown>>>> {
  const components: Record<string, React.ComponentType<IDockviewPanelProps<Record<string, unknown>>>> = {}
  for (const [type, entry] of Object.entries(PANEL_REGISTRY)) {
    components[type] = entry.component
  }
  return components
}

const components = buildComponents()

export interface WorkspaceProps {
  /** Server-loaded layout JSON (from DB). Takes precedence over localStorage. */
  savedLayout?: SerializedDockview | null
  /** Callback when layout changes (for auto-save) */
  onLayoutChange?: (layout: SerializedDockview) => void
}

export function Workspace({ savedLayout, onLayoutChange }: WorkspaceProps) {
  const apiRef = useRef<DockviewApi | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuPosition | null>(null)

  const getInitialLayout = useCallback((): SerializedDockview | null => {
    // Priority: server-saved layout > localStorage > first preset
    if (savedLayout) return savedLayout

    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (stored) {
        try {
          return JSON.parse(stored) as SerializedDockview
        } catch {
          // Corrupted layout, ignore
        }
      }
    }

    return null
  }, [savedLayout])

  const handleReady = useCallback(
    (event: DockviewReadyEvent) => {
      apiRef.current = event.api

      const layout = getInitialLayout()
      if (layout) {
        event.api.fromJSON(layout)
      } else {
        // Load default preset (single chart)
        event.api.fromJSON(LAYOUT_PRESETS[0]!.layout)
      }

      // Auto-save on layout changes
      const disposable = event.api.onDidLayoutChange(() => {
        const serialized = event.api.toJSON()
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(serialized))
        onLayoutChange?.(serialized)
      })

      return () => disposable.dispose()
    },
    [getInitialLayout, onLayoutChange],
  )

  const applyPreset = useCallback((presetId: string) => {
    const api = apiRef.current
    if (!api) return
    const preset = LAYOUT_PRESETS.find((p) => p.id === presetId)
    if (!preset) return
    api.fromJSON(preset.layout)
  }, [])

  const addPanel = useCallback((type: PanelType, params?: Record<string, unknown>) => {
    const api = apiRef.current
    if (!api) return
    const id = nextPanelId(type)
    const entry = PANEL_REGISTRY[type]
    api.addPanel({
      id,
      component: type,
      title: entry.defaultTitle,
      params: params ?? {},
    })
  }, [])

  // Wire up hotkeys
  useWorkspaceHotkeys({ applyPreset, addPanel })

  // Context menu handler
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    // Only trigger on panel tab areas or panel content
    const target = e.target as HTMLElement
    const panelElement = target.closest('[data-dockview-panel-id]') as HTMLElement | null
    if (!panelElement) return

    e.preventDefault()
    const panelId = panelElement.getAttribute('data-dockview-panel-id')
    if (!panelId) return

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      panelId,
    })
  }, [])

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return
    const handleClick = () => setContextMenu(null)
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [contextMenu])

  return (
    <div className="relative h-full w-full" onContextMenu={handleContextMenu}>
      <DockviewReact
        onReady={handleReady}
        components={components}
        className="dockview-theme-dark"
      />

      {contextMenu && apiRef.current && (
        <PanelContextMenu
          position={contextMenu}
          api={apiRef.current}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}

export { type DockviewApi }
