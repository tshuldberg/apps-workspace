export type SortDirection = 'asc' | 'desc'

export type WatchlistColumn = 'symbol' | 'lastPrice' | 'changePercent' | 'volume'

export interface SortConfig {
  column: WatchlistColumn
  direction: SortDirection
}

export interface SortableRow {
  symbol: string
  lastPrice: number
  changePercent: number
  volume: number
}

export function toggleSort(
  current: SortConfig | null,
  column: WatchlistColumn,
): SortConfig {
  if (current?.column === column) {
    return { column, direction: current.direction === 'asc' ? 'desc' : 'asc' }
  }
  return { column, direction: 'asc' }
}

export function sortRows<T extends SortableRow>(rows: T[], config: SortConfig | null): T[] {
  if (!config) return rows

  const sorted = [...rows]
  const { column, direction } = config
  const mult = direction === 'asc' ? 1 : -1

  sorted.sort((a, b) => {
    const aVal = a[column]
    const bVal = b[column]
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return mult * aVal.localeCompare(bVal)
    }
    return mult * ((aVal as number) - (bVal as number))
  })

  return sorted
}
