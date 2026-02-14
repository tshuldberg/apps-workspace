import { AlertEvaluator } from './evaluator/alert-evaluator.js'

const REDIS_URL = process.env.REDIS_URL ?? ''
const WS_GATEWAY_URL = process.env.WS_GATEWAY_URL ?? 'ws://localhost:4001'

if (!REDIS_URL) {
  console.error('[notifications] REDIS_URL is required')
  process.exit(1)
}

const evaluator = new AlertEvaluator(REDIS_URL, WS_GATEWAY_URL)

evaluator.start().then(() => {
  console.log('[notifications] Alert evaluator started')
}).catch((err) => {
  console.error('[notifications] Failed to start:', err)
  process.exit(1)
})

process.on('SIGINT', () => {
  evaluator.stop().then(() => process.exit(0))
})
process.on('SIGTERM', () => {
  evaluator.stop().then(() => process.exit(0))
})
