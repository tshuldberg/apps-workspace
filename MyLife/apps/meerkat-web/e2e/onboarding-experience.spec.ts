import { expect, test, type Page } from '@playwright/test';

async function startCreation(page: Page) {
  await page.route('**/api/entitlements/meerkat-app**', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ unlocked: true, purchaseDate: '2026-07-09T00:00:00.000Z' }),
  }));
  await page.addInitScript(() => localStorage.setItem('meerkat_app_unlock_state', JSON.stringify({ unlocked: true, purchaseDate: '2026-07-09T00:00:00.000Z' })));
  await page.goto('/');
  const age = page.getByRole('dialog', { name: 'When were you born?' });
  await age.getByLabel('Month').fill('1');
  await age.getByLabel('Day').fill('1');
  await age.getByLabel('Year').fill('1990');
  await age.getByRole('button', { name: 'Continue' }).click();
  const welcome = page.getByRole('dialog', { name: 'Welcome to Meerkat' });
  await welcome.getByLabel('Your name').fill('Layout Tester');
  await welcome.getByRole('button', { name: 'Continue', exact: true }).click();
  await welcome.getByRole('button', { name: /Create a community/ }).click();
  await welcome.getByLabel('Community name').fill('Our studio');
  await expect(welcome.getByRole('heading', { name: 'Your standard community' })).toBeVisible();
  await welcome.getByRole('button', { name: 'Choose a layout' }).click();
  return welcome;
}

