import { MeiliSearch } from 'meilisearch'

const MEILI_HOST = process.env.MEILISEARCH_HOST ?? 'http://127.0.0.1:7700'
const MEILI_KEY = process.env.MEILISEARCH_API_KEY ?? ''

export const meili = new MeiliSearch({ host: MEILI_HOST, apiKey: MEILI_KEY })

export const SYMBOLS_INDEX = 'symbols'

export interface IndexedSymbol {
  id: number
  symbol: string
  name: string
  exchange: string | null
  type: string
  sector: string | null
  industry: string | null
}

/** Configure the symbols index with optimal search settings */
export async function configureSymbolsIndex(): Promise<void> {
  const index = meili.index(SYMBOLS_INDEX)

  await index.updateSettings({
    searchableAttributes: ['symbol', 'name', 'sector', 'industry'],
    displayedAttributes: ['id', 'symbol', 'name', 'exchange', 'type', 'sector', 'industry'],
    sortableAttributes: ['symbol', 'name'],
    filterableAttributes: ['type', 'exchange', 'sector'],
    rankingRules: [
      'words',
      'typo',
      'proximity',
      'attribute',
      'sort',
      'exactness',
    ],
    typoTolerance: {
      minWordSizeForTypos: { oneTypo: 3, twoTypos: 6 },
    },
  })
}

/** Search symbols with fuzzy matching */
export async function searchSymbols(
  query: string,
  options?: { limit?: number; filter?: string },
): Promise<IndexedSymbol[]> {
  const index = meili.index(SYMBOLS_INDEX)

  const result = await index.search<IndexedSymbol>(query, {
    limit: options?.limit ?? 20,
    filter: options?.filter,
  })

  return result.hits
}
