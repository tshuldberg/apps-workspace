import { expect, test } from '@playwright/test';
import { FIXTURE, setFixtureMode } from './fixture-control';

/**
 * The report affordance on a public article for a reader with no session.
 *
 * `mynews-report` runs with verify_jwt ON and attributes a report to a profile,
 * so an anonymous caller genuinely cannot file one. WP10's answer is a sign-in
 * sheet INSIDE the card: the reader keeps the reason and the detail they typed,
 * and nothing navigates. That "in place, not a redirect" property is the point of
 * these specs, so it is asserted directly (URL unchanged, detail preserved) and
 * not inferred from the copy.
 */

test.beforeEach(async ({ request }) => {
  await setFixtureMode(request, 'ok');
});

const DETAIL = 'Fixture detail from the e2e harness.';

test('a signed-out reader gets the sign-in sheet in place, not a redirect', async ({ page }) => {
  const reportPosts: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/api/report')) {
      reportPosts.push(request.url());
    }
  });

  const articlePath = `/a/${FIXTURE.topSlug}`;
  await page.goto(articlePath);

  await page.getByRole('button', { name: 'Report this article' }).click();
  await expect(page.getByRole('heading', { name: 'Report this content' })).toBeVisible();

  // Thirteen reasons come from the module taxonomy; picking one shows its hint.
  await page.getByRole('button', { name: 'Harassment or bullying' }).click();
  await expect(page.locator('.report-hint')).not.toBeEmpty();

  const detail = page.getByLabel('Add detail (optional)');
  await detail.fill(DETAIL);
  await page.getByRole('button', { name: 'Submit report' }).click();

  // The sheet, in the card.
  await expect(page.getByRole('heading', { name: 'Confirm it is you' })).toBeVisible();
  await expect(page.getByLabel('Email on your MyNews account')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Email me a code' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Not now' })).toBeVisible();

  // Nothing was sent to the intake API, so nothing can have been fabricated as
  // filed, and the reader was not navigated anywhere.
  expect(reportPosts).toEqual([]);
  await expect(page).toHaveURL(new RegExp(`${articlePath}$`));
  await expect(page.getByRole('heading', { name: 'Report submitted' })).toHaveCount(0);

  // The report survived the sign-in prompt, which is the whole reason the sheet
  // is here instead of a login page.
  await expect(detail).toHaveValue(DETAIL);
  await expect(page.getByRole('button', { name: 'Harassment or bullying' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('sending a code advances to the code stage and a bad code is rejected honestly', async ({
  page,
}) => {
  await page.goto(`/a/${FIXTURE.topSlug}`);
  await page.getByRole('button', { name: 'Report this article' }).click();
  await page.getByRole('button', { name: 'Spam' }).click();
  await page.getByRole('button', { name: 'Submit report' }).click();

  await page.getByLabel('Email on your MyNews account').fill('reader@example.org');
  await page.getByRole('button', { name: 'Email me a code' }).click();

  // `/api/auth/otp` answers ok for any plausible address on purpose (it must not
  // become an account-existence oracle), so the code stage is the honest next
  // state whether or not that address has an account.
  await expect(page.getByText('Code sent to reader@example.org')).toBeVisible();
  const code = page.getByLabel('6-digit code');
  await expect(code).toBeVisible();

  // The fixture stands in for Supabase Auth and rejects every code, which is what
  // a wrong or expired code really produces. The app must say so and must not
  // claim a session.
  await code.fill('000000');
  await page.getByRole('button', { name: 'Verify and send report' }).click();
  await expect(page.getByText('Enter the 6-digit code from the email.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Report submitted' })).toHaveCount(0);
});

test('the report affordance is also present on a journalist profile', async ({ page }) => {
  await page.goto(`/j/${FIXTURE.authorHandle}`);
  await page.getByRole('button', { name: 'Report this profile' }).click();
  await expect(page.getByRole('heading', { name: 'Report this content' })).toBeVisible();
});
