import { expect, test, type Page } from '@playwright/test';
import { setFixtureMode } from './fixture-control';

/**
 * The public DMCA intake form (`/legal/dmca`).
 *
 * Three states, all real:
 *
 *  1. empty submit  -> the browser's own constraint validation refuses, because
 *     every statutory field carries `required`. The app renders no per-field
 *     error text of its own, so this spec asserts what actually happens: the
 *     first missing field reports invalid, and no request leaves the page. It
 *     does NOT assert invented per-field error copy.
 *  2. bad email     -> the same mechanism for the address field, plus the app's
 *     own zod validation for an address the browser accepts but the schema does
 *     not (`reader@localhost`), which surfaces the module's validation message.
 *  3. complete      -> POSTs to `/api/dmca`, which signs the platform client IP
 *     and forwards to the fixture standing in for the `mynews-dmca` edge
 *     function. The queued receipt is the app's real success state.
 */

const VALID = {
  name: 'Fixture Rights Holder',
  email: 'rights@example.org',
  address: '1 Fixture Way, Testville',
  work: 'The original photograph published on example.org in June 2026.',
  url: 'https://mynews.app/a/fixture-city-budget',
  signature: 'Fixture Rights Holder',
};

async function fillTakedown(page: Page, overrides: Partial<typeof VALID> = {}): Promise<void> {
  const values = { ...VALID, ...overrides };
  // `exact: true` throughout: the signature field's label ends with "type your
  // full legal name", so a substring match is ambiguous.
  await page.getByLabel('Your full legal name', { exact: true }).fill(values.name);
  await page.getByLabel('Contact email', { exact: true }).fill(values.email);
  await page.getByLabel('Mailing address (optional)', { exact: true }).fill(values.address);
  await page
    .getByLabel('Identification of the copyrighted work you claim was infringed', { exact: true })
    .fill(values.work);
  await page
    .getByLabel('Public URL of the allegedly infringing material', { exact: true })
    .fill(values.url);
  // Both statutory attestations. The checkboxes are labelled with the full
  // attestation sentences, which are module constants; addressing them by
  // container keeps this spec from re-typing legal text that must not drift.
  const attestations = page.locator('.dmca-check input[type="checkbox"]');
  await expect(attestations).toHaveCount(2);
  await attestations.nth(0).check();
  await attestations.nth(1).check();
  await page
    .getByLabel('Physical or electronic signature (type your full legal name)', { exact: true })
    .fill(values.signature);
}

test.beforeEach(async ({ request }) => {
  await setFixtureMode(request, 'ok');
});

test('an empty submission is refused and never reaches the intake API', async ({ page }) => {
  const posts: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/api/dmca')) {
      posts.push(request.url());
    }
  });

  await page.goto('/legal/dmca');
  await page.getByRole('button', { name: 'Submit takedown notice' }).click();

  const name = page.getByLabel('Your full legal name', { exact: true });
  expect(await name.evaluate((el: HTMLInputElement) => el.validity.valueMissing)).toBe(true);
  expect(posts).toEqual([]);
  await expect(page.getByRole('heading', { name: 'Submission queued' })).toHaveCount(0);
});

test('a malformed email is refused by the browser and never reaches the intake API', async ({
  page,
}) => {
  const posts: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/api/dmca')) {
      posts.push(request.url());
    }
  });

  await page.goto('/legal/dmca');
  await fillTakedown(page, { email: 'not-an-email' });
  await page.getByRole('button', { name: 'Submit takedown notice' }).click();

  const email = page.getByLabel('Contact email', { exact: true });
  expect(await email.evaluate((el: HTMLInputElement) => el.validity.typeMismatch)).toBe(true);
  expect(posts).toEqual([]);
  await expect(page.getByRole('heading', { name: 'Submission queued' })).toHaveCount(0);
});

test("an email the browser accepts but the schema rejects shows the app's own error", async ({
  page,
}) => {
  const posts: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/api/dmca')) {
      posts.push(request.url());
    }
  });

  // `reader@localhost` satisfies input[type=email] but not the module's schema
  // (no TLD), so this is the one path where the app's OWN validation speaks. A
  // separate test rather than a second attempt in the same page, so no native
  // validation popup from a previous submit is in play.
  await page.goto('/legal/dmca');
  await fillTakedown(page, { email: 'reader@localhost' });
  await page.getByRole('button', { name: 'Submit takedown notice' }).click();

  await expect(
    page.getByText(
      'That submission is missing a required element or attestation. Review every identity, contact, material, location, statement, and signature field, then try again.',
    ),
  ).toBeVisible();
  expect(posts).toEqual([]);
});

test('a complete takedown notice is queued with a reference id', async ({ page }) => {
  await page.goto('/legal/dmca');
  await fillTakedown(page);

  const response = page.waitForResponse(
    (res) => res.url().includes('/api/dmca') && res.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Submit takedown notice' }).click();
  expect((await response).status()).toBe(200);

  const receipt = page.getByRole('status');
  await expect(receipt.getByRole('heading', { name: 'Submission queued' })).toBeVisible();
  await expect(receipt).toContainText('is in the moderation queue');
  await expect(receipt.locator('.mono')).toHaveText(/^fixture-dmca-\d+$/);
  // resolutionStatus 'resolved' from the fixture, so the matched-target line is
  // the honest one to show.
  await expect(
    receipt.getByText('The submitted URL matched a public MyNews record'),
  ).toBeVisible();
  await expect(receipt.getByText('Keep the reference ID')).toBeVisible();
});
