import { create } from 'zustand'

export type LinkColor = 'red' | 'green' | 'blue' | 'yellow'

export const LINK_COLORS: Record<LinkColor, string> = {
  red: '#ef4444',
  green: '#22c55e',
  blue: '#3b82f6',
  yellow: '#eab308',
}

export const LINK_COLOR_LIST: LinkColor[] = ['red', 'green', 'blue', 'yellow']

interface LinkingState {
  /** Map from link color to the currently selected symbol */
  groups: Record<LinkColor, string | null>

  /** Map from panel ID to link color (null = unlinked) */
  panelLinks: Record<string, LinkColor | null>

  /** Set the symbol for a link group — all panels in this group update */
  setGroupSymbol: (color: LinkColor, symbol: string) => void

  /** Link a panel to a color group */
  linkPanel: (panelId: string, color: LinkColor | null) => void

  /** Get the symbol a panel should display based on its link group */
  getLinkedSymbol: (panelId: string) => string | null

  /** Unlink a panel (remove from any group) */
  unlinkPanel: (panelId: string) => void

  /** Get all panel IDs in a given color group */
  getPanelsInGroup: (color: LinkColor) => string[]

  /** Clear all panels from a group */
  clearGroup: (color: LinkColor) => void
}

export const useLinkingStore = create<LinkingState>((set, get) => ({
  groups: { red: null, green: null, blue: null, yellow: null },
  panelLinks: {},

  setGroupSymbol: (color, symbol) =>
    set((state) => ({
      groups: { ...state.groups, [color]: symbol },
    })),

  linkPanel: (panelId, color) =>
    set((state) => ({
      panelLinks: { ...state.panelLinks, [panelId]: color },
    })),

  getLinkedSymbol: (panelId) => {
    const state = get()
    const color = state.panelLinks[panelId]
    if (!color) return null
    return state.groups[color]
  },

  unlinkPanel: (panelId) =>
    set((state) => {
      const { [panelId]: _, ...rest } = state.panelLinks
      return { panelLinks: rest }
    }),

  getPanelsInGroup: (color) => {
    const state = get()
    return Object.entries(state.panelLinks)
      .filter(([, c]) => c === color)
      .map(([id]) => id)
  },

  clearGroup: (color) =>
    set((state) => {
      const newLinks = { ...state.panelLinks }
      for (const [id, c] of Object.entries(newLinks)) {
        if (c === color) delete newLinks[id]
      }
      return {
        groups: { ...state.groups, [color]: null },
        panelLinks: newLinks,
      }
    }),
}))
