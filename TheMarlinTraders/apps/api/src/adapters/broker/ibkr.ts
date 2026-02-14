/**
 * Interactive Brokers Adapter
 *
 * Implements BrokerAdapter for IBKR Client Portal API.
 * Supports multi-account, bracket orders, OCA groups,
 * conditional orders, and contract resolution.
 *
 * IBKR Client Portal API uses session-based auth via gateway.
 * Sessions expire after ~24h and must be re-authenticated.
 */

import type {
  BrokerAdapter,
  BrokerAccount,
  BrokerCredentials,
  BrokerOrder,
  BrokerOrderResult,
  BrokerPosition,
  BrokerSession,
  OrderStatus,
  OrderUpdate,
  OrderUpdateEvent,
  OrderSide,
} from './broker.interface.js'
import type {
  IBKRBracketOrder,
  OCAOrder,
  ConditionalOrder,
  AdaptiveAlgo,
} from '@marlin/shared'
import { IBKRContractResolver } from './ibkr-contracts.js'

// ── IBKR API Types ────────────────────────────────────────

interface IBKRAccountInfo {
  id: string
  accountId: string
  accountVan: string
  accountTitle: string
  displayName: string
  accountAlias: string
  accountStatus: number
  currency: string
  type: string
  tradingType: string
  faclient: boolean
  parent: {
    mmc: string[]
    accountId: string
    isMParent: boolean
    isMChild: boolean
    isMultiplex: boolean
  }
  desc: string
}

interface IBKRAccountSummary {
  accountready: { value: boolean }
  netliquidation: { amount: number; currency: string }
  totalcashvalue: { amount: number; currency: string }
  buyingpower: { amount: number; currency: string }
  grosspositionvalue: { amount: number; currency: string }
  sma: { amount: number; currency: string }
  availablefunds: { amount: number; currency: string }
  maintmarginreq: { amount: number; currency: string }
  initmarginreq: { amount: number; currency: string }
  cushion: { value: number }
  daytradesremaining: { value: number }
  daytradingstatus: { value: string }
}

interface IBKRPosition {
  acctId: string
  conid: number
  contractDesc: string
  position: number
  mktPrice: number
  mktValue: number
  currency: string
  avgCost: number
  avgPrice: number
  realizedPnl: number
  unrealizedPnl: number
  exchs: string | null
  expiry: string | null
  putOrCall: string | null
  multiplier: number | null
  strike: number
  exerciseStyle: string | null
  assetClass: string
  model: string
}

interface IBKROrderResponse {
  order_id: string
  order_status: string
  encrypt_message?: string
}

interface IBKROrderDetail {
  orderId: number
  conid: number
  symbol: string
  side: string
  orderType: string
  price: number
  auxPrice: number
  status: string
  filledQuantity: number
  remainingQuantity: number
  totalQuantity: number
  avgPrice: number
  lastFillPrice: number
  timeInForce: string
  lastExecutionTime_r: number
  orderDesc: string
  ocaGroupId: string
  parentId: number
}

interface IBKROrderReply {
  id: string
  message?: string[]
  confirmed?: boolean
}

// ── Constants ─────────────────────────────────────────────

const GATEWAY_BASE_URL = 'https://localhost:5000/v1/api'

const STATUS_MAP: Record<string, OrderStatus> = {
  Submitted: 'new',
  PreSubmitted: 'pending_new',
  Filled: 'filled',
  Cancelled: 'cancelled',
  Inactive: 'rejected',
  PendingSubmit: 'pending_new',
  PendingCancel: 'cancelled',
  ApiPending: 'pending_new',
  ApiCancelled: 'cancelled',
}

const EVENT_MAP: Record<string, OrderUpdateEvent> = {
  Submitted: 'new',
  Filled: 'fill',
  Cancelled: 'canceled',
  Inactive: 'rejected',
}

// ── Adapter ───────────────────────────────────────────────

export class IBKRAdapter implements BrokerAdapter {
  readonly provider = 'ibkr' as const

