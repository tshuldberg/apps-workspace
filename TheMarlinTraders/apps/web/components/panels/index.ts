import type { ComponentType } from 'react'
import type { IDockviewPanelProps } from 'dockview-react'
import { ChartPanel } from './chart-panel.js'
import { WatchlistPanelWrapper } from './watchlist-panel-wrapper.js'
import { OrderEntryPanel } from './order-entry-panel.js'
import { NewsFeedPanel } from './news-feed-panel.js'

export type PanelType = 'chart' | 'watchlist' | 'order-entry' | 'news-feed'

export interface PanelRegistryEntry {
  component: ComponentType<IDockviewPanelProps<Record<string, unknown>>>
  defaultTitle: string
}

export const PANEL_REGISTRY: Record<PanelType, PanelRegistryEntry> = {
  chart: {
    component: ChartPanel as ComponentType<IDockviewPanelProps<Record<string, unknown>>>,
    defaultTitle: 'Chart',
  },
  watchlist: {
    component: WatchlistPanelWrapper as ComponentType<IDockviewPanelProps<Record<string, unknown>>>,
    defaultTitle: 'Watchlist',
  },
  'order-entry': {
    component: OrderEntryPanel as ComponentType<IDockviewPanelProps<Record<string, unknown>>>,
    defaultTitle: 'Order Entry',
  },
  'news-feed': {
    component: NewsFeedPanel as ComponentType<IDockviewPanelProps<Record<string, unknown>>>,
    defaultTitle: 'News Feed',
  },
}

export { ChartPanel } from './chart-panel.js'
export { WatchlistPanelWrapper } from './watchlist-panel-wrapper.js'
export { OrderEntryPanel } from './order-entry-panel.js'
export { NewsFeedPanel } from './news-feed-panel.js'
