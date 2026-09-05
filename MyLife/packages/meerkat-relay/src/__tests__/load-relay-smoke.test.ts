/**
 * Live smoke: boot the REAL slim relay bin (the exact compiled artifact + plain-node
 * CMD the container runs, via scripts/smoke-relay.mjs) and run the WP-7B relay load
 * harness against it as a child process for a few seconds at a low rate.
 *
 * This proves the load harness speaks the REAL wire protocol end to end: it pairs
 * two ws clients on a shared token, forwards opaque `env` frames, the peer echoes
 * them back, and the initiator measures real round-trips through the booted relay.
 * We assert the harness exits 0 (ok) with a parseable final verdict line showing
 * completed > 0 -- a non-vacuous pass against a real relay, not a stub.
 *
 * Kept under ~20s total: a ~4s load run against an ephemeral-port relay.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
// The harness is plain JS (it boots a child process); reuse its build+boot helpers.
// @ts-expect-error -- .mjs harness has no type declarations; runtime shape is stable.
import { buildProductionArtifact, bootRelay } from '../../scripts/smoke-relay.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const loadRelayScript = join(here, '..', '..', 'scripts', 'load', 'load-relay.mjs');

interface BootedRelay {
  url: string;
  port: number;
  stop: () => Promise<void>;
}

let relay: BootedRelay | null = null;

afterEach(async () => {
  if (relay) {
    await relay.stop();
    relay = null;
  }
});

/** Run the load harness child and collect its stdout + exit code. */
function runLoadRelay(args: string[]): Promise<{ code: number | null; lines: Record<string, unknown>[] }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [loadRelayScript, ...args], { stdio: ['ignore', 'pipe', 'inherit'] });
    let buf = '';
    const lines: Record<string, unknown>[] = [];
    child.stdout.on('data', (chunk) => {
      buf += chunk.toString();
      let nl: number;
      while ((nl = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        if (!line.trim()) continue;
        try { lines.push(JSON.parse(line)); } catch { /* ignore non-json */ }
      }
    });
    child.on('error', reject);
    child.on('exit', (code) => resolve({ code, lines }));
  });
}

describe('load-relay harness against the real booted relay bin', () => {
  it('pairs, forwards opaque frames, and exits 0 with completed > 0', async () => {
    const work = buildProductionArtifact();
    // The relay's env rate limit is keyed by CLIENT IP, not per connection, so all
    // pairs from 127.0.0.1 share one budget. bootRelay forwards process.env to the
    // child, so raise the (clamped) env-rate budget for this local multi-pair run;
    // the default 20/s per-IP cap is a real property we document in the runbook, not
    // something to trip in a throughput smoke. (This is a relay CONFIG knob, not a
    // harness workaround: RELAY_ENV_RATE is clamped to [10, 5000] in protocol.ts.)
    const prevRate = process.env.RELAY_ENV_RATE;
    const prevWindow = process.env.RELAY_WINDOW_MS;
    process.env.RELAY_ENV_RATE = '5000';
    process.env.RELAY_WINDOW_MS = '1000';
    try {
      relay = (await bootRelay(work)) as BootedRelay;
    } finally {
      if (prevRate === undefined) delete process.env.RELAY_ENV_RATE;
      else process.env.RELAY_ENV_RATE = prevRate;
      if (prevWindow === undefined) delete process.env.RELAY_WINDOW_MS;
      else process.env.RELAY_WINDOW_MS = prevWindow;
    }

    const { code, lines } = await runLoadRelay([
      '--target', relay.url,
      '--connections', '4',
      '--rate', '10',
      '--duration', '3',
      '--progress-interval', '1',
    ]);

    const verdictLine = lines.find((l) => 'verdict' in l && l.probe === 'load-relay');
    expect(verdictLine, 'a final load-relay verdict line was emitted').toBeTruthy();
    // A real relay served the session: completed round-trips must be positive, and
    // the verdict must be a non-vacuous ok (exit 0).
    expect(Number(verdictLine!.completed)).toBeGreaterThan(0);
    expect(verdictLine!.verdict).toBe('ok');
    expect(code).toBe(0);
  }, 20_000);
});
