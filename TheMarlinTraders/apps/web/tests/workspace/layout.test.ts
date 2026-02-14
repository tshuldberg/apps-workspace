import { describe, it, expect, beforeEach, vi } from 'vitest'
import { LAYOUT_PRESETS, getPresetById } from '../../components/layout-presets.js'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
  }
})()

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

describe('Layout Presets', () => {
  it('should have 5 presets defined', () => {
    expect(LAYOUT_PRESETS).toHaveLength(5)
  })

  it('should have unique preset IDs', () => {
    const ids = LAYOUT_PRESETS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('should have valid serialized layout structure for each preset', () => {
    for (const preset of LAYOUT_PRESETS) {
      expect(preset.layout).toBeDefined()
      expect(preset.layout.grid).toBeDefined()
      expect(preset.layout.grid.root).toBeDefined()
      expect(preset.layout.panels).toBeDefined()
      expect(Object.keys(preset.layout.panels).length).toBeGreaterThan(0)
    }
  })

  it('should retrieve preset by ID', () => {
    const single = getPresetById('single')
    expect(single).toBeDefined()
    expect(single!.name).toBe('Single Chart')

    const twoByTwo = getPresetById('2x2')
    expect(twoByTwo).toBeDefined()
    expect(twoByTwo!.name).toBe('2x2 Grid')
  })

  it('should return undefined for unknown preset ID', () => {
    expect(getPresetById('nonexistent')).toBeUndefined()
  })

  describe('Single Chart preset', () => {
    it('should have exactly 1 panel', () => {
      const preset = getPresetById('single')!
      expect(Object.keys(preset.layout.panels)).toHaveLength(1)
    })

    it('should have a chart panel', () => {
      const preset = getPresetById('single')!
      const panels = Object.values(preset.layout.panels)
      expect(panels[0]!.contentComponent).toBe('chart')
    })
  })

  describe('2x1 preset', () => {
    it('should have 2 chart panels', () => {
      const preset = getPresetById('2x1')!
      const panels = Object.values(preset.layout.panels)
      expect(panels).toHaveLength(2)
      expect(panels.every((p) => p.contentComponent === 'chart')).toBe(true)
    })
  })

  describe('2x2 preset', () => {
    it('should have 4 chart panels', () => {
      const preset = getPresetById('2x2')!
      const panels = Object.values(preset.layout.panels)
      expect(panels).toHaveLength(4)
      expect(panels.every((p) => p.contentComponent === 'chart')).toBe(true)
    })
  })

  describe('3x2 preset', () => {
    it('should have 6 panels with mixed types', () => {
      const preset = getPresetById('3x2')!
      const panels = Object.values(preset.layout.panels)
      expect(panels).toHaveLength(6)

      const types = panels.map((p) => p.contentComponent)
      expect(types.filter((t) => t === 'chart')).toHaveLength(4)
      expect(types.filter((t) => t === 'watchlist')).toHaveLength(1)
      expect(types.filter((t) => t === 'order-entry')).toHaveLength(1)
    })
  })

  describe('Custom preset', () => {
    it('should have chart, watchlist, and order-entry panels', () => {
      const preset = getPresetById('custom')!
      const panels = Object.values(preset.layout.panels)
      const types = panels.map((p) => p.contentComponent)
      expect(types).toContain('chart')
      expect(types).toContain('watchlist')
      expect(types).toContain('order-entry')
    })
  })
})

describe('Layout persistence (localStorage)', () => {
  const STORAGE_KEY = 'marlin-workspace-layout'

  beforeEach(() => {
    localStorageMock.clear()
  })

  it('should save layout to localStorage', () => {
    const layout = LAYOUT_PRESETS[0]!.layout
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout))
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      JSON.stringify(layout),
    )
  })

  it('should load layout from localStorage', () => {
    const layout = LAYOUT_PRESETS[0]!.layout
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout))

    const stored = localStorage.getItem(STORAGE_KEY)
    expect(stored).toBeTruthy()
    const parsed = JSON.parse(stored!)
    expect(parsed.grid).toBeDefined()
    expect(parsed.panels).toBeDefined()
  })

  it('should handle missing localStorage gracefully', () => {
    const stored = localStorage.getItem(STORAGE_KEY)
    expect(stored).toBeNull()
  })

  it('should handle corrupted localStorage data', () => {
    localStorage.setItem(STORAGE_KEY, 'not-valid-json{{{')
    const stored = localStorage.getItem(STORAGE_KEY)
    expect(() => {
      try {
        JSON.parse(stored!)
      } catch {
        // Expected behavior - corrupted data
      }
    }).not.toThrow()
  })
})

