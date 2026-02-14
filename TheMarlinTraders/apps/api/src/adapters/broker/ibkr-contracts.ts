/**
 * IBKR Contract Resolver
 *
 * Maps standard symbols to IBKR contract IDs (conid).
 * Handles equity, options, and futures contract resolution
 * with Redis caching (24h TTL).
 */

import type { IBKRContract, IBKRSecType } from '@marlin/shared'
import { redis } from '../../lib/redis.js'

// ── Types ────────────────────────────────────────────────

interface IBKRSearchResult {
  conid: number
  companyHeader: string
  companyName: string
  symbol: string
  description: string
  restricted: string | null
  fop: string | null
  opt: string | null
  war: string | null
  sections: IBKRSection[]
}

interface IBKRSection {
  secType: string
  months?: string
  exchange?: string
  conid?: number
}

interface IBKRSecDefResult {
  conid: number
  symbol: string
  secType: string
  exchange: string
  listingExchange: string
  currency: string
  group: string
  name: string
  lastTradeDateOrContractMonth: string
  strike?: number
  right?: string
  multiplier?: string
}

interface IBKRStrikesResult {
  call: Record<string, number[]>
  put: Record<string, number[]>
}

// ── Constants ─────────────────────────────────────────────

const CACHE_TTL = 86400 // 24 hours
const CACHE_PREFIX = 'ibkr:contract:'
const BATCH_CACHE_PREFIX = 'ibkr:batch:'

// ── Contract Resolver ────────────────────────────────────

export class IBKRContractResolver {
  constructor(
    private baseUrl: string,
    private sessionToken: string,
  ) {}

  /**
   * Resolve a standard symbol to an IBKR contract.
   * Checks Redis cache first, then calls IBKR API.
   */
  async resolveContract(
    symbol: string,
    secType: IBKRSecType = 'STK',
  ): Promise<IBKRContract> {
    const cacheKey = `${CACHE_PREFIX}${symbol}:${secType}`

    // Check cache
    const cached = await redis.get(cacheKey)
    if (cached) {
      return JSON.parse(cached) as IBKRContract
    }

    // Search IBKR for the contract
    const results = await this.searchContract(symbol)

    if (!results.length) {
      throw new IBKRContractError(`No IBKR contract found for symbol: ${symbol}`)
    }

    // Find the matching secType from search results
    const match = this.findBestMatch(results, symbol, secType)

    if (!match) {
      throw new IBKRContractError(
        `No ${secType} contract found for symbol: ${symbol}`,
      )
    }

    const contract: IBKRContract = {
      conid: match.conid,
      symbol: match.symbol,
      secType,
      exchange: 'SMART',
      currency: 'USD',
    }

    // Cache the result
    await redis.set(cacheKey, JSON.stringify(contract), 'EX', CACHE_TTL)

    return contract
  }

  /**
   * Resolve an options contract.
   * symbol + expiry + strike + right -> conid
   */
  async resolveOptionsContract(
    underlying: string,
    expiry: string,
    strike: number,
    right: 'C' | 'P',
  ): Promise<IBKRContract> {
    const cacheKey = `${CACHE_PREFIX}opt:${underlying}:${expiry}:${strike}:${right}`

    // Check cache
    const cached = await redis.get(cacheKey)
    if (cached) {
      return JSON.parse(cached) as IBKRContract
    }

    // First resolve the underlying to get its conid
    const underlyingContract = await this.resolveContract(underlying, 'STK')

    // Search for the specific options contract via secdef
    const secDefs = await this.getSecurityDefinitions(
      underlyingContract.conid,
      expiry,
      'OPT',
    )

    const match = secDefs.find(
      (def) =>
        def.strike === strike &&
        def.right === right &&
        def.lastTradeDateOrContractMonth === expiry,
    )

    if (!match) {
      throw new IBKRContractError(
        `No options contract found: ${underlying} ${expiry} ${strike} ${right}`,
      )
    }

    const contract: IBKRContract = {
      conid: match.conid,
      symbol: underlying,
      secType: 'OPT',
      exchange: match.exchange || 'SMART',
      currency: match.currency || 'USD',
      lastTradeDateOrContractMonth: expiry,
      strike,
      right,
      multiplier: match.multiplier || '100',
    }

    // Cache the result
    await redis.set(cacheKey, JSON.stringify(contract), 'EX', CACHE_TTL)

    return contract
  }