  private baseUrl: string = GATEWAY_BASE_URL
  private sessionToken: string = ''
  private activeAccountId: string = ''
  private ws: WebSocket | null = null
  private orderUpdateCallbacks: Set<(update: OrderUpdate) => void> = new Set()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private isConnected = false
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null

  /** Contract resolver for symbol -> conid mapping */
  private _contractResolver: IBKRContractResolver | null = null

  get contractResolver(): IBKRContractResolver {
    if (!this._contractResolver) {
      this._contractResolver = new IBKRContractResolver(
        this.baseUrl,
        this.sessionToken,
      )
    }
    return this._contractResolver
  }

  // ── Authentication ──────────────────────────────────────

  async authenticate(credentials: BrokerCredentials): Promise<BrokerSession> {
    this.sessionToken = credentials.accessToken

    if (credentials.paper) {
      // IBKR paper trading uses the same gateway but different accounts
      this.baseUrl = GATEWAY_BASE_URL
    }

    // Validate session by fetching auth status
    const authStatus = await this.request<{
      authenticated: boolean
      competing: boolean
      connected: boolean
      message: string
    }>('POST', '/iserver/auth/status')

    if (!authStatus.authenticated) {
      throw new IBKRApiError('IBKR session is not authenticated. Please re-authenticate via Client Portal.', 401)
    }

    // Get accounts
    const accounts = await this.listAccounts()
    if (accounts.length === 0) {
      throw new IBKRApiError('No IBKR accounts found', 404)
    }

    // Use first account as default
    this.activeAccountId = accounts[0].accountId

    // Start keep-alive ping (IBKR sessions timeout without activity)
    this.startKeepAlive()

    // Reset contract resolver with new credentials
    this._contractResolver = new IBKRContractResolver(
      this.baseUrl,
      this.sessionToken,
    )

    return {
      accountId: this.activeAccountId,
      provider: 'ibkr',
      accessToken: this.sessionToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // ~24h
    }
  }

  // ── Account ──────────────────────────────────────────────

  async getAccount(): Promise<BrokerAccount> {
    return this.getAccountById(this.activeAccountId)
  }

  async getAccountById(accountId: string): Promise<BrokerAccount> {
    const summary = await this.request<IBKRAccountSummary>(
      'GET',
      `/portfolio/${encodeURIComponent(accountId)}/summary`,
    )

    const daytradeCount = summary.daytradesremaining?.value ?? -1
    const isPDT = summary.daytradingstatus?.value === 'PDT'

    return {
      accountId,
      status: summary.accountready?.value ? 'active' : 'restricted',
      currency: summary.netliquidation?.currency ?? 'USD',
      cashBalance: summary.totalcashvalue?.amount ?? 0,
      buyingPower: summary.buyingpower?.amount ?? 0,
      portfolioValue: summary.netliquidation?.amount ?? 0,
      equity: summary.netliquidation?.amount ?? 0,
      multiplier: 1,
      daytradeCount: daytradeCount >= 0 ? daytradeCount : 0,
      patternDayTrader: isPDT,
      lastEquity: summary.netliquidation?.amount ?? 0,
      createdAt: new Date().toISOString(),
    }
  }

  /**
   * List all sub-accounts under the master account.
   */
  async listAccounts(): Promise<IBKRAccountInfo[]> {
    const response = await this.request<{ accounts: string[] }>(
      'GET',
      '/portfolio/accounts',
    )

    const accounts: IBKRAccountInfo[] = []
    for (const accountId of response.accounts ?? []) {
      try {
        const info = await this.request<IBKRAccountInfo>(
          'GET',
          `/portfolio/${encodeURIComponent(accountId)}/meta`,
        )
        accounts.push({ ...info, accountId })
      } catch {
        // Skip accounts that fail to load
        accounts.push({
          id: accountId,
          accountId,
          accountVan: accountId,
          accountTitle: accountId,
          displayName: accountId,
          accountAlias: '',
          accountStatus: 1,
          currency: 'USD',
          type: 'INDIVIDUAL',
          tradingType: 'STKNOPT',
          faclient: false,
          parent: {
            mmc: [],
            accountId: '',
            isMParent: false,
            isMChild: false,
            isMultiplex: false,
          },
          desc: accountId,
        })
      }
    }

    return accounts
  }

