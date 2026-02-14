import Redis from 'ioredis'
import type { NormalizedBar, NormalizedQuote } from '@marlin/shared'

export class RedisPublisher {
  private pub: Redis

  constructor(redisUrl: string) {
    this.pub = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    })
  }

  async connect(): Promise<void> {
    await this.pub.connect()
  }

  async publishBar(bar: NormalizedBar): Promise<void> {
    const channel = `bars:${bar.symbol}:${bar.timeframe}`
    await this.pub.publish(channel, JSON.stringify(bar))
  }

  async publishQuote(quote: NormalizedQuote): Promise<void> {
    const channel = `quotes:${quote.symbol}`
    await this.pub.publish(channel, JSON.stringify(quote))
  }

  async disconnect(): Promise<void> {
    await this.pub.quit()
  }
}