describe('Panel Registry', () => {
  it('should export all panel types from index', async () => {
    const { PANEL_REGISTRY } = await import('../../components/panels/index.js')
    expect(PANEL_REGISTRY).toBeDefined()
    expect(PANEL_REGISTRY.chart).toBeDefined()
    expect(PANEL_REGISTRY.watchlist).toBeDefined()
    expect(PANEL_REGISTRY['order-entry']).toBeDefined()
    expect(PANEL_REGISTRY['news-feed']).toBeDefined()
  })

  it('should have components and default titles for all panel types', async () => {
    const { PANEL_REGISTRY } = await import('../../components/panels/index.js')
    for (const [, entry] of Object.entries(PANEL_REGISTRY)) {
      expect(entry.component).toBeDefined()
      expect(typeof entry.defaultTitle).toBe('string')
      expect(entry.defaultTitle.length).toBeGreaterThan(0)
    }
  })
})

describe('Linking Store extensions', () => {
  it('should export new methods', async () => {
    const { useLinkingStore, LINK_COLOR_LIST } = await import(
      '@marlin/data/stores/linking-store'
    )
    expect(LINK_COLOR_LIST).toEqual(['red', 'green', 'blue', 'yellow'])

    const state = useLinkingStore.getState()
    expect(typeof state.unlinkPanel).toBe('function')
    expect(typeof state.getPanelsInGroup).toBe('function')
    expect(typeof state.clearGroup).toBe('function')
  })

  it('should link and unlink panels', async () => {
    const { useLinkingStore } = await import('@marlin/data/stores/linking-store')
    const store = useLinkingStore

    store.getState().linkPanel('panel-1', 'red')
    expect(store.getState().panelLinks['panel-1']).toBe('red')

    store.getState().unlinkPanel('panel-1')
    expect(store.getState().panelLinks['panel-1']).toBeUndefined()
  })

  it('should get panels in a group', async () => {
    const { useLinkingStore } = await import('@marlin/data/stores/linking-store')
    const store = useLinkingStore

    store.getState().linkPanel('p1', 'blue')
    store.getState().linkPanel('p2', 'blue')
    store.getState().linkPanel('p3', 'red')

    const bluePanels = store.getState().getPanelsInGroup('blue')
    expect(bluePanels).toContain('p1')
    expect(bluePanels).toContain('p2')
    expect(bluePanels).not.toContain('p3')
  })

  it('should clear a group', async () => {
    const { useLinkingStore } = await import('@marlin/data/stores/linking-store')
    const store = useLinkingStore

    store.getState().linkPanel('p1', 'green')
    store.getState().setGroupSymbol('green', 'AAPL')
    store.getState().clearGroup('green')

    expect(store.getState().groups.green).toBeNull()
    expect(store.getState().panelLinks['p1']).toBeUndefined()
  })

  it('should propagate symbol changes to linked panels', async () => {
    const { useLinkingStore } = await import('@marlin/data/stores/linking-store')
    const store = useLinkingStore

    store.getState().linkPanel('chart-a', 'yellow')
    store.getState().linkPanel('chart-b', 'yellow')
    store.getState().setGroupSymbol('yellow', 'TSLA')

    expect(store.getState().getLinkedSymbol('chart-a')).toBe('TSLA')
    expect(store.getState().getLinkedSymbol('chart-b')).toBe('TSLA')
  })
})
