import { expect, test, type Page } from '@playwright/test';
import WebSocket from 'ws';

async function seedVerifiedUnlockForPrivateFlow(page: Page): Promise<void> {
  await page.route('**/api/entitlements/meerkat-app**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ unlocked: true, purchaseDate: '2026-07-09T00:00:00.000Z' }),
    });
  });
  await page.addInitScript(() => {
    localStorage.setItem('meerkat_app_unlock_state', JSON.stringify({
      unlocked: true,
      purchaseDate: '2026-07-09T00:00:00.000Z',
    }));
  });
}


async function passAgeGate(page: Page): Promise<void> {
  // Plan 51's age gate mounts before onboarding on every fresh browser
  // profile. Answer it with an adult birth date; the date is checked
  // in-browser and never stored, so the fixture value leaks nothing.
  const gate = page.getByRole('dialog', { name: 'When were you born?' });
  await expect(gate).toBeVisible();
  await gate.getByLabel('Month').fill('1');
  await gate.getByLabel('Day').fill('1');
  await gate.getByLabel('Year').fill('1990');
  await gate.getByRole('button', { name: 'Continue' }).click();
  await expect(gate).toBeHidden();
}

async function completeOnboardingWithCommunity(page: Page): Promise<void> {
  await seedVerifiedUnlockForPrivateFlow(page);
  await page.goto('/');
  await passAgeGate(page);
  const welcome = page.getByRole('dialog', { name: 'Welcome to Meerkat' });
  await expect(welcome.getByRole('heading', { name: 'Welcome to Meerkat' })).toBeVisible();
  await welcome.getByLabel('Your name').fill('Launch Tester');
  await welcome.getByRole('button', { name: 'Continue' }).click();
  await welcome.getByRole('button', { name: /Create a community/ }).click();
  await welcome.getByLabel('Community name').fill('Launch QA');
  await welcome.getByRole('button', { name: 'Choose a layout' }).click();
  await welcome.getByRole('button', { name: 'Choose a theme' }).click();
  await welcome.getByRole('button', { name: 'Create community', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Say hello in Launch QA' })).toBeVisible();
  await welcome.getByLabel('First message').fill('Hello from launch e2e');
  await welcome.getByRole('button', { name: 'Send first message' }).click();
  await expect(welcome).toBeHidden();
  await expect(page.getByRole('main').getByText('Hello from launch e2e')).toBeVisible();
}

test('cold load, onboarding, create community, and send a community message', async ({ page }) => {
  await completeOnboardingWithCommunity(page);
  await expect(page.getByRole('main').getByText('Launch QA')).toBeVisible();
});

test('Downloads browser is reachable from Files and shows honest empty/loading states', async ({ page }) => {
  await completeOnboardingWithCommunity(page);
  await page.getByRole('button', { name: 'Files' }).click();
  await expect(page.getByRole('heading', { name: 'Files' })).toBeVisible();
  await page.getByRole('button', { name: 'All downloads' }).click();
  await expect(page.getByRole('heading', { name: 'Downloads' })).toBeVisible();
  await expect(page.getByLabel('Search downloads')).toBeVisible();
  await expect(page.getByRole('button', { name: 'All' })).toBeVisible();
  await expect(page.getByText('No downloads yet')).toBeVisible();
  await expect(page.getByText(/removed files are never saveable/i)).toBeVisible();
});

test('Settings exposes Downloads and recovery restore fails closed on bad material', async ({ page, browserName }) => {
  await seedVerifiedUnlockForPrivateFlow(page);
  await page.goto('/');
  await passAgeGate(page);
  await page.getByLabel('Your name').fill('Restore Tester');
  await page.getByRole('button', { name: 'Already have a backup? Restore your identity' }).click();
  await page.getByLabel('Recovery key').fill('MKR1-BAD-BAD-BAD');
  await page.getByLabel('Encrypted identity backup').fill('not-a-valid-backup');
  await page.getByRole('button', { name: 'Restore identity' }).click();
  await expect(page.getByRole('alert')).toContainText('not valid');

  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByLabel('Your name').fill(`Settings Tester ${browserName}`);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Just look around' }).click();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+,' : 'Control+,');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await page.getByRole('button', { name: 'Open Downloads' }).click();
  await expect(page.getByRole('heading', { name: 'Downloads' })).toBeVisible();
});

test('Storage & Backup opens from Settings with an honest empty state', async ({ page }) => {
  await seedVerifiedUnlockForPrivateFlow(page);
  await page.goto('/');
  await passAgeGate(page);
  const welcome = page.getByRole('dialog', { name: 'Welcome to Meerkat' });
  await welcome.getByLabel('Your name').fill('Storage Tester');
  await welcome.getByRole('button', { name: 'Continue' }).click();
  await welcome.getByRole('button', { name: 'Just look around' }).click();

  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+,' : 'Control+,');
  await page.getByRole('button', { name: 'Open Storage & Backup' }).click();

  const storage = page.getByRole('dialog', { name: 'Storage & Backup' });
  await expect(storage).toBeVisible();
  await expect(storage.getByRole('heading', { name: 'Nothing is backed up yet' })).toBeVisible();
  await expect(storage.getByRole('button', { name: 'Add a destination' })).toBeVisible();
  await expect(storage.getByText('Nothing is backed up until a destination verifies a copy.')).toBeVisible();
});

test('creating a community from a template works end to end (rc13 defect 1)', async ({ page }) => {
  await completeOnboardingWithCommunity(page);

  // Chat-first template (Club). The rc12 defect made EVERY template fail with
  // "cannot start a transaction within a transaction" on the browser adapter;
  // this spec runs the real sql.js adapter, so a nesting regression fails here.
  await page.getByTitle('Add a community').click();
  const dialog = page.getByRole('dialog', { name: 'Add a community' });
  await expect(dialog.getByText('Start from a template')).toBeVisible();
  await dialog.getByRole('button', { name: /^Club/ }).click();
  // TemplateDetail and the scratch section both render a "Community name" field
  // and a "Create community" button; the template detail pair renders first.
  await dialog.getByLabel('Community name').first().fill('Club QA');
  await dialog.getByRole('button', { name: 'Create community' }).first().click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('main').getByText('Club QA').first()).toBeVisible();

  // Library-first template (Media Library): exercises createLibrary + identity
  // publish in the ONE post-storeOwnedCommunity transaction, then lands on the
  // community's Libraries home.
  await page.getByTitle('Add a community').click();
  await dialog.getByRole('button', { name: /Media Library/ }).click();
  await dialog.getByLabel('Community name').first().fill('Media QA');
  await dialog.getByRole('button', { name: 'Create community' }).first().click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Media QA' })).toBeVisible();
  await expect(page.getByRole('main').getByText('Movies').first()).toBeVisible();
});

