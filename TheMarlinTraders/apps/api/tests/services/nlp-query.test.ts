import { describe, it, expect } from 'vitest'
import { parseNLPQuery, getNLPExamples } from '../../src/services/nlp-query.js'

// ── Keyword Extraction Tests ───────────────────────────────────────────────

describe('parseNLPQuery - Keyword Extraction', () => {
  it('should detect "oversold" keyword and generate RSI < 30 filter', () => {
    const result = parseNLPQuery('Show me oversold stocks')
    expect(result.parsedFilters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'rsi_14',
          operator: 'lt',
          value: 30,
        }),
      ]),
    )
    expect(result.parsedIndicators).toContain('RSI')
  })

  it('should detect "overbought" keyword and generate RSI > 70 filter', () => {
    const result = parseNLPQuery('Find overbought tech stocks')
    expect(result.parsedFilters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'rsi_14',
          operator: 'gt',
          value: 70,
        }),
      ]),
    )
  })

  it('should detect "large-cap" keyword', () => {
    const result = parseNLPQuery('Show me large-cap stocks')
    expect(result.parsedFilters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'market_cap',
          operator: 'gt',
          value: 10_000_000_000,
        }),
      ]),
    )
  })

  it('should detect "large caps" with space', () => {
    const result = parseNLPQuery('Show me large caps')
    expect(result.parsedFilters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'market_cap',
          operator: 'gt',
          value: 10_000_000_000,
        }),
      ]),
    )
  })

  it('should detect "mid-cap" keyword', () => {
    const result = parseNLPQuery('Find mid-cap growth stocks')
    expect(result.parsedFilters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'market_cap',
          operator: 'between',
          value: [2_000_000_000, 10_000_000_000],
        }),
      ]),
    )
  })

  it('should detect "small-cap" keyword', () => {
    const result = parseNLPQuery('Show small cap stocks')
    expect(result.parsedFilters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'market_cap',
          operator: 'lt',
          value: 2_000_000_000,
        }),
      ]),
    )
  })

  it('should detect "breaking out" keyword', () => {
    const result = parseNLPQuery('Stocks breaking out today')
    expect(result.parsedFilters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'price_vs_20d_high' }),
        expect.objectContaining({ field: 'volume_ratio_20d', operator: 'gt', value: 1.5 }),
      ]),
    )
  })

  it('should detect "bullish" keyword', () => {
    const result = parseNLPQuery('Show me bullish setups')
    expect(result.parsedFilters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'price_vs_sma50', operator: 'gt', value: 0 }),
        expect.objectContaining({ field: 'sma50_vs_sma200', operator: 'gt', value: 0 }),
      ]),
    )
    expect(result.parsedIndicators).toContain('SMA')
  })

  it('should detect "bearish" keyword', () => {
    const result = parseNLPQuery('Find bearish stocks')
    expect(result.parsedFilters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'price_vs_sma50', operator: 'lt', value: 0 }),
        expect.objectContaining({ field: 'sma50_vs_sma200', operator: 'lt', value: 0 }),
      ]),
    )
  })

  it('should detect "high volume" keyword', () => {
    const result = parseNLPQuery('Find high volume stocks')
    expect(result.parsedFilters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'volume_ratio_20d',
          operator: 'gt',
          value: 2,
        }),
      ]),
    )
  })

  it('should detect "gap up" keyword', () => {
    const result = parseNLPQuery('Stocks that gapped up today')
    expect(result.parsedFilters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'gap_percent',
          operator: 'gt',
          value: 3,
        }),
      ]),
    )
  })

  it('should detect "gap down" keyword', () => {
    const result = parseNLPQuery('Find stocks that gap down')
    expect(result.parsedFilters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'gap_percent',
          operator: 'lt',
          value: -3,
        }),
      ]),
    )
  })

  it('should detect "near 52-week high" keyword', () => {
    const result = parseNLPQuery('Stocks near 52-week high')
    expect(result.parsedFilters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'pct_from_52w_high',
          operator: 'gte',
          value: -5,
        }),
      ]),
    )
  })

  it('should detect "near 52-week low" keyword', () => {
    const result = parseNLPQuery('Stocks near 52 week low')
    expect(result.parsedFilters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'pct_from_52w_low',
          operator: 'lte',
          value: 5,
        }),
      ]),
    )
  })

  it('should detect "golden cross" keyword', () => {
    const result = parseNLPQuery('Find golden cross stocks')
    expect(result.parsedFilters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'sma50_vs_sma200',
          operator: 'gt',
          value: 0,
        }),
      ]),
    )
  })

  it('should detect "death cross" keyword', () => {
    const result = parseNLPQuery('Stocks with death cross')
    expect(result.parsedFilters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'sma50_vs_sma200',
          operator: 'lt',
          value: 0,
        }),
      ]),
    )
  })
})