  /**
   * Switch the active account for subsequent operations.
   */
  switchAccount(accountId: string): void {
    this.activeAccountId = accountId
  }

  // ── Positions ──────────────────────────────────────────

  async getPositions(): Promise<BrokerPosition[]> {
    return this.getPositionsByAccount(this.activeAccountId)
  }

  async getPositionsByAccount(accountId: string): Promise<BrokerPosition[]> {
    const data = await this.request<IBKRPosition[]>(
      'GET',
      `/portfolio/${encodeURIComponent(accountId)}/positions/0`,
    )

    return (data ?? []).map((p) => ({
      symbol: p.contractDesc || `CONID:${p.conid}`,
      quantity: Math.abs(p.position),
      side: p.position >= 0 ? ('long' as const) : ('short' as const),
      avgEntryPrice: p.avgPrice,
      currentPrice: p.mktPrice,
      marketValue: p.mktValue,
      costBasis: p.avgCost * Math.abs(p.position),
      unrealizedPnL: p.unrealizedPnl,
      unrealizedPnLPercent:
        p.avgCost > 0
          ? ((p.mktPrice - p.avgPrice) / p.avgPrice) * 100
          : 0,
      changeToday: 0, // IBKR doesn't provide daily change directly
    }))
  }

  /**
   * Get aggregated positions across all sub-accounts.
   */
  async getAllPositions(): Promise<Map<string, BrokerPosition[]>> {
    const accounts = await this.listAccounts()
    const result = new Map<string, BrokerPosition[]>()

    for (const account of accounts) {
      try {
        const positions = await this.getPositionsByAccount(account.accountId)
        result.set(account.accountId, positions)
      } catch {
        result.set(account.accountId, [])
      }
    }

    return result
  }

  // ── Standard Orders ──────────────────────────────────────

  async submitOrder(order: BrokerOrder): Promise<BrokerOrderResult> {
    // Resolve symbol to conid if needed
    let conid: number
    if (order.symbol.startsWith('CONID:')) {
      conid = parseInt(order.symbol.replace('CONID:', ''), 10)
    } else {
      const contract = await this.contractResolver.resolveContract(order.symbol)
      conid = contract.conid
    }

    const ibkrOrder: Record<string, unknown> = {
      acctId: this.activeAccountId,
      conid,
      orderType: this.mapOrderTypeToIBKR(order.type),
      side: order.side.toUpperCase(),
      quantity: order.quantity,
      tif: this.mapTimeInForceToIBKR(order.timeInForce),
    }

    if (order.limitPrice !== undefined) {
      ibkrOrder.price = order.limitPrice
    }
    if (order.stopPrice !== undefined) {
      ibkrOrder.auxPrice = order.stopPrice
    }
    if (order.extendedHours) {
      ibkrOrder.outsideRTH = true
    }

    const response = await this.submitIBKROrder(ibkrOrder)

    return {
      orderId: response.order_id,
      status: STATUS_MAP[response.order_status] ?? 'new',
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      quantity: order.quantity,
      filledQuantity: 0,
      limitPrice: order.limitPrice,
      stopPrice: order.stopPrice,
      timeInForce: order.timeInForce,
      submittedAt: new Date().toISOString(),
    }
  }

  async cancelOrder(orderId: string): Promise<void> {
    await this.request(
      'DELETE',
      `/iserver/account/${encodeURIComponent(this.activeAccountId)}/order/${encodeURIComponent(orderId)}`,
    )
  }

