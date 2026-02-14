/**
 * Shared ScreenerFilter type — mirrors the API schema definition
 * so pattern types can reference it without importing from apps/api.
 */

export interface ScreenerFilter {
  field: string
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq' | 'between' | 'in'
  value: number | string | number[] | string[]
  category: 'fundamental' | 'technical' | 'price_action'
}

export interface ScreenerFilterSet {
  logic: 'AND' | 'OR'
  filters: ScreenerFilter[]
}