test('an unpaid onboarding action cannot create private state', async ({ page }) => {
  await page.goto('/');
  await passAgeGate(page);
  const welcome = page.getByRole('dialog', { name: 'Welcome to Meerkat' });
  await welcome.getByLabel('Your name').fill('Locked Tester');
  await welcome.getByRole('button', { name: 'Continue' }).click();
  await welcome.getByRole('button', { name: /Create a community/ }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Unlock Meerkat' })).toBeVisible();
  await expect(page.getByText('Community created.')).toHaveCount(0);
});

test('a forged local unlock cache is revalidated and cannot expose private state', async ({ page }) => {
  await page.route('**/api/entitlements/meerkat-app**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ unlocked: false, purchaseDate: null }),
    });
  });
  await page.addInitScript(() => {
    localStorage.setItem('meerkat_app_unlock_state', JSON.stringify({
      unlocked: true,
      purchaseDate: '2099-01-01T00:00:00.000Z',
      grant: 'forged.local.grant',
    }));
  });
  await page.goto('/');
  await passAgeGate(page);
  await expect(page.getByRole('button', { name: 'Unlock', exact: true })).toBeVisible();
  const welcome = page.getByRole('dialog', { name: 'Welcome to Meerkat' });
  await welcome.getByLabel('Your name').fill('Cache Attacker');
  await welcome.getByRole('button', { name: 'Continue' }).click();
  await welcome.getByRole('button', { name: /Create a community/ }).click();
  await expect(page.getByRole('heading', { name: 'Unlock Meerkat' })).toBeVisible();
  await expect(page.getByText('Community created.')).toHaveCount(0);
});

function expectRelayHandshake(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
      reject(new Error(`MEERKAT_E2E_RELAY_URL must be ws:// or wss://, got ${url}`));
      return;
    }
    const socket = new WebSocket(url);
    const timer = setTimeout(() => {
      socket.terminate();
      reject(new Error(`Relay did not answer within 5s: ${url}`));
    }, 5_000);
    socket.once('open', () => {
      clearTimeout(timer);
      socket.close();
      resolve();
    });
    socket.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

