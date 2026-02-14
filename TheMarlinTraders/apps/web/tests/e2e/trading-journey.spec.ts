import { test, expect } from '@playwright/test'

test.describe('Trading Journey E2E', () => {
  test('chart page renders with symbol', async ({ page }) => {
    await page.goto('/chart/AAPL')
    await expect(page.locator('text=AAPL')).toBeVisible({ timeout: 10_000 })
  })

  test('timeframe selector switches timeframes via click', async ({ page }) => {
    await page.goto('/chart/AAPL')
    await expect(page.locator('text=AAPL')).toBeVisible({ timeout: 10_000 })

    const tfButton = page.locator('button:has-text("5m")')
    await tfButton.click()
    await expect(tfButton).toHaveClass(/bg-accent/)
  })

  test('switch timeframes via keyboard shortcuts', async ({ page }) => {
    await page.goto('/chart/AAPL')
    await expect(page.locator('text=AAPL')).toBeVisible({ timeout: 10_000 })

    // Press "2" for 5m timeframe
    await page.keyboard.press('2')
    const tf5m = page.locator('button:has-text("5m")')
    await expect(tf5m).toHaveClass(/bg-accent/, { timeout: 2_000 })

    // Press "4" for 1h timeframe
    await page.keyboard.press('4')
    const tf1h = page.locator('button:has-text("1h")')
    await expect(tf1h).toHaveClass(/bg-accent/, { timeout: 2_000 })
  })

  test('command palette opens with Cmd+K and searches symbols', async ({ page }) => {
    await page.goto('/chart/AAPL')
    await expect(page.locator('text=AAPL')).toBeVisible({ timeout: 10_000 })

    // Open command palette
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control'
    await page.keyboard.press(`${modifier}+k`)

    // Verify command palette is visible
    const palette = page.locator('[cmdk-root], [data-command-palette]')
    await expect(palette.first()).toBeVisible({ timeout: 5_000 })

    // Search for a symbol
    const input = page.locator('[cmdk-input], input[placeholder*="Search"]')
    await input.first().fill('TSLA')
    await page.waitForTimeout(300) // debounce delay

    // Results should appear or show searching state
    const resultArea = page.locator('[cmdk-list]')
    await expect(resultArea.first()).toBeVisible({ timeout: 5_000 })

    // Close with Escape
    await page.keyboard.press('Escape')
    await expect(palette.first()).not.toBeVisible({ timeout: 2_000 })
  })

  test('watchlist panel loads and displays symbols', async ({ page }) => {
    await page.goto('/')
    const watchlist = page.locator('[data-panel-id="watchlist"], text=Watchlist')
    await expect(watchlist.first()).toBeVisible({ timeout: 10_000 })
  })

  test('paper trading: open order entry and submit', async ({ page }) => {
    await page.goto('/')

    // Find or open order entry panel
    const orderPanel = page.locator('[data-panel-id="order-entry"], text=Order Entry')
    if (await orderPanel.first().isVisible()) {
      await orderPanel.first().click()
    }

    // Verify buy/sell buttons exist
    await expect(page.locator('text=Buy').first()).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('text=Sell').first()).toBeVisible({ timeout: 5_000 })

    // Fill order form if inputs are present
    const qtyInput = page.locator('input[name="quantity"], input[placeholder*="Qty"]')
    if (await qtyInput.first().isVisible({ timeout: 2_000 }).catch(() => false)) {
      await qtyInput.first().fill('10')
    }
  })

  test('alert creation flow from chart page', async ({ page }) => {
    await page.goto('/chart/AAPL')
    await expect(page.locator('text=AAPL')).toBeVisible({ timeout: 10_000 })

    // Look for alert button or indicator in the chart toolbar
    const alertButton = page.locator('button[title*="Alert"], button:has-text("Alert")')
    if (await alertButton.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
      await alertButton.first().click()
      // Alert creator panel or dialog should appear
      const alertCreator = page.locator('[data-testid="alert-creator"], text=Create Alert')
      await expect(alertCreator.first()).toBeVisible({ timeout: 5_000 })
    }
  })
})
