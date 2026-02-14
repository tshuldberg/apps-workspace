/**
 * Index all symbols from PostgreSQL into Meilisearch.
 *
 * Usage: bun tools/scripts/index-symbols.ts
 */
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { eq } from 'drizzle-orm'
import { symbols } from '../../apps/api/src/db/schema/symbols.js'
import {
  meili,
  SYMBOLS_INDEX,
  configureSymbolsIndex,
  type IndexedSymbol,
} from '../../apps/api/src/services/search.js'

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error('DATABASE_URL is required')
    process.exit(1)
  }

  const client = postgres(connectionString)
  const db = drizzle(client)

  console.log('Fetching symbols from database...')
  const rows = await db
    .select({
      id: symbols.id,
      symbol: symbols.symbol,
      name: symbols.name,
      exchange: symbols.exchange,
      type: symbols.type,
      sector: symbols.sector,
      industry: symbols.industry,
    })
    .from(symbols)
    .where(eq(symbols.isActive, true))

  console.log(`Found ${rows.length} active symbols`)

  console.log('Configuring Meilisearch index...')
  await configureSymbolsIndex()

  console.log('Indexing symbols...')
  const BATCH_SIZE = 1000
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE) as IndexedSymbol[]
    await meili.index(SYMBOLS_INDEX).addDocuments(batch, { primaryKey: 'id' })
    console.log(`  Indexed ${Math.min(i + BATCH_SIZE, rows.length)} / ${rows.length}`)
  }

  console.log('Done. Waiting for indexing to complete...')
  await meili.index(SYMBOLS_INDEX).waitForTasks()
  console.log('Indexing complete.')

  await client.end()
}

main().catch((err) => {
  console.error('Failed to index symbols:', err)
  process.exit(1)
})