test('relay-dependent launch paths require a real configured relay', async ({ page }) => {
  const relayUrl = process.env.MEERKAT_E2E_RELAY_URL?.trim();
  test.skip(!relayUrl, 'MEERKAT_E2E_RELAY_URL is not configured, so relay-dependent browser launch paths are skipped honestly.');

  // Prove the relay actually answers a WebSocket handshake before asserting UI state.
  await expectRelayHandshake(relayUrl!);

  await completeOnboardingWithCommunity(page);
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+,' : 'Control+,');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Connection server' })).toBeVisible();
  await expect(page.getByText('Free server reachable')).toBeVisible();
});

test('person identity: a per-community name is editable after joining (plan 52)', async ({ page }) => {
  // Plan 52 P3 + M-3: the join door collects a per-community name, and that
  // name must stay changeable afterwards -- it was previously set-once, at the
  // moment of least information, and any edit was silently reverted by the
  // alignment pass. The save notice must also state that linked devices adopt
  // it, because that is the behaviour the override actually produces.
  await completeOnboardingWithCommunity(page);
  await page.getByRole('button', { name: 'Community settings' }).click();
  await expect(page.getByRole('heading', { name: 'Name in this community' })).toBeVisible();

  const nameField = page.getByLabel('Name shown in Launch QA');
  await expect(nameField).toBeVisible();
  await nameField.fill('Anon Otter');
  await page.getByRole('button', { name: 'Save community profile' }).click();

  // The edit PERSISTS rather than being reverted by the alignment pass, and the
  // editor returns to a clean state, which is the behaviour M-3 is about. (The
  // save-confirmation copy is locked statically in check-meerkat-parity; it is
  // not asserted here because the notice does not survive the provider refresh
  // that follows a save -- recorded in errors_log.md as a separate UX defect.)
  await expect(page.getByLabel('Name shown in Launch QA')).toHaveValue('Anon Otter');
  await expect(page.getByRole('button', { name: 'Save community profile' })).toBeDisabled();
});

