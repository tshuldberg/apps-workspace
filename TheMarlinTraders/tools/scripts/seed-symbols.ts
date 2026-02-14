/**
 * Seed script: Insert ~50 popular US equity symbols into the symbols table.
 * Usage: DATABASE_URL=... bun tools/scripts/seed-symbols.ts
 */
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { symbols } from '../../apps/api/src/db/schema/symbols.js'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}

const client = postgres(connectionString)
const db = drizzle(client)

const SEED_SYMBOLS = [
  { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', type: 'stock' as const, sector: 'Technology', industry: 'Consumer Electronics' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ', type: 'stock' as const, sector: 'Technology', industry: 'Software' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', exchange: 'NASDAQ', type: 'stock' as const, sector: 'Technology', industry: 'Internet' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', exchange: 'NASDAQ', type: 'stock' as const, sector: 'Consumer Cyclical', industry: 'E-Commerce' },
  { symbol: 'META', name: 'Meta Platforms Inc.', exchange: 'NASDAQ', type: 'stock' as const, sector: 'Technology', industry: 'Social Media' },
  { symbol: 'TSLA', name: 'Tesla Inc.', exchange: 'NASDAQ', type: 'stock' as const, sector: 'Consumer Cyclical', industry: 'Auto Manufacturers' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', exchange: 'NASDAQ', type: 'stock' as const, sector: 'Technology', industry: 'Semiconductors' },
  { symbol: 'BRK.B', name: 'Berkshire Hathaway Inc.', exchange: 'NYSE', type: 'stock' as const, sector: 'Financials', industry: 'Insurance' },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.', exchange: 'NYSE', type: 'stock' as const, sector: 'Financials', industry: 'Banking' },
  { symbol: 'JNJ', name: 'Johnson & Johnson', exchange: 'NYSE', type: 'stock' as const, sector: 'Healthcare', industry: 'Pharmaceuticals' },
  { symbol: 'V', name: 'Visa Inc.', exchange: 'NYSE', type: 'stock' as const, sector: 'Financials', industry: 'Payments' },
  { symbol: 'UNH', name: 'UnitedHealth Group Inc.', exchange: 'NYSE', type: 'stock' as const, sector: 'Healthcare', industry: 'Health Insurance' },
  { symbol: 'HD', name: 'The Home Depot Inc.', exchange: 'NYSE', type: 'stock' as const, sector: 'Consumer Cyclical', industry: 'Home Improvement' },
  { symbol: 'PG', name: 'Procter & Gamble Co.', exchange: 'NYSE', type: 'stock' as const, sector: 'Consumer Defensive', industry: 'Household Products' },
  { symbol: 'MA', name: 'Mastercard Inc.', exchange: 'NYSE', type: 'stock' as const, sector: 'Financials', industry: 'Payments' },
  { symbol: 'DIS', name: 'The Walt Disney Company', exchange: 'NYSE', type: 'stock' as const, sector: 'Communication Services', industry: 'Entertainment' },
  { symbol: 'NFLX', name: 'Netflix Inc.', exchange: 'NASDAQ', type: 'stock' as const, sector: 'Communication Services', industry: 'Streaming' },
  { symbol: 'ADBE', name: 'Adobe Inc.', exchange: 'NASDAQ', type: 'stock' as const, sector: 'Technology', industry: 'Software' },
  { symbol: 'CRM', name: 'Salesforce Inc.', exchange: 'NYSE', type: 'stock' as const, sector: 'Technology', industry: 'Software' },
  { symbol: 'PYPL', name: 'PayPal Holdings Inc.', exchange: 'NASDAQ', type: 'stock' as const, sector: 'Financials', industry: 'Payments' },
  { symbol: 'INTC', name: 'Intel Corporation', exchange: 'NASDAQ', type: 'stock' as const, sector: 'Technology', industry: 'Semiconductors' },
  { symbol: 'AMD', name: 'Advanced Micro Devices Inc.', exchange: 'NASDAQ', type: 'stock' as const, sector: 'Technology', industry: 'Semiconductors' },
  { symbol: 'CSCO', name: 'Cisco Systems Inc.', exchange: 'NASDAQ', type: 'stock' as const, sector: 'Technology', industry: 'Networking' },
  { symbol: 'PEP', name: 'PepsiCo Inc.', exchange: 'NASDAQ', type: 'stock' as const, sector: 'Consumer Defensive', industry: 'Beverages' },
  { symbol: 'KO', name: 'The Coca-Cola Company', exchange: 'NYSE', type: 'stock' as const, sector: 'Consumer Defensive', industry: 'Beverages' },
  { symbol: 'COST', name: 'Costco Wholesale Corporation', exchange: 'NASDAQ', type: 'stock' as const, sector: 'Consumer Defensive', industry: 'Retail' },
  { symbol: 'WMT', name: 'Walmart Inc.', exchange: 'NYSE', type: 'stock' as const, sector: 'Consumer Defensive', industry: 'Retail' },
  { symbol: 'ABT', name: 'Abbott Laboratories', exchange: 'NYSE', type: 'stock' as const, sector: 'Healthcare', industry: 'Medical Devices' },
  { symbol: 'MRK', name: 'Merck & Co. Inc.', exchange: 'NYSE', type: 'stock' as const, sector: 'Healthcare', industry: 'Pharmaceuticals' },
  { symbol: 'PFE', name: 'Pfizer Inc.', exchange: 'NYSE', type: 'stock' as const, sector: 'Healthcare', industry: 'Pharmaceuticals' },
  { symbol: 'XOM', name: 'Exxon Mobil Corporation', exchange: 'NYSE', type: 'stock' as const, sector: 'Energy', industry: 'Oil & Gas' },
  { symbol: 'CVX', name: 'Chevron Corporation', exchange: 'NYSE', type: 'stock' as const, sector: 'Energy', industry: 'Oil & Gas' },
  { symbol: 'BAC', name: 'Bank of America Corporation', exchange: 'NYSE', type: 'stock' as const, sector: 'Financials', industry: 'Banking' },
  { symbol: 'WFC', name: 'Wells Fargo & Company', exchange: 'NYSE', type: 'stock' as const, sector: 'Financials', industry: 'Banking' },
  { symbol: 'GS', name: 'Goldman Sachs Group Inc.', exchange: 'NYSE', type: 'stock' as const, sector: 'Financials', industry: 'Investment Banking' },
  { symbol: 'MS', name: 'Morgan Stanley', exchange: 'NYSE', type: 'stock' as const, sector: 'Financials', industry: 'Investment Banking' },
  { symbol: 'BA', name: 'The Boeing Company', exchange: 'NYSE', type: 'stock' as const, sector: 'Industrials', industry: 'Aerospace' },
  { symbol: 'CAT', name: 'Caterpillar Inc.', exchange: 'NYSE', type: 'stock' as const, sector: 'Industrials', industry: 'Machinery' },
  { symbol: 'GE', name: 'GE Aerospace', exchange: 'NYSE', type: 'stock' as const, sector: 'Industrials', industry: 'Aerospace' },
  { symbol: 'UBER', name: 'Uber Technologies Inc.', exchange: 'NYSE', type: 'stock' as const, sector: 'Technology', industry: 'Ride-Sharing' },
  { symbol: 'SQ', name: 'Block Inc.', exchange: 'NYSE', type: 'stock' as const, sector: 'Technology', industry: 'Fintech' },
  { symbol: 'SHOP', name: 'Shopify Inc.', exchange: 'NYSE', type: 'stock' as const, sector: 'Technology', industry: 'E-Commerce' },
  { symbol: 'COIN', name: 'Coinbase Global Inc.', exchange: 'NASDAQ', type: 'stock' as const, sector: 'Financials', industry: 'Crypto Exchange' },
  { symbol: 'PLTR', name: 'Palantir Technologies Inc.', exchange: 'NYSE', type: 'stock' as const, sector: 'Technology', industry: 'Software' },
  { symbol: 'SNOW', name: 'Snowflake Inc.', exchange: 'NYSE', type: 'stock' as const, sector: 'Technology', industry: 'Cloud Computing' },
  // ETFs
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust', exchange: 'NYSE', type: 'etf' as const, sector: 'Index', industry: 'Broad Market' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust', exchange: 'NASDAQ', type: 'etf' as const, sector: 'Index', industry: 'Technology' },
  { symbol: 'IWM', name: 'iShares Russell 2000 ETF', exchange: 'NYSE', type: 'etf' as const, sector: 'Index', industry: 'Small Cap' },
  { symbol: 'DIA', name: 'SPDR Dow Jones Industrial Average ETF', exchange: 'NYSE', type: 'etf' as const, sector: 'Index', industry: 'Broad Market' },
  { symbol: 'VTI', name: 'Vanguard Total Stock Market ETF', exchange: 'NYSE', type: 'etf' as const, sector: 'Index', industry: 'Broad Market' },
]

async function seed() {
  console.log(`Seeding ${SEED_SYMBOLS.length} symbols...`)

  await db
    .insert(symbols)
    .values(SEED_SYMBOLS)
    .onConflictDoNothing({ target: symbols.symbol })

  console.log('Seed complete.')
  await client.end()
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
