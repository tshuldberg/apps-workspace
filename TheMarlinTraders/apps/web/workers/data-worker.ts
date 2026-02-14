/** Data Worker — processes raw market data messages from the WS worker.
 *  Formats data for chart rendering so the main thread only handles paint. */

import { processMessage } from '@marlin/data/workers/data-processor'
import type { ProcessedMessage } from '@marlin/data/workers/data-processor'

interface DataMessage {
  type: 'data'
  channel: string
  payload: unknown
}

interface RawWsMessage {
  type: 'message'
  data: DataMessage
}

self.onmessage = (event: MessageEvent<RawWsMessage>) => {
  const msg = event.data

  if (msg.type !== 'message' || msg.data.type !== 'data') return

  const processed = processMessage(msg.data.channel, msg.data.payload)
  if (processed) {
    self.postMessage(processed)
  }
}
