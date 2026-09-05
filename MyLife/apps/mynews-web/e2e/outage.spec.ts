import { expect, test } from '@playwright/test';
import { FIXTURE, setFixtureMode } from './fixture-control';

/**
 * Backend outage, exercised for real: the fixture answers every data path with
 * 503, which is what the app's loaders classify as `outage` (as opposed to
 * `missing`, which is a 404, and `unconfigured`, which is also a 404).
 *
 * The distinction is load-bearing for SEO and for the reader: a 404 during an
 * outage window tells a crawler a live article is gone, and tells a reader they
 * mistyped the address. So an outage must render the outage surface and must not
 * render an empty feed, a 404, or a placeholder.
 */

test.beforeEach(async ({ request }) => {
  await setFixtureMode(request, 'outage');
});

test.afterEach(async ({ request }) => {
  await setFixtureMode(request, 'ok');
});

test('the home feed says the list is missing, not empty', async ({ page }) => {
  await page.goto('/');

  // The home page keeps its own copy rather than the full-page outage surface,
  // because the mission text above the list is still true during an outage. What
  // matters is that it does not claim there are no articles.
  await expect(
    page.getByText(
      'We could not load the latest articles. The MyNews servers did not answer in time, so this list is missing rather than empty.',
    ),
  ).toBeVisible();
  await expect(page.getByText('No published articles are available right now.')).toHaveCount(0);
  await expect(page.getByText(FIXTURE.topHeadline)).toHaveCount(0);
});

test('an article page shows the outage surface and asks crawlers not to index it', async ({
  page,
}) => {
  const response = await page.goto(`/a/${FIXTURE.topSlug}`);

  // App Router pages cannot set a 5xx status, so the crawler contract is the
  // noindex meta tag (see OutageNotice's own note). The status stays 200.
  expect(response?.status()).toBe(200);
  await expect(page.getByText('MyNews is having trouble right now')).toBeVisible();
  await expect(page.getByText('there is nothing wrong with the address you used')).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    /noindex/,
  );
  await expect(page.getByRole('heading', { name: FIXTURE.topHeadline })).toHaveCount(0);
});

test('a journalist page shows the outage surface instead of a 404', async ({ page }) => {
  const response = await page.goto(`/j/${FIXTURE.authorHandle}`);
  expect(response?.status()).not.toBe(404);
  await expect(page.getByText('MyNews is having trouble right now')).toBeVisible();
});

test('the RSS feed answers 503 with Retry-After instead of an empty channel', async ({
  request,
  baseURL,
}) => {
  const response = await request.get(`${baseURL}/feed.xml`);
  expect(response.status()).toBe(503);
  expect(response.headers()['retry-after']).toBe('60');
});
