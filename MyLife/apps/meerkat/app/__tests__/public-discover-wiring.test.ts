// Source locks for the Set-5 discover/public-layer/persona hardening (PROMPT-006).
// Pins: the queued-and-flushed VerifySheet join (the Alert must fire only after the
// Modal dismissed), fail-honest async handlers on the genuinely-throwing seams
// (persistPublicReport signing, requestPublicJoin relay resolution, persona-key
// secure-store writes, the clipboard export), the single-flight refs that protect
// single-use humanity tokens and persona registration, back fallbacks on every
// deep-linkable public screen, the block-author confirm, the stale report-sheet
// timer guard, and the PublishSheet stale-probe supersede guard.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '(root)');
const publicReader = readFileSync(join(root, 'components', 'PublicReader.tsx'), 'utf8');
const verifySheet = readFileSync(join(root, 'components', 'VerifySheet.tsx'), 'utf8');
const publishSheet = readFileSync(join(root, 'components', 'PublishSheet.tsx'), 'utf8');
const postThread = readFileSync(join(root, 'public', 'post', '[postId].tsx'), 'utf8');
const compose = readFileSync(join(root, 'public', 'compose.tsx'), 'utf8');
const explore = readFileSync(join(root, 'public', 'explore.tsx'), 'utf8');
const topic = readFileSync(join(root, 'public', 'topic', '[channel].tsx'), 'utf8');
const personaProfile = readFileSync(join(root, 'public', 'persona', '[persona].tsx'), 'utf8');
const personaCreate = readFileSync(join(root, 'persona', 'create.tsx'), 'utf8');
const personaSettings = readFileSync(join(root, 'persona', 'settings.tsx'), 'utf8');

describe('PublicReader (mobile)', () => {
  it('the snapshot load is wrapped so a corrupt cache row cannot strand the spinner', () => {
    expect(publicReader).toContain('const publicKey = publicSnapshotKeyFromHex(entry.public_key_hex);');
    expect(publicReader).toContain("setResult({ ok: false, reason: 'manifest_failed' });\n        setInFlight(false);");
  });

  it('a thrown persistPublicReport surfaces an honest notice', () => {
    expect(publicReader).toContain("setReportNotice('The report could not be saved on this device. Nothing was sent.')");
  });

  it('the join submit is single-flight and a thrown park surfaces honestly', () => {
    expect(publicReader).toContain('if (joinInFlightRef.current) return;');
    expect(publicReader).toContain('joinInFlightRef.current = true;');
    expect(publicReader).toContain('joinInFlightRef.current = false;');
    expect(publicReader).toContain("'The join request could not be sent right now. Try again when you are online.'");
  });

  it('the verified join is queued through the VerifySheet dismissal, never fired from onVerified', () => {
    expect(publicReader).toContain('queuedJoinRef.current = pendingJoin; setPendingJoin(null);');
    expect(publicReader).toContain('onDismissed={() => {');
    expect(publicReader).toContain('if (queued) submitJoinRequest(queued);');
    expect(publicReader).not.toContain('onVerified={() => { if (pendingJoin) submitJoinRequest(pendingJoin);');
  });

  it('back falls back to Discover when the reader is the first route', () => {
    expect(publicReader).toContain("if (router.canGoBack()) router.back(); else router.replace('/discover');");
  });
});

describe('VerifySheet (mobile)', () => {
  it('exposes onDismissed via Modal onDismiss (iOS) plus the non-iOS visibility effect', () => {
    expect(verifySheet).toContain("onDismiss={Platform.OS === 'ios' ? onDismissed : undefined}");
    expect(verifySheet).toContain("if (Platform.OS !== 'ios' && !visible) onDismissed?.();");
  });
});

describe('Public thread screen (mobile)', () => {
  it('block author confirms before the device-local write and navigation', () => {
    expect(postThread).toContain("'Block this public name?'");
    expect(postThread).not.toMatch(/onPress=\{\(\) => \{ blockPublicPersona\(db, [^)]+\); (?:router\.back|goBack)\(\); \}\}/u);
  });

  it('back falls back to the Public tab on both affordances', () => {
    expect(postThread).toContain("else router.replace('/public');");
    expect(postThread).toContain('onPress={goBack}');
  });

  it('the report-sent timer closes only its own report target', () => {
    expect(postThread).toContain('setReportTarget((cur) => (cur === target ? null : cur));');
    expect(postThread).toContain("setReportPhase((p) => (p === 'sent' ? 'idle' : p));");
    expect(postThread).not.toContain('setTimeout(() => { setReportTarget(null);');
  });
});

describe('Public compose screen (mobile)', () => {
  it('the posted auto-back timer is owned by a ref and cleared on unmount', () => {
    expect(compose).toContain('backTimerRef.current = setTimeout(goBack, 700);');
    expect(compose).toContain('clearTimeout(backTimerRef.current)');
    expect(compose).not.toContain('setTimeout(() => router.back(), 700)');
  });

  it('back falls back to the Public tab', () => {
    expect(compose).toContain("else router.replace('/public');");
  });
});

describe('deep-linkable public screens fall back on back', () => {
  it.each([
    ['explore', explore],
    ['topic', topic],
    ['persona profile', personaProfile],
  ])('%s has a canGoBack fallback to /public', (_name, src) => {
    expect(src).toContain("if (router.canGoBack()) router.back(); else router.replace('/public');");
  });
});

describe('Persona create screen (mobile)', () => {
  it('create is single-flight and a thrown register/secure-store write is caught', () => {
    expect(personaCreate).toContain('if (createInFlightRef.current) return;');
    expect(personaCreate).toContain('createInFlightRef.current = true;');
    expect(personaCreate).toContain("setError('That did not go through on this device. Try again.');");
    expect(personaCreate).toContain('createInFlightRef.current = false;');
    expect(personaCreate).toContain('setBusy(false);\n      }');
  });

  it('Go back and Not now fall back to the Public tab', () => {
    expect(personaCreate).toContain("else router.replace('/public');");
    expect(personaCreate.match(/onPress=\{goBack\}/gu)?.length).toBe(2);
  });
});

describe('Persona settings screen (mobile)', () => {
  it('the export catches a rejected clipboard write and always clears busy', () => {
    expect(personaSettings).toContain("setNotice('The export could not be copied to the clipboard. Nothing was changed; try again.');");
    expect(personaSettings).toContain('} finally {\n        setBusy(null);\n      }');
  });

  it('both states render a back affordance with the identity fallback', () => {
    expect(personaSettings).toContain("else router.replace('/(tabs)/identity');");
    expect(personaSettings.match(/onPress=\{goBack\}/gu)?.length).toBe(3);
  });
});

describe('PublishSheet (mobile)', () => {
  it('an in-flight probe is superseded by any host edit or tier switch', () => {
    expect(publishSheet).toContain('probeSeq.current += 1;');
    expect(publishSheet.match(/const seq = \+\+probeSeq\.current;/gu)?.length).toBe(2);
    expect(publishSheet.match(/if \(probeSeq\.current === seq\) setProbe\(\{ kind: 'done', result: r \}\);/gu)?.length).toBe(2);
    expect(publishSheet).not.toContain("setProbe({ kind: 'done', result: await probeServingHost");
  });

  it('the copy-link rejection surfaces in the visible pane', () => {
    expect(publishSheet).toContain("setCopyError('Could not copy the link.');");
    expect(publishSheet).toContain('{copyError ? <Text');
    expect(publishSheet).not.toContain('void Clipboard.setStringAsync(view.link)');
  });
});
