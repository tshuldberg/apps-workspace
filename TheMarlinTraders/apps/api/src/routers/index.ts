import { z } from 'zod'
import { router, publicProcedure } from '../trpc.js'
import { marketRouter } from './market.js'
import { watchlistRouter } from './watchlists.js'
import { searchRouter } from './search.js'
import { alertsRouter } from './alerts.js'
import { paperTradingRouter } from './paper-trading.js'
import { layoutRouter } from './layouts.js'
import { screenerRouter } from './screener.js'
import { drawingsRouter } from './drawings.js'
import { optionsRouter } from './options.js'
import { journalRouter } from './journal.js'
import { heatmapRouter } from './heatmap.js'
import { performanceRouter } from './performance.js'
import { ideasRouter } from './ideas.js'
import { profilesRouter } from './profiles.js'
import { leaderboardsRouter } from './leaderboards.js'
import { chatRouter } from './chat.js'
import { newsRouter } from './news.js'

export const appRouter = router({
  health: publicProcedure.query(() => ({
    status: 'ok' as const,
    timestamp: new Date().toISOString(),
    version: '0.0.0',
  })),

  ping: publicProcedure.input(z.object({ message: z.string() })).query(({ input }) => ({
    pong: input.message,
    timestamp: new Date().toISOString(),
  })),

  market: marketRouter,
  watchlist: watchlistRouter,
  search: searchRouter,
  alerts: alertsRouter,
  paperTrading: paperTradingRouter,
  layout: layoutRouter,
  screener: screenerRouter,
  drawings: drawingsRouter,
  options: optionsRouter,
  journal: journalRouter,
  heatmap: heatmapRouter,
  performance: performanceRouter,
  ideas: ideasRouter,
  profiles: profilesRouter,
  leaderboards: leaderboardsRouter,
  chat: chatRouter,
  news: newsRouter,
})

export type AppRouter = typeof appRouter
