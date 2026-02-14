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
import { optionsFlowRouter } from './options-flow.js'
import { journalRouter } from './journal.js'
import { heatmapRouter } from './heatmap.js'
import { performanceRouter } from './performance.js'
import { ideasRouter } from './ideas.js'
import { profilesRouter } from './profiles.js'
import { leaderboardsRouter } from './leaderboards.js'
import { chatRouter } from './chat.js'
import { newsRouter } from './news.js'
import { brokerRouter } from './broker.js'
import { multiAssetRouter } from './multi-asset.js'
import { advancedOrdersRouter } from './advanced-orders.js'
import { aiAnalysisRouter } from './ai-analysis.js'
import { moderationRouter } from './moderation.js'
import { futuresRouter } from './futures.js'
import { strategyRouter } from './strategy.js'
import { strategyDeployRouter } from './strategy-deploy.js'
import { backtestRouter } from './backtest.js'
import { mlRouter } from './ml.js'

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
  optionsFlow: optionsFlowRouter,
  journal: journalRouter,
  heatmap: heatmapRouter,
  performance: performanceRouter,
  ideas: ideasRouter,
  profiles: profilesRouter,
  leaderboards: leaderboardsRouter,
  chat: chatRouter,
  news: newsRouter,
  broker: brokerRouter,
  multiAsset: multiAssetRouter,
  advancedOrders: advancedOrdersRouter,
  aiAnalysis: aiAnalysisRouter,
  moderation: moderationRouter,
  futures: futuresRouter,
  strategy: strategyRouter,
  strategyDeploy: strategyDeployRouter,
  backtest: backtestRouter,
  ml: mlRouter,
})

export type AppRouter = typeof appRouter
