import type { SerializedDockview } from 'dockview-react'

export interface LayoutPreset {
  id: string
  name: string
  description: string
  shortcut?: string
  layout: SerializedDockview
}

/** Single full-screen chart */
const singleChart: SerializedDockview = {
  grid: {
    root: {
      type: 'branch',
      data: [
        {
          type: 'leaf',
          data: {
            views: ['chart-1'],
            activeView: 'chart-1',
            id: 'group-1',
          },
          size: 100,
        },
      ],
      size: 100,
    },
    width: 1200,
    height: 800,
    orientation: 'HORIZONTAL',
  },
  panels: {
    'chart-1': {
      id: 'chart-1',
      contentComponent: 'chart',
      title: 'AAPL',
      params: { symbol: 'AAPL' },
    },
  },
  activeGroup: 'group-1',
}

/** Two charts side by side (2x1) */
const twoByOne: SerializedDockview = {
  grid: {
    root: {
      type: 'branch',
      data: [
        {
          type: 'leaf',
          data: {
            views: ['chart-1'],
            activeView: 'chart-1',
            id: 'group-1',
          },
          size: 50,
        },
        {
          type: 'leaf',
          data: {
            views: ['chart-2'],
            activeView: 'chart-2',
            id: 'group-2',
          },
          size: 50,
        },
      ],
      size: 100,
    },
    width: 1200,
    height: 800,
    orientation: 'HORIZONTAL',
  },
  panels: {
    'chart-1': {
      id: 'chart-1',
      contentComponent: 'chart',
      title: 'AAPL',
      params: { symbol: 'AAPL' },
    },
    'chart-2': {
      id: 'chart-2',
      contentComponent: 'chart',
      title: 'MSFT',
      params: { symbol: 'MSFT' },
    },
  },
  activeGroup: 'group-1',
}

/** 2x2 grid of charts */
const twoByTwo: SerializedDockview = {
  grid: {
    root: {
      type: 'branch',
      data: [
        {
          type: 'branch',
          data: [
            {
              type: 'leaf',
              data: {
                views: ['chart-1'],
                activeView: 'chart-1',
                id: 'group-1',
              },
              size: 50,
            },
            {
              type: 'leaf',
              data: {
                views: ['chart-2'],
                activeView: 'chart-2',
                id: 'group-2',
              },
              size: 50,
            },
          ],
          size: 50,
        },
        {
          type: 'branch',
          data: [
            {
              type: 'leaf',
              data: {
                views: ['chart-3'],
                activeView: 'chart-3',
                id: 'group-3',
              },
              size: 50,
            },
            {
              type: 'leaf',
              data: {
                views: ['chart-4'],
                activeView: 'chart-4',
                id: 'group-4',
              },
              size: 50,
            },
          ],
          size: 50,
        },
      ],
      size: 100,
    },
    width: 1200,
    height: 800,
    orientation: 'VERTICAL',
  },
  panels: {
    'chart-1': {
      id: 'chart-1',
      contentComponent: 'chart',
      title: 'AAPL',
      params: { symbol: 'AAPL' },
    },
    'chart-2': {
      id: 'chart-2',
      contentComponent: 'chart',
      title: 'MSFT',
      params: { symbol: 'MSFT' },
    },
    'chart-3': {
      id: 'chart-3',
      contentComponent: 'chart',
      title: 'GOOGL',
      params: { symbol: 'GOOGL' },
    },
    'chart-4': {
      id: 'chart-4',
      contentComponent: 'chart',
      title: 'AMZN',
      params: { symbol: 'AMZN' },
    },
  },
  activeGroup: 'group-1',
}

