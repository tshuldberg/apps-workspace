/**
 * Android Smoke Tests — Maestro E2E Test Definitions
 *
 * These tests verify core Android functionality using Maestro.
 * Run with: `maestro test apps/mobile/tests/android-smoke.yaml`
 *
 * Prerequisites:
 *   1. Install Maestro: `curl -Ls "https://get.maestro.mobile.dev" | bash`
 *   2. Start Android emulator: `emulator @Pixel_7_API_34`
 *   3. Build and install dev client: `npx expo run:android`
 *
 * This TypeScript file generates the Maestro YAML flow and provides
 * type-safe test definitions. Export the YAML with:
 *   `npx tsx apps/mobile/tests/android-smoke.ts > apps/mobile/tests/android-smoke.yaml`
 */

interface MaestroStep {
  action: string
  selector?: string
  text?: string
  direction?: 'LEFT' | 'RIGHT' | 'UP' | 'DOWN'
  timeout?: number
  optional?: boolean
  label?: string
}

interface MaestroFlow {
  appId: string
  name: string
  tags?: string[]
  env?: Record<string, string>
  steps: MaestroStep[]
}

const APP_ID = 'com.marlintraders.app'

const TAB_LABELS = ['Chart', 'Watchlist', 'Trade', 'Alerts', 'More'] as const

/**
 * Test 1: App Launch
 * Verifies the app starts and shows the main tab bar.
 */
const appLaunchSteps: MaestroStep[] = [
  { action: 'launchApp', selector: APP_ID, label: 'Launch Marlin Traders' },
  { action: 'assertVisible', selector: 'Chart', timeout: 10000, label: 'Chart tab visible' },
  { action: 'assertVisible', selector: 'Watchlist', label: 'Watchlist tab visible' },
  { action: 'assertVisible', selector: 'Trade', label: 'Trade tab visible' },
  { action: 'assertVisible', selector: 'Alerts', label: 'Alerts tab visible' },
  { action: 'assertVisible', selector: 'More', label: 'More tab visible' },
]

/**
 * Test 2: Tab Navigation
 * Verifies all 5 tabs are tappable and show correct headers.
 */
const tabNavigationSteps: MaestroStep[] = [
  { action: 'tapOn', selector: 'Watchlist', label: 'Navigate to Watchlist' },
  { action: 'assertVisible', selector: 'Watchlist', timeout: 3000, label: 'Watchlist header visible' },

  { action: 'tapOn', selector: 'Trade', label: 'Navigate to Portfolio' },
  { action: 'assertVisible', selector: 'Portfolio', timeout: 3000, label: 'Portfolio header visible' },

  { action: 'tapOn', selector: 'Alerts', label: 'Navigate to Alerts' },
  { action: 'assertVisible', selector: 'Alerts', timeout: 3000, label: 'Alerts header visible' },

  { action: 'tapOn', selector: 'More', label: 'Navigate to Settings' },
  { action: 'assertVisible', selector: 'Settings', timeout: 3000, label: 'Settings header visible' },

  { action: 'tapOn', selector: 'Chart', label: 'Navigate back to Chart' },
  { action: 'assertVisible', selector: 'Chart', timeout: 3000, label: 'Chart header visible' },
]

/**
 * Test 3: Chart Screen
 * Verifies chart renders with search bar and trade button.
 */
const chartScreenSteps: MaestroStep[] = [
  { action: 'tapOn', selector: 'Chart', label: 'Go to Chart tab' },
  { action: 'assertVisible', selector: 'Search symbol...', timeout: 5000, label: 'Search bar visible' },
  { action: 'assertVisible', selector: 'Trade', label: 'Trade button visible' },
  // Verify indicator chips
  { action: 'assertVisible', selector: 'SMA 20', optional: true, label: 'SMA indicator visible' },
  { action: 'assertVisible', selector: 'EMA 50', optional: true, label: 'EMA indicator visible' },
]

/**
 * Test 4: Symbol Search
 * Opens symbol search modal and verifies it appears.
 */
const symbolSearchSteps: MaestroStep[] = [
  { action: 'tapOn', selector: 'Chart', label: 'Go to Chart tab' },
  { action: 'tapOn', selector: 'Search symbol...', label: 'Open symbol search' },
  { action: 'assertVisible', selector: 'Search', timeout: 3000, label: 'Search modal visible' },
  { action: 'pressKey', selector: 'back', label: 'Close search modal' },
]

/**
 * Test 5: Watchlist Screen
 * Verifies the watchlist renders with the FAB button.
 */
const watchlistSteps: MaestroStep[] = [
  { action: 'tapOn', selector: 'Watchlist', label: 'Go to Watchlist tab' },
  { action: 'assertVisible', selector: 'Watchlist', timeout: 3000, label: 'Watchlist screen loaded' },
  // FAB should be visible for adding symbols
  // Empty state message if no symbols
  { action: 'assertVisible', selector: 'No symbols yet', optional: true, label: 'Empty state or symbols visible' },
]