  async getOrders(status?: OrderStatus): Promise<BrokerOrderResult[]> {
    const data = await this.request<{ orders: IBKROrderDetail[] }>(
      'GET',
      '/iserver/account/orders',
    )

    const orders = (data.orders ?? []).map((o) => this.mapOrder(o))

    if (status) {
      return orders.filter((o) => o.status === status)
    }

    return orders
  }

  // ── Bracket Orders ─────────────────────────────────────

  /**
   * Submit a bracket order (entry + profit target + stop loss).
   * IBKR links these via parentId, creating a proper bracket group.
   */
  async submitBracketOrder(
    bracket: IBKRBracketOrder,
  ): Promise<{ entryOrderId: string; targetOrderId: string; stopOrderId: string }> {
    // Build the parent (entry) order
    const entryOrder: Record<string, unknown> = {
      acctId: this.activeAccountId,
      conid: bracket.entry.conid,
      orderType: bracket.entry.orderType,
      side: bracket.entry.action,
      quantity: bracket.entry.quantity,
      tif: bracket.entry.timeInForce,
      isSingleGroup: true,
      outsideRTH: false,
    }

    if (bracket.entry.limitPrice !== undefined) {
      entryOrder.price = bracket.entry.limitPrice
    }
    if (bracket.entry.stopPrice !== undefined) {
      entryOrder.auxPrice = bracket.entry.stopPrice
    }

    // Build profit target (child order)
    const profitSide = bracket.entry.action === 'BUY' ? 'SELL' : 'BUY'
    const targetOrder: Record<string, unknown> = {
      acctId: this.activeAccountId,
      conid: bracket.entry.conid,
      orderType: 'LMT',
      side: profitSide,
      quantity: bracket.entry.quantity,
      price: bracket.profitTarget.limitPrice,
      tif: 'GTC',
      isChildOrder: true,
    }

    // Build stop loss (child order)
    const stopOrder: Record<string, unknown> = {
      acctId: this.activeAccountId,
      conid: bracket.entry.conid,
      orderType: bracket.stopLoss.trailingAmount ? 'TRAIL' : 'STP',
      side: profitSide,
      quantity: bracket.entry.quantity,
      auxPrice: bracket.stopLoss.stopPrice,
      tif: 'GTC',
      isChildOrder: true,
    }

    if (bracket.stopLoss.trailingAmount) {
      stopOrder.trailingAmt = bracket.stopLoss.trailingAmount
      stopOrder.trailingType = bracket.stopLoss.trailingType === 'percent' ? '%' : 'amt'
    }

    // Submit as a bracket group
    const body = {
      orders: [entryOrder, targetOrder, stopOrder],
    }

    const response = await this.request<IBKROrderReply[]>(
      'POST',
      `/iserver/account/${encodeURIComponent(this.activeAccountId)}/orders`,
      body,
    )

    // Handle confirmation prompts (IBKR may require confirmation)
    const confirmed = await this.handleOrderConfirmation(response)

    return {
      entryOrderId: confirmed[0]?.id ?? 'pending',
      targetOrderId: confirmed[1]?.id ?? 'pending',
      stopOrderId: confirmed[2]?.id ?? 'pending',
    }
  }

  // ── OCA Orders ─────────────────────────────────────────

  /**
   * Submit an OCA (One-Cancels-All) order group.
   */
  async submitOCAOrder(
    oca: OCAOrder,
  ): Promise<{ orderIds: string[] }> {
    const orders = oca.orders.map((o) => ({
      acctId: this.activeAccountId,
      conid: o.conid,
      orderType: o.orderType,
      side: o.action,
      quantity: o.quantity,
      price: o.limitPrice,
      auxPrice: o.stopPrice,
      tif: o.timeInForce,
      cOID: oca.ocaGroup,
      ocaType: oca.ocaType,
    }))

    const body = { orders }

    const response = await this.request<IBKROrderReply[]>(
      'POST',
      `/iserver/account/${encodeURIComponent(this.activeAccountId)}/orders`,
      body,
    )

    const confirmed = await this.handleOrderConfirmation(response)

    return {
      orderIds: confirmed.map((r) => r.id),
    }
  }

