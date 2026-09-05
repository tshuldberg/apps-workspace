import { expect, test } from '@playwright/test';
import { FIXTURE, MODERATOR_EMAIL, setFixtureMode, signInAs } from './fixture-control';

/**
 * The console's authorization gates, exercised end to end.
 *
 * WP9 made the console enforce three independent gates, and every page and server
 * action goes through all of them:
 *
 *   1. the email allowlist (`MYNEWS_CONSOLE_MODERATOR_EMAILS`),
 *   2. an aal2 session (a second factor actually presented),
 *   3. an active role row (`nw_moderator_role`).
 *
 * Each spec below holds a real cookie session and lets the app decide. The
 * fixture answers `GET /auth/v1/user` from the presented bearer token, so
 * middleware, the layout, and `requireModerator()` resolve the same identity
 * independently, exactly as in production.
 */

test.beforeEach(async ({ request }) => {
  await setFixtureMode(request, 'ok');
});

test('an unauthenticated visit to a console page lands on the login gate', async ({ page }) => {
  await page.goto('/queue');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { level: 1, name: 'MyNews moderator sign-in' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Email me a sign-in link' })).toBeVisible();

  // Nothing from the queue leaks into the login page.
  await expect(page.getByText(FIXTURE.headline)).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Report queue' })).toHaveCount(0);
});

test('a session whose email is not on the allowlist is refused', async ({
  page,
  context,
  request,
}) => {
  await signInAs(context, request, 'outsider');
  await page.goto('/queue');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { level: 1, name: 'MyNews moderator sign-in' })).toBeVisible();
  await expect(page.getByText(FIXTURE.headline)).toHaveCount(0);
  // The nav offers no queues to a session the console does not recognise.
  await expect(page.getByRole('link', { name: 'Report queue' })).toHaveCount(0);
});

test('an allowlisted moderator at aal1 is held at the MFA gate', async ({
  page,
  context,
  request,
}) => {
  await signInAs(context, request, 'moderator-aal1');
  await page.goto('/queue');

  await expect(page).toHaveURL(/\/mfa$/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Two-factor verification required' }),
  ).toBeVisible();
  // The identity has a verified TOTP factor, so the honest next step is to verify
  // this session rather than to enrol.
  await expect(page.getByRole('heading', { name: 'Enter your authenticator code' })).toBeVisible();
  await expect(page.getByText('Assurance level')).toBeVisible();
  await expect(page.locator('.mono', { hasText: 'aal1' })).toBeVisible();

  // Held means held: no queue content, and no queue links in the nav.
  await expect(page.getByText(FIXTURE.headline)).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Report queue' })).toHaveCount(0);
});

test('an allowlisted moderator at aal2 with no role row is walled off', async ({
  page,
  context,
  request,
}) => {
  await signInAs(context, request, 'moderator-norole');
  await page.goto('/queue');

  await expect(page).toHaveURL(/\/no-role$/);
  await expect(page.getByRole('heading', { level: 1, name: 'No moderator role' })).toBeVisible();
  await expect(page.getByText(FIXTURE.headline)).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Report queue' })).toHaveCount(0);
});

test('the report queue renders the fixture rows for an authorized moderator', async ({
  page,
  context,
  request,
}) => {
  await signInAs(context, request, 'moderator-aal2');
  await page.goto('/queue');

  await expect(page).toHaveURL(/\/queue$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Open report queue' })).toBeVisible();

  // Only now does the nav offer the queues, and it names the role it resolved.
  await expect(page.getByRole('link', { name: 'Report queue' })).toBeVisible();
  await expect(page.locator('.whoami')).toContainText(MODERATOR_EMAIL);
  await expect(page.locator('.whoami')).toContainText('Admin');

  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(2);
  await expect(page.locator('.stat', { hasText: 'reports on this page' }).locator('.value')).toHaveText(
    '2',
  );
  // Both fixture reports were created half an hour ago and every routed SLA is at
  // least 24 hours, so nothing is overdue.
  await expect(
    page.locator('.stat', { hasText: 'past their routed SLA deadline' }).locator('.value'),
  ).toHaveText('0');

  // Copyright report: hydrated article context plus the linked DMCA notice's
  // 512(c)(3) elements inline.
  const copyright = page.locator('tr#report-r-copyright');
  // Exact: the row also contains the article id and the strike button, both of
  // which include the word.
  await expect(copyright.getByText('Copyright', { exact: true })).toBeVisible();
  await expect(copyright.getByText(FIXTURE.headline)).toBeVisible();
  await expect(copyright.getByText(FIXTURE.articleId)).toBeVisible();
  await expect(copyright.getByText(FIXTURE.complainant).first()).toBeVisible();
  await expect(copyright.getByText(FIXTURE.infringingUrl)).toBeVisible();
  await expect(copyright.getByRole('button', { name: 'Retract article' })).toBeVisible();
  await expect(copyright.getByRole('button', { name: 'Retract + copyright strike' })).toBeVisible();

  // Profile report: the suspension form, and the dual-control note that the
  // long presets only propose.
  const harassment = page.locator('tr#report-r-harassment');
  await expect(harassment.getByText('Harassment')).toBeVisible();
  await expect(harassment.getByText(`@${FIXTURE.profileHandle}`)).toBeVisible();
  await expect(harassment.getByRole('button', { name: 'Suspend' })).toBeVisible();
  await expect(harassment.getByText('A second moderator has to approve it')).toBeVisible();

  // Every row can be dismissed, and dismissal always demands an audited reason.
  await expect(page.getByRole('button', { name: 'Dismiss (no action)' })).toHaveCount(2);
});

test('an allowlisted moderator at aal2 with a role can reach the home redirect', async ({
  page,
  context,
  request,
}) => {
  await signInAs(context, request, 'moderator-aal2');
  await page.goto('/');
  await expect(page).toHaveURL(/\/queue$/);
});
