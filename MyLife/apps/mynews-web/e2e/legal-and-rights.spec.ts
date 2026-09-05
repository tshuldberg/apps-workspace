import { expect, test } from '@playwright/test';
import { setFixtureMode } from './fixture-control';

/**
 * The legal hub, its documents, and the account-rights page.
 *
 * These pages read no records, but they are capability-keyed: the harness sets
 * no contact addresses and no payments rail, so the copy asserted here is the
 * honest unconfigured-deployment copy. If a page ever hardcodes a claim instead
 * of deriving it, these assertions flip.
 */

test.beforeEach(async ({ request }) => {
  await setFixtureMode(request, 'ok');
});

/** Every legal route that exists in `app/legal/`, with its rendered h1. */
const LEGAL_PAGES: Array<{ path: string; heading: string }> = [
  { path: '/legal', heading: 'Legal' },
  { path: '/legal/terms', heading: 'Terms of Service' },
  { path: '/legal/privacy', heading: 'Privacy Policy' },
  { path: '/legal/guidelines', heading: 'Community Guidelines' },
  { path: '/legal/dmca', heading: 'DMCA notices' },
];

for (const { path, heading } of LEGAL_PAGES) {
  test(`${path} renders`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  });
}

test('the legal hub links every document and omits the unconfigured fee claim', async ({ page }) => {
  await page.goto('/legal');

  const index = page.getByRole('region', { name: 'Legal documents' });
  await expect(index.getByRole('link', { name: 'Terms of Service' })).toBeVisible();
  await expect(index.getByRole('link', { name: 'Privacy Policy' })).toBeVisible();
  await expect(index.getByRole('link', { name: 'Community Guidelines' })).toBeVisible();
  await expect(index.getByRole('link', { name: 'DMCA / Copyright' })).toBeVisible();

  // No payments rail is configured in this harness, so the 2% platform-fee claim
  // must not be published. This is the capability system's whole point.
  await expect(page.getByText('2% platform fee')).toHaveCount(0);
});

test('/about/editing renders the editing explainer', async ({ page }) => {
  const response = await page.goto('/about/editing');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('/account/delete states where deletion happens and ships no form', async ({ page }) => {
  await page.goto('/account/delete');

  await expect(page.getByRole('heading', { level: 1, name: 'Delete your account' })).toBeVisible();
  // Exact: the page also renders the sentence-case menu item "Delete my account".
  await expect(page.getByText('DELETE MY ACCOUNT', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'The 7-day grace period' })).toBeVisible();
  await expect(
    page.getByText('There is no form on this page on purpose.'),
  ).toBeVisible();

  // The honest state this harness can actually reach: the page carries no
  // deletion form at all, so there is nothing to submit and no field to fill.
  await expect(page.locator('form')).toHaveCount(0);
  await expect(page.locator('input')).toHaveCount(0);

  // Retained/removed lists come from the module constants the privacy policy and
  // the app render, so they cannot disagree with each other.
  await expect(page.getByRole('region', { name: 'What is kept' }).locator('li')).toHaveCount(3);
  await expect(page.getByRole('region', { name: 'What is deleted' }).locator('li')).toHaveCount(4);

  // No contact address is configured, so the page says so instead of printing
  // an address nobody reads.
  await expect(
    page.getByText('This deployment has not published a contact address yet'),
  ).toBeVisible();
});
