// Source locks for the Set-5 discover/public-layer hardening, web side (PROMPT-006).
// Pins: the wrapped snapshot load (a corrupt cache row cannot strand the spinner),
// the fail-honest report and join handlers on the genuinely-throwing seams, the
// single-flight join ref that protects the single-use humanity token, the
// block-author confirm, the stale report-sheet timer guard, and the PublishSheet
// stale-probe supersede guard.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ui = join(__dirname, '..');
const readerView = readFileSync(join(ui, 'discover', 'PublicReaderView.tsx'), 'utf8');
const threadView = readFileSync(join(ui, 'public', 'PublicThreadView.tsx'), 'utf8');
const publishSheet = readFileSync(join(ui, 'publish', 'PublishSheet.tsx'), 'utf8');

describe('PublicReaderView (web)', () => {
  it('the snapshot load is wrapped so a corrupt cache row cannot strand the spinner', () => {
    expect(readerView).toContain('const publicKey = publicSnapshotKeyFromHex(entry.public_key_hex);');
    expect(readerView).toContain("setResult({ ok: false, reason: 'manifest_failed' });\n        setInFlight(false);");
  });

  it('a thrown persistPublicReport surfaces an honest notice', () => {
    expect(readerView).toContain("setReportNotice('The report could not be saved on this device. Nothing was sent.')");
  });

  it('the join submit is single-flight and a thrown park surfaces honestly', () => {
    expect(readerView).toContain('if (joinInFlightRef.current) return;');
    expect(readerView).toContain('joinInFlightRef.current = true;');
    expect(readerView).toContain('joinInFlightRef.current = false;');
    expect(readerView).toContain("setJoinNotice('The join request could not be sent right now. Try again when you are online.');");
  });
});

describe('PublicThreadView (web)', () => {
  it('block author confirms before the device-local write and navigation', () => {
    expect(threadView).toContain("window.confirm('Block this public name?");
    expect(threadView).not.toMatch(/onClick=\{\(\) => \{ blockPublicPersona\(m\.db, [^)]+\); void m\.db\.flush\(\); onBack\(\); \}\}/u);
  });

  it('the report-sent timer closes only its own report target', () => {
    expect(threadView).toContain('setReportTarget((cur) => (cur === target ? null : cur));');
    expect(threadView).toContain("setReportPhase((p) => (p === 'sent' ? 'idle' : p));");
    expect(threadView).not.toContain('setTimeout(() => { setReportTarget(null);');
  });
});

describe('PublishSheet (web)', () => {
  it('an in-flight probe is superseded by any host edit or tier switch', () => {
    expect(publishSheet).toContain('probeSeq.current += 1;');
    expect(publishSheet.match(/const seq = \+\+probeSeq\.current;/gu)?.length).toBe(2);
    expect(publishSheet.match(/if \(probeSeq\.current === seq\) setProbe\(\{ kind: 'done', result: r \}\);/gu)?.length).toBe(2);
    expect(publishSheet).not.toContain("setProbe({ kind: 'done', result: await probeServingHost");
  });
});
