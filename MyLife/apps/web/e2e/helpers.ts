import { expect, type Page } from '@playwright/test';

const NOTIFICATION_PATCH = Symbol.for('mylife.e2e.notificationPatch');

/**
 * Headless Chromium reports the legacy `Notification.permission` static as
 * 'denied' even when the context permission is granted (permissions.query
 * returns 'granted'). The reminders provider reads the static, so without
 * this patch its permission prompt renders over bottom-right action buttons
 * and intercepts clicks. Force the static to match the granted context.
 */
async function ensureNotificationPermissionPatch(page: Page): Promise<void> {
  const marked = page as Page & { [NOTIFICATION_PATCH]?: boolean };
  if (marked[NOTIFICATION_PATCH]) return;
  marked[NOTIFICATION_PATCH] = true;
  await page.addInitScript(() => {
    if (typeof Notification !== 'undefined') {
      Object.defineProperty(Notification, 'permission', {
        get: () => 'granted',
        configurable: true,
      });
    }
  });
}

export async function gotoWhenReady(page: Page, path: string) {
  await ensureNotificationPermissionPatch(page);
  let lastError: unknown;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const response = await page.goto(path, { timeout: 15_000, waitUntil: 'load' });
      if (response && response.status() >= 500) {
        throw new Error(`Navigation to ${path} returned ${response.status()}`);
      }
      return;
    } catch (error) {
      lastError = error;
      const message = String(error);
      const shouldRetry =
        message.includes('ERR_CONNECTION_REFUSED') ||
        message.includes('ECONNRESET') ||
        message.includes('ERR_ABORTED') ||
        message.includes('aborted') ||
        message.includes('Timeout') ||
        message.includes('returned 5');
      if (!shouldRetry) {
        throw error;
      }
      await page.waitForTimeout(2_000);
    }
  }

  throw lastError;
}

export async function ensureModuleEnabledFromDiscover(page: Page, moduleName: string) {
  await gotoWhenReady(page, '/discover');

  const moduleCard = page
    .getByTestId('discover-module-card')
    .filter({ has: page.getByRole('heading', { name: moduleName, exact: true }) })
    .first();
  await expect(moduleCard).toBeVisible();

  const toggle = moduleCard.getByRole('button', { name: /^(Enable|Enabled)$/ });
  const label = (await toggle.innerText()).trim();
  if (label === 'Enable') {
    await toggle.click();
    const consentButton = page.getByRole('button', { name: 'I Consent' });
    if (await consentButton.isVisible().catch(() => false)) {
      await consentButton.click();
    }
  }
  await expect(toggle).toHaveText('Enabled');
}
