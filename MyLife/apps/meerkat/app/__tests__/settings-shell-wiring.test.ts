// Source locks for the Set-6 shell/settings/identity/storage hardening
// (PROMPT-007). Pins: fail-honest clipboard handlers (success claimed only after
// the await resolves, rejection rendered), back fallbacks on every deep-linkable
// Set-6 screen incl. the shared StorageHeader, synchronous single-flight refs on
// the destination connect / backup / restore / disconnect flows, the stale
// backup-target repair, disconnect navigating only after a REAL revoke, the
// restore setup-throw drop-back to summary, the generate-recovery secure-store
// catch, the two-step theme delete confirm, and the AccountSection catches that
// keep busy/loading from stranding on a secure-store throw.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '(root)');
const tabs = join(root, '(tabs)');
const me = readFileSync(join(tabs, 'me.tsx'), 'utf8');
const settings = readFileSync(join(tabs, 'settings.tsx'), 'utf8');
const identity = readFileSync(join(tabs, 'identity.tsx'), 'utf8');
const aboutStatus = readFileSync(join(tabs, 'about-status.tsx'), 'utf8');
const appearance = readFileSync(join(tabs, 'appearance.tsx'), 'utf8');
const themeEditor = readFileSync(join(tabs, 'theme-editor.tsx'), 'utf8');
const transportDiagnostics = readFileSync(join(tabs, 'transport-diagnostics.tsx'), 'utf8');
const downloads = readFileSync(join(tabs, 'downloads.tsx'), 'utf8');
const storageHub = readFileSync(join(tabs, 'storage.tsx'), 'utf8');
const addDestination = readFileSync(join(tabs, 'storage', 'add-destination.tsx'), 'utf8');
const backup = readFileSync(join(tabs, 'storage', 'backup.tsx'), 'utf8');
const restore = readFileSync(join(tabs, 'storage', 'restore.tsx'), 'utf8');
const destinationDetail = readFileSync(join(tabs, 'storage', 'destination', '[id].tsx'), 'utf8');
const storageKit = readFileSync(join(root, 'components', 'StorageKit.tsx'), 'utf8');
const accountSection = readFileSync(join(root, 'components', 'AccountSection.tsx'), 'utf8');
const nodeProvider = readFileSync(join(root, 'providers', 'NodeProvider.tsx'), 'utf8');

describe('clipboard honesty (Me, Identity, Settings, Appearance share sheet)', () => {
  it('me.tsx claims Copied only after the await resolves and renders a copy failure', () => {
    expect(me).toContain('await Clipboard.setStringAsync(friendCode);');
    expect(me).toContain('The code could not be copied to the clipboard. Try again.');
    expect(me).not.toContain('void Clipboard.setStringAsync(friendCode);');
  });

  it('identity.tsx copy folds with an owned timer and a rendered failure', () => {
    expect(identity).toContain('Copy failed. Nothing was copied to the clipboard; try again.');
    expect(identity).toContain('copiedTimerRef');
  });

  it('settings.tsx diagnostics + recovery copies render success and failure', () => {
    expect(settings).toContain('Diagnostics copied to the clipboard.');
    expect(settings).toContain("copyRecoveryValue(recovery.key, 'Recovery key copied to the clipboard.')");
    expect(settings).not.toContain('void Clipboard.setStringAsync(recovery.key);');
    expect(settings).not.toContain('void Clipboard.setStringAsync(buildDiagnosticsSnapshot());');
  });

  it('appearance share sheet claims Copied only after resolve with an adjacent error', () => {
    expect(appearance).toContain('.catch(() => setCopyError(');
    expect(appearance).not.toContain('void Clipboard.setStringAsync(value);\n    setCopied(label);');
  });
});

describe('back fallbacks on deep-linkable Set-6 screens', () => {
  it('about-status falls back to /me', () => {
    expect(aboutStatus).toContain("router.replace('/me')");
    expect(aboutStatus).toContain('router.canGoBack()');
  });

  it('transport diagnostics falls back to /settings', () => {
    expect(transportDiagnostics).toContain("router.replace('/settings')");
  });

  it('appearance falls back to /me and theme editor to /appearance', () => {
    expect(appearance).toContain("router.replace('/me')");
    expect(themeEditor).toContain("router.replace('/appearance')");
  });

  it('downloads falls back to /settings', () => {
    expect(downloads).toContain("router.replace('/settings')");
  });

  it('the shared StorageHeader has a canGoBack fallback and the hub overrides it to /settings', () => {
    expect(storageKit).toContain('backFallback');
    expect(storageKit).toContain('router.canGoBack()');
    expect(storageHub).toContain('backFallback="/settings"');
  });
});

