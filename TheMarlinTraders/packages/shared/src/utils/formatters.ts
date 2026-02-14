/**
 * Format a price to the appropriate number of decimal places.
 * Prices >= $1 get 2 decimals, < $1 get 4 decimals.
 */
export function formatPrice(price: number): string {
  if (price >= 1) {
    return price.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }
  return price.toLocaleString('en-US', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  })
}

/**
 * Format volume with K/M/B suffixes.
 */
export function formatVolume(volume: number): string {
  if (volume >= 1_000_000_000) {
    return `${(volume / 1_000_000_000).toFixed(2)}B`
  }
  if (volume >= 1_000_000) {
    return `${(volume / 1_000_000).toFixed(2)}M`
  }
  if (volume >= 1_000) {
    return `${(volume / 1_000).toFixed(2)}K`
  }
  return volume.toString()
}

/**
 * Format a percentage with sign and 2 decimal places.
 */
export function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

/**
 * Format market cap with B/M/K suffixes.
 */
export function formatMarketCap(cap: number): string {
  if (cap >= 1_000_000_000_000) {
    return `$${(cap / 1_000_000_000_000).toFixed(2)}T`
  }
  if (cap >= 1_000_000_000) {
    return `$${(cap / 1_000_000_000).toFixed(2)}B`
  }
  if (cap >= 1_000_000) {
    return `$${(cap / 1_000_000).toFixed(2)}M`
  }
  return `$${cap.toLocaleString('en-US')}`
}
