import { redis } from '../db/redis.js'

export type Timeframe = '1D' | '1W' | '1M' | '3M' | 'YTD' | '1Y'
export type ColorMetric = 'changePercent' | 'peRatio' | 'rsi' | 'ivRank' | 'marketCap'

export interface HeatmapStock {
  symbol: string
  name: string
  sector: string
  industry: string
  marketCap: number
  price: number
  change: number
  changePercent: number
  volume: number
  peRatio: number | null
  rsi: number | null
  ivRank: number | null
}

export interface SectorGroup {
  sector: string
  totalMarketCap: number
  avgChangePercent: number
  stocks: HeatmapStock[]
}

export interface HeatmapData {
  sectors: SectorGroup[]
  updatedAt: string
}

export interface MetricResult {
  symbol: string
  metric: ColorMetric
  value: number | null
}

// GICS Sectors (reference list; sectors are derived from stock data)
const _GICS_SECTORS = [
  'Information Technology',
  'Health Care',
  'Financials',
  'Consumer Discretionary',
  'Communication Services',
  'Industrials',
  'Consumer Staples',
  'Energy',
  'Utilities',
  'Real Estate',
  'Materials',
] as const

const CACHE_PREFIX = 'heatmap:sp500'
const CACHE_TTL = 300 // 5 minutes

/**
 * Get full S&P 500 heatmap data, grouped by sector.
 * Returns cached data if available, otherwise builds from market data.
 */
export async function getMarketHeatmap(timeframe: Timeframe = '1D'): Promise<HeatmapData> {
  const cacheKey = `${CACHE_PREFIX}:${timeframe}`

  // Try cache first
  const cached = await redis.get(cacheKey)
  if (cached) {
    return JSON.parse(cached) as HeatmapData
  }

  const stocks = await fetchSP500Data(timeframe)
  const sectors = groupBySector(stocks)

  const data: HeatmapData = {
    sectors,
    updatedAt: new Date().toISOString(),
  }

  // Cache with TTL
  await redis.set(cacheKey, JSON.stringify(data), 'EX', CACHE_TTL)

  return data
}

/**
 * Get heatmap data for a single sector.
 */
export async function getSectorHeatmap(
  sectorName: string,
  timeframe: Timeframe = '1D',
): Promise<SectorGroup | null> {
  const full = await getMarketHeatmap(timeframe)
  return full.sectors.find((s) => s.sector === sectorName) ?? null
}

/**
 * Get specific metric values for a list of symbols.
 */
export async function getStockMetrics(
  symbols: string[],
  metric: ColorMetric,
): Promise<MetricResult[]> {
  // In production, this would query the market data provider.
  // For now, resolve from the cached snapshot.
  const full = await getMarketHeatmap('1D')
  const allStocks = full.sectors.flatMap((s) => s.stocks)

  return symbols.map((symbol) => {
    const stock = allStocks.find((s) => s.symbol === symbol)
    if (!stock) {
      return { symbol, metric, value: null }
    }

    let value: number | null = null
    switch (metric) {
      case 'changePercent':
        value = stock.changePercent
        break
      case 'peRatio':
        value = stock.peRatio
        break
      case 'rsi':
        value = stock.rsi
        break
      case 'ivRank':
        value = stock.ivRank
        break
      case 'marketCap':
        value = stock.marketCap
        break
    }

    return { symbol, metric, value }
  })
}

function groupBySector(stocks: HeatmapStock[]): SectorGroup[] {
  const groups = new Map<string, HeatmapStock[]>()

  for (const stock of stocks) {
    const existing = groups.get(stock.sector)
    if (existing) {
      existing.push(stock)
    } else {
      groups.set(stock.sector, [stock])
    }
  }

  return Array.from(groups.entries())
    .map(([sector, sectorStocks]) => {
      const totalMarketCap = sectorStocks.reduce((sum, s) => sum + s.marketCap, 0)
      const avgChangePercent =
        sectorStocks.reduce((sum, s) => sum + s.changePercent, 0) / sectorStocks.length

      return {
        sector,
        totalMarketCap,
        avgChangePercent,
        stocks: sectorStocks.sort((a, b) => b.marketCap - a.marketCap),
      }
    })
    .sort((a, b) => b.totalMarketCap - a.totalMarketCap)
}

