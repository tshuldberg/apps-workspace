export interface PriceConditionInput {
  currentPrice: number
  previousPrice: number
  threshold: number
}

/** Price is above the threshold */
export function priceAbove({ currentPrice, threshold }: PriceConditionInput): boolean {
  return currentPrice >= threshold
}

/** Price is below the threshold */
export function priceBelow({ currentPrice, threshold }: PriceConditionInput): boolean {
  return currentPrice <= threshold
}

/** Price crossed above the threshold (was below, now above) */
export function priceCrossingUp({ currentPrice, previousPrice, threshold }: PriceConditionInput): boolean {
  return previousPrice < threshold && currentPrice >= threshold
}

/** Price crossed below the threshold (was above, now below) */
export function priceCrossingDown({ currentPrice, previousPrice, threshold }: PriceConditionInput): boolean {
  return previousPrice > threshold && currentPrice <= threshold
}
