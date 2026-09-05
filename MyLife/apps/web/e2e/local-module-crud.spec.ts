import { expect, test, type Locator, type Page } from '@playwright/test';
import { ensureModuleEnabledFromDiscover, gotoWhenReady } from './helpers';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cardByKicker(page: Page, kicker: string, occurrence: 'first' | 'last' = 'first'): Locator {
  const locator = page
    .locator('p')
    .filter({ hasText: new RegExp(`^${escapeRegex(kicker)}$`) })
    .locator('xpath=ancestor::section[1]');
  return occurrence === 'last' ? locator.last() : locator.first();
}

test.describe('Current local module flows', () => {
  test('BestChef recipe create and library search flow', async ({ page }) => {
    const recipeName = `E2E Pasta ${Date.now()}`;

    // The recipes module ships under the BestChef name (modules/bestchef).
    await ensureModuleEnabledFromDiscover(page, 'BestChef');
    await gotoWhenReady(page, '/recipes/add');
    await expect(page.getByRole('heading', { name: 'New Masterpiece' })).toBeVisible();

    await page.getByPlaceholder('e.g. Saffron Infused Wild Risotto').fill(recipeName);
    await page.getByPlaceholder('A brief description of this recipe...').fill('Created by the web e2e suite.');
    await page.getByPlaceholder('20 min').fill('10');
    await page.getByPlaceholder('45 min').fill('25');
    await page.getByPlaceholder('4', { exact: true }).fill('6');
    await page.getByRole('button', { name: 'Save Recipe' }).click();

    await expect(page).toHaveURL(/\/recipes$/);
    await gotoWhenReady(page, '/recipes/library');
    await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();

    const search = page.getByPlaceholder('SEARCH COLLECTION...');
    await search.fill(recipeName);
    await search.press('Enter');
    await expect(page.getByText(recipeName)).toBeVisible();
  });

  test('MyCar garage add and delete flow', async ({ page }) => {
    const vehicleName = `E2E Car ${Date.now()}`;

    await gotoWhenReady(page, '/car/garage');
    await expect(page.getByRole('heading', { name: 'Garage' })).toBeVisible();

    await page.getByPlaceholder('Nickname (optional)').fill(vehicleName);
    await page.getByPlaceholder('Make *').fill('Honda');
    await page.getByPlaceholder('Model *').fill('Civic');
    await page.getByPlaceholder('Year').fill('2023');
    await page.getByPlaceholder('Odometer').fill('12345');
    await page.getByRole('button', { name: 'Save Vehicle' }).click();

    await expect(page.getByText(vehicleName)).toBeVisible();
    await page.getByRole('button', { name: 'Delete' }).first().click();
    await page.getByRole('button', { name: 'Confirm' }).first().click();
    await expect(page.getByText(vehicleName)).toHaveCount(0);
  });

  test('MyHabits dashboard and library surfaces render', async ({ page }) => {
    await ensureModuleEnabledFromDiscover(page, 'MyHabits');
    await gotoWhenReady(page, '/habits');

    await expect(
      page.getByText(/Today.s habit board, streak pressure, and recovery context\./),
    ).toBeVisible();

    await expect(page.getByRole('link', { name: /Open habit library/ })).toBeVisible();
    await gotoWhenReady(page, '/habits/habits');
    await expect(page).toHaveURL(/\/habits\/habits$/);
    await expect(page.getByText('Every habit, grouped by area and ready for review.')).toBeVisible();
    await expect(page.getByPlaceholder('Search habits')).toBeVisible();
  });

  test('MyMeds prescription create, dose, and archive flow', async ({ page }) => {
    const medName = `E2E Med ${Date.now()}`;

    await ensureModuleEnabledFromDiscover(page, 'MyMeds');
    await gotoWhenReady(page, '/meds/medications');
    await expect(page.getByText('Medication list')).toBeVisible();

    await page.getByPlaceholder('Medication name').fill(medName);
    await page.getByPlaceholder('Dose').fill('250');
    await page.getByPlaceholder('Unit').fill('mg');
    await page.getByPlaceholder('Prescriber', { exact: true }).fill('E2E Clinic');
    await page.getByRole('button', { name: 'Create prescription' }).click();

    const medRow = page.getByRole('row').filter({ hasText: medName });
    await expect(medRow).toBeVisible();
    await expect(medRow.getByText('250 mg')).toBeVisible();

    await page.getByRole('button', { name: 'Take dose' }).click();
    await expect(page.getByText(medName).first()).toBeVisible();

    await page.getByRole('button', { name: 'Archive', exact: true }).click();
    await expect(medRow).toHaveCount(0);
  });

  test('MyBudget envelope, account, and transaction flow', async ({ page }) => {
    const idSuffix = Date.now();
    const envelopeName = `E2E Env ${idSuffix}`;
    const accountName = `E2E Acct ${idSuffix}`;
    const merchantName = `E2E Merchant ${idSuffix}`;
    const today = new Date().toISOString().slice(0, 10);

    await ensureModuleEnabledFromDiscover(page, 'MyBudget');
    await gotoWhenReady(page, '/budget');
    await expect(page.getByRole('heading', { name: 'Budget' })).toBeVisible();

    const newEnvelopeCard = cardByKicker(page, 'New Envelope');
    await newEnvelopeCard.getByPlaceholder('Envelope name').fill(envelopeName);
    await newEnvelopeCard.getByPlaceholder('0.00').fill('500.00');
    await newEnvelopeCard.getByRole('button', { name: 'Create' }).click();

    const envelopesSection = page
      .getByText('Envelopes', { exact: true })
      .first()
      .locator('xpath=ancestor::section[1]');
    await expect(envelopesSection.getByText(envelopeName)).toBeVisible();

    const newAccountCard = cardByKicker(page, 'New Account');
    await newAccountCard.getByPlaceholder('Account name').fill(accountName);
    await newAccountCard.getByPlaceholder('0.00').fill('1000.00');
    await newAccountCard.getByRole('button', { name: 'Create' }).click();

    const accountsSection = page
      .getByText('Accounts', { exact: true })
      .first()
      .locator('xpath=ancestor::section[1]');
    await expect(accountsSection.getByRole('link', { name: accountName })).toBeVisible();

    const newTransactionCard = cardByKicker(page, 'New Transaction');
    await newTransactionCard.getByPlaceholder('0.00').fill('42.35');
    await newTransactionCard.locator('input[type="date"]').fill(today);
    await newTransactionCard.getByPlaceholder('Merchant (optional)').fill(merchantName);
    await newTransactionCard.locator('select').nth(1).selectOption({ label: accountName });
    await newTransactionCard.locator('select').nth(2).selectOption({ label: envelopeName });
    await newTransactionCard.getByPlaceholder('Note (optional)').fill('Budget e2e test');
    await newTransactionCard.getByRole('button', { name: 'Create' }).click();

    const transactionsSection = page
      .getByText('Transactions', { exact: true })
      .last()
      .locator('xpath=ancestor::section[1]');
    await expect(transactionsSection.getByText(merchantName)).toBeVisible();

    await transactionsSection.locator('select').nth(0).selectOption('inflow');
    await expect(transactionsSection.getByText('No transactions for the current filter')).toBeVisible();

    await transactionsSection.locator('select').nth(0).selectOption('outflow');
    await expect(transactionsSection.getByText(merchantName)).toBeVisible();
  });
});
