import { expect, test, type Page } from '@playwright/test';
import type { BrowserDatabaseAdapter } from '../src/lib/storage/browser-database-adapter';

type StorageWindow = Window & {
  db: BrowserDatabaseAdapter;
  openDb: () => Promise<BrowserDatabaseAdapter>;
  attempts: number;
  failUntil: number;
};
async function openHarness(page: Page) {
  await page.route('**/storage-harness', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Storage acceptance</title>' }));
  await page.goto('/storage-harness');
  await page.evaluate(async () => {
    const path = '/src/lib/storage/browser-database-adapter.ts';
    const { createBrowserDatabaseAdapter, createIdbDbBytesStore } = await import(/* @vite-ignore */ path);
    const w = window as unknown as StorageWindow;
    const store = createIdbDbBytesStore('acceptance');
    w.attempts = 0;
    w.failUntil = 0;
    w.openDb = () => createBrowserDatabaseAdapter({
      persistDebounceMs: 60000,
      bytesStore: { ...store, write: async (bytes: Uint8Array) => {
        if (++w.attempts <= w.failUntil) throw new Error('QuotaExceededError');
        await store.write(bytes);
      } },
    });
  });
}

test('F1 shared IndexedDB refuses stale writers, transfers deletes, and recovers after owner termination', async ({ context, page }) => {
  await openHarness(page);
  await page.evaluate(async () => {
    const w = window as unknown as StorageWindow;
    w.db = await w.openDb();
    w.db.execute('CREATE TABLE notes(id TEXT PRIMARY KEY)');
    w.db.execute("INSERT INTO notes VALUES ('a')");
    await w.db.flush();
  });
  const b = await context.newPage(); // same browser context means shared IndexedDB
  await openHarness(b);
  const denied = await b.evaluate(async () => {
    try { await (window as unknown as StorageWindow).openDb(); return false; }
    catch (error) { return String(error).includes('another tab'); }
  });
  expect(denied).toBe(true);
  await page.close(); // no adapter.close(): browser releases a terminated owner's lock
  await b.evaluate(async () => {
    const w = window as unknown as StorageWindow;
    w.db = await w.openDb();
    w.db.transaction(() => {
      w.db.execute("DELETE FROM notes WHERE id='a'");
      w.db.execute("INSERT INTO notes VALUES ('b')");
    });
    await w.db.close(); // pending changes must be durable before ownership release
  });
  await b.reload();
  await openHarness(b);
  expect(await b.evaluate(async () => {
    const w = window as unknown as StorageWindow;
    w.db = await w.openDb();
    return w.db.query('SELECT * FROM notes');
  })).toEqual([{ id: 'b' }]);
});

test('F2 failed flush rejects before durable success in real IndexedDB', async ({ page }) => {
  await openHarness(page);
  const result = await page.evaluate(async () => {
    const w = window as unknown as StorageWindow;
    w.db = await w.openDb();
    w.db.execute('CREATE TABLE notes(id TEXT)');
    w.failUntil = 20;
    let rejected = false;
    try { await w.db.flush(); } catch { rejected = true; }
    return { rejected, attempts: w.attempts };
  });
  expect(result).toEqual({ rejected: true, attempts: 1 });
  await page.evaluate(async () => {
    const w = window as unknown as StorageWindow;
    w.db.execute("INSERT INTO notes VALUES ('retained')");
    w.failUntil = 0;
    await w.db.close();
    w.db = await w.openDb();
  });
  expect(await page.evaluate(() => (window as unknown as StorageWindow).db.query('SELECT * FROM notes'))).toEqual([{ id: 'retained' }]);
});

test('F1 unsupported browser capability fails closed', async ({ page }) => {
  await openHarness(page);
  expect(await page.evaluate(async () => {
    Object.defineProperty(navigator, 'locks', { value: undefined });
    try { await (window as unknown as StorageWindow).openDb(); return false; }
    catch (error) { return String(error).includes('Web Locks'); }
  })).toBe(true);
});

test('F2 permanent quota failure stops retries and exposes recovery in the browser', async ({ page }) => {
  await openHarness(page);
  await page.evaluate(async () => {
    const refreshPath = '/@react-refresh';
    const runtime = (await import(/* @vite-ignore */ refreshPath)).default;
    runtime.injectIntoGlobalHook(window);
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true });
    const path = '/e2e/storage-status-harness.tsx';
    const { showDatabaseStatus } = await import(/* @vite-ignore */ path);
    const w = window as unknown as StorageWindow;
    w.db = await w.openDb();
    showDatabaseStatus(w.db);
    w.failUntil = Infinity;
    w.db.execute('CREATE TABLE notes(id TEXT)');
    try { await w.db.flush(); } catch { /* visible recovery */ }
  });
  await expect(page.getByRole('alert')).toContainText('Changes are not saved');
  await expect(page.getByRole('alert')).toContainText('Automatic retries stopped', { timeout: 12000 });
  expect(await page.evaluate(() => (window as unknown as StorageWindow).attempts)).toBe(4);
  await page.screenshot({ path: '../../output/playwright/meerkat-remediation-2026-09-04/storage-unsaved.png' });
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export pending database' }).click();
  expect((await download).suggestedFilename()).toBe('meerkat-unsaved.sqlite');
  await page.evaluate(() => { (window as unknown as StorageWindow).failUntil = 0; });
  await page.getByRole('button', { name: 'Retry save' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (window as unknown as StorageWindow).db.getPersistenceState().status)).toBe('saved');
});