/** 3x2 grid — large chart top-left, watchlist top-right, 3 charts bottom */
const threeByTwo: SerializedDockview = {
  grid: {
    root: {
      type: 'branch',
      data: [
        {
          type: 'branch',
          data: [
            {
              type: 'leaf',
              data: {
                views: ['chart-1'],
                activeView: 'chart-1',
                id: 'group-1',
              },
              size: 70,
            },
            {
              type: 'leaf',
              data: {
                views: ['watchlist-1', 'order-entry-1'],
                activeView: 'watchlist-1',
                id: 'group-2',
              },
              size: 30,
            },
          ],
          size: 60,
        },
        {
          type: 'branch',
          data: [
            {
              type: 'leaf',
              data: {
                views: ['chart-2'],
                activeView: 'chart-2',
                id: 'group-3',
              },
              size: 33,
            },
            {
              type: 'leaf',
              data: {
                views: ['chart-3'],
                activeView: 'chart-3',
                id: 'group-4',
              },
              size: 34,
            },
            {
              type: 'leaf',
              data: {
                views: ['chart-4'],
                activeView: 'chart-4',
                id: 'group-5',
              },
              size: 33,
            },
          ],
          size: 40,
        },
      ],
      size: 100,
    },
    width: 1200,
    height: 800,
    orientation: 'VERTICAL',
  },
  panels: {
    'chart-1': {
      id: 'chart-1',
      contentComponent: 'chart',
      title: 'AAPL',
      params: { symbol: 'AAPL' },
    },
    'watchlist-1': {
      id: 'watchlist-1',
      contentComponent: 'watchlist',
      title: 'Watchlist',
      params: {},
    },
    'order-entry-1': {
      id: 'order-entry-1',
      contentComponent: 'order-entry',
      title: 'Order Entry',
      params: {},
    },
    'chart-2': {
      id: 'chart-2',
      contentComponent: 'chart',
      title: 'MSFT',
      params: { symbol: 'MSFT' },
    },
    'chart-3': {
      id: 'chart-3',
      contentComponent: 'chart',
      title: 'GOOGL',
      params: { symbol: 'GOOGL' },
    },
    'chart-4': {
      id: 'chart-4',
      contentComponent: 'chart',
      title: 'AMZN',
      params: { symbol: 'AMZN' },
    },
  },
  activeGroup: 'group-1',
}

/** Custom — single chart with watchlist and order entry sidebar */
const custom: SerializedDockview = {
  grid: {
    root: {
      type: 'branch',
      data: [
        {
          type: 'leaf',
          data: {
            views: ['chart-1'],
            activeView: 'chart-1',
            id: 'group-1',
          },
          size: 70,
        },
        {
          type: 'branch',
          data: [
            {
              type: 'leaf',
              data: {
                views: ['watchlist-1'],
                activeView: 'watchlist-1',
                id: 'group-2',
              },
              size: 50,
            },
            {
              type: 'leaf',
              data: {
                views: ['order-entry-1'],
                activeView: 'order-entry-1',
                id: 'group-3',
              },
              size: 50,
            },
          ],
          size: 30,
        },
      ],
      size: 100,
    },
    width: 1200,
    height: 800,
    orientation: 'HORIZONTAL',
  },
  panels: {
    'chart-1': {
      id: 'chart-1',
      contentComponent: 'chart',
      title: 'AAPL',
      params: { symbol: 'AAPL' },
    },
    'watchlist-1': {
      id: 'watchlist-1',
      contentComponent: 'watchlist',
      title: 'Watchlist',
      params: {},
    },
    'order-entry-1': {
      id: 'order-entry-1',
      contentComponent: 'order-entry',
      title: 'Order Entry',
      params: {},
    },
  },
  activeGroup: 'group-1',
}

export const LAYOUT_PRESETS: LayoutPreset[] = [
  {
    id: 'single',
    name: 'Single Chart',
    description: 'Full-screen single chart view',
    shortcut: 'Cmd+1',
    layout: singleChart,
  },
  {
    id: '2x1',
    name: '2x1 Split',
    description: 'Two charts side by side',
    shortcut: 'Cmd+2',
    layout: twoByOne,
  },
  {
    id: '2x2',
    name: '2x2 Grid',
    description: 'Four charts in a grid',
    shortcut: 'Cmd+3',
    layout: twoByTwo,
  },
  {
    id: '3x2',
    name: '3x2 Pro',
    description: 'Main chart with watchlist, order entry, and 3 sub-charts',
    shortcut: 'Cmd+4',
    layout: threeByTwo,
  },
  {
    id: 'custom',
    name: 'Custom',
    description: 'Chart with sidebar panels',
    shortcut: 'Cmd+5',
    layout: custom,
  },
]

export function getPresetById(id: string): LayoutPreset | undefined {
  return LAYOUT_PRESETS.find((p) => p.id === id)
}