/**
 * Get a timeframe-specific multiplier for change ranges.
 * Longer timeframes have wider typical ranges.
 */
function getTimeframeMultiplier(timeframe: Timeframe): number {
  switch (timeframe) {
    case '1D':
      return 1
    case '1W':
      return 2.5
    case '1M':
      return 5
    case '3M':
      return 8
    case 'YTD':
      return 12
    case '1Y':
      return 18
  }
}

/**
 * Fetch S&P 500 constituent data from the market data provider.
 * In production this would call Polygon.io or similar; here we generate
 * representative data from the seed database.
 */
async function fetchSP500Data(timeframe: Timeframe): Promise<HeatmapStock[]> {
  // This would normally call the Polygon.io snapshot endpoint:
  // GET /v2/snapshot/locale/us/markets/stocks/tickers
  // For now, return representative S&P 500 data.
  return generateSP500Snapshot(timeframe)
}

// Representative S&P 500 snapshot with top stocks per sector
function generateSP500Snapshot(timeframe: Timeframe): HeatmapStock[] {
  const multiplier = getTimeframeMultiplier(timeframe)

  const stocks: Omit<HeatmapStock, 'change' | 'changePercent'>[] = [
    // Information Technology
    { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Information Technology', industry: 'Technology Hardware', marketCap: 3200e9, price: 195.50, volume: 55e6, peRatio: 32.5, rsi: 58, ivRank: 35 },
    { symbol: 'MSFT', name: 'Microsoft Corporation', sector: 'Information Technology', industry: 'Software', marketCap: 2900e9, price: 420.30, volume: 22e6, peRatio: 37.2, rsi: 62, ivRank: 28 },
    { symbol: 'NVDA', name: 'NVIDIA Corporation', sector: 'Information Technology', industry: 'Semiconductors', marketCap: 2400e9, price: 880.50, volume: 45e6, peRatio: 68.3, rsi: 71, ivRank: 55 },
    { symbol: 'AVGO', name: 'Broadcom Inc.', sector: 'Information Technology', industry: 'Semiconductors', marketCap: 620e9, price: 1380.20, volume: 3e6, peRatio: 42.8, rsi: 55, ivRank: 42 },
    { symbol: 'ADBE', name: 'Adobe Inc.', sector: 'Information Technology', industry: 'Software', marketCap: 240e9, price: 540.10, volume: 4e6, peRatio: 48.5, rsi: 45, ivRank: 38 },
    { symbol: 'CRM', name: 'Salesforce Inc.', sector: 'Information Technology', industry: 'Software', marketCap: 280e9, price: 290.40, volume: 6e6, peRatio: 52.1, rsi: 50, ivRank: 30 },
    { symbol: 'AMD', name: 'Advanced Micro Devices', sector: 'Information Technology', industry: 'Semiconductors', marketCap: 260e9, price: 160.80, volume: 50e6, peRatio: 380.0, rsi: 42, ivRank: 60 },
    { symbol: 'INTC', name: 'Intel Corporation', sector: 'Information Technology', industry: 'Semiconductors', marketCap: 180e9, price: 42.30, volume: 35e6, peRatio: null, rsi: 38, ivRank: 65 },
    { symbol: 'CSCO', name: 'Cisco Systems', sector: 'Information Technology', industry: 'Communications Equipment', marketCap: 200e9, price: 49.50, volume: 20e6, peRatio: 14.8, rsi: 52, ivRank: 22 },
    { symbol: 'ORCL', name: 'Oracle Corporation', sector: 'Information Technology', industry: 'Software', marketCap: 350e9, price: 128.60, volume: 10e6, peRatio: 35.2, rsi: 60, ivRank: 33 },
    // Health Care
    { symbol: 'UNH', name: 'UnitedHealth Group', sector: 'Health Care', industry: 'Managed Health Care', marketCap: 480e9, price: 520.80, volume: 4e6, peRatio: 22.5, rsi: 48, ivRank: 40 },
    { symbol: 'JNJ', name: 'Johnson & Johnson', sector: 'Health Care', industry: 'Pharmaceuticals', marketCap: 380e9, price: 158.20, volume: 8e6, peRatio: 10.8, rsi: 42, ivRank: 25 },
    { symbol: 'LLY', name: 'Eli Lilly', sector: 'Health Care', industry: 'Pharmaceuticals', marketCap: 680e9, price: 720.50, volume: 3e6, peRatio: 112.5, rsi: 68, ivRank: 48 },
    { symbol: 'ABBV', name: 'AbbVie Inc.', sector: 'Health Care', industry: 'Pharmaceuticals', marketCap: 310e9, price: 175.30, volume: 6e6, peRatio: 55.2, rsi: 55, ivRank: 32 },
    { symbol: 'MRK', name: 'Merck & Co.', sector: 'Health Care', industry: 'Pharmaceuticals', marketCap: 300e9, price: 118.40, volume: 10e6, peRatio: 50.3, rsi: 40, ivRank: 35 },
    { symbol: 'PFE', name: 'Pfizer Inc.', sector: 'Health Care', industry: 'Pharmaceuticals', marketCap: 160e9, price: 28.50, volume: 30e6, peRatio: null, rsi: 35, ivRank: 45 },
    { symbol: 'TMO', name: 'Thermo Fisher Scientific', sector: 'Health Care', industry: 'Life Sciences Tools', marketCap: 210e9, price: 555.70, volume: 2e6, peRatio: 36.8, rsi: 50, ivRank: 28 },
    // Financials
    { symbol: 'BRK.B', name: 'Berkshire Hathaway', sector: 'Financials', industry: 'Multi-Sector Holdings', marketCap: 870e9, price: 405.20, volume: 4e6, peRatio: 9.8, rsi: 58, ivRank: 18 },
    { symbol: 'JPM', name: 'JPMorgan Chase', sector: 'Financials', industry: 'Diversified Banks', marketCap: 560e9, price: 195.80, volume: 10e6, peRatio: 12.1, rsi: 62, ivRank: 25 },
    { symbol: 'V', name: 'Visa Inc.', sector: 'Financials', industry: 'Transaction Processing', marketCap: 540e9, price: 280.40, volume: 7e6, peRatio: 31.5, rsi: 55, ivRank: 20 },
    { symbol: 'MA', name: 'Mastercard Inc.', sector: 'Financials', industry: 'Transaction Processing', marketCap: 420e9, price: 450.60, volume: 3e6, peRatio: 35.2, rsi: 58, ivRank: 22 },
    { symbol: 'BAC', name: 'Bank of America', sector: 'Financials', industry: 'Diversified Banks', marketCap: 280e9, price: 35.80, volume: 40e6, peRatio: 12.8, rsi: 50, ivRank: 30 },
    { symbol: 'GS', name: 'Goldman Sachs', sector: 'Financials', industry: 'Investment Banking', marketCap: 140e9, price: 410.50, volume: 2e6, peRatio: 15.5, rsi: 60, ivRank: 28 },
    // Consumer Discretionary
    { symbol: 'AMZN', name: 'Amazon.com', sector: 'Consumer Discretionary', industry: 'Broadline Retail', marketCap: 1900e9, price: 185.20, volume: 50e6, peRatio: 62.8, rsi: 55, ivRank: 35 },
    { symbol: 'TSLA', name: 'Tesla Inc.', sector: 'Consumer Discretionary', industry: 'Automobile Manufacturers', marketCap: 620e9, price: 195.50, volume: 110e6, peRatio: 55.0, rsi: 48, ivRank: 72 },
    { symbol: 'HD', name: 'Home Depot', sector: 'Consumer Discretionary', industry: 'Home Improvement Retail', marketCap: 350e9, price: 355.40, volume: 4e6, peRatio: 24.5, rsi: 52, ivRank: 25 },
    { symbol: 'MCD', name: "McDonald's Corp.", sector: 'Consumer Discretionary', industry: 'Restaurants', marketCap: 200e9, price: 280.30, volume: 3e6, peRatio: 25.2, rsi: 48, ivRank: 22 },
    { symbol: 'NKE', name: 'Nike Inc.', sector: 'Consumer Discretionary', industry: 'Footwear', marketCap: 150e9, price: 98.50, volume: 8e6, peRatio: 28.5, rsi: 38, ivRank: 40 },
    // Communication Services
    { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'Communication Services', industry: 'Interactive Media', marketCap: 2100e9, price: 170.30, volume: 25e6, peRatio: 25.8, rsi: 58, ivRank: 30 },
    { symbol: 'META', name: 'Meta Platforms', sector: 'Communication Services', industry: 'Interactive Media', marketCap: 1300e9, price: 505.80, volume: 15e6, peRatio: 28.5, rsi: 62, ivRank: 38 },
    { symbol: 'NFLX', name: 'Netflix Inc.', sector: 'Communication Services', industry: 'Movies & Entertainment', marketCap: 280e9, price: 640.20, volume: 5e6, peRatio: 48.2, rsi: 65, ivRank: 42 },
    { symbol: 'DIS', name: 'Walt Disney Co.', sector: 'Communication Services', industry: 'Movies & Entertainment', marketCap: 200e9, price: 110.50, volume: 12e6, peRatio: 72.5, rsi: 45, ivRank: 35 },
    // Industrials
    { symbol: 'GE', name: 'GE Aerospace', sector: 'Industrials', industry: 'Aerospace & Defense', marketCap: 180e9, price: 165.30, volume: 6e6, peRatio: 38.5, rsi: 60, ivRank: 28 },
    { symbol: 'CAT', name: 'Caterpillar Inc.', sector: 'Industrials', industry: 'Construction Machinery', marketCap: 170e9, price: 345.20, volume: 3e6, peRatio: 17.5, rsi: 55, ivRank: 25 },
    { symbol: 'UNP', name: 'Union Pacific', sector: 'Industrials', industry: 'Railroads', marketCap: 150e9, price: 245.80, volume: 3e6, peRatio: 22.8, rsi: 50, ivRank: 20 },
    { symbol: 'HON', name: 'Honeywell International', sector: 'Industrials', industry: 'Industrial Conglomerates', marketCap: 140e9, price: 210.40, volume: 3e6, peRatio: 26.5, rsi: 48, ivRank: 22 },
    { symbol: 'RTX', name: 'RTX Corporation', sector: 'Industrials', industry: 'Aerospace & Defense', marketCap: 135e9, price: 100.80, volume: 5e6, peRatio: 38.2, rsi: 52, ivRank: 30 },
    // Consumer Staples
    { symbol: 'PG', name: 'Procter & Gamble', sector: 'Consumer Staples', industry: 'Household Products', marketCap: 380e9, price: 162.50, volume: 7e6, peRatio: 26.8, rsi: 48, ivRank: 18 },
    { symbol: 'KO', name: 'Coca-Cola Co.', sector: 'Consumer Staples', industry: 'Soft Drinks', marketCap: 260e9, price: 60.20, volume: 15e6, peRatio: 24.5, rsi: 50, ivRank: 15 },
    { symbol: 'PEP', name: 'PepsiCo Inc.', sector: 'Consumer Staples', industry: 'Soft Drinks', marketCap: 230e9, price: 168.40, volume: 5e6, peRatio: 25.2, rsi: 42, ivRank: 20 },
    { symbol: 'COST', name: 'Costco Wholesale', sector: 'Consumer Staples', industry: 'Consumer Staples Merch.', marketCap: 320e9, price: 720.30, volume: 2e6, peRatio: 50.5, rsi: 55, ivRank: 22 },
    { symbol: 'WMT', name: 'Walmart Inc.', sector: 'Consumer Staples', industry: 'Consumer Staples Merch.', marketCap: 450e9, price: 168.80, volume: 8e6, peRatio: 28.5, rsi: 58, ivRank: 18 },
    // Energy
    { symbol: 'XOM', name: 'Exxon Mobil', sector: 'Energy', industry: 'Integrated Oil & Gas', marketCap: 450e9, price: 108.50, volume: 15e6, peRatio: 12.5, rsi: 52, ivRank: 30 },
    { symbol: 'CVX', name: 'Chevron Corporation', sector: 'Energy', industry: 'Integrated Oil & Gas', marketCap: 280e9, price: 150.30, volume: 8e6, peRatio: 13.8, rsi: 48, ivRank: 28 },
    { symbol: 'COP', name: 'ConocoPhillips', sector: 'Energy', industry: 'Oil & Gas Exploration', marketCap: 140e9, price: 118.20, volume: 5e6, peRatio: 12.2, rsi: 45, ivRank: 35 },
    { symbol: 'SLB', name: 'Schlumberger NV', sector: 'Energy', industry: 'Oil & Gas Equipment', marketCap: 70e9, price: 50.40, volume: 10e6, peRatio: 18.5, rsi: 42, ivRank: 38 },
    // Utilities
    { symbol: 'NEE', name: 'NextEra Energy', sector: 'Utilities', industry: 'Electric Utilities', marketCap: 140e9, price: 68.50, volume: 10e6, peRatio: 22.5, rsi: 48, ivRank: 20 },
    { symbol: 'SO', name: 'Southern Company', sector: 'Utilities', industry: 'Electric Utilities', marketCap: 80e9, price: 74.20, volume: 5e6, peRatio: 20.8, rsi: 50, ivRank: 18 },
    { symbol: 'DUK', name: 'Duke Energy', sector: 'Utilities', industry: 'Electric Utilities', marketCap: 75e9, price: 98.30, volume: 3e6, peRatio: 18.5, rsi: 45, ivRank: 15 },
    // Real Estate
    { symbol: 'PLD', name: 'Prologis Inc.', sector: 'Real Estate', industry: 'Industrial REITs', marketCap: 120e9, price: 130.50, volume: 4e6, peRatio: 45.2, rsi: 42, ivRank: 25 },
    { symbol: 'AMT', name: 'American Tower', sector: 'Real Estate', industry: 'Telecom Tower REITs', marketCap: 95e9, price: 205.30, volume: 2e6, peRatio: 38.5, rsi: 48, ivRank: 22 },
    { symbol: 'EQIX', name: 'Equinix Inc.', sector: 'Real Estate', industry: 'Data Center REITs', marketCap: 80e9, price: 850.20, volume: 500e3, peRatio: 85.5, rsi: 55, ivRank: 28 },
    // Materials
    { symbol: 'LIN', name: 'Linde plc', sector: 'Materials', industry: 'Industrial Gases', marketCap: 210e9, price: 440.80, volume: 2e6, peRatio: 32.5, rsi: 55, ivRank: 20 },
    { symbol: 'APD', name: 'Air Products', sector: 'Materials', industry: 'Industrial Gases', marketCap: 60e9, price: 270.50, volume: 1e6, peRatio: 25.8, rsi: 42, ivRank: 22 },
    { symbol: 'SHW', name: 'Sherwin-Williams', sector: 'Materials', industry: 'Specialty Chemicals', marketCap: 80e9, price: 315.40, volume: 1e6, peRatio: 32.2, rsi: 50, ivRank: 18 },
  ]

  // Apply random daily changes scaled by timeframe
  return stocks.map((stock) => {
    const changePercent =
      (Math.random() - 0.45) * 6 * multiplier // Slight upward bias, scaled by timeframe
    const change = stock.price * (changePercent / 100)
    return {
      ...stock,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round(changePercent * 100) / 100,
    }
  })
}