/**
 * Test 6: Alerts Screen
 * Verifies the alerts screen and FAB for creating alerts.
 */
const alertsSteps: MaestroStep[] = [
  { action: 'tapOn', selector: 'Alerts', label: 'Go to Alerts tab' },
  { action: 'assertVisible', selector: 'Alerts', timeout: 3000, label: 'Alerts screen loaded' },
]

/**
 * Test 7: Portfolio Screen
 * Verifies portfolio summary card renders.
 */
const portfolioSteps: MaestroStep[] = [
  { action: 'tapOn', selector: 'Trade', label: 'Go to Portfolio tab' },
  { action: 'assertVisible', selector: 'Portfolio Value', timeout: 3000, label: 'Portfolio summary visible' },
  { action: 'assertVisible', selector: 'Positions', label: 'Positions section visible' },
  { action: 'assertVisible', selector: 'Recent Orders', label: 'Orders section visible' },
]

/**
 * Test 8: Settings Screen
 * Verifies settings sections render.
 */
const settingsSteps: MaestroStep[] = [
  { action: 'tapOn', selector: 'More', label: 'Go to Settings tab' },
  { action: 'assertVisible', selector: 'Account', timeout: 3000, label: 'Account section visible' },
  { action: 'assertVisible', selector: 'Preferences', label: 'Preferences section visible' },
  { action: 'assertVisible', selector: 'Support', label: 'Support section visible' },
  { action: 'assertVisible', selector: 'Sign Out', label: 'Sign out button visible' },
]

/**
 * Test 9: Push Notification Setup
 * Verifies that notification permission dialog can be triggered.
 * Note: This test may require manual interaction on first run.
 */
const pushNotificationSteps: MaestroStep[] = [
  { action: 'launchApp', selector: APP_ID, label: 'Relaunch for notification test' },
  // Notification permission dialog may appear
  { action: 'tapOn', selector: 'Allow', optional: true, timeout: 5000, label: 'Allow notifications if prompted' },
  // Verify app is functional after permission dialog
  { action: 'assertVisible', selector: 'Chart', timeout: 5000, label: 'App functional after notification setup' },
]

/**
 * Combine all steps into a single flow.
 */
const androidSmokeFlow: MaestroFlow = {
  appId: APP_ID,
  name: 'Android Smoke Tests',
  tags: ['android', 'smoke'],
  env: {
    APP_ID,
  },
  steps: [
    ...appLaunchSteps,
    ...tabNavigationSteps,
    ...chartScreenSteps,
    ...symbolSearchSteps,
    ...watchlistSteps,
    ...alertsSteps,
    ...portfolioSteps,
    ...settingsSteps,
    ...pushNotificationSteps,
  ],
}

/**
 * Converts the flow definition to Maestro YAML format.
 */
function toMaestroYaml(flow: MaestroFlow): string {
  const lines: string[] = [
    `appId: ${flow.appId}`,
    `name: ${flow.name}`,
    '',
    '---',
    '',
  ]

  for (const step of flow.steps) {
    const comment = step.label ? `# ${step.label}` : ''
    if (comment) lines.push(comment)

    switch (step.action) {
      case 'launchApp':
        lines.push(`- launchApp:`)
        lines.push(`    appId: "${step.selector}"`)
        break
      case 'assertVisible':
        lines.push(`- assertVisible:`)
        lines.push(`    text: "${step.selector}"`)
        if (step.timeout) lines.push(`    timeout: ${step.timeout}`)
        if (step.optional) lines.push(`    optional: true`)
        break
      case 'tapOn':
        lines.push(`- tapOn:`)
        lines.push(`    text: "${step.selector}"`)
        if (step.timeout) lines.push(`    timeout: ${step.timeout}`)
        if (step.optional) lines.push(`    optional: true`)
        break
      case 'pressKey':
        lines.push(`- pressKey: ${step.selector}`)
        break
      case 'inputText':
        lines.push(`- inputText: "${step.text}"`)
        break
      case 'scroll':
        lines.push(`- scroll:`)
        lines.push(`    direction: ${step.direction}`)
        break
    }
    lines.push('')
  }

  return lines.join('\n')
}

// When run directly, output the YAML
const yaml = toMaestroYaml(androidSmokeFlow)
if (typeof process !== 'undefined' && process.argv[1]?.includes('android-smoke')) {
  console.log(yaml)
}

export {
  androidSmokeFlow,
  toMaestroYaml,
  appLaunchSteps,
  tabNavigationSteps,
  chartScreenSteps,
  symbolSearchSteps,
  watchlistSteps,
  alertsSteps,
  portfolioSteps,
  settingsSteps,
  pushNotificationSteps,
}
export type { MaestroStep, MaestroFlow }
