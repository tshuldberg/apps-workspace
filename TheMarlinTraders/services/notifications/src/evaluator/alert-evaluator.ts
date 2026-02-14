import Redis from 'ioredis'
import type { OHLCV } from '@marlin/shared'
import { priceAbove, priceBelow, priceCrossingUp, priceCrossingDown } from './conditions/price.js'
import { volumeAbove, rvolAbove } from './conditions/volume.js'
import { rsiAbove, rsiBelow, macdCrossover, maCrossover } from './conditions/indicator.js'
import { sendInAppNotification } from '../channels/in-app.js'
import { sendEmailNotification } from '../channels/email.js'
import { sendWebhookNotification } from '../channels/webhook.js'
import { sendPushNotification } from '../channels/push.js'

interface AlertRecord {
  id: string
  userId: string
  symbol: string
  conditionType: string
  threshold: string
  deliveryMethod: string
  webhookUrl: string | null
  status: string
  message: string | null
}

interface MarketTick {
  symbol: string
  price: number
  volume: number
  timestamp: number
}

/**
 * AlertEvaluator subscribes to Redis market data channels and evaluates
 * active alerts against incoming ticks. When a condition is met, it
 * records the trigger and dispatches notifications via the configured channel.
 */
export class AlertEvaluator {
  private redisSub: Redis
  private redisPub: Redis
  private redisCmd: Redis
  private previousPrices = new Map<string, number>()
  private running = false

  constructor(
    private readonly redisUrl: string,
    private readonly wsGatewayUrl: string,
  ) {
    this.redisSub = new Redis(redisUrl, { maxRetriesPerRequest: 3, lazyConnect: true })
    this.redisPub = new Redis(redisUrl, { maxRetriesPerRequest: 3, lazyConnect: true })
    this.redisCmd = new Redis(redisUrl, { maxRetriesPerRequest: 3, lazyConnect: true })
  }

  async start(): Promise<void> {
    await this.redisSub.connect()
    await this.redisPub.connect()
    await this.redisCmd.connect()

    // Subscribe to the market data tick channel published by market-data service
    await this.redisSub.psubscribe('market:tick:*')

    this.redisSub.on('pmessage', (_pattern: string, channel: string, message: string) => {
      const symbol = channel.replace('market:tick:', '')
      try {
        const tick = JSON.parse(message) as MarketTick
        this.evaluateTick(symbol, tick).catch((err) => {
          console.error(`[evaluator] Error evaluating ${symbol}:`, err)
        })
      } catch {
        // Ignore malformed messages
      }
    })

    this.running = true
    console.log('[evaluator] Subscribed to market:tick:* channels')
  }

  async stop(): Promise<void> {
    this.running = false
    await this.redisSub.punsubscribe('market:tick:*')
    this.redisSub.disconnect()
    this.redisPub.disconnect()
    this.redisCmd.disconnect()
  }

  private async evaluateTick(symbol: string, tick: MarketTick): Promise<void> {
    // Load active alerts for this symbol from Redis cache
    const alertsJson = await this.redisCmd.get(`alerts:active:${symbol}`)
    if (!alertsJson) return

    const activeAlerts = JSON.parse(alertsJson) as AlertRecord[]
    const previousPrice = this.previousPrices.get(symbol) ?? tick.price

    for (const alert of activeAlerts) {
      if (alert.status !== 'active') continue

      const triggered = this.checkCondition(alert, tick, previousPrice)
      if (triggered) {
        await this.handleTrigger(alert, tick)
      }
    }

    this.previousPrices.set(symbol, tick.price)
  }