  // ── Conditional Orders ─────────────────────────────────

  /**
   * Submit a conditional order (order with price/time/margin conditions).
   */
  async submitConditionalOrder(
    conditional: ConditionalOrder,
  ): Promise<BrokerOrderResult> {
    const ibkrConditions = conditional.conditions.map((c) => {
      switch (c.type) {
        case 'price':
          return {
            type: 1,
            conid: c.conid,
            operator: c.operator === '>=' || c.operator === '>' ? 1 : 2,
            triggerMethod: c.triggerMethod,
            value: c.value.toString(),
            exchange: c.exchange,
          }
        case 'time':
          return {
            type: 3,
            value: c.triggerAfter,
          }
        case 'margin':
          return {
            type: 4,
            operator: c.operator === '>=' ? 1 : 2,
            value: c.cushionPercent.toString(),
          }
        case 'volume':
          return {
            type: 5,
            conid: c.conid,
            operator: c.operator === '>=' ? 1 : 2,
            value: c.value.toString(),
            exchange: c.exchange,
          }
      }
    })

    const order: Record<string, unknown> = {
      acctId: this.activeAccountId,
      conid: conditional.order.conid,
      orderType: conditional.order.orderType,
      side: conditional.order.action,
      quantity: conditional.order.quantity,
      tif: conditional.order.timeInForce,
      conditions: ibkrConditions,
      conditionOutsideRTH: true,
      conditionsLogic: conditional.conditionsLogic === 'AND' ? 'a' : 'o',
    }

    if (conditional.order.limitPrice !== undefined) {
      order.price = conditional.order.limitPrice
    }
    if (conditional.order.stopPrice !== undefined) {
      order.auxPrice = conditional.order.stopPrice
    }

    const response = await this.submitIBKROrder(order)

    return {
      orderId: response.order_id,
      status: STATUS_MAP[response.order_status] ?? 'new',
      symbol: `CONID:${conditional.order.conid}`,
      side: conditional.order.action.toLowerCase() as OrderSide,
      type: this.mapOrderTypeFromIBKR(conditional.order.orderType),
      quantity: conditional.order.quantity,
      filledQuantity: 0,
      limitPrice: conditional.order.limitPrice,
      stopPrice: conditional.order.stopPrice,
      timeInForce: this.mapTimeInForceFromIBKR(conditional.order.timeInForce),
      submittedAt: new Date().toISOString(),
    }
  }

  // ── Adaptive Algo ──────────────────────────────────────

  /**
   * Submit an adaptive algo order (IBKR's smart routing algorithm).
   */
  async submitAdaptiveAlgoOrder(
    algo: AdaptiveAlgo,
  ): Promise<BrokerOrderResult> {
    const order: Record<string, unknown> = {
      acctId: this.activeAccountId,
      conid: algo.conid,
      orderType: 'MKT',
      side: algo.action,
      quantity: algo.quantity,
      tif: algo.timeInForce,
      strategy: 'Adaptive',
      strategyParameters: {
        adaptivePriority: algo.priority,
      },
    }

    if (algo.startTime) {
      order.startTime = algo.startTime
    }
    if (algo.endTime) {
      order.endTime = algo.endTime
    }

    const response = await this.submitIBKROrder(order)

    return {
      orderId: response.order_id,
      status: STATUS_MAP[response.order_status] ?? 'new',
      symbol: `CONID:${algo.conid}`,
      side: algo.action.toLowerCase() as OrderSide,
      type: 'market',
      quantity: algo.quantity,
      filledQuantity: 0,
      timeInForce: this.mapTimeInForceFromIBKR(algo.timeInForce),
      submittedAt: new Date().toISOString(),
    }
  }

  // ── WebSocket Order Updates ──────────────────────────────

