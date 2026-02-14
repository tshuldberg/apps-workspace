import { useEffect } from 'react'
import type { PanelType } from './panels/index.js'

interface WorkspaceHotkeysConfig {
  applyPreset: (presetId: string) => void
  addPanel: (type: PanelType, params?: Record<string, unknown>) => void
}

const PRESET_KEYS: Record<string, string> = {
  '1': 'single',
  '2': '2x1',
  '3': '2x2',
  '4': '3x2',
  '5': 'custom',
}

const PANEL_KEYS: Record<string, PanelType> = {
  'n': 'chart',
  'w': 'watchlist',
  'o': 'order-entry',
  'f': 'news-feed',
}

export function useWorkspaceHotkeys({ applyPreset, addPanel }: WorkspaceHotkeysConfig) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore when typing in inputs
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return
      }

      const isMeta = e.metaKey || e.ctrlKey

      if (!isMeta) return

      // Cmd+1 through Cmd+5 for preset switching
      const presetId = PRESET_KEYS[e.key]
      if (presetId) {
        e.preventDefault()
        applyPreset(presetId)
        return
      }

      // Cmd+Shift+<key> for adding panels
      if (e.shiftKey) {
        const panelType = PANEL_KEYS[e.key.toLowerCase()]
        if (panelType) {
          e.preventDefault()
          const params = panelType === 'chart' ? { symbol: 'AAPL' } : {}
          addPanel(panelType, params)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [applyPreset, addPanel])
}
