/**
 * OpenAPI specification generator for the tRPC API.
 *
 * Since tRPC is not inherently REST-based, this module generates an OpenAPI
 * spec that documents the tRPC endpoints as RPC-style operations. This is
 * useful for:
 * - External developer documentation
 * - API gateway configuration
 * - Client SDK generation for non-TypeScript consumers
 */

// ── Types ───────────────────────────────────────────────────────────────────

export interface OpenAPISpec {
  openapi: string
  info: OpenAPIInfo
  servers: OpenAPIServer[]
  paths: Record<string, OpenAPIPathItem>
  components: OpenAPIComponents
}

interface OpenAPIInfo {
  title: string
  description: string
  version: string
  contact: {
    name: string
    url: string
  }
  license: {
    name: string
    url: string
  }
}

interface OpenAPIServer {
  url: string
  description: string
}

interface OpenAPIPathItem {
  [method: string]: OpenAPIOperation
}

interface OpenAPIOperation {
  operationId: string
  summary: string
  description: string
  tags: string[]
  security?: Array<Record<string, string[]>>
  requestBody?: {
    required: boolean
    content: {
      'application/json': {
        schema: OpenAPISchema
        example?: unknown
      }
    }
  }
  responses: Record<string, OpenAPIResponse>
}

interface OpenAPIResponse {
  description: string
  content?: {
    'application/json': {
      schema: OpenAPISchema
      example?: unknown
    }
  }
}

interface OpenAPISchema {
  type?: string
  properties?: Record<string, OpenAPISchema>
  items?: OpenAPISchema
  required?: string[]
  enum?: string[]
  description?: string
  format?: string
  default?: unknown
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
  $ref?: string
}

interface OpenAPIComponents {
  securitySchemes: Record<string, {
    type: string
    scheme?: string
    bearerFormat?: string
    description: string
  }>
  schemas: Record<string, OpenAPISchema>
}

// ── Route Definitions ───────────────────────────────────────────────────────

/**
 * tRPC route documentation entries.
 * Each entry maps a tRPC procedure path to its OpenAPI documentation.
 */
interface RouteDoc {
  path: string
  method: 'GET' | 'POST'
  summary: string
  description: string
  tags: string[]
  auth: boolean
  input?: OpenAPISchema
  inputExample?: unknown
  output?: OpenAPISchema
  outputExample?: unknown
}

