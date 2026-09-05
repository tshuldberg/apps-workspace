/**
 * Log-hygiene at the PROCESS boundary.
 *
 * server.test.ts already asserts in-process that the logger never receives an
 * envelope value. This test goes one level out: it boots the REAL compiled
 * entrypoint as a child process (the artifact the container runs), drives a live
 * session that pushes a known ciphertext envelope, a known token, and a known
 * rendezvous record across the wire, captures the FULL child stdout, and asserts
 * none of those secrets ever appear in it. The relay may log events and counts;
 * it may never log content, tokens, rendezvous records, OR content-registry
 * announce records / rids -- the ann/lk verbs get the same direct hygiene
 * assertion as pub/res, not merely inferred from pub/res symmetry.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { WebSocket } from 'ws';
// @ts-expect-error -- .mjs harness has no type declarations; runtime shape is stable.
import { buildProductionArtifact, bootRelay, connect, nextFrame, SMOKE_SECRETS } from '../../scripts/smoke-relay.mjs';

interface BootedRelay {
  url: string;
  port: number;
  captured: { value: string };
  getExitCode: () => number | null;
  stop: () => Promise<void>;
}

let relay: BootedRelay | null = null;
const openSockets: WebSocket[] = [];

afterEach(async () => {
  for (const s of openSockets) {
    try { s.terminate(); } catch { /* ignore */ }
  }
  openSockets.length = 0;
  if (relay) {
    await relay.stop();
    relay = null;
  }
});

describe('relay log hygiene at the process boundary', () => {
  it('never leaks an envelope, token, rendezvous record, or registry record to stdout', async () => {
    const { TOKEN, SECRET_ENVELOPE, REND_ID, SECRET_REC, REG_ID, SECRET_REG_REC } = SMOKE_SECRETS as {
      TOKEN: string; SECRET_ENVELOPE: string; REND_ID: string; SECRET_REC: string;
      REG_ID: string; SECRET_REG_REC: string;
    };

    const work = buildProductionArtifact();
    relay = (await bootRelay(work)) as BootedRelay;

    const a = (await connect(relay.url)) as WebSocket;
    const b = (await connect(relay.url)) as WebSocket;
    openSockets.push(a, b);

    a.send(JSON.stringify({ t: 'hello', token: TOKEN }));
    b.send(JSON.stringify({ t: 'hello', token: TOKEN }));
    await Promise.all([nextFrame(a, 'ready'), nextFrame(b, 'ready')]);

    // Push a rendezvous record through pub/res.
    a.send(JSON.stringify({ t: 'pub', rid: REND_ID, rec: SECRET_REC }));
    await nextFrame(a, 'pubok');
    b.send(JSON.stringify({ t: 'res', rid: REND_ID }));
    const rec = await nextFrame(b, 'rec');
    expect(rec.rec).toBe(SECRET_REC);

    // Push a content-registry announce record through ann, then read it back with
    // a (non-consuming) lk, so both registry verbs carry secret bytes over the
    // live relay before we assert nothing leaked.
    a.send(JSON.stringify({ t: 'ann', rid: REG_ID, rec: SECRET_REG_REC }));
    await nextFrame(a, 'annok');
    b.send(JSON.stringify({ t: 'lk', rid: REG_ID }));
    const hosts = await nextFrame(b, 'hosts');
    expect(hosts.recs).toContain(SECRET_REG_REC);

    // Push a ciphertext envelope through.
    const deliver = nextFrame(b, 'env');
    a.send(JSON.stringify({ t: 'env', env: SECRET_ENVELOPE }));
    expect((await deliver).env).toBe(SECRET_ENVELOPE);

    // Let join/leave events flush, then assert hygiene over the FULL stdout.
    a.close();
    b.close();
    await new Promise((r) => setTimeout(r, 250));

    const out = relay.captured.value;
    expect(out).not.toContain(SECRET_ENVELOPE);
    expect(out).not.toContain(SECRET_REC);
    expect(out).not.toContain(SECRET_REG_REC);
    expect(out).not.toContain(TOKEN);
    expect(out).not.toContain(REND_ID);
    expect(out).not.toContain(REG_ID);
    // It SHOULD have logged join events (counts/events are allowed).
    expect(out).toContain('"event":"join"');
  }, 30_000);
});