  subscribeOrderUpdates(cb: (update: OrderUpdate) => void): () => void {
    this.orderUpdateCallbacks.add(cb)

    if (!this.isConnected) {
      this.connectStream()
    }

    return () => {
      this.orderUpdateCallbacks.delete(cb)
      if (this.orderUpdateCallbacks.size === 0) {
        this.disconnectStream()
      }
    }
  }

  disconnect(): void {
    this.disconnectStream()
    this.stopKeepAlive()
    this.orderUpdateCallbacks.clear()
    this._contractResolver = null
  }

  // ── Private: HTTP ────────────────────────────────────────

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

      if (response.status === 401) {
        throw new IBKRApiError(
          'IBKR session expired. Please re-authenticate via Client Portal.',
          401,
        )
      }

      throw new IBKRApiError(
        `IBKR API error: ${response.status} ${response.statusText} - ${errorBody}`,
        response.status,
      )
    }

    if (response.status === 204) {
      return undefined as unknown as T
    }

    return response.json() as Promise<T>
  }

  private async submitIBKROrder(
    order: Record<string, unknown>,
  ): Promise<IBKROrderResponse> {
    const response = await this.request<IBKROrderReply[]>(
      'POST',
      `/iserver/account/${encodeURIComponent(this.activeAccountId)}/orders`,
      { orders: [order] },
    )

    const confirmed = await this.handleOrderConfirmation(response)

    if (!confirmed.length || !confirmed[0].id) {
      throw new IBKRApiError('Order submission failed: no order ID returned', 400)
    }

    return {
      order_id: confirmed[0].id,
      order_status: 'Submitted',
    }
  }

  /**
   * IBKR may return confirmation prompts that require a reply.
   * Auto-confirm for programmatic submissions.
   */
  private async handleOrderConfirmation(
    replies: IBKROrderReply[],
  ): Promise<IBKROrderReply[]> {
    // Check if any reply needs confirmation
    const needsConfirmation = replies.some(
      (r) => r.message && !r.confirmed,
    )

    if (needsConfirmation) {
      // Confirm the order
      const replyId = replies[0]?.id
      if (replyId) {
        const confirmed = await this.request<IBKROrderReply[]>(
          'POST',
          `/iserver/reply/${encodeURIComponent(replyId)}`,
          { confirmed: true },
        )
        return confirmed
      }
    }

    return replies
  }

  // ── Private: WebSocket ──────────────────────────────────

  private connectStream(): void {
    if (this.ws) return

    try {
      const wsUrl = this.baseUrl.replace('https://', 'wss://').replace('/v1/api', '/v1/api/ws')
      this.ws = new WebSocket(wsUrl)

      this.ws.addEventListener('open', () => {
        this.isConnected = true
        // Subscribe to order updates
        this.ws?.send(JSON.stringify({
          topic: 'sor',
        }))
        // Subscribe to order status
        this.ws?.send(JSON.stringify({
          topic: 'sbd+{}',
        }))
      })

      this.ws.addEventListener('message', (event) => {
        try {
          const msg = JSON.parse(
            typeof event.data === 'string' ? event.data : '',
          )

          // Handle order update messages
          if (msg.topic === 'sor' && msg.args) {
            const update = this.mapOrderUpdateFromWS(msg.args)
            if (update) {
              for (const cb of this.orderUpdateCallbacks) {
                cb(update)
              }
            }
          }
        } catch {
          // Ignore malformed messages
        }
      })

      this.ws.addEventListener('close', () => {
        this.isConnected = false
        this.ws = null
        if (this.orderUpdateCallbacks.size > 0) {
          this.reconnectTimer = setTimeout(() => this.connectStream(), 5000)
        }
      })

      this.ws.addEventListener('error', () => {
        this.ws?.close()
      })
    } catch {
      this.reconnectTimer = setTimeout(() => this.connectStream(), 5000)
    }
  }

  private disconnectStream(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
      this.isConnected = false
    }
  }

  // ── Private: Keep-Alive ─────────────────────────────────

  private startKeepAlive(): void {
    this.stopKeepAlive()
    // Ping every 5 minutes to prevent session timeout
    this.keepAliveTimer = setInterval(async () => {
      try {
        await this.request('POST', '/tickle')
      } catch {
        // Session may have expired
      }
    }, 5 * 60 * 1000)
  }

  private stopKeepAlive(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer)
      this.keepAliveTimer = null
    }
  }

  // ── Private: Mappers ─────────────────────────────────────

  private mapOrder(o: IBKROrderDetail): BrokerOrderResult {
    return {
      orderId: o.orderId.toString(),
      status: STATUS_MAP[o.status] ?? 'new',
      symbol: o.symbol || `CONID:${o.conid}`,
      side: o.side?.toLowerCase() === 'sell' ? 'sell' : 'buy',
      type: this.mapOrderTypeFromIBKR(o.orderType),
      quantity: o.totalQuantity,
      filledQuantity: o.filledQuantity,
      avgFillPrice: o.avgPrice > 0 ? o.avgPrice : undefined,
      limitPrice: o.orderType === 'LMT' || o.orderType === 'STP_LMT' ? o.price : undefined,
      stopPrice: o.orderType === 'STP' || o.orderType === 'STP_LMT' ? o.auxPrice : undefined,
      timeInForce: this.mapTimeInForceFromIBKR(o.timeInForce),
      submittedAt: o.lastExecutionTime_r
        ? new Date(o.lastExecutionTime_r).toISOString()
        : new Date().toISOString(),
      filledAt:
        o.status === 'Filled' && o.lastExecutionTime_r
          ? new Date(o.lastExecutionTime_r).toISOString()
          : undefined,
    }
  }

  private mapOrderUpdateFromWS(
    args: Record<string, unknown>,
  ): OrderUpdate | null {
    const orderId = args.orderId as number | undefined
    const status = args.status as string | undefined

    if (!orderId || !status) return null

    return {
      event: EVENT_MAP[status] ?? 'new',
      orderId: orderId.toString(),
      symbol: (args.symbol as string) ?? '',
      side: ((args.side as string) ?? '').toLowerCase() === 'sell' ? 'sell' : 'buy',
      status: STATUS_MAP[status] ?? 'new',
      filledQuantity: (args.filledQuantity as number) ?? 0,
      avgFillPrice: (args.avgPrice as number) ?? undefined,
      timestamp: new Date().toISOString(),
    }
  }

  private mapOrderTypeToIBKR(type: BrokerOrder['type']): string {
    const map: Record<string, string> = {
      market: 'MKT',
      limit: 'LMT',
      stop: 'STP',
      stop_limit: 'STP_LMT',
      trailing_stop: 'TRAIL',
    }
    return map[type] ?? 'MKT'
  }

  private mapOrderTypeFromIBKR(ibkrType: string): BrokerOrderResult['type'] {
    const map: Record<string, BrokerOrderResult['type']> = {
      MKT: 'market',
      LMT: 'limit',
      STP: 'stop',
      STP_LMT: 'stop_limit',
      TRAIL: 'trailing_stop',
    }
    return map[ibkrType] ?? 'market'
  }

  private mapTimeInForceToIBKR(tif: BrokerOrder['timeInForce']): string {
    const map: Record<string, string> = {
      day: 'DAY',
      gtc: 'GTC',
      ioc: 'IOC',
      fok: 'FOK',
    }
    return map[tif] ?? 'DAY'
  }

  private mapTimeInForceFromIBKR(tif: string): BrokerOrderResult['timeInForce'] {
    const map: Record<string, BrokerOrderResult['timeInForce']> = {
      DAY: 'day',
      GTC: 'gtc',
      IOC: 'ioc',
      FOK: 'fok',
    }
    return map[tif] ?? 'day'
  }
}

// ── Error ──────────────────────────────────────────────────

export class IBKRApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message)
    this.name = 'IBKRApiError'
  }
}