const ROUTE_DOCS: RouteDoc[] = [
  // ── Health ──────────────────────────────────────────────────────────
  {
    path: '/trpc/health',
    method: 'GET',
    summary: 'Health check',
    description: 'Returns API status, version, and timestamp.',
    tags: ['System'],
    auth: false,
    output: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['ok'] },
        timestamp: { type: 'string', format: 'date-time' },
        version: { type: 'string' },
      },
    },
    outputExample: { status: 'ok', timestamp: '2026-02-14T00:00:00.000Z', version: '0.0.0' },
  },

  // ── Market ──────────────────────────────────────────────────────────
  {
    path: '/trpc/market.getBars',
    method: 'GET',
    summary: 'Get OHLCV bars',
    description: 'Fetch historical OHLCV bar data for a symbol and timeframe.',
    tags: ['Market Data'],
    auth: false,
    input: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Ticker symbol (e.g. AAPL)', minLength: 1, maxLength: 10 },
        timeframe: { type: 'string', description: 'Bar timeframe (1m, 5m, 15m, 1h, 1D, 1W, 1M)' },
        from: { type: 'string', format: 'date', description: 'Start date (YYYY-MM-DD)' },
        to: { type: 'string', format: 'date', description: 'End date (YYYY-MM-DD)' },
      },
      required: ['symbol', 'timeframe', 'from', 'to'],
    },
    inputExample: { symbol: 'AAPL', timeframe: '1D', from: '2024-01-01', to: '2024-12-31' },
  },
  {
    path: '/trpc/market.getQuote',
    method: 'GET',
    summary: 'Get latest quote',
    description: 'Get the latest price quote for a symbol.',
    tags: ['Market Data'],
    auth: false,
    input: {
      type: 'object',
      properties: {
        symbol: { type: 'string', minLength: 1, maxLength: 10 },
      },
      required: ['symbol'],
    },
  },

  // ── Watchlists ────────────────────────────────────────────────────
  {
    path: '/trpc/watchlist.list',
    method: 'GET',
    summary: 'List watchlists',
    description: 'Get all watchlists for the authenticated user.',
    tags: ['Watchlists'],
    auth: true,
  },
  {
    path: '/trpc/watchlist.create',
    method: 'POST',
    summary: 'Create watchlist',
    description: 'Create a new watchlist.',
    tags: ['Watchlists'],
    auth: true,
    input: {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 100 },
        symbols: { type: 'array', items: { type: 'string' } },
      },
      required: ['name'],
    },
  },

  // ── Ideas ────────────────────────────────────────────────────────
  {
    path: '/trpc/ideas.create',
    method: 'POST',
    summary: 'Create trading idea',
    description: 'Post a new trading idea with optional chart snapshot.',
    tags: ['Social'],
    auth: true,
    input: {
      type: 'object',
      properties: {
        title: { type: 'string', minLength: 1, maxLength: 200 },
        body: { type: 'string', minLength: 1, maxLength: 50000 },
        symbol: { type: 'string', minLength: 1, maxLength: 10 },
        sentiment: { type: 'string', enum: ['bullish', 'bearish', 'neutral'] },
        tags: { type: 'array', items: { type: 'string', maxLength: 50 } },
      },
      required: ['title', 'body', 'symbol'],
    },
    inputExample: {
      title: 'AAPL looking strong above 200 SMA',
      body: 'Apple just reclaimed the 200-day...',
      symbol: 'AAPL',
      sentiment: 'bullish',
      tags: ['swing-trade', 'technical'],
    },
  },
  {
    path: '/trpc/ideas.list',
    method: 'GET',
    summary: 'List trading ideas',
    description: 'Browse trading ideas with filtering and cursor pagination.',
    tags: ['Social'],
    auth: false,
  },
  {
    path: '/trpc/ideas.vote',
    method: 'POST',
    summary: 'Vote on idea',
    description: 'Upvote or downvote a trading idea. Toggles on repeat.',
    tags: ['Social'],
    auth: true,
  },

  // ── Chat ──────────────────────────────────────────────────────────
  {
    path: '/trpc/chat.listRooms',
    method: 'GET',
    summary: 'List chat rooms',
    description: 'Get all available chat rooms with member counts.',
    tags: ['Chat'],
    auth: false,
  },
  {
    path: '/trpc/chat.sendMessage',
    method: 'POST',
    summary: 'Send chat message',
    description: 'Send a message to a chat room. Checks reputation gates.',
    tags: ['Chat'],
    auth: true,
    input: {
      type: 'object',
      properties: {
        roomId: { type: 'string', format: 'uuid' },
        body: { type: 'string', minLength: 1, maxLength: 10000 },
        parentId: { type: 'string', format: 'uuid', description: 'Thread parent message ID' },
      },
      required: ['roomId', 'body'],
    },
  },

  // ── Moderation ────────────────────────────────────────────────────
  {
    path: '/trpc/moderation.reportContent',
    method: 'POST',
    summary: 'Report content',
    description: 'Report an idea, comment, or chat message for moderation review.',
    tags: ['Moderation'],
    auth: true,
    input: {
      type: 'object',
      properties: {
        contentType: { type: 'string', enum: ['idea', 'comment', 'chat_message', 'profile'] },
        contentId: { type: 'string', format: 'uuid' },
        authorId: { type: 'string' },
        reason: { type: 'string', enum: ['spam', 'harassment', 'hate_speech', 'misinformation', 'inappropriate', 'self_harm', 'other'] },
        description: { type: 'string', maxLength: 2000 },
      },
      required: ['contentType', 'contentId', 'authorId', 'reason'],
    },
  },
  {
    path: '/trpc/moderation.getModerationQueue',
    method: 'GET',
    summary: 'Get moderation queue (admin)',
    description: 'List flagged content items pending moderator review.',
    tags: ['Moderation'],
    auth: true,
  },
  {
    path: '/trpc/moderation.moderateItem',
    method: 'POST',
    summary: 'Moderate content (admin)',
    description: 'Take a moderation action on a flagged item: approve, reject, warn, mute, or ban.',
    tags: ['Moderation'],
    auth: true,
    input: {
      type: 'object',
      properties: {
        queueItemId: { type: 'string', format: 'uuid' },
        action: { type: 'string', enum: ['approve', 'reject', 'warn', 'mute', 'ban'] },
        note: { type: 'string', maxLength: 2000 },
      },
      required: ['queueItemId', 'action'],
    },
  },

  // ── Alerts ──────────────────────────────────────────────────────
  {
    path: '/trpc/alerts.list',
    method: 'GET',
    summary: 'List alerts',
    description: 'Get all alerts for the authenticated user.',
    tags: ['Alerts'],
    auth: true,
  },
  {
    path: '/trpc/alerts.create',
    method: 'POST',
    summary: 'Create alert',
    description: 'Create a new price or indicator alert.',
    tags: ['Alerts'],
    auth: true,
  },

  // ── Journal ────────────────────────────────────────────────────
  {
    path: '/trpc/journal.list',
    method: 'GET',
    summary: 'List journal entries',
    description: 'Get trade journal entries for the authenticated user.',
    tags: ['Journal'],
    auth: true,
  },

  // ── Leaderboards ──────────────────────────────────────────────
  {
    path: '/trpc/leaderboards.getRankings',
    method: 'GET',
    summary: 'Get leaderboard rankings',
    description: 'Get trader rankings by performance metric (Sharpe, win rate, PnL, profit factor).',
    tags: ['Social'],
    auth: false,
    input: {
      type: 'object',
      properties: {
        timeframe: { type: 'string', enum: ['7d', '30d', '90d', '1y', 'all'] },
        metric: { type: 'string', enum: ['sharpe', 'winRate', 'totalPnl', 'profitFactor'] },
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
      },
    },
  },
]

