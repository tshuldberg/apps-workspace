import { describe, it, expect, beforeEach } from 'vitest'
import { useWatchlistStore } from '../../src/stores/watchlist-store.js'
import type { Watchlist, WatchlistSymbol } from '../../src/stores/watchlist-store.js'
import { useLinkingStore } from '../../src/stores/linking-store.js'
import { toggleSort, sortRows } from '../../../../packages/ui/src/trading/watchlist-sort.js'

function makeItem(overrides: Partial<WatchlistSymbol> = {}): WatchlistSymbol {
  return {
    id: crypto.randomUUID(),
    symbolId: 1,
    symbol: 'AAPL',
    name: 'Apple Inc.',
    position: 0,
    ...overrides,
  }
}

function makeList(overrides: Partial<Watchlist> = {}): Watchlist {
  return {
    id: crypto.randomUUID(),
    name: 'Watchlist',
    position: 0,
    items: [],
    ...overrides,
  }
}

describe('watchlist store', () => {
  beforeEach(() => {
    useWatchlistStore.setState({ lists: [], activeListId: null })
  })

  describe('setLists', () => {
    it('sets lists and auto-selects first list', () => {
      const list = makeList({ name: 'Tech' })
      useWatchlistStore.getState().setLists([list])

      expect(useWatchlistStore.getState().lists).toHaveLength(1)
      expect(useWatchlistStore.getState().activeListId).toBe(list.id)
    })

    it('preserves existing activeListId', () => {
      const list1 = makeList({ name: 'Tech' })
      const list2 = makeList({ name: 'Crypto' })

      useWatchlistStore.setState({ activeListId: list2.id })
      useWatchlistStore.getState().setLists([list1, list2])

      expect(useWatchlistStore.getState().activeListId).toBe(list2.id)
    })

    it('handles empty list', () => {
      useWatchlistStore.getState().setLists([])
      expect(useWatchlistStore.getState().activeListId).toBeNull()
    })
  })

  describe('createList', () => {
    it('adds a new list', () => {
      const list = makeList({ name: 'New List' })
      useWatchlistStore.getState().createList(list)

      expect(useWatchlistStore.getState().lists).toHaveLength(1)
      expect(useWatchlistStore.getState().lists[0]!.name).toBe('New List')
    })

    it('auto-selects first created list', () => {
      const list = makeList()
      useWatchlistStore.getState().createList(list)

      expect(useWatchlistStore.getState().activeListId).toBe(list.id)
    })

    it('does not override existing activeListId', () => {
      const list1 = makeList()
      const list2 = makeList()

      useWatchlistStore.getState().createList(list1)
      useWatchlistStore.getState().createList(list2)

      expect(useWatchlistStore.getState().activeListId).toBe(list1.id)
    })
  })

  describe('renameList', () => {
    it('renames an existing list', () => {
      const list = makeList({ name: 'Old' })
      useWatchlistStore.getState().setLists([list])
      useWatchlistStore.getState().renameList(list.id, 'New')

      expect(useWatchlistStore.getState().lists[0]!.name).toBe('New')
    })

    it('does nothing for unknown id', () => {
      const list = makeList({ name: 'Keep' })
      useWatchlistStore.getState().setLists([list])
      useWatchlistStore.getState().renameList('unknown-id', 'Changed')

      expect(useWatchlistStore.getState().lists[0]!.name).toBe('Keep')
    })
  })

  describe('deleteList', () => {
    it('removes the list', () => {
      const list = makeList()
      useWatchlistStore.getState().setLists([list])
      useWatchlistStore.getState().deleteList(list.id)

      expect(useWatchlistStore.getState().lists).toHaveLength(0)
    })

    it('resets activeListId to first remaining list', () => {
      const list1 = makeList()
      const list2 = makeList()
      useWatchlistStore.getState().setLists([list1, list2])
      useWatchlistStore.getState().setActiveList(list1.id)
      useWatchlistStore.getState().deleteList(list1.id)

      expect(useWatchlistStore.getState().activeListId).toBe(list2.id)
    })

    it('sets activeListId to null when last list deleted', () => {
      const list = makeList()
      useWatchlistStore.getState().setLists([list])
      useWatchlistStore.getState().deleteList(list.id)

      expect(useWatchlistStore.getState().activeListId).toBeNull()
    })
  })

  describe('setActiveList', () => {
    it('sets the active list id', () => {
      useWatchlistStore.getState().setActiveList('abc')
      expect(useWatchlistStore.getState().activeListId).toBe('abc')
    })
  })

  describe('addSymbol', () => {
    it('adds a symbol to the target list', () => {
      const list = makeList()
      useWatchlistStore.getState().setLists([list])

      const item = makeItem({ symbol: 'TSLA' })
      useWatchlistStore.getState().addSymbol(list.id, item)

      const updated = useWatchlistStore.getState().lists[0]!
      expect(updated.items).toHaveLength(1)
      expect(updated.items[0]!.symbol).toBe('TSLA')
    })

    it('does not affect other lists', () => {
      const list1 = makeList()
      const list2 = makeList()
      useWatchlistStore.getState().setLists([list1, list2])

      const item = makeItem()
      useWatchlistStore.getState().addSymbol(list1.id, item)

      expect(useWatchlistStore.getState().lists[1]!.items).toHaveLength(0)
    })
  })

  describe('removeSymbol', () => {
    it('removes a symbol from the target list', () => {
      const item = makeItem({ symbol: 'MSFT' })
      const list = makeList({ items: [item] })
      useWatchlistStore.getState().setLists([list])

      useWatchlistStore.getState().removeSymbol(list.id, item.id)

      expect(useWatchlistStore.getState().lists[0]!.items).toHaveLength(0)
    })
  })

  describe('reorderSymbols', () => {
    it('replaces items array with new order', () => {
      const item1 = makeItem({ symbol: 'AAPL', position: 0 })
      const item2 = makeItem({ symbol: 'MSFT', position: 1 })
      const list = makeList({ items: [item1, item2] })
      useWatchlistStore.getState().setLists([list])

      useWatchlistStore.getState().reorderSymbols(list.id, [item2, item1])

      const items = useWatchlistStore.getState().lists[0]!.items
      expect(items[0]!.symbol).toBe('MSFT')
      expect(items[1]!.symbol).toBe('AAPL')
    })
  })
})

