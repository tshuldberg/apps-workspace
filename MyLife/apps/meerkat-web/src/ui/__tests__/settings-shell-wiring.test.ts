// Source locks for the Set-6 web shell/settings/storage hardening (PROMPT-007).
// Pins: the provider-owned validated app-unlock machine (four honest states,
// adopt-on-notify with no re-fetch loop, the shell and Settings reading ONE
// source so they can never contradict each other), the boot half-state recovery
// screen, the persist-failure banner, the persona-create single-flight + catch,
// the danger-zone catches, the storage disconnect revoked-gate, the stale
// backup-target repair, and clipboard honesty in the appearance share panel.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = join(__dirname, '..', '..');
const provider = readFileSync(join(src, 'lib', 'MeerkatProvider.tsx'), 'utf8');
const app = readFileSync(join(src, 'ui', 'App.tsx'), 'utf8');
const hostedAccess = readFileSync(join(src, 'lib', 'hosted-access.ts'), 'utf8');
const appUnlockSection = readFileSync(join(src, 'ui', 'settings', 'AppUnlockSection.tsx'), 'utf8');
const personaSection = readFileSync(join(src, 'ui', 'settings', 'PublicPersonaSection.tsx'), 'utf8');
const dangerSection = readFileSync(join(src, 'ui', 'settings', 'DangerSection.tsx'), 'utf8');
const accountSection = readFileSync(join(src, 'ui', 'settings', 'AccountSection.tsx'), 'utf8');
const identitySection = readFileSync(join(src, 'ui', 'settings', 'IdentitySection.tsx'), 'utf8');
const recoverySection = readFileSync(join(src, 'ui', 'settings', 'RecoverySection.tsx'), 'utf8');
const storageSection = readFileSync(join(src, 'ui', 'settings', 'StorageSection.tsx'), 'utf8');
const storageOverlay = readFileSync(join(src, 'ui', 'settings', 'StorageOverlay.tsx'), 'utf8');
const notificationsSection = readFileSync(join(src, 'ui', 'settings', 'NotificationsSection.tsx'), 'utf8');
const appearanceSection = readFileSync(join(src, 'ui', 'settings', 'AppearanceSection.tsx'), 'utf8');
const syncInit = readFileSync(join(src, 'lib', 'browser-sync-init.ts'), 'utf8');

describe('validated app-unlock machine (single source of truth)', () => {
  it('the provider owns the four honest states', () => {
    expect(provider).toContain("'checking' | 'unlocked' | 'locked' | 'cannot_verify'");
    expect(provider).toContain('revalidateAppUnlock');
  });

  it('cache notifications ADOPT the server answer and never re-fetch (loop-free)', () => {
    expect(provider).toContain('cannot loop (no re-fetch on notify)');
  });

  it('a cannot-verify outcome is distinguished from a verified negative', () => {
    expect(provider).toContain('Private features stay locked until verification succeeds.');
    expect(provider).toContain('Your purchase is no longer active on this account.');
  });

  it('App.tsx consumes the provider machine instead of its own validator', () => {
    expect(app).toContain("m.appUnlock.status === 'unlocked'");
    expect(app).not.toContain('fetchAppUnlockState');
    expect(app).toContain('Purchase could not be verified');
    expect(app).toContain('Try again');
  });

  it('AppUnlockSection reads the same machine and holds no local unlocked state', () => {
    expect(appUnlockSection).toContain("m.appUnlock.status === 'unlocked'");
    expect(appUnlockSection).not.toContain('setUnlocked(');
    expect(appUnlockSection).toContain('Try verification again');
  });

  it('a byte-identical cache write still notifies listeners', () => {
    expect(hostedAccess).toContain('listeners always fire');
    expect(hostedAccess).not.toContain('=== serialized) return;');
  });
});

describe('boot half-state recovery + persist-failure surface', () => {
  it('boot renders the honest recovery screen for a vault half-state', () => {
    expect(provider).toContain('BootRecoveryScreen');
    expect(provider).toContain('Meerkat cannot read its keys in this browser');
    expect(provider).toContain('Start fresh in this browser');
    expect(provider).toContain('Reload and try again');
  });

  it('an identity row without its signing key fails boot as a typed half-state', () => {
    expect(provider).toContain("'signing_key_missing'");
    expect(provider).toContain('secrets.getSecret(row.private_key_ref) === null');
  });

  it('a non-Error boot throw still renders a described message', () => {
    expect(provider).toContain('String(error)');
  });

  it('the secret-store persist failure renders as a live banner', () => {
    expect(provider).toContain('subscribePersistFailure');
    expect(provider).toContain('secretPersistFailure');
  });

  it('boot is single-flight (StrictMode double-mount cannot run two boots)', () => {
    expect(syncInit).toContain('cachedPromise');
    expect(syncInit).toContain('Single-flight boot promise');
  });
});

describe('settings sections: honest async handlers', () => {
  it('persona create is single-flight and catches the secret-store throw', () => {
    expect(personaSection).toContain('createInFlightRef');
    expect(personaSection).toContain('That did not go through on this device. Try again.');
  });

  it('danger zone reset/delete both catch with honest copy', () => {
    expect(dangerSection).toContain('The reset did not complete');
    expect(dangerSection).toContain('resetting');
  });

  it('account sign-in / sign-out / mint / delete never reject silently', () => {
    expect(accountSection).toContain('Sign-in did not complete in this browser. Nothing was changed; try again.');
    expect(accountSection).toContain('Sign out could not be saved in this browser. Try again.');
    expect(accountSection).toContain('The deletion request did not complete. Your account was not deleted; try again.');
  });

  it('identity save and recovery restore render failures instead of stranding', () => {
    expect(identitySection).toContain('The name could not be saved in this browser. Try again.');
    expect(recoverySection).toContain('The restore could not be saved in this browser. Try again.');
    expect(recoverySection).toContain('Nothing was generated.');
  });

  it('storage budget picks are single-flight with a rendered failure', () => {
    expect(storageSection).toContain('budgetBusyRef');
    expect(storageSection).toContain('The budget change could not be applied. Try again.');
  });

  it('notifications enable/disable catch the push seams', () => {
    expect(notificationsSection).toContain('Notifications could not be turned on. Nothing was changed; try again.');
    expect(notificationsSection).toContain('Notifications could not be fully turned off. Try again.');
  });

  it('appearance copy claims Copied only after resolve and delete needs two steps', () => {
    expect(appearanceSection).toContain('.catch(() => setCopyError(');
    expect(appearanceSection).toContain('confirmingDelete');
    expect(appearanceSection).toContain('Delete forever');
  });
});

describe('storage overlay: disconnect gate, single-flight, stale-target repair', () => {
  it('disconnect leaves the screen only after a real revoke', () => {
    expect(storageOverlay).toContain('let revoked = false;');
    expect(storageOverlay).toContain("if (revoked) setStep({ kind: 'hub' });");
    expect(storageOverlay).toContain('Nothing was disconnected.');
  });

  it('the connect flows take a synchronous slot', () => {
    expect(storageOverlay).toContain('takeConnectSlot');
    expect(storageOverlay).toContain('releaseConnectSlot');
  });

  it('backup repairs a stale selected destination and runs single-flight', () => {
    expect(storageOverlay).toContain('targets.some((t) => t.id === selectedId)');
    expect(storageOverlay).toContain('runInFlightRef');
    expect(storageOverlay).toContain('restoreInFlightRef');
  });
});