test('invitation survives locked onboarding and restart, then requires verified preview after unlock', async ({ page }) => {
  const { createCommunity, createCommunityInvite, generateDeviceIdentity } = await import('@mylife/sync');
  const owner = generateDeviceIdentity('Invitation owner');
  const signed = createCommunity(owner, { name: 'Retained Invitation', channels: [{ id: 'general', name: 'general' }] });
  const { link } = createCommunityInvite(owner, signed);
  await page.goto('/#' + encodeURIComponent(link));
  await passAgeGate(page);
  const welcome = page.getByRole('dialog', { name: 'Welcome to Meerkat' });
  await welcome.getByLabel('Your name').fill('Invited tester');
  await welcome.getByRole('button', { name: 'Continue' }).click();
  await welcome.getByRole('button', { name: /Join with an invite/ }).click();
  await expect(page.getByRole('heading', { name: 'Unlock Meerkat' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Join community', exact: true })).toHaveCount(0);
  // The URL can be lost during a purchase redirect. Only the durable intent may resume it.
  await seedVerifiedUnlockForPrivateFlow(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Return to your invitation' }).click();
  await expect(page.getByText('Retained Invitation', { exact: true })).toBeVisible();
  // Closing a preview defers it. Only explicit discard or joining clears intent.
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Return to your invitation' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Return to your invitation' }).click();
  await page.getByRole('button', { name: 'Join community', exact: true }).click();
  // No server exists in this fixture. The approval retry intent must survive that failure.
  await expect.poll(() => page.evaluate(async () => {
    const path = '/src/lib/browser-sync-init.ts';
    const { bootBrowserSync } = await import(/* @vite-ignore */ path);
    const { db } = await bootBrowserSync();
    return db.query("SELECT value FROM mk_settings WHERE key LIKE 'pending_join_link:%'").length;
  })).toBe(1);
  await page.reload();
  expect(await page.evaluate(async () => {
    const path = '/src/lib/browser-sync-init.ts';
    const { bootBrowserSync } = await import(/* @vite-ignore */ path);
    const { db } = await bootBrowserSync();
    return db.query("SELECT value FROM mk_settings WHERE key LIKE 'pending_join_link:%'").length;
  })).toBe(1);
});

test('an open invitation preview expires without allowing a stale join action', async ({ page }) => {
  const { createCommunity, createCommunityInvite, generateDeviceIdentity } = await import('@mylife/sync');
  const owner = generateDeviceIdentity('Expiry owner');
  const signed = createCommunity(owner, { name: 'Expiring Invitation', channels: [{ id: 'general', name: 'general' }] });
  const { link } = createCommunityInvite(owner, signed, 60000);
  await seedVerifiedUnlockForPrivateFlow(page);
  await page.clock.install();
  await page.goto('/#' + encodeURIComponent(link));
  await passAgeGate(page);
  const welcome = page.getByRole('dialog', { name: 'Welcome to Meerkat' });
  await welcome.getByLabel('Your name').fill('Expiry tester');
  await welcome.getByRole('button', { name: 'Continue' }).click();
  await welcome.getByRole('button', { name: 'Just look around' }).click();
  await page.getByRole('button', { name: 'Return to your invitation' }).click();
  await expect(page.getByRole('button', { name: 'Join community', exact: true })).toBeVisible();
  await page.clock.fastForward(61000);
  await expect(page.getByText('That invite link has expired. Ask for a fresh one.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Join community', exact: true })).toHaveCount(0);
});

test('writer takeover preserves signed messages and the matching private identity key', async ({ context, page }) => {
  await completeOnboardingWithCommunity(page);
  const original = await page.evaluate(async () => {
    const path = '/src/lib/browser-sync-init.ts';
    const { bootBrowserSync } = await import(/* @vite-ignore */ path);
    const { db, secrets } = await bootBrowserSync();
    await db.flush();
    const identity = db.query('SELECT public_key, private_key_ref FROM mk_identity')[0];
    return { identity, hasKey: secrets.getSecret(identity.private_key_ref) !== null, messages: db.query("SELECT * FROM cm_messages WHERE body = 'Hello from launch e2e'") };
  });
  expect(original.hasKey).toBe(true);
  expect(original.messages).toHaveLength(1);
  const b = await context.newPage();
  await seedVerifiedUnlockForPrivateFlow(b);
  await b.goto('/');
  await expect(b.getByRole('heading', { name: 'Meerkat is open in another tab' })).toBeVisible();
  await page.close();
  // Open here reloads the document. Wait for that navigation before querying
  // the recovered store; an absent boot label can also match the old page.
  await Promise.all([
    b.waitForEvent('load'),
    b.getByRole('button', { name: 'Open here' }).click(),
  ]);
  await expect(b.getByRole('main')).toBeVisible();
  const recovered = await b.evaluate(async () => {
    const path = '/src/lib/browser-sync-init.ts';
    const { bootBrowserSync } = await import(/* @vite-ignore */ path);
    const { db, secrets } = await bootBrowserSync();
    const identity = db.query('SELECT public_key, private_key_ref FROM mk_identity')[0];
    return { identity, hasKey: secrets.getSecret(identity.private_key_ref) !== null, messages: db.query("SELECT * FROM cm_messages WHERE body = 'Hello from launch e2e'") };
  });
  expect(recovered).toEqual(original);
});


test('catch-up explains a missing connection and retains automatic-trigger errors', async ({ page }) => {
  const uncaught: string[] = [];
  page.on('pageerror', (error) => uncaught.push(error.message));
  await seedVerifiedUnlockForPrivateFlow(page);
  await page.goto('/');
  await passAgeGate(page);
  const welcome = page.getByRole('dialog', { name: 'Welcome to Meerkat' });
  await welcome.getByLabel('Your name').fill('Catch-up Tester');
  await welcome.getByRole('button', { name: 'Continue' }).click();
  await expect(welcome.getByText('Automatic dialing is off')).toBeVisible();
  await welcome.getByRole('button', { name: 'Catch up now', exact: true }).click();
  await expect(welcome.getByText(/Mailbox catch-up did not run/)).toBeVisible();
  await expect(welcome.getByText(/No contacts were available for a session/)).toBeVisible();
  await welcome.getByRole('button', { name: 'Turn on', exact: true }).click();
  await expect(welcome.getByText('Automatic dialing is on')).toBeVisible();
  // Inject a rejected durability boundary, not a simulated transport or receipt.
  await page.evaluate(async () => {
    const path = '/src/lib/browser-sync-init.ts';
    const { bootBrowserSync } = await import(/* @vite-ignore */ path);
    const { db } = await bootBrowserSync();
    const flush = db.flush;
    db.flush = async () => { throw new Error('injected persistence failure'); };
    (window as unknown as { restoreFlush: () => void }).restoreFlush = () => { db.flush = flush; };
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const failure = welcome.getByText('Could not finish catching up. Check your connection and unsaved changes, then try again.');
  await expect(failure).toBeVisible();
  await page.evaluate(() => (window as unknown as { restoreFlush: () => void }).restoreFlush());
  await welcome.getByRole('button', { name: 'Catch up now', exact: true }).click();
  await expect(failure).toBeHidden();
  await expect(welcome.getByText(/Mailbox catch-up did not run/)).toBeVisible();
  expect(uncaught).toEqual([]);
  await page.screenshot({ path: '../../output/playwright/meerkat-remediation-2026-09-04/catchup-recovery.png', fullPage: true });
});