  private checkCondition(alert: AlertRecord, tick: MarketTick, previousPrice: number): boolean {
    const threshold = parseFloat(alert.threshold)

    switch (alert.conditionType) {
      case 'price_above':
        return priceAbove({ currentPrice: tick.price, previousPrice, threshold })
      case 'price_below':
        return priceBelow({ currentPrice: tick.price, previousPrice, threshold })
      case 'price_crossing_up':
        return priceCrossingUp({ currentPrice: tick.price, previousPrice, threshold })
      case 'price_crossing_down':
        return priceCrossingDown({ currentPrice: tick.price, previousPrice, threshold })
      case 'volume_above':
        return volumeAbove({ currentVolume: tick.volume, threshold })
      case 'rvol_above': {
        // Average volume loaded from Redis cache
        const avgVolumeStr = this.previousPrices.get(`${alert.symbol}:avgvol`)
        const averageVolume = avgVolumeStr ? parseFloat(String(avgVolumeStr)) : 0
        return rvolAbove({ currentVolume: tick.volume, averageVolume, threshold })
      }
      // Indicator-based conditions require historical OHLCV data
      // These are evaluated on a less frequent schedule (bar close) rather than per-tick
      case 'rsi_above':
      case 'rsi_below':
      case 'macd_crossover':
      case 'ma_crossover':
        // Indicator conditions are evaluated by the bar-close evaluator (see below)
        return false
      default:
        return false
    }
  }

  /**
   * Evaluates indicator-based alert conditions when a new bar closes.
   * Called from the bar-close handler, not per-tick.
   */
  async evaluateBarClose(symbol: string, data: OHLCV[]): Promise<void> {
    const alertsJson = await this.redisCmd.get(`alerts:active:${symbol}`)
    if (!alertsJson) return

    const activeAlerts = JSON.parse(alertsJson) as AlertRecord[]
    const lastBar = data[data.length - 1]
    if (!lastBar) return

    for (const alert of activeAlerts) {
      if (alert.status !== 'active') continue

      let triggered = false
      const threshold = parseFloat(alert.threshold)

      switch (alert.conditionType) {
        case 'rsi_above':
          triggered = rsiAbove({ data }, threshold)
          break
        case 'rsi_below':
          triggered = rsiBelow({ data }, threshold)
          break
        case 'macd_crossover':
          triggered = macdCrossover({ data })
          break
        case 'ma_crossover':
          triggered = maCrossover({ data })
          break
      }

      if (triggered) {
        await this.handleTrigger(alert, {
          symbol,
          price: lastBar.close,
          volume: lastBar.volume,
          timestamp: lastBar.timestamp,
        })
      }
    }
  }

  private async handleTrigger(alert: AlertRecord, tick: MarketTick): Promise<void> {
    const now = new Date().toISOString()
    const triggerMessage =
      alert.message ??
      `Alert: ${alert.symbol} ${alert.conditionType.replace(/_/g, ' ')} ${alert.threshold}`

    console.log(`[evaluator] TRIGGERED: ${alert.symbol} ${alert.conditionType} @ ${tick.price}`)

    // Record the trigger in Redis (will be persisted to DB by the API)
    await this.redisPub.publish(
      'alert:triggers',
      JSON.stringify({
        alertId: alert.id,
        triggeredAt: now,
        priceAtTrigger: String(tick.price),
        message: triggerMessage,
      }),
    )

    // Mark the alert as triggered in cache
    await this.redisCmd.hset(`alert:status`, alert.id, 'triggered')

    // Dispatch notification based on delivery method
    switch (alert.deliveryMethod) {
      case 'in_app':
        await sendInAppNotification(this.redisPub, {
          userId: alert.userId,
          alertId: alert.id,
          symbol: alert.symbol,
          message: triggerMessage,
          triggeredAt: now,
        })
        break
      case 'email':
        await sendEmailNotification({
          to: alert.userId, // In production, resolve userId -> email
          subject: `Alert: ${alert.symbol} ${alert.conditionType.replace(/_/g, ' ')}`,
          body: `<h3>${triggerMessage}</h3><p>Price: $${tick.price} at ${now}</p>`,
        })
        break
      case 'webhook':
        if (alert.webhookUrl) {
          await sendWebhookNotification(alert.webhookUrl, {
            alertId: alert.id,
            symbol: alert.symbol,
            conditionType: alert.conditionType,
            threshold: alert.threshold,
            priceAtTrigger: String(tick.price),
            message: triggerMessage,
            triggeredAt: now,
          })
        }
        break
      case 'push':
        // In production, resolve userId -> push tokens from DB
        await sendPushNotification({
          expoPushTokens: [],
          title: `${alert.symbol} Alert`,
          body: triggerMessage,
          data: { alertId: alert.id, symbol: alert.symbol },
        })
        break
    }
  }
}
