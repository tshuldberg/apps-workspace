import { expect, test } from '@playwright/test';
import { setFixtureHealthMode, setFixtureMode, signInAs } from './fixture-control';

/**
 * The service-health page (plan 48 WP11).
 *
 * The page's whole job is to be trustworthy when things are going wrong, so the
 * specs that matter most are the degraded and unreadable ones. Nothing here
 * stubs application logic: the fixture answers `nw_health_snapshot()` at the
 * PostgREST boundary and the console's own classifier decides every level.
 */

test.beforeEach(async ({ request }) => {
  await setFixtureMode(request, 'ok');
  await setFixtureHealthMode(request, 'ok');
});

test('renders every component with a level for an authorized moderator', async ({
  page,
  context,
  request,
}) => {
  await signInAs(context, request, 'moderator-aal2');
  await page.goto('/health');

  await expect(page.getByRole('heading', { name: 'Service health' })).toBeVisible();
  await expect(page.getByText('All components inside their thresholds.')).toBeVisible();

  // Six queues plus three workers, each on its own row.
  for (const component of [
    'queue_report',
    'queue_ncii',
    'queue_dmca',
    'queue_screening',
    'queue_deletion',
    'queue_support_reconciliation',
    'worker_mynews_ncii_worker',
    'worker_mynews_account_worker',
    'worker_mynews_support_worker',
  ]) {
    await expect(page.getByText(component, { exact: true })).toBeVisible();
  }
  await expect(page.getByText('OK', { exact: true })).toHaveCount(9);
});

test('reports a past-threshold queue and a silent worker as needing attention', async ({
  page,
  context,
  request,
}) => {
  await signInAs(context, request, 'moderator-aal2');
  await setFixtureHealthMode(request, 'degraded');
  await page.goto('/health');

  await expect(
    page.getByText('At least one component is past a threshold or cannot be assessed.'),
  ).toBeVisible();
  await expect(page.getByText('2 of 9 component(s) need attention.')).toBeVisible();

  // The DMCA queue is past its alarm threshold. Exact match on the badge: the
  // row's "why" column also contains the word "alarm".
  const dmcaRow = page.locator('tr', { hasText: 'queue_dmca' });
  await expect(dmcaRow.getByText('ALARM', { exact: true })).toBeVisible();

  // A worker that has never recorded a run is UNKNOWN, never OK. This is the
  // assertion that stops a silent worker from reading as a healthy one.
  const workerRow = page.locator('tr', { hasText: 'worker_mynews_support_worker' });
  await expect(workerRow.getByText('UNKNOWN')).toBeVisible();
  await expect(workerRow.getByText('never recorded a run')).toBeVisible();
  await expect(workerRow.getByText('OK', { exact: true })).toHaveCount(0);
});

test('says the snapshot is unavailable rather than showing zeros', async ({
  page,
  context,
  request,
}) => {
  await signInAs(context, request, 'moderator-aal2');
  await setFixtureHealthMode(request, 'unavailable');
  await page.goto('/health');

  await expect(page.getByText('The health snapshot could not be read')).toBeVisible();
  await expect(
    page.getByText('An unreadable snapshot is not the same as a healthy one'),
  ).toBeVisible();
  await expect(page.getByText('shows no figures rather than zeros')).toBeVisible();
  // No table at all: a failed read must not render a grid of empty rows that
  // looks like a healthy, quiet service.
  await expect(page.locator('table')).toHaveCount(0);
  await expect(page.getByText('All components inside their thresholds.')).toHaveCount(0);
});

test('is behind the same gates as every other console page', async ({ page }) => {
  await page.goto('/health');
  await expect(page).toHaveURL(/\/login/);
});