// ── Filter Generation from Complex Queries ─────────────────────────────────

describe('parseNLPQuery - Complex Queries', () => {
  it('should combine multiple keywords into multiple filters', () => {
    const result = parseNLPQuery('Show me oversold large-caps breaking out')

    // Should have RSI filter
    expect(result.parsedFilters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'rsi_14', operator: 'lt', value: 30 }),
      ]),
    )

    // Should have market cap filter
    expect(result.parsedFilters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'market_cap', operator: 'gt', value: 10_000_000_000 }),
      ]),
    )

    // Should have breakout filters
    expect(result.parsedFilters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'price_vs_20d_high' }),
      ]),
    )

    // Should recommend screening
    expect(result.parsedActions).toContain('screen')
  })

  it('should handle "bullish stocks near 52-week high with high volume"', () => {
    const result = parseNLPQuery('Bullish stocks near 52-week high with high volume')

    expect(result.parsedFilters.length).toBeGreaterThanOrEqual(3)

    // Bullish filters
    expect(result.parsedFilters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'price_vs_sma50', operator: 'gt' }),
      ]),
    )

    // 52-week high
    expect(result.parsedFilters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'pct_from_52w_high' }),
      ]),
    )

    // High volume
    expect(result.parsedFilters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'volume_ratio_20d', operator: 'gt', value: 2 }),
      ]),
    )
  })

  it('should detect chart action for "Chart AAPL"', () => {
    const result = parseNLPQuery('Chart AAPL')
    expect(result.parsedActions).toContain('chart')
  })

  it('should detect alert action for "Alert me when..."', () => {
    const result = parseNLPQuery('Alert me when TSLA is oversold')
    expect(result.parsedActions).toContain('alert')
  })
})

// ── Edge Cases ─────────────────────────────────────────────────────────────

describe('parseNLPQuery - Edge Cases', () => {
  it('should handle empty-ish input gracefully', () => {
    const result = parseNLPQuery('hello world')
    expect(result.rawText).toBe('hello world')
    expect(result.parsedFilters).toEqual([])
    expect(result.parsedActions).toContain('screen') // default action
  })

  it('should preserve raw text', () => {
    const query = '  Show me oversold stocks  '
    const result = parseNLPQuery(query)
    expect(result.rawText).toBe('Show me oversold stocks')
  })

  it('should not duplicate filters from overlapping keywords', () => {
    // "bullish" and "golden cross" both produce sma50_vs_sma200 > 0
    const result = parseNLPQuery('Bullish stocks with golden cross')
    const sma50Filters = result.parsedFilters.filter(
      (f) => f.field === 'sma50_vs_sma200' && f.operator === 'gt',
    )
    // Should not have duplicates
    expect(sma50Filters.length).toBe(1)
  })

  it('should be case insensitive', () => {
    const lower = parseNLPQuery('oversold large-cap')
    const upper = parseNLPQuery('OVERSOLD LARGE-CAP')
    const mixed = parseNLPQuery('Oversold Large-Cap')

    expect(lower.parsedFilters.length).toBe(upper.parsedFilters.length)
    expect(lower.parsedFilters.length).toBe(mixed.parsedFilters.length)
  })

  it('should handle ambiguous queries with multiple possible actions', () => {
    const result = parseNLPQuery('Chart and alert oversold AAPL')
    expect(result.parsedActions).toContain('chart')
    expect(result.parsedActions).toContain('alert')
    expect(result.parsedFilters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'rsi_14' }),
      ]),
    )
  })

  it('should return indicators for technical queries', () => {
    const result = parseNLPQuery('overbought with MACD crossover')
    expect(result.parsedIndicators).toContain('RSI')
    expect(result.parsedIndicators).toContain('MACD')
  })
})

// ── getNLPExamples Tests ───────────────────────────────────────────────────

describe('getNLPExamples', () => {
  it('should return an array of example strings', () => {
    const examples = getNLPExamples()
    expect(Array.isArray(examples)).toBe(true)
    expect(examples.length).toBeGreaterThan(0)
    for (const example of examples) {
      expect(typeof example).toBe('string')
      expect(example.length).toBeGreaterThan(0)
    }
  })
})
