export interface Keybinding {
  id: string
  label: string
  category: 'timeframe' | 'navigation' | 'drawing' | 'general' | 'trading'
  keys: string
  description: string
}

export const KEYBINDING_CATEGORIES = [
  { id: 'timeframe', label: 'Timeframes' },
  { id: 'navigation', label: 'Panel Navigation' },
  { id: 'drawing', label: 'Drawing Tools' },
  { id: 'general', label: 'General' },
  { id: 'trading', label: 'Trading' },
] as const

export type KeybindingCategory = (typeof KEYBINDING_CATEGORIES)[number]['id']

export const DEFAULT_KEYBINDINGS: Keybinding[] = [
  // Timeframes
  { id: 'tf-1m', label: '1 Minute', category: 'timeframe', keys: '1', description: 'Switch to 1-minute timeframe' },
  { id: 'tf-5m', label: '5 Minutes', category: 'timeframe', keys: '2', description: 'Switch to 5-minute timeframe' },
  { id: 'tf-15m', label: '15 Minutes', category: 'timeframe', keys: '3', description: 'Switch to 15-minute timeframe' },
  { id: 'tf-1h', label: '1 Hour', category: 'timeframe', keys: '4', description: 'Switch to 1-hour timeframe' },
  { id: 'tf-4h', label: '4 Hours', category: 'timeframe', keys: '5', description: 'Switch to 4-hour timeframe' },
  { id: 'tf-1d', label: '1 Day', category: 'timeframe', keys: '6', description: 'Switch to daily timeframe' },
  { id: 'tf-1w', label: '1 Week', category: 'timeframe', keys: '7', description: 'Switch to weekly timeframe' },
  { id: 'tf-1mo', label: '1 Month', category: 'timeframe', keys: '8', description: 'Switch to monthly timeframe' },

  // Panel navigation
  { id: 'nav-chart', label: 'Focus Chart', category: 'navigation', keys: 'ctrl+1', description: 'Focus the chart panel' },
  { id: 'nav-watchlist', label: 'Focus Watchlist', category: 'navigation', keys: 'ctrl+2', description: 'Focus the watchlist panel' },
  { id: 'nav-order-entry', label: 'Focus Order Entry', category: 'navigation', keys: 'ctrl+3', description: 'Focus the order entry panel' },
  { id: 'nav-positions', label: 'Focus Positions', category: 'navigation', keys: 'ctrl+4', description: 'Focus the positions panel' },
  { id: 'nav-alerts', label: 'Focus Alerts', category: 'navigation', keys: 'ctrl+5', description: 'Focus the alerts panel' },
  { id: 'nav-screener', label: 'Focus Screener', category: 'navigation', keys: 'ctrl+6', description: 'Focus the screener panel' },

  // Drawing tools (sequences: D then <key>)
  { id: 'draw-trendline', label: 'Trendline', category: 'drawing', keys: 'd t', description: 'Activate trendline drawing tool' },
  { id: 'draw-horizontal', label: 'Horizontal Line', category: 'drawing', keys: 'd h', description: 'Activate horizontal line drawing tool' },
  { id: 'draw-vertical', label: 'Vertical Line', category: 'drawing', keys: 'd v', description: 'Activate vertical line drawing tool' },
  { id: 'draw-fibonacci', label: 'Fibonacci Retracement', category: 'drawing', keys: 'd f', description: 'Activate Fibonacci retracement tool' },
  { id: 'draw-rectangle', label: 'Rectangle', category: 'drawing', keys: 'd r', description: 'Activate rectangle drawing tool' },
  { id: 'draw-cancel', label: 'Cancel Drawing', category: 'drawing', keys: 'escape', description: 'Cancel active drawing mode' },

  // General
  { id: 'cmd-palette', label: 'Command Palette', category: 'general', keys: 'mod+k', description: 'Open command palette / symbol search' },
  { id: 'save-layout', label: 'Save Layout', category: 'general', keys: 'mod+s', description: 'Save current workspace layout' },
  { id: 'save-layout-as', label: 'Save Layout As', category: 'general', keys: 'mod+shift+s', description: 'Save workspace layout with a new name' },
  { id: 'toggle-sidebar', label: 'Toggle Sidebar', category: 'general', keys: 'mod+/', description: 'Show or hide the sidebar' },
  { id: 'fullscreen', label: 'Fullscreen', category: 'general', keys: 'f11', description: 'Toggle fullscreen mode' },
  { id: 'close-modal', label: 'Close Modal', category: 'general', keys: 'escape', description: 'Close the current modal or panel' },

  // Trading
  { id: 'buy-order', label: 'Buy Order', category: 'trading', keys: 'b', description: 'Open buy order entry' },
  { id: 'sell-order', label: 'Sell Order', category: 'trading', keys: 's', description: 'Open sell order entry' },
  { id: 'submit-order', label: 'Submit Order', category: 'trading', keys: 'mod+enter', description: 'Submit the current order' },
]
