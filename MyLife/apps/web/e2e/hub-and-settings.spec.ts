import { expect, test, type Locator, type Page } from '@playwright/test';
import { ensureModuleEnabledFromDiscover, gotoWhenReady } from './helpers';

async function canSee(locator: Locator, timeout = 1_000) {
  try {
    await expect(locator).toBeVisible({ timeout });
    return true;
  } catch {
    return false;
  }
}

function getDashboardHeading(page: Page) {
  return page.getByRole('heading', { name: /Dashboard|Morning|Afternoon|Evening/ });
}

async function clickOnboardingMode(page: Page, buttonName: string) {
  const button = page.getByRole('button', { name: buttonName });
  await expect(button).toBeEnabled();
  await button.click();
  await Promise.race([
    page
      .waitForURL((url) => !url.pathname.endsWith('/onboarding/mode'), { timeout: 5_000 })
      .catch(() => undefined),
    page.waitForTimeout(5_000),
  ]);
}

async function completeOnboardingIfNeeded(page: Page) {
  await gotoWhenReady(page, '/');

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const dashboardHeading = getDashboardHeading(page);
    if (await canSee(dashboardHeading, 5_000)) {
      return;
    }

    if (await canSee(page.getByRole('heading', { name: 'Our pledge to you' }))) {
      await Promise.all([
        page.waitForURL(/\/onboarding\/goal/, { timeout: 20_000 }),
        page.getByRole('button', { name: 'I accept' }).click(),
      ]);
      continue;
    }

    if (await canSee(page.getByRole('heading', { name: 'What matters to you?' }), 5_000)) {
      await page.getByRole('button', { name: /Learning & reading/ }).click();
      const continueButton = page.getByRole('button', { name: 'Continue' });
      await expect(continueButton).toBeEnabled();
      await Promise.all([
        page.waitForURL(/\/onboarding\/kit/, { timeout: 20_000 }),
        continueButton.click(),
      ]);
      continue;
    }

    if (await canSee(page.getByRole('heading', { name: 'Your starter kit' }), 5_000)) {
      await Promise.all([
        page.waitForURL((url) => !url.pathname.startsWith('/onboarding/kit'), { timeout: 20_000 }),
        page.getByRole('button', { name: 'Start' }).click(),
      ]);
      await gotoWhenReady(page, '/');
      continue;
    }

    if (page.url().includes('/onboarding/mode')) {
      await clickOnboardingMode(page, 'Use Local-Only');
      await gotoWhenReady(page, '/');
      continue;
    }

    await gotoWhenReady(page, '/');
    await page.waitForTimeout(1_000);
  }

  throw new Error(`Onboarding did not reach the dashboard. Current URL: ${page.url()}`);
}

async function chooseSelfHostMode(page: Page, serverUrl: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await gotoWhenReady(page, '/onboarding/mode');
    const serverInput = page.getByPlaceholder('https://home.example.com');
    await expect(serverInput).toBeVisible();
    await serverInput.fill(serverUrl);
    await clickOnboardingMode(page, 'Use Self-Host');

    await gotoWhenReady(page, '/settings');
    const modeBadge = page.getByText('SELF HOST');
    const serverLabel = page.getByText(`Server: ${serverUrl}`);
    if ((await canSee(modeBadge, 5_000)) && (await canSee(serverLabel, 5_000))) {
      return;
    }
  }

  throw new Error(`Self-host mode did not persist for ${serverUrl}`);
}

test.describe('Hub and Settings', () => {
  test('buttons navigate to expected pages and persist mode changes', async ({ page }) => {
    await completeOnboardingIfNeeded(page);
    await ensureModuleEnabledFromDiscover(page, 'MyBooks');

    await gotoWhenReady(page, '/');
    await expect(page.getByRole('heading', { name: /Morning|Afternoon|Evening/ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Discover' }).first()).toBeVisible();

    await page.getByRole('link', { name: 'Settings' }).click();
    await expect(page).toHaveURL(/\/settings$/);

    await expect(page.getByRole('link', { name: 'Discover' }).first()).toBeVisible();
    await gotoWhenReady(page, '/discover');
    await expect(page).toHaveURL(/\/discover$/);

    await chooseSelfHostMode(page, 'https://example.invalid');

    await page.getByRole('link', { name: 'Open Self-Host Setup' }).click();
    await expect(page).toHaveURL('/settings/self-host');

    const serverUrlInput = page.getByLabel('Server URL');
    await expect(serverUrlInput).toHaveValue(/https?:\/\//);
    await serverUrlInput.fill('http://127.0.0.1:1');
    await expect(serverUrlInput).toHaveValue('http://127.0.0.1:1');
    await page.getByRole('button', { name: 'Test Connection' }).click();
    await expect(page.getByText('Overall: FAIL')).toBeVisible();
    await expect(
      page.getByText(
        'Health endpoint is unreachable. Check DNS, firewall, and server port mapping.',
      ),
    ).toBeVisible();

    await page.getByLabel('Server URL').fill('https://selfhost.example.com');
    await page.getByRole('button', { name: 'Save and Use Self-Host' }).click();
    await expect(page.getByText('Saved self-host mode and server URL.')).toBeVisible();

    await gotoWhenReady(page, '/settings');
    await expect(page.getByText('Server: https://selfhost.example.com')).toBeVisible();
  });
});