// ── Error Schemas ───────────────────────────────────────────────────────────

const ERROR_RESPONSES: Record<string, OpenAPIResponse> = {
  '400': {
    description: 'Bad Request — invalid input',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/TRPCError' },
        example: {
          error: {
            message: 'Validation error',
            code: 'BAD_REQUEST',
            data: { code: 'BAD_REQUEST', httpStatus: 400 },
          },
        },
      },
    },
  },
  '401': {
    description: 'Unauthorized — missing or invalid auth token',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/TRPCError' },
        example: {
          error: {
            message: 'Not authenticated',
            code: 'UNAUTHORIZED',
            data: { code: 'UNAUTHORIZED', httpStatus: 401 },
          },
        },
      },
    },
  },
  '403': {
    description: 'Forbidden — insufficient permissions or tier',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/TRPCError' },
        example: {
          error: {
            message: 'Upgrade to pro to access realtime-data',
            code: 'FORBIDDEN',
            data: { code: 'FORBIDDEN', httpStatus: 403 },
          },
        },
      },
    },
  },
  '429': {
    description: 'Too Many Requests — rate limit exceeded',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/TRPCError' },
        example: {
          error: {
            message: 'Rate limit exceeded. Try again in 30 seconds.',
            code: 'TOO_MANY_REQUESTS',
            data: { code: 'TOO_MANY_REQUESTS', httpStatus: 429 },
          },
        },
      },
    },
  },
  '500': {
    description: 'Internal Server Error',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/TRPCError' },
        example: {
          error: {
            message: 'Internal server error',
            code: 'INTERNAL_SERVER_ERROR',
            data: { code: 'INTERNAL_SERVER_ERROR', httpStatus: 500 },
          },
        },
      },
    },
  },
}

// ── Generator ───────────────────────────────────────────────────────────────

/**
 * Generate the OpenAPI 3.1 specification for the Marlin Traders API.
 */
export function generateOpenAPISpec(): OpenAPISpec {
  const paths: Record<string, OpenAPIPathItem> = {}

  for (const route of ROUTE_DOCS) {
    const method = route.method.toLowerCase()
    const operationId = route.path
      .replace('/trpc/', '')
      .replace(/\./g, '_')

    const operation: OpenAPIOperation = {
      operationId,
      summary: route.summary,
      description: route.description,
      tags: route.tags,
      responses: {
        '200': {
          description: 'Successful response',
          ...(route.output
            ? {
                content: {
                  'application/json': {
                    schema: route.output,
                    ...(route.outputExample ? { example: route.outputExample } : {}),
                  },
                },
              }
            : {}),
        },
        ...ERROR_RESPONSES,
      },
    }

    if (route.auth) {
      operation.security = [{ BearerAuth: [] }]
    }

    if (route.input) {
      if (route.method === 'GET') {
        // For GET, input goes as query parameter `input` (tRPC convention)
        operation.requestBody = undefined
      } else {
        operation.requestBody = {
          required: true,
          content: {
            'application/json': {
              schema: route.input,
              ...(route.inputExample ? { example: route.inputExample } : {}),
            },
          },
        }
      }
    }

    paths[route.path] = {
      ...paths[route.path],
      [method]: operation,
    }
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'The Marlin Traders API',
      description:
        'API for The Marlin Traders platform — charting, trading ideas, social features, ' +
        'paper trading, alerts, and more. All endpoints use tRPC over HTTP.',
      version: '0.1.0',
      contact: {
        name: 'Marlin Traders',
        url: 'https://themarlintraders.com',
      },
      license: {
        name: 'Proprietary',
        url: 'https://themarlintraders.com/terms',
      },
    },
    servers: [
      {
        url: 'https://api.themarlintraders.com',
        description: 'Production',
      },
      {
        url: 'http://localhost:3001',
        description: 'Local development',
      },
    ],
    paths,
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Clerk JWT token. Pass as `Authorization: Bearer <token>`.',
        },
      },
      schemas: {
        TRPCError: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                message: { type: 'string' },
                code: {
                  type: 'string',
                  enum: [
                    'BAD_REQUEST',
                    'UNAUTHORIZED',
                    'FORBIDDEN',
                    'NOT_FOUND',
                    'TOO_MANY_REQUESTS',
                    'INTERNAL_SERVER_ERROR',
                  ],
                },
                data: {
                  type: 'object',
                  properties: {
                    code: { type: 'string' },
                    httpStatus: { type: 'integer' },
                  },
                },
              },
            },
          },
        },
        Pagination: {
          type: 'object',
          description: 'Cursor-based pagination metadata',
          properties: {
            nextCursor: {
              type: 'string',
              format: 'uuid',
              description: 'Pass as cursor to get the next page. Null if no more items.',
            },
          },
        },
      },
    },
  }
}

/**
 * Serialize the OpenAPI spec to JSON.
 */
export function getOpenAPIJson(): string {
  return JSON.stringify(generateOpenAPISpec(), null, 2)
}