describe('linking store', () => {
  beforeEach(() => {
    useLinkingStore.setState({
      groups: { red: null, green: null, blue: null, yellow: null },
      panelLinks: {},
    })
  })

  it('sets group symbol', () => {
    useLinkingStore.getState().setGroupSymbol('red', 'AAPL')
    expect(useLinkingStore.getState().groups.red).toBe('AAPL')
  })

  it('links a panel to a color', () => {
    useLinkingStore.getState().linkPanel('panel-1', 'blue')
    expect(useLinkingStore.getState().panelLinks['panel-1']).toBe('blue')
  })

  it('gets linked symbol for a panel', () => {
    useLinkingStore.getState().linkPanel('panel-1', 'green')
    useLinkingStore.getState().setGroupSymbol('green', 'TSLA')
    expect(useLinkingStore.getState().getLinkedSymbol('panel-1')).toBe('TSLA')
  })

  it('returns null for unlinked panel', () => {
    expect(useLinkingStore.getState().getLinkedSymbol('panel-999')).toBeNull()
  })

  it('unlinks a panel', () => {
    useLinkingStore.getState().linkPanel('panel-1', 'red')
    useLinkingStore.getState().linkPanel('panel-1', null)
    expect(useLinkingStore.getState().getLinkedSymbol('panel-1')).toBeNull()
  })
})

describe('watchlist sort', () => {
  const rows = [
    { id: '1', symbolId: 1, symbol: 'MSFT', lastPrice: 400, changePercent: 1.5, volume: 30_000_000 },
    { id: '2', symbolId: 2, symbol: 'AAPL', lastPrice: 180, changePercent: -0.5, volume: 50_000_000 },
    { id: '3', symbolId: 3, symbol: 'TSLA', lastPrice: 250, changePercent: 3.2, volume: 80_000_000 },
  ]

  it('toggleSort creates ascending sort for new column', () => {
    const result = toggleSort(null, 'symbol')
    expect(result).toEqual({ column: 'symbol', direction: 'asc' })
  })

  it('toggleSort flips direction for same column', () => {
    const result = toggleSort({ column: 'symbol', direction: 'asc' }, 'symbol')
    expect(result).toEqual({ column: 'symbol', direction: 'desc' })
  })

  it('toggleSort resets to asc for different column', () => {
    const result = toggleSort({ column: 'symbol', direction: 'desc' }, 'lastPrice')
    expect(result).toEqual({ column: 'lastPrice', direction: 'asc' })
  })

  it('sortRows returns original order when no config', () => {
    const result = sortRows(rows, null)
    expect(result.map((r) => r.symbol)).toEqual(['MSFT', 'AAPL', 'TSLA'])
  })

  it('sorts by symbol ascending', () => {
    const result = sortRows(rows, { column: 'symbol', direction: 'asc' })
    expect(result.map((r) => r.symbol)).toEqual(['AAPL', 'MSFT', 'TSLA'])
  })

  it('sorts by symbol descending', () => {
    const result = sortRows(rows, { column: 'symbol', direction: 'desc' })
    expect(result.map((r) => r.symbol)).toEqual(['TSLA', 'MSFT', 'AAPL'])
  })

  it('sorts by lastPrice ascending', () => {
    const result = sortRows(rows, { column: 'lastPrice', direction: 'asc' })
    expect(result.map((r) => r.symbol)).toEqual(['AAPL', 'TSLA', 'MSFT'])
  })

  it('sorts by changePercent descending', () => {
    const result = sortRows(rows, { column: 'changePercent', direction: 'desc' })
    expect(result.map((r) => r.symbol)).toEqual(['TSLA', 'MSFT', 'AAPL'])
  })

  it('sorts by volume ascending', () => {
    const result = sortRows(rows, { column: 'volume', direction: 'asc' })
    expect(result.map((r) => r.symbol)).toEqual(['MSFT', 'AAPL', 'TSLA'])
  })
})
