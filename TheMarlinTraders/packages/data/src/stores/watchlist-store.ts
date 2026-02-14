import { create } from 'zustand'

export interface WatchlistSymbol {
  id: string
  symbolId: number
  symbol: string
  name: string
  position: number
}

export interface Watchlist {
  id: string
  name: string
  position: number
  items: WatchlistSymbol[]
}

interface WatchlistState {
  lists: Watchlist[]
  activeListId: string | null

  // List CRUD
  setLists: (lists: Watchlist[]) => void
  createList: (list: Watchlist) => void
  renameList: (id: string, name: string) => void
  deleteList: (id: string) => void
  setActiveList: (id: string) => void

  // Item CRUD
  addSymbol: (listId: string, item: WatchlistSymbol) => void
  removeSymbol: (listId: string, itemId: string) => void
  reorderSymbols: (listId: string, items: WatchlistSymbol[]) => void
}

export const useWatchlistStore = create<WatchlistState>((set, get) => ({
  lists: [],
  activeListId: null,

  setLists: (lists) =>
    set({
      lists,
      activeListId: get().activeListId ?? lists[0]?.id ?? null,
    }),

  createList: (list) =>
    set((state) => ({
      lists: [...state.lists, list],
      activeListId: state.activeListId ?? list.id,
    })),

  renameList: (id, name) =>
    set((state) => ({
      lists: state.lists.map((l) => (l.id === id ? { ...l, name } : l)),
    })),

  deleteList: (id) =>
    set((state) => {
      const remaining = state.lists.filter((l) => l.id !== id)
      return {
        lists: remaining,
        activeListId:
          state.activeListId === id ? (remaining[0]?.id ?? null) : state.activeListId,
      }
    }),

  setActiveList: (id) => set({ activeListId: id }),

  addSymbol: (listId, item) =>
    set((state) => ({
      lists: state.lists.map((l) =>
        l.id === listId ? { ...l, items: [...l.items, item] } : l,
      ),
    })),

  removeSymbol: (listId, itemId) =>
    set((state) => ({
      lists: state.lists.map((l) =>
        l.id === listId
          ? { ...l, items: l.items.filter((i) => i.id !== itemId) }
          : l,
      ),
    })),

  reorderSymbols: (listId, items) =>
    set((state) => ({
      lists: state.lists.map((l) => (l.id === listId ? { ...l, items } : l)),
    })),
}))
