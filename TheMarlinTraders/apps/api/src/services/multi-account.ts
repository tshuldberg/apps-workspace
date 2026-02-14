/**
 * Multi-Account Manager
 *
 * Manages multiple broker sub-accounts (common with IBKR).
 * Provides aggregated portfolio views, account switching,
 * per-account P&L tracking, and user-friendly alias management.
 */

import type { BrokerAccount, BrokerPosition } from '../adapters/broker/broker.interface.js'
import { IBKRAdapter } from '../adapters/broker/ibkr.js'
import { redis } from '../lib/redis.js'

// ── Types ────────────────────────────────────────────────

export interface SubAccount {
  accountId: string
  provider: 'alpaca' | 'ibkr' | 'tradier'
  alias: string
  isPaper: boolean
  isActive: boolean
  account?: BrokerAccount
}

export interface AggregatedPortfolio {
  totalEquity: number
  totalCashBalance: number
  totalBuyingPower: number
  totalPortfolioValue: number
  totalUnrealizedPnL: number
  accounts: AccountPortfolio[]
}

export interface AccountPortfolio {
  accountId: string
  alias: string
  provider: 'alpaca' | 'ibkr' | 'tradier'
  isPaper: boolean
  equity: number
  cashBalance: number
  buyingPower: number
  portfolioValue: number
  unrealizedPnL: number
  positions: BrokerPosition[]
}

export interface AccountAlias {
  accountId: string
  alias: string
}

// ── Constants ─────────────────────────────────────────────

const ALIAS_CACHE_PREFIX = 'account:alias:'
const ALIAS_CACHE_TTL = 604800 // 7 days

// ── Multi-Account Manager ────────────────────────────────

export class MultiAccountManager {
  private adapters: Map<string, IBKRAdapter> = new Map()
  private activeAccountId: string | null = null

  /**
   * Register an IBKR adapter for multi-account management.
   */
  registerAdapter(connectionId: string, adapter: IBKRAdapter): void {
    this.adapters.set(connectionId, adapter)
  }

  /**
   * List all sub-accounts under a given IBKR adapter.
   */
  async listSubAccounts(connectionId: string): Promise<SubAccount[]> {
    const adapter = this.getAdapter(connectionId)
    const ibkrAccounts = await adapter.listAccounts()

    const subAccounts: SubAccount[] = []

    for (const acct of ibkrAccounts) {
      const alias = await this.getAlias(acct.accountId)

      subAccounts.push({
        accountId: acct.accountId,
        provider: 'ibkr',
        alias: alias || acct.accountAlias || acct.displayName || acct.accountId,
        isPaper: acct.type === 'DEMO' || acct.tradingType === 'PAPER',
        isActive: acct.accountStatus === 1,
      })
    }

    return subAccounts
  }

  /**
   * Switch the active account for order submission.
   */
  switchAccount(connectionId: string, accountId: string): void {
    const adapter = this.getAdapter(connectionId)
    adapter.switchAccount(accountId)
    this.activeAccountId = accountId
  }

  /**
   * Get the currently active account ID.
   */
  getActiveAccountId(): string | null {
    return this.activeAccountId
  }

  /**
   * Get aggregated portfolio across all sub-accounts.
   */
  async getAggregatedPortfolio(connectionId: string): Promise<AggregatedPortfolio> {
    const adapter = this.getAdapter(connectionId)
    const subAccounts = await this.listSubAccounts(connectionId)

    const accountPortfolios: AccountPortfolio[] = []
    let totalEquity = 0
    let totalCash = 0
    let totalBuyingPower = 0
    let totalPortfolioValue = 0
    let totalUnrealizedPnL = 0

    for (const sub of subAccounts) {
      if (!sub.isActive) continue

      try {
        const account = await adapter.getAccountById(sub.accountId)
        const positions = await adapter.getPositionsByAccount(sub.accountId)

        const unrealizedPnL = positions.reduce(
          (sum, p) => sum + p.unrealizedPnL,
          0,
        )

        const portfolio: AccountPortfolio = {
          accountId: sub.accountId,
          alias: sub.alias,
          provider: 'ibkr',
          isPaper: sub.isPaper,
          equity: account.equity,
          cashBalance: account.cashBalance,
          buyingPower: account.buyingPower,
          portfolioValue: account.portfolioValue,
          unrealizedPnL,
          positions,
        }

        accountPortfolios.push(portfolio)

        totalEquity += account.equity
        totalCash += account.cashBalance
        totalBuyingPower += account.buyingPower
        totalPortfolioValue += account.portfolioValue
        totalUnrealizedPnL += unrealizedPnL
      } catch {
        // Skip accounts that fail to load
        accountPortfolios.push({
          accountId: sub.accountId,
          alias: sub.alias,
          provider: 'ibkr',
          isPaper: sub.isPaper,
          equity: 0,
          cashBalance: 0,
          buyingPower: 0,
          portfolioValue: 0,
          unrealizedPnL: 0,
          positions: [],
        })
      }
    }

    return {
      totalEquity,
      totalCashBalance: totalCash,
      totalBuyingPower,
      totalPortfolioValue,
      totalUnrealizedPnL,
      accounts: accountPortfolios,
    }
  }

  /**
   * Get per-account P&L summary.
   */
  async getAccountPnL(
    connectionId: string,
    accountId: string,
  ): Promise<{
    unrealizedPnL: number
    unrealizedPnLPercent: number
    dayPnL: number
    positions: BrokerPosition[]
  }> {
    const adapter = this.getAdapter(connectionId)
    const account = await adapter.getAccountById(accountId)
    const positions = await adapter.getPositionsByAccount(accountId)

    const unrealizedPnL = positions.reduce((sum, p) => sum + p.unrealizedPnL, 0)
    const totalCost = positions.reduce(
      (sum, p) => sum + p.avgEntryPrice * p.quantity,
      0,
    )
    const unrealizedPnLPercent = totalCost > 0 ? (unrealizedPnL / totalCost) * 100 : 0

    return {
      unrealizedPnL,
      unrealizedPnLPercent,
      dayPnL: account.equity - account.lastEquity,
      positions,
    }
  }

  // ── Alias Management ────────────────────────────────────

  /**
   * Set a user-friendly alias for an account.
   */
  async setAlias(
    userId: string,
    accountId: string,
    alias: string,
  ): Promise<void> {
    const key = `${ALIAS_CACHE_PREFIX}${userId}:${accountId}`
    await redis.set(key, alias, 'EX', ALIAS_CACHE_TTL)
  }

  /**
   * Get the alias for an account.
   */
  async getAlias(accountId: string): Promise<string | null> {
    // Search across all user aliases (this is a simplified approach)
    const keys = await redis.keys(`${ALIAS_CACHE_PREFIX}*:${accountId}`)
    if (keys.length > 0) {
      return redis.get(keys[0])
    }
    return null
  }

  /**
   * Get all aliases for a user.
   */
  async getUserAliases(userId: string): Promise<AccountAlias[]> {
    const keys = await redis.keys(`${ALIAS_CACHE_PREFIX}${userId}:*`)
    const aliases: AccountAlias[] = []

    for (const key of keys) {
      const accountId = key.split(':').pop() ?? ''
      const alias = await redis.get(key)
      if (alias) {
        aliases.push({ accountId, alias })
      }
    }

    return aliases
  }

  // ── Private ──────────────────────────────────────────────

  private getAdapter(connectionId: string): IBKRAdapter {
    const adapter = this.adapters.get(connectionId)
    if (!adapter) {
      throw new Error(`No IBKR adapter registered for connection: ${connectionId}`)
    }
    return adapter
  }
}