test('layout precedes theme, future media is honest, and back preserves the draft', async ({ page }) => {
  const welcome = await startCreation(page);
  await expect(welcome.getByRole('heading', { name: 'How should your community feel?' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(welcome.getByRole('button', { name: /^Standard community/ })).toBeFocused();
  await page.keyboard.press('Space');
  await expect(welcome.getByRole('button', { name: /^Standard community/ })).toHaveAttribute('aria-pressed', 'true');
  for (const name of ['Video channel', 'Short videos', 'Live stage']) {
    await welcome.getByRole('button', { name: new RegExp(`^${name}`) }).click();
    await expect(welcome.getByRole('button', { name: 'Choose a theme' })).toBeEnabled();
    await expect(welcome.getByRole('status')).toContainText('You can load this starter now');
  }
  await welcome.getByRole('button', { name: /^Discussion board/ }).click();
  await welcome.evaluate((element) => { element.scrollTop = 0; });
  await page.screenshot({ path: 'output/playwright/onboarding-layout-desktop.png', fullPage: true });
  await welcome.getByRole('button', { name: 'Choose a theme' }).click();
  await welcome.getByRole('button', { name: 'Calm', exact: true }).click();
  await welcome.getByRole('button', { name: 'Dark preview' }).click();
  await expect(welcome.getByLabel('Discussion board layout preview')).toContainText('Calm');
  await welcome.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(welcome.getByRole('button', { name: /^Discussion board/ })).toHaveAttribute('aria-pressed', 'true');
  await welcome.getByRole('button', { name: 'Choose a theme' }).click();
  await expect(welcome.getByRole('button', { name: /^Calm/ })).toHaveAttribute('aria-pressed', 'true');
  await welcome.getByRole('button', { name: 'Create community', exact: true }).click();
  await welcome.getByRole('button', { name: 'Open community', exact: true }).click();
  await expect(welcome).toBeHidden();
  await expect(page.getByRole('main').getByText('A place for your conversations.')).toBeVisible();
  await page.reload();
  await expect(welcome).toBeHidden();
  await expect(page.getByRole('navigation', { name: 'Communities' }).getByTitle('Our studio', { exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: 'Communities' }).getByTitle('Our studio', { exact: true }).click();
  await expect(page.getByRole('main').getByText('A place for your conversations.')).toBeVisible();
});

test('phone onboarding creates the selected shared library and keeps the personal theme', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const welcome = await startCreation(page);
  const personalAccent = await page.locator('html').evaluate((element) => getComputedStyle(element).getPropertyValue('--mk-accent'));
  await welcome.getByRole('button', { name: /^Shared library/ }).click();
  await welcome.getByRole('button', { name: 'Choose a theme' }).click();
  await welcome.getByRole('button', { name: 'Calm', exact: true }).click();
  await welcome.evaluate((element) => { element.scrollTop = 0; });
  await page.screenshot({ path: 'output/playwright/onboarding-theme-phone.png', fullPage: true });
  const hasOverflow = await welcome.evaluate((element) => element.scrollWidth > element.clientWidth);
  expect(hasOverflow).toBe(false);
  await welcome.getByRole('button', { name: 'Create community', exact: true }).click();
  await welcome.getByRole('button', { name: 'Open community', exact: true }).click();
  await expect(welcome).toBeHidden();
  await expect(page.getByRole('main').getByText('Photos', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('main').getByText('Videos', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('main').getByText('Documents', { exact: true }).first()).toBeVisible();
  expect(await page.locator('html').evaluate((element) => getComputedStyle(element).getPropertyValue('--mk-accent'))).toBe(personalAccent);
  const libraryAccent = await page.getByRole('main').getByText('Photos', { exact: true }).first().evaluate((element) => getComputedStyle(element).getPropertyValue('--mk-accent').trim());
  expect(libraryAccent.toLowerCase()).toBe('#3f6fa5');
});

for (const [layout, capability] of [['Video channel', 'Video is enabled'], ['Short videos', 'Short videos are enabled'], ['Live stage', 'Live stage is enabled']] as const) {
  test(`loads unfinished ${layout} with a usable chat and persists the device default`, async ({ page }) => {
    const welcome = await startCreation(page);
    await welcome.getByRole('button', { name: new RegExp(`^${layout}`) }).click();
    await welcome.getByRole('checkbox', { name: /Use this layout by default/ }).check();
    await welcome.getByRole('button', { name: 'Choose a theme' }).click();
    await welcome.getByRole('button', { name: 'Create community', exact: true }).click();
    await welcome.getByRole('button', { name: 'Open community', exact: true }).click();
    await expect(page.getByRole('main').getByText(new RegExp(capability))).toBeVisible();
    await expect(page.getByRole('main').getByRole('button', { name: /Open #General/ })).toBeVisible();
    await expect(page.getByRole('main').getByText(/Using your device default/)).toBeVisible();
    if (layout === 'Live stage') await page.getByRole('main').screenshot({ path: 'output/playwright/live-starter-home.png' });
    await page.reload();
    await page.getByRole('navigation', { name: 'Communities' }).getByTitle('Our studio', { exact: true }).click();
    await expect(page.getByRole('main').getByText(new RegExp(capability))).toBeVisible();
  });
}

test('desktop and mobile defaults stay independent, restore the community view, and starters load without publishing', async ({ page }) => {
  const welcome = await startCreation(page);
  await welcome.getByRole('button', { name: /^Discussion board/ }).click();
  await welcome.getByRole('button', { name: 'Choose a theme' }).click();
  await welcome.getByRole('button', { name: 'Create community', exact: true }).click();
  await welcome.getByRole('button', { name: 'Open community', exact: true }).click();

  const openDefaults = async () => {
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const settings = page.getByRole('dialog', { name: 'Settings', exact: true });
    await settings.getByText('Appearance', { exact: true }).click();
    return settings;
  };
  const settings = await openDefaults();
  await settings.getByLabel('Default community home', { exact: true }).selectOption('video');
  await expect(settings.getByRole('status').filter({ hasText: 'Device layout saved' })).toBeVisible();
  await settings.getByLabel('Layout device profile').selectOption('mobile');
  await expect(settings.getByLabel('Default community home', { exact: true })).toHaveValue('community');
  await settings.getByLabel('Default community home', { exact: true }).selectOption('shorts');
  await settings.locator('.mk-device-layout').screenshot({ path: 'output/playwright/device-layout-settings.png' });
  await settings.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('navigation', { name: 'Communities' }).getByTitle('Our studio', { exact: true }).click();
  await expect(page.getByRole('main').getByText(/This block needs Short videos turned on/)).toBeVisible();
  await page.reload();
  const restored = await openDefaults();
  await expect(restored.getByLabel('Layout device profile')).toHaveValue('mobile');
  await expect(restored.getByLabel('Default community home', { exact: true })).toHaveValue('shorts');
  await restored.getByLabel('Layout device profile').selectOption('desktop');
  await expect(restored.getByLabel('Default community home', { exact: true })).toHaveValue('video');
  await restored.getByLabel('Default community home', { exact: true }).selectOption('community');
  await restored.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('navigation', { name: 'Communities' }).getByTitle('Our studio', { exact: true }).click();
  await expect(page.getByRole('main').getByText('A place for your conversations.')).toBeVisible();

  await page.getByRole('button', { name: 'Community settings', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Our studio settings' });
  await editor.getByLabel('Starter layout', { exact: true }).selectOption('live');
  await editor.getByRole('button', { name: 'Load starter into draft' }).click();
  await expect(editor.getByText(/Live stage is enabled/)).toBeVisible();
  await editor.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('main').getByText('A place for your conversations.')).toBeVisible();
  await page.getByRole('button', { name: 'Community settings', exact: true }).click();
  await editor.getByLabel('Starter layout', { exact: true }).selectOption('live');
  await editor.getByRole('button', { name: 'Load starter into draft' }).click();
  await editor.getByRole('button', { name: 'Publish layout', exact: true }).click();
  await editor.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('main').getByText(/Live stage is enabled/)).toBeVisible();
});
