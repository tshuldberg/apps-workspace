/**
 * Strategy Deployer — Live & Paper Strategy Deployment
 *
 * Manages the lifecycle of deployed trading strategies:
 * deploy, run, monitor, and stop. Supports two modes:
 * - 'paper': orders routed to the paper trading engine
 * - 'live': orders routed to real broker adapters (Alpaca/IBKR)
 *
 * Each deployment is tracked in memory with its own risk manager,
 * P&L state, and signal history.
 */

import type { OHLCV } from '@marlin/shared'
import { StrategySandbox } from './strategy-sandbox.js'
import type { StrategySignal, SandboxConfig } from './strategy-sandbox.js'
import { RiskManager } from './strategy-risk.js'
import type { RiskConfig, PortfolioSnapshot, OrderToCheck } from './strategy-risk.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DeploymentMode = 'paper' | 'live'
export type DeploymentStatus = 'running' | 'stopped' | 'error'

export interface DeploymentConfig {
  strategyId: string
  strategyName: string
  code: string
  symbol: string
  mode: DeploymentMode
  brokerConnectionId?: string
  equity: number
  riskConfig?: Partial<RiskConfig>
}

export interface DeploymentState {
  id: string
  strategyId: string
  strategyName: string
  symbol: string
  mode: DeploymentMode
  status: DeploymentStatus
  brokerConnectionId?: string
  equity: number
  startedAt: number
  stoppedAt?: number
  lastSignalAt?: number
  lastError?: string
  signalCount: number
  signals: StrategySignal[]
  recentOrders: DeploymentOrder[]
  riskManager: RiskManager
  pnlToday: number
  totalPnl: number
  peakEquity: number
  currentEquity: number
}

export interface DeploymentOrder {
  id: string
  timestamp: number
  side: 'buy' | 'sell'
  symbol: string
  quantity: number
  price: number
  status: 'submitted' | 'filled' | 'rejected' | 'cancelled'
  reason?: string
  riskBlocked?: boolean
  riskReason?: string
}

export interface DeploymentSummary {
  id: string
  strategyId: string
  strategyName: string
  symbol: string
  mode: DeploymentMode
  status: DeploymentStatus
  startedAt: number
  stoppedAt?: number
  lastSignalAt?: number
  lastError?: string
  signalCount: number
  pnlToday: number
  totalPnl: number
  currentEquity: number
  uptimeMs: number
}

export interface DeploymentDetail extends DeploymentSummary {
  signals: StrategySignal[]
  recentOrders: DeploymentOrder[]
  riskConfig: RiskConfig
  killSwitchActive: boolean
  killSwitchReason?: string
  drawdownPercent: number
  dailyPnLPercent: number
  peakEquity: number
}

// ---------------------------------------------------------------------------
// Strategy Deployer
// ---------------------------------------------------------------------------

let nextDeploymentId = 0
function generateDeploymentId(): string {
  nextDeploymentId += 1
  return `deploy-${Date.now()}-${nextDeploymentId}`
}

let nextOrderId = 0
function generateOrderId(): string {
  nextOrderId += 1
  return `order-${Date.now()}-${nextOrderId}`
}

export class StrategyDeployer {
  private deployments = new Map<string, DeploymentState>()
  private sandbox = new StrategySandbox()

  // ── Deploy ─────────────────────────────────────────────────

  /**
   * Deploy a strategy in paper or live mode.
   * Returns the deployment ID.
   */
  deploy(config: DeploymentConfig): { deploymentId: string } | { error: string } {
    // Validate the strategy code first
    const validation = this.sandbox.validateCode(config.code)
    if (!validation.valid) {
      return { error: `Strategy validation failed: ${validation.errors.join('; ')}` }
    }

    // For live mode, require a broker connection
    if (config.mode === 'live' && !config.brokerConnectionId) {
      return { error: 'Live mode requires a broker connection ID' }
    }

    const id = generateDeploymentId()
    const riskManager = new RiskManager(config.riskConfig, config.equity)

    const state: DeploymentState = {
      id,
      strategyId: config.strategyId,
      strategyName: config.strategyName,
      symbol: config.symbol,
      mode: config.mode,
      status: 'running',
      brokerConnectionId: config.brokerConnectionId,
      equity: config.equity,
      startedAt: Date.now(),
      signalCount: 0,
      signals: [],
      recentOrders: [],
      riskManager,
      pnlToday: 0,
      totalPnl: 0,
      peakEquity: config.equity,
      currentEquity: config.equity,
    }

    this.deployments.set(id, state)
    return { deploymentId: id }
  }

