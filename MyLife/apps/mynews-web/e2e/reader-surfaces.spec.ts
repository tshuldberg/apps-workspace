import { expect, test } from '@playwright/test';
import { FIXTURE, setFixtureMode } from './fixture-control';

/**
 * The public reader surfaces, rendered server-side against the fixture record.
 *
 * These are the pages a search crawler and a first-time reader see, and every
 * value asserted here came out of the real PostgREST read path: the app's own
 * query builders, adapter, row mappers, and stitching. Nothing is mocked above
 * the network boundary.
 */

test.beforeEach(async ({ request }) => {
  await setFixtureMode(request, 'ok');
});

test('the home feed renders the fixture articles newest first', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: 'MyNews' })).toBeVisible();

  const latest = page.getByRole('region', { name: 'Latest articles' });
  await expect(latest).toBeVisible();

  const titles = latest.locator('.article-list-title');
  await expect(titles).toHaveCount(2);
  // published_at ordering is the query's job (order=published_at.desc), so the
  // sequence is part of what this asserts.
  await expect(titles.nth(0)).toHaveText(FIXTURE.topHeadline);
  await expect(titles.nth(1)).toHaveText(FIXTURE.secondHeadline);
  await expect(titles.nth(0)).toHaveAttribute('href', `/a/${FIXTURE.topSlug}`);

  // The byline on a feed row comes from the separate public-profile read that is
  // stitched onto the article row, so seeing the name proves the stitch ran.
  await expect(latest.locator('.article-list-meta').first()).toContainText(FIXTURE.authorName);

  // The unconfigured launch line must not appear when a record IS configured.
  await expect(
    page.getByText('This reader is not connected to a MyNews server.'),
  ).toHaveCount(0);
});

test('an article page renders its headline, body, byline and editing cards', async ({ page }) => {
  await page.goto(`/a/${FIXTURE.topSlug}`);

  await expect(page.getByRole('heading', { level: 1, name: FIXTURE.topHeadline })).toBeVisible();
  await expect(
    page.getByText('The council adopted the amended figures on a 5 to 2 vote.'),
  ).toBeVisible();

  // Byline: the author link, the verified badge (which follows the journalist
  // row, not the article row), and the revision the reader is looking at.
  const byline = page.locator('.byline');
  await expect(byline.getByRole('link', { name: FIXTURE.authorName })).toHaveAttribute(
    'href',
    `/j/${FIXTURE.authorHandle}`,
  );
  await expect(byline.getByTitle('Verified journalist')).toHaveText('Verified');
  await expect(byline).toContainText('rev 2');

  const body = page.locator('.article-body');
  await expect(body.locator('p')).toHaveCount(2);
  await expect(body.locator('p').first()).toContainText('The council adopted the amended budget');

  // Public revision history, newest first, with the editor credit carried in the
  // signed changelog of rev 2.
  const revisions = page.getByRole('region', { name: 'Revision history' });
  await expect(revisions.locator('.revision-rev').nth(0)).toHaveText('rev 2');
  await expect(revisions.locator('.revision-rev').nth(1)).toHaveText('rev 1');
  await expect(revisions.getByText('correction suggested by')).toBeVisible();
  await expect(revisions.getByText('First published.')).toBeVisible();

  // Editing cards. "Improved by" is derived from the changelog credits and the
  // marginalia line from the separate suggestions read.
  await expect(page.getByRole('heading', { name: 'Improved by 1 editor' })).toBeVisible();
  const marginalia = page.getByRole('link', { name: /open suggestion/ });
  await expect(marginalia).toHaveText('1 open suggestion, 1 correction with citations');
  await expect(marginalia).toHaveAttribute('href', `/a/${FIXTURE.topSlug}/suggestions`);
  await expect(page.getByRole('heading', { name: 'Suggest an edit' })).toBeVisible();
});

test('an unknown article slug is a 404, not an outage or a placeholder', async ({ page }) => {
  const response = await page.goto('/a/no-such-fixture-slug');
  expect(response?.status()).toBe(404);
  // The outage surface must not claim a missing record is a server problem.
  await expect(page.getByText('MyNews is having trouble right now')).toHaveCount(0);
});

test('a journalist page renders the profile, badge and published articles', async ({ page }) => {
  await page.goto(`/j/${FIXTURE.authorHandle}`);

  await expect(page.getByRole('heading', { level: 1 })).toContainText(FIXTURE.authorName);
  await expect(page.getByTitle('Verified journalist')).toHaveText('Verified');
  await expect(page.getByText(`@${FIXTURE.authorHandle}`)).toBeVisible();
  await expect(page.getByText(FIXTURE.bio)).toBeVisible();
  await expect(page.locator('.beat')).toHaveCount(2);

  const published = page.getByRole('region', { name: 'Published articles' });
  await expect(published.locator('.article-list-title')).toHaveCount(2);
  await expect(published.getByText(FIXTURE.topHeadline)).toBeVisible();
});