test('F1 secondary app tab explains safe takeover', async ({ context, page }) => {
  await page.goto('/');
  await expect(page.getByText('Booting Meerkat…')).toHaveCount(0);
  const b = await context.newPage();
  await b.goto('/');
  await expect(b.getByRole('heading', { name: 'Meerkat is open in another tab' })).toBeVisible();
  await page.close();
  await b.getByRole('button', { name: 'Open here' }).click();
  await expect(b.getByRole('heading', { name: 'Meerkat is open in another tab' })).toHaveCount(0);
  await expect(b.getByText('Booting Meerkat…')).toHaveCount(0);
});

test('F1 upgrade fences legacy tabs that do not participate in writer ownership', async ({ page }) => {
  await openHarness(page);
  expect(await page.evaluate(async () => {
    const old = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('meerkat-web', 4);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    // This is the actual v4 connection's existing upgrade handler behavior.
    old.onversionchange = () => old.close();
    const w = window as unknown as StorageWindow;
    w.db = await w.openDb();
    w.db.execute('CREATE TABLE retained(id TEXT)');
    await w.db.flush();
    return new Promise<string>((resolve) => {
      const reopen = indexedDB.open('meerkat-web', 4);
      reopen.onerror = () => resolve(reopen.error?.name ?? 'unknown');
      reopen.onsuccess = () => { reopen.result.close(); resolve('unsafe old writer'); };
    });
  })).toBe('VersionError');
});

test('F1 renderer crash releases ownership and preserves the last durable revision', async ({ context, page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Renderer crash injection uses Chromium DevTools.');
  await openHarness(page);
  expect(await page.evaluate(async () => {
    const w = window as unknown as StorageWindow;
    w.db = await w.openDb();
    w.db.execute('CREATE TABLE notes(id TEXT)');
    w.db.execute("INSERT INTO notes VALUES ('durable')");
    await w.db.flush();
    w.db.execute("INSERT INTO notes VALUES ('unsaved')");
    return w.db.getPersistenceState().pending;
  })).toBe(true);
  const session = await context.newCDPSession(page);
  const crashed = page.waitForEvent('crash');
  void session.send('Page.crash').catch(() => undefined);
  await crashed;
  const next = await context.newPage();
  await openHarness(next);
  expect(await next.evaluate(async () => {
    const w = window as unknown as StorageWindow;
    w.db = await w.openDb();
    return w.db.query('SELECT * FROM notes');
  })).toEqual([{ id: 'durable' }]);
});


test('F2 a failed recovery export remains visible and can be retried without losing pending rows', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openHarness(page);
  await page.evaluate(async () => {
    const refreshPath = '/@react-refresh';
    const runtime = (await import(/* @vite-ignore */ refreshPath)).default;
    runtime.injectIntoGlobalHook(window);
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true });
    const path = '/e2e/storage-status-harness.tsx';
    const { showDatabaseStatus } = await import(/* @vite-ignore */ path);
    const w = window as unknown as StorageWindow;
    w.db = await w.openDb();
    w.failUntil = Infinity;
    w.db.execute('CREATE TABLE notes(id TEXT)');
    w.db.execute("INSERT INTO notes VALUES ('keep-me')");
    try { await w.db.flush(); } catch { /* retain pending work */ }
    const original = w.db.export.bind(w.db);
    w.db.export = async () => {
      w.db.export = original;
      throw new Error('Injected export failure');
    };
    showDatabaseStatus(w.db);
  });
  await page.getByRole('button', { name: 'Export pending database' }).click();
  await expect(page.getByRole('alert')).toContainText('Could not prepare the recovery download. Keep this tab open and try exporting again.');
  expect(errors).toEqual([]);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export pending database' }).click();
  expect((await download).suggestedFilename()).toBe('meerkat-unsaved.sqlite');
  await expect(page.getByText('Could not prepare the recovery download.', { exact: false })).toHaveCount(0);
  expect(await page.evaluate(() => {
    const w = window as unknown as StorageWindow;
    return { pending: w.db.getPersistenceState().pending, rows: w.db.query('SELECT * FROM notes') };
  })).toEqual({ pending: true, rows: [{ id: 'keep-me' }] });
  expect(errors).toEqual([]);
});
