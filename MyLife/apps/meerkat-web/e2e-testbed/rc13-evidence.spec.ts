// rc13 defect evidence spec (QA harness only, never committed to the release
// tree). Runs against a LIVE testbed (real relay + real production web bundle)
// in two ISOLATED browser contexts, so identities, keys, and SQLite databases
// are genuinely separate devices.
//
//   MODE=prefix   expects the rc12 defects: template creation throws
//                 "cannot start a transaction within a transaction", and a
//                 sync run > 60s after the Sync dialog opened fails with
//                 "No relay URL configured." while the card still says
//                 "Free server reachable".
//   MODE=postfix  expects the rc13 fixes: all six templates create, and the
//                 same > 60s-stale sync completes over the free default.
//
// Origin comes from TESTBED_ORIGIN. Screenshots land in shots/.

import { expect, test, type BrowserContext, type Page } from '@playwright/test';

const ORIGIN = process.env.TESTBED_ORIGIN ?? 'http://127.0.0.1:8899';
const MODE = process.env.MODE === 'prefix' ? 'prefix' : 'postfix';
const SHOTS = new URL('../../../artifacts/meerkat-testbed/shots/', import.meta.url).pathname;
const TEMPLATES = ['Family Space', 'Media Library', 'Club', 'Course Hub', 'Newsroom', 'Blank'];

test.setTimeout(300_000);

async function bootDevice(context: BrowserContext, name: string): Promise<Page> {
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem('meerkat_app_unlock_state', JSON.stringify({
      unlocked: true,
      purchaseDate: '2026-07-09T00:00:00.000Z',
    }));
  });
  await page.goto(ORIGIN);
  const gate = page.getByRole('dialog', { name: 'When were you born?' });
  await expect(gate).toBeVisible();
  await gate.getByLabel('Month').fill('1');
  await gate.getByLabel('Day').fill('1');
  await gate.getByLabel('Year').fill('1990');
  await gate.getByRole('button', { name: 'Continue' }).click();
  const welcome = page.getByRole('dialog', { name: 'Welcome to Meerkat' });
  await welcome.getByLabel('Your name').fill(name);
  await welcome.getByRole('button', { name: 'Continue' }).click();
  await welcome.getByRole('button', { name: 'Just look around' }).click();
  await expect(welcome).toBeHidden();
  return page;
}

async function openSync(page: Page): Promise<void> {
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+,' : 'Control+,');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await page.getByRole('button', { name: 'Open Sync' }).click();
  await expect(page.getByRole('dialog', { name: 'Sync' })).toBeVisible();
}

async function pairingCode(page: Page): Promise<string> {
  const code = await page.getByLabel("This device's pairing code").innerText();
  expect(code.trim()).toMatch(/^MKPAIR1-/);
  return code.trim();
}

test('rc13 defect evidence over the live testbed', async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await bootDevice(ctxA, 'Device A');
  const b = await bootDevice(ctxB, 'Device B');

  // --- Defect 1: community creation from templates -------------------------
  const toTry = MODE === 'prefix' ? TEMPLATES.slice(0, 2) : TEMPLATES;
  for (const [i, name] of toTry.entries()) {
    await a.getByTitle('Add a community').click();
    const dialog = a.getByRole('dialog', { name: 'Add a community' });
    await dialog.getByRole('button', { name: new RegExp(`^${name}`) }).click();
    await dialog.getByLabel('Community name').first().fill(`${name} rc13`);
    await dialog.getByRole('button', { name: 'Create community' }).first().click();
    if (MODE === 'prefix') {
      await expect(dialog.getByRole('alert')).toContainText('cannot start a transaction');
      await a.screenshot({ path: `${SHOTS}rc13-prefix-template-${i + 1}-fails.png` });
      await dialog.getByRole('button', { name: 'Close' }).click();
    } else {
      await expect(dialog).toBeHidden();
      await a.screenshot({ path: `${SHOTS}rc13-postfix-template-${i + 1}-${name.toLowerCase().replace(/ /g, '-')}-created.png` });
    }
  }

  // --- Defect 2: free-default relay after > 60s of probe staleness ---------
  await openSync(a);
  await openSync(b);
  const codeA = await pairingCode(a);
  const codeB = await pairingCode(b);
  await a.getByLabel('Peer pairing code').fill(codeB);
  await a.getByRole('button', { name: 'Pair device' }).click();
  await b.getByLabel('Peer pairing code').fill(codeA);
  await b.getByRole('button', { name: 'Pair device' }).click();
  await expect(a.getByText('Paired devices: 1')).toBeVisible();
  await expect(b.getByText('Paired devices: 1')).toBeVisible();

  // Age the probe cache past RELAY_PROBE_TTL_MS (60s). In prefix mode nothing
  // refreshes it (the card probed once on mount); in postfix mode the dial
  // path re-probes on demand, so the wait must not matter.
  await a.waitForTimeout(70_000);

  const phrase = 'rc13 evidence shared phrase';
  await b.getByLabel('Shared rendezvous phrase').fill(phrase);
  await a.getByLabel('Shared rendezvous phrase').fill(phrase);

  // Both the AutoConnect card and the Manual session render a "Sync now"
  // button; the manual one is last in the dialog DOM.
  const manualSyncA = a.getByRole('button', { name: 'Sync now', exact: true }).last();

  if (MODE === 'prefix') {
    // The pre-fix defect manifests one of two ways depending on whether a
    // provider refresh re-read the stale cache: the manual button goes dead
    // (relayUrl state recomputed to ''), or the click fails with the observed
    // "No relay URL configured." Either way the free default is unusable
    // > 60s after the last probe write, while the relay itself is up.
    if (await manualSyncA.isDisabled()) {
      await a.screenshot({ path: `${SHOTS}rc13-prefix-stale-probe-sync-dead.png`, fullPage: true });
    } else {
      await b.getByRole('button', { name: 'Listen', exact: true }).click();
      await a.waitForTimeout(1_500);
      await manualSyncA.click();
      await expect(a.getByRole('status')).toContainText('No relay URL configured', { timeout: 30_000 });
      await a.screenshot({ path: `${SHOTS}rc13-prefix-stale-probe-sync-fails.png`, fullPage: true });
    }
  } else {
    await expect(manualSyncA).toBeEnabled({ timeout: 15_000 });
    await b.getByRole('button', { name: 'Listen', exact: true }).click();
    await a.waitForTimeout(1_500);
    await manualSyncA.click();
    await expect(a.getByRole('status')).toContainText('Session completed', { timeout: 30_000 });
    await a.getByRole('status').scrollIntoViewIfNeeded();
    await a.screenshot({ path: `${SHOTS}rc13-postfix-stale-probe-sync-completes.png`, fullPage: true });
  }

  await ctxA.close();
  await ctxB.close();
});
