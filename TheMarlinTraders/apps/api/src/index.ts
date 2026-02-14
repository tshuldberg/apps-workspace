import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from './routers/index.js'
import { createContext } from './context.js'

const PORT = Number(process.env.PORT ?? 4000)

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

Bun.serve({
  port: PORT,
  fetch(req) {
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
      return fetchRequestHandler({
        endpoint: '/trpc',
        req,
        router: appRouter,
        createContext: () => createContext(req),
        responseMeta: () => ({
          headers: CORS_HEADERS,
        }),
      })
    }

    return new Response('Not Found', { status: 404, headers: CORS_HEADERS })
  },
})

console.log(`Marlin API running on http://localhost:${PORT}`)