describe('settings.tsx honest async handlers', () => {
  it('the storage meter read cannot strand "Reading storage..."', () => {
    expect(settings).toContain('Storage usage could not be read.');
  });

  it('budget picks are single-flight with an honest failure alert', () => {
    expect(settings).toContain('budgetBusyRef');
    expect(settings).toContain('The budget change could not be applied. Try again.');
  });

  it('generate recovery catches the secure-store read throw honestly', () => {
    expect(settings).toContain('could not be read from secure storage. Nothing was generated.');
  });

  it('clear-storage and save-folder failures render instead of vanishing', () => {
    expect(settings).toContain('Local storage could not be fully cleared. Try again.');
    expect(settings).toContain('The folder picker could not be opened. No default folder was changed; try again.');
  });
});

describe('downloads.tsx honest file handlers', () => {
  it('openFile catches the export/share seam', () => {
    expect(downloads).toContain('The file could not be exported for opening. Nothing was changed; try again.');
  });

  it('a bulk-save setup throw still renders a per-file outcome', () => {
    expect(downloads).toContain('The save could not start. Nothing was written; try again.');
  });
});

describe('storage flows: single-flight, stale-target repair, honest disconnect', () => {
  it('add-destination takes a synchronous connect slot in every flow', () => {
    expect(addDestination).toContain('takeConnectSlot');
    expect((addDestination.match(/if \(!takeConnectSlot\(/g) ?? []).length).toBe(4);
    expect(addDestination).toContain('releaseConnectSlot');
  });

  it('backup repairs a stale selected destination against the still-ready targets', () => {
    expect(backup).toContain('targets.some((t) => t.id === selectedId)');
    expect(backup).not.toContain('const destinationId = selectedId ?? targets[0]?.id ?? null;');
  });

  it('backup and restore runs are synchronously single-flight', () => {
    expect(backup).toContain('runInFlightRef');
    expect(restore).toContain('restoreInFlightRef');
  });

  it('a restore setup throw drops back to the summary so the error and retry render', () => {
    expect(restore).toContain("setPhase('summary');");
    expect(restore).toContain('{error ? <Text style={styles.error}>{error}</Text> : null}\n        </View>\n      ) : null}\n\n      {phase === \'running\' && progress ?');
  });

  it('destination disconnect leaves the screen only after a real revoke', () => {
    expect(destinationDetail).toContain('let revoked = false;');
    expect(destinationDetail).toContain('if (revoked) {');
    expect(destinationDetail).toContain('Nothing was disconnected.');
    expect(destinationDetail).not.toContain('refresh();\n          router.back();');
  });

  it('destination manage actions share one synchronous in-flight ref', () => {
    expect(destinationDetail).toContain('actionInFlightRef');
    expect((destinationDetail.match(/actionInFlightRef\.current = true;/g) ?? []).length).toBe(4);
  });
});

describe('theme editor and appearance', () => {
  it('a failed custom-theme save renders instead of a dead Save tap', () => {
    expect(themeEditor).toContain('The theme could not be saved on this device. Try again.');
  });

  it('custom theme delete needs a two-step confirm', () => {
    expect(appearance).toContain('confirmingDelete');
    expect(appearance).toContain('Delete forever');
    expect(appearance).toContain('This cannot be undone.');
  });
});

describe('transport diagnostics honest load', () => {
  it('a probe rejection renders instead of stranding "Reading availability…"', () => {
    expect(transportDiagnostics).toContain('Availability could not be read on this build.');
  });
});

describe('AccountSection (Plan 51) never strands busy or the loading gate', () => {
  it('reload folds a secure-store throw into an honest note with loaded=true', () => {
    expect(accountSection).toContain('The account state could not be read from secure storage.');
  });

  it('sign-in, sign-out, mint, and delete all catch with honest copy', () => {
    expect(accountSection).toContain('Sign-in did not complete on this device. Nothing was changed; try again.');
    expect(accountSection).toContain('Sign out could not be saved on this device. Try again.');
    expect(accountSection).toContain('That did not complete on this device. Nothing was changed; try again.');
    expect(accountSection).toContain('The deletion request did not complete. Your account was not deleted; try again.');
  });
});

describe('NodeProvider refresh folds', () => {
  it('a filesystem read rejection keeps last-known real state instead of rejecting focus effects', () => {
    expect(nodeProvider).toContain('keep last-known real state');
  });
});
