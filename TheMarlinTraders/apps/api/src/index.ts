import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from './routers/index.js'
import { createContext } from './context.js'

const PORT = Number(process.env.PORT ?? 4000)

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function normalizeLegacyBatchInput(url: URL): URL {
  if (url.searchParams.get('batch') !== '1') return url

  const inputRaw = url.searchParams.get('input')
  if (!inputRaw) return url

  try {
    const parsed = JSON.parse(inputRaw) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return url

    let changed = false
    const normalized: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(parsed)) {
      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        'json' in (value as Record<string, unknown>)
      ) {
        normalized[key] = (value as { json: unknown }).json
        changed = true
      } else {
        normalized[key] = value
      }
    }

    if (!changed) return url

    const next = new URL(url.toString())
    next.searchParams.set('input', JSON.stringify(normalized))
    return next
  } catch {
    return url
  }
}

function wrapLegacyBatchData(payload: unknown): unknown {
  if (!Array.isArray(payload)) return payload

  return payload.map((entry) => {
    if (!entry || typeof entry !== 'object') return entry

    const result = (entry as { result?: unknown }).result
    if (!result || typeof result !== 'object') return entry

    const resultRecord = result as Record<string, unknown>
    const data = resultRecord.data

    if (data === undefined) return entry
    if (data && typeof data === 'object' && !Array.isArray(data) && 'json' in data) return entry

    return {
      ...(entry as Record<string, unknown>),
      result: {
        ...resultRecord,
        data: { json: data },
      },
    }
  })
}

async function maybeWrapLegacyBatchResponse(response: Response, url: URL): Promise<Response> {
  if (url.searchParams.get('batch') !== '1') return response

  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) return response

  try {
    const payload = await response.json()
    const wrapped = wrapLegacyBatchData(payload)
    const headers = new Headers(response.headers)
    headers.set('content-type', 'application/json')
    return new Response(JSON.stringify(wrapped), {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  } catch {
    return response
  }
}

Bun.serve({
  port: PORT,
  idleTimeout: 30,
  async fetch(req) {
    const url = new URL(req.url)

    // CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    // Health check (non-tRPC)
    if (url.pathname === '/health') {
      return Response.json(
        { status: 'ok', timestamp: new Date().toISOString() },
        { headers: CORS_HEADERS },
      )
    }

    // tRPC handler
    if (url.pathname.startsWith('/trpc')) {
      const normalizedUrl = normalizeLegacyBatchInput(url)
      const trpcReq =
        normalizedUrl.toString() === url.toString() ? req : new Request(normalizedUrl, req)

      const trpcResponse = await fetchRequestHandler({
        endpoint: '/trpc',
        req: trpcReq,
        router: appRouter,
        createContext: () => createContext(req),
        responseMeta: () => ({
          headers: CORS_HEADERS,
        }),
      })

      return maybeWrapLegacyBatchResponse(trpcResponse, normalizedUrl)
    }

    return new Response('Not Found', { status: 404, headers: CORS_HEADERS })
  },
})

console.log(`Marlin API running on http://localhost:${PORT}`)
