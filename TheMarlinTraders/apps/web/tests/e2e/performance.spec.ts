import { test, expect } from '@playwright/test'

test.describe('Performance', () => {
  test('chart page initial load under 3 seconds', async ({ page }) => {
    const start = Date.now()
    await page.goto('/chart/AAPL')
    await expect(page.locator('text=AAPL')).toBeVisible({ timeout: 10_000 })
    const loadTime = Date.now() - start
    expect(loadTime).toBeLessThan(3_000)
  })

  test('timeframe switch responds under 500ms', async ({ page }) => {
    await page.goto('/chart/AAPL')
    await expect(page.locator('text=AAPL')).toBeVisible({ timeout: 10_000 })

    // Wait for initial chart to settle
    await page.waitForTimeout(500)

    const start = Date.now()
    await page.locator('button:has-text("1h")').click()
    // Wait for the button to reflect the active state
    await expect(page.locator('button:has-text("1h")')).toHaveClass(/bg-accent/, {
      timeout: 500,
    })
    const switchTime = Date.now() - start
    expect(switchTime).toBeLessThan(500)
  })

  test('command palette opens under 200ms', async ({ page }) => {
    await page.goto('/chart/AAPL')
    await expect(page.locator('text=AAPL')).toBeVisible({ timeout: 10_000 })

    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control'
    const start = Date.now()
    await page.keyboard.press(`${modifier}+k`)
    const palette = page.locator('[cmdk-root], [data-command-palette]')
    await expect(palette.first()).toBeVisible({ timeout: 1_000 })
    const openTime = Date.now() - start
    expect(openTime).toBeLessThan(200)
  })

  test('no layout shift during chart load', async ({ page }) => {
    await page.goto('/chart/AAPL')
    await expect(page.locator('text=AAPL')).toBeVisible({ timeout: 10_000 })

    // Measure CLS via Performance Observer
    const cls = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let cumulativeScore = 0
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!(entry as PerformanceEntry & { hadRecentInput: boolean }).hadRecentInput) {
              cumulativeScore += (entry as PerformanceEntry & { value: number }).value
            }
          }
        })
        observer.observe({ type: 'layout-shift', buffered: true })
        // Give it a moment to collect buffered entries
        setTimeout(() => {
          observer.disconnect()
          resolve(cumulativeScore)
        }, 1000)
      })
    })

    expect(cls).toBeLessThan(0.1)
  })
})