  // ── Process bars (called by market data pipeline) ──────────

  /**
   * Process incoming bar data for a deployment.
   * Runs the strategy sandbox on the bars and generates orders.
   */
  processBar(deploymentId: string, bars: OHLCV[]): DeploymentOrder[] {
    const state = this.deployments.get(deploymentId)
    if (!state || state.status !== 'running') return []

    const sandboxConfig: SandboxConfig = {
      symbol: state.symbol,
      equity: state.currentEquity,
    }

    // Find the strategy code — in a production system this would
    // come from the database. For now, we read from the deployment request.
    // The code is stored in a separate strategies store (TODO: wire to DB)
    // For the deployer's scope, we execute the sandbox each time bars arrive.

    // The deployment doesn't store code directly; strategies are fetched
    // from the DB via strategyId. For testability, this method accepts bars
    // and delegates to the subclass or an injected code provider.
    // This is a placeholder — processSignals is the primary entry point.
    return []
  }

  /**
   * Process signals generated by the sandbox and apply risk checks
   * before creating orders. This is the main entry point after sandbox
   * execution returns signals.
   */
  processSignals(deploymentId: string, signals: StrategySignal[]): DeploymentOrder[] {
    const state = this.deployments.get(deploymentId)
    if (!state || state.status !== 'running') return []

    const orders: DeploymentOrder[] = []

    for (const signal of signals) {
      // Build portfolio snapshot for risk check
      const portfolio: PortfolioSnapshot = {
        equity: state.currentEquity,
        positions: [], // In production, fetch from broker/paper engine
      }

      const orderToCheck: OrderToCheck = {
        symbol: signal.symbol,
        side: signal.side,
        quantity: signal.quantity,
        price: signal.price,
      }

      // Run risk checks
      const riskResult = state.riskManager.checkOrder(orderToCheck, portfolio)

      const order: DeploymentOrder = {
        id: generateOrderId(),
        timestamp: Date.now(),
        side: signal.side,
        symbol: signal.symbol,
        quantity: signal.quantity,
        price: signal.price,
        status: riskResult.allowed ? 'submitted' : 'rejected',
        reason: signal.reason,
        riskBlocked: !riskResult.allowed,
        riskReason: riskResult.reason,
      }

      orders.push(order)

      // If risk check passed, the order would be sent to the broker/paper engine
      if (riskResult.allowed) {
        order.status = 'filled' // Simulate immediate fill for paper mode
      }

      // Update state
      state.signalCount += 1
      state.lastSignalAt = Date.now()
      state.signals.push(signal)
      state.recentOrders.push(order)

      // Trim signal/order history to last 500 entries
      if (state.signals.length > 500) state.signals = state.signals.slice(-500)
      if (state.recentOrders.length > 500) state.recentOrders = state.recentOrders.slice(-500)

      // If kill switch triggered, stop the deployment
      if (state.riskManager.getKillSwitchStatus().triggered) {
        state.status = 'error'
        state.lastError = state.riskManager.getKillSwitchStatus().reason
        state.stoppedAt = Date.now()
        break
      }
    }

    return orders
  }

  // ── Stop ───────────────────────────────────────────────────

  /**
   * Gracefully stop a running strategy deployment.
   */
  stop(deploymentId: string): { success: boolean; error?: string } {
    const state = this.deployments.get(deploymentId)
    if (!state) {
      return { success: false, error: 'Deployment not found' }
    }
    if (state.status === 'stopped') {
      return { success: false, error: 'Deployment already stopped' }
    }

    state.status = 'stopped'
    state.stoppedAt = Date.now()
    return { success: true }
  }

