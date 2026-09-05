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

test.describe('MyBudget user flows', () => {
  test('budget buttons perform expected actions and persist data through UI pipelines', async ({ page }) => {
    const idSuffix = Date.now();
    const envelopeName = `E2E Envelope ${idSuffix}`;
    const accountName = `E2E Account ${idSuffix}`;
    const merchantName = `E2E Merchant ${idSuffix}`;
    const goalName = `E2E Goal ${idSuffix}`;
    const today = new Date().toISOString().slice(0, 10);

    await ensureModuleEnabledFromDiscover(page, 'MyBudget');

    await gotoWhenReady(page, '/budget');
    await expect(page.getByRole('heading', { name: 'Budget' })).toBeVisible();

    const newEnvelopeCard = cardByKicker(page, 'New Envelope');
    await newEnvelopeCard.getByPlaceholder('Envelope name').fill(envelopeName);
    await newEnvelopeCard.getByPlaceholder('0.00').fill('123.45');
    await newEnvelopeCard.getByRole('button', { name: 'Create' }).click();

    const envelopesSection = page
      .getByText('Envelopes', { exact: true })
      .first()
      .locator('xpath=ancestor::section[1]');
    await expect(envelopesSection.getByText(envelopeName)).toBeVisible();

    const newAccountCard = cardByKicker(page, 'New Account');
    await newAccountCard.getByPlaceholder('Account name').fill(accountName);
    await newAccountCard.getByPlaceholder('0.00').fill('500.50');
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
    await newTransactionCard.getByPlaceholder('Note (optional)').fill('Budget e2e transaction');
    await newTransactionCard.getByRole('button', { name: 'Create' }).click();

    const transactionsSection = page
      .getByText('Transactions', { exact: true })
      .last()
      .locator('xpath=ancestor::section[1]');
    await expect(transactionsSection.getByText(merchantName)).toBeVisible();

    const newGoalCard = cardByKicker(page, 'New Goal');
    await newGoalCard.getByPlaceholder('Goal name').fill(goalName);
    await newGoalCard.locator('select').selectOption({ label: envelopeName });
    await newGoalCard.getByPlaceholder('Target amount (0.00)').fill('1000.00');
    await newGoalCard.getByPlaceholder('Completed amount (0.00)').fill('150.00');
    await newGoalCard.locator('input[type="date"]').fill('2026-12-01');
    await newGoalCard.getByRole('button', { name: 'Create' }).click();

    const goalsSection = page
      .getByText('Goals', { exact: true })
      .first()
      .locator('xpath=ancestor::section[1]');
    const goalRow = goalsSection.locator('div').filter({ hasText: goalName }).first();
    await expect(goalRow.getByText(goalName)).toBeVisible();

    await goalRow.getByRole('button', { name: 'Complete' }).click();
    await expect(goalRow.getByRole('button', { name: 'Reopen' })).toBeVisible();

    await transactionsSection.locator('select').nth(0).selectOption('inflow');
    await expect(transactionsSection.getByText('No transactions for the current filter')).toBeVisible();

    await transactionsSection.locator('select').nth(0).selectOption('outflow');
    await expect(transactionsSection.getByText(merchantName)).toBeVisible();

    page.once('dialog', (dialog) => {
      dialog.accept();
    });
    await goalRow.getByRole('button', { name: 'Delete' }).click();
    await expect(goalsSection.getByText(goalName)).toHaveCount(0);
  });
});