  /**
   * Batch-resolve multiple symbols to contracts.
   * Uses pipelining for efficient Redis lookups.
   */
  async batchResolve(
    symbols: string[],
    secType: IBKRSecType = 'STK',
  ): Promise<Map<string, IBKRContract>> {
    const results = new Map<string, IBKRContract>()
    const uncached: string[] = []

    // Pipeline cache lookups
    const pipeline = redis.pipeline()
    for (const sym of symbols) {
      pipeline.get(`${CACHE_PREFIX}${sym}:${secType}`)
    }
    const cacheResults = await pipeline.exec()

    // Separate cached from uncached
    for (let i = 0; i < symbols.length; i++) {
      const [err, val] = cacheResults?.[i] ?? [null, null]
      if (!err && val && typeof val === 'string') {
        results.set(symbols[i], JSON.parse(val) as IBKRContract)
      } else {
        uncached.push(symbols[i])
      }
    }

    // Resolve uncached symbols (with rate limiting — 1 at a time)
    for (const sym of uncached) {
      try {
        const contract = await this.resolveContract(sym, secType)
        results.set(sym, contract)
      } catch {
        // Skip symbols that can't be resolved
      }
    }

    return results
  }

  /**
   * Get available strikes for an underlying contract.
   */
  async getStrikes(
    underlyingConid: number,
    expiry: string,
  ): Promise<{ calls: number[]; puts: number[] }> {
    const response = await this.request<IBKRStrikesResult>(
      'GET',
      `/iserver/secdef/strikes?conid=${underlyingConid}&sectype=OPT&month=${expiry}`,
    )

    return {
      calls: response.call?.[expiry] ?? [],
      puts: response.put?.[expiry] ?? [],
    }
  }

  /**
   * Search IBKR for contracts matching a symbol string.
   */
  async searchContract(query: string): Promise<IBKRSearchResult[]> {
    const response = await this.request<IBKRSearchResult[]>(
      'GET',
      `/iserver/secdef/search?symbol=${encodeURIComponent(query)}`,
    )
    return response
  }

  /**
   * Invalidate cached contract for a symbol.
   */
  async invalidateCache(symbol: string, secType?: IBKRSecType): Promise<void> {
    if (secType) {
      await redis.del(`${CACHE_PREFIX}${symbol}:${secType}`)
    } else {
      // Delete all secType variants
      const keys = await redis.keys(`${CACHE_PREFIX}${symbol}:*`)
      if (keys.length > 0) {
        await redis.del(...keys)
      }
    }
  }

  // ── Private ──────────────────────────────────────────────

  private async getSecurityDefinitions(
    underlyingConid: number,
    month: string,
    secType: string,
  ): Promise<IBKRSecDefResult[]> {
    const body = {
      conid: underlyingConid,
      sectype: secType,
      month,
    }

    const response = await this.request<{ secdef: IBKRSecDefResult[] }>(
      'POST',
      '/iserver/secdef/info',
      body,
    )

    return response.secdef ?? []
  }

  private findBestMatch(
    results: IBKRSearchResult[],
    symbol: string,
    secType: IBKRSecType,
  ): IBKRSearchResult | undefined {
    // Exact symbol match with matching secType in sections
    const exact = results.find((r) => {
      if (r.symbol !== symbol.toUpperCase()) return false
      return r.sections?.some(
        (s) => s.secType?.toUpperCase() === secType,
      )
    })

    if (exact) return exact

    // Fallback: first result with matching symbol
    return results.find((r) => r.symbol === symbol.toUpperCase())
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Cookie: `api=${this.sessionToken}`,
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '')
      throw new IBKRContractError(
        `IBKR API error: ${response.status} ${response.statusText} - ${errorBody}`,
      )
    }

    return response.json() as Promise<T>
  }
}

// ── Error ──────────────────────────────────────────────────

export class IBKRContractError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IBKRContractError'
  }
}