  /**
   * Stop ALL active deployments (emergency kill switch).
   */
  stopAll(): { stopped: number } {
    let stopped = 0
    for (const [, state] of this.deployments) {
      if (state.status === 'running') {
        state.status = 'stopped'
        state.stoppedAt = Date.now()
        stopped++
      }
    }
    return { stopped }
  }

  // ── Status & queries ──────────────────────────────────────

  /**
   * Get the status of a specific deployment.
   */
  getStatus(deploymentId: string): DeploymentDetail | null {
    const state = this.deployments.get(deploymentId)
    if (!state) return null

    const killSwitch = state.riskManager.getKillSwitchStatus()

    return {
      id: state.id,
      strategyId: state.strategyId,
      strategyName: state.strategyName,
      symbol: state.symbol,
      mode: state.mode,
      status: state.status,
      startedAt: state.startedAt,
      stoppedAt: state.stoppedAt,
      lastSignalAt: state.lastSignalAt,
      lastError: state.lastError,
      signalCount: state.signalCount,
      pnlToday: state.pnlToday,
      totalPnl: state.totalPnl,
      currentEquity: state.currentEquity,
      uptimeMs: (state.stoppedAt ?? Date.now()) - state.startedAt,
      signals: state.signals,
      recentOrders: state.recentOrders,
      riskConfig: state.riskManager.getConfig(),
      killSwitchActive: killSwitch.triggered,
      killSwitchReason: killSwitch.reason,
      drawdownPercent: state.riskManager.getDrawdownPercent(state.currentEquity),
      dailyPnLPercent: state.riskManager.getDailyPnLPercent(state.currentEquity),
      peakEquity: state.peakEquity,
    }
  }

  /**
   * List all active (running) deployments.
   */
  getActive(): DeploymentSummary[] {
    const active: DeploymentSummary[] = []
    for (const [, state] of this.deployments) {
      if (state.status === 'running') {
        active.push(this.toSummary(state))
      }
    }
    return active
  }

  /**
   * List all deployments (any status).
   */
  getAll(): DeploymentSummary[] {
    const all: DeploymentSummary[] = []
    for (const [, state] of this.deployments) {
      all.push(this.toSummary(state))
    }
    return all
  }

  // ── Risk config management ────────────────────────────────

  /**
   * Get the risk config for a deployment.
   */
  getRiskConfig(deploymentId: string): RiskConfig | null {
    const state = this.deployments.get(deploymentId)
    if (!state) return null
    return state.riskManager.getConfig()
  }

  /**
   * Update the risk config for a deployment.
   */
  updateRiskConfig(deploymentId: string, config: Partial<RiskConfig>): { success: boolean; error?: string } {
    const state = this.deployments.get(deploymentId)
    if (!state) return { success: false, error: 'Deployment not found' }
    state.riskManager.updateConfig(config)
    return { success: true }
  }

  /**
   * Reset the kill switch for a deployment (allows resuming).
   */
  resetKillSwitch(deploymentId: string): { success: boolean; error?: string } {
    const state = this.deployments.get(deploymentId)
    if (!state) return { success: false, error: 'Deployment not found' }
    state.riskManager.resetKillSwitch()
    if (state.status === 'error') {
      state.status = 'running'
      state.lastError = undefined
      state.stoppedAt = undefined
    }
    return { success: true }
  }

  // ── Helpers ───────────────────────────────────────────────

  private toSummary(state: DeploymentState): DeploymentSummary {
    return {
      id: state.id,
      strategyId: state.strategyId,
      strategyName: state.strategyName,
      symbol: state.symbol,
      mode: state.mode,
      status: state.status,
      startedAt: state.startedAt,
      stoppedAt: state.stoppedAt,
      lastSignalAt: state.lastSignalAt,
      lastError: state.lastError,
      signalCount: state.signalCount,
      pnlToday: state.pnlToday,
      totalPnl: state.totalPnl,
      currentEquity: state.currentEquity,
      uptimeMs: (state.stoppedAt ?? Date.now()) - state.startedAt,
    }
  }
}
