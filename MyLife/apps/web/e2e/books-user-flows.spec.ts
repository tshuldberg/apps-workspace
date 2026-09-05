import { expect, test } from '@playwright/test';
import { ensureModuleEnabledFromDiscover, gotoWhenReady } from './helpers';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test.describe('MyBooks user flows', () => {
  test('search/add, page navigation, and stats all work', async ({ page }) => {
    const idSuffix = Date.now();
    const title = `E2E Search Book ${idSuffix}`;
    const author = 'E2E Author';

    await ensureModuleEnabledFromDiscover(page, 'MyBooks');

    await page.route('https://openlibrary.org/search.json**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          docs: [
            {
              key: `/works/OL${idSuffix}W`,
              title,
              author_name: [author],
              cover_edition_key: `OL${idSuffix}M`,
              first_publish_year: 2020,
              isbn: ['1234567890', '1234567890123'],
              number_of_pages_median: 321,
            },
          ],
        }),
      });
    });

    await gotoWhenReady(page, '/books/search');
    await page
      .getByPlaceholder('Search your digital sanctuary...')
      .fill(`e2e-${idSuffix}`);
    await page.keyboard.press('Enter');

    await expect(page.getByText(title)).toBeVisible();
    await page.getByRole('button', { name: 'Add to library' }).click();
    await expect(page.getByRole('button', { name: 'Added to library' })).toBeDisabled();

    await gotoWhenReady(page, '/books');
    await expect(page.getByRole('heading', { name: 'MyBooks' })).toBeVisible();
    const libraryBookLink = page
      .getByRole('link', { name: new RegExp(escapeRegex(title)) })
      .first();
    await expect(libraryBookLink).toBeVisible();

    await libraryBookLink.click();
    await expect(page).toHaveURL(/\/books\/.+/);
    await expect(page.getByRole('heading', { name: title })).toBeVisible();

    await gotoWhenReady(page, '/books/stats');
    await expect(page.getByRole('heading', { name: 'Reading Stats' })).toBeVisible();
    await expect(page.getByText(/Total books/i)).toBeVisible();
    await expect(page.getByText('DNF')).toBeVisible();
  });

  test('csv import button flow populates library data', async ({ page }) => {
    const idSuffix = Date.now();
    const importedTitle = `E2E Imported Book ${idSuffix}`;
    const csv = `Title,Authors\n${importedTitle},E2E Import Author\n`;

    await ensureModuleEnabledFromDiscover(page, 'MyBooks');

    await gotoWhenReady(page, '/books/import');
    await page.getByRole('button', { name: 'StoryGraph' }).click();

    await page.locator('input[type="file"]').setInputFiles({
      name: 'storygraph.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv, 'utf8'),
    });

    await expect(page.getByText(importedTitle)).toBeVisible();
    await page.getByRole('button', { name: /Import \d+ Books/i }).click();
    await expect(page.getByText('Previous Batch Summary')).toBeVisible();
    await expect(page.getByText(/Books Imported/i)).toBeVisible();

    await gotoWhenReady(page, '/books');
    await expect(
      page.getByRole('link', { name: new RegExp(escapeRegex(importedTitle)) }).first(),
    ).toBeVisible();
  });
});
