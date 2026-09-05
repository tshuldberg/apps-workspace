/**
 * Host control-panel server integration (Plan 20, Phase 4.1 + 5.1 + 5.3 + 6.2 + 6.4).
 *
 * Drives a REAL node:http server on an ephemeral loopback port. The supervisor's
 * spawn is injected to run a plain `node -e` fixture that prints the exact
 * {event:'listening',port} line the real bins log (NEVER a tsx child -- the relay
 * CLAUDE.md warns tsx-under-tsx background IO starves in the sandbox). Proven here:
 *   - the panel binds 127.0.0.1 ONLY,
 *   - GET /api/status returns real per-service statuses,
 *   - POST /api/start reports 'live' ONLY after the real listening line (a
 *     never-listening child stays 'error', never a fabricated live),
 *   - GET /api/card WITHHOLDS the card until the relay is live AND the public
 *     exposure is verified reachable from off-host.
 */

import { afterEach, describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  createHostServer,
  type HostServer,
  type HostServerDeps,
  type ExposureCandidate,
} from '../server';
import { makeRealSpawn } from '../spawn';
import type { SpawnFn } from '../process-supervisor';
import type { ReachabilityState } from '../reachability';
import type { HostConfig } from '../host-config';

const RELAY_ONLY: HostConfig = {
  services: { relay: true, communityNode: false, seeder: false },
  exposure: 'tunnel',
  securityPreset: 'private',
};

/** A `node -e` source that prints the listening line after a tick, then stays alive. */
function listeningFixture(port: number, delayMs = 15): string {
  const line = JSON.stringify(JSON.stringify({ event: 'listening', port }) + '\n');
  return `setTimeout(()=>{process.stdout.write(${line});setInterval(()=>{},1000);},${delayMs});`;
}

/** A `node -e` source that NEVER prints a listening line (proves no fabricated live). */
const NEVER_LISTENS = 'setInterval(()=>{},1000);';

/** Spawn adapter that ignores the real bin and runs a node -e fixture instead. */
function fixtureSpawn(source: string): SpawnFn {
  const real = makeRealSpawn();
  return (_bin, _args, env) => real(process.execPath, ['-e', source], env);
}

const servers: HostServer[] = [];
const tmpDirs: string[] = [];

function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), 'mk-host-'));
  tmpDirs.push(d);
  return d;
}

async function makeServer(over: Partial<HostServerDeps> = {}): Promise<{ srv: HostServer; base: string }> {
  const dir = tmp();
  const srv = createHostServer({
    configDir: dir,
    serviceSpecsDeps: { dataDir: join(dir, 'data') },
    spawn: fixtureSpawn(listeningFixture(8787)),
    healthProbe: async () => ({ ok: true, connections: 3 }),
    // Hermetic by default: no real cloudflared/LAN. Card tests override these.
    startExposure: async () => null,
    verifyReachability: async (): Promise<ReachabilityState> => 'unverified',
    startTimeoutMs: 4_000,
    ...over,
  });
  servers.push(srv);
  const bound = await srv.listen(0);
  expect(bound.host).toBe('127.0.0.1');
  return { srv, base: `http://127.0.0.1:${bound.port}` };
}

const PUBLIC_TUNNEL: ExposureCandidate = {
  kind: 'tunnel',
  scope: 'public',
  relayUrl: 'wss://abc.trycloudflare.com',
};

afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => s.close()));
  for (const d of tmpDirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('createHostServer', () => {
  it('binds 127.0.0.1 ONLY (an admin surface, never a public listener)', async () => {
    const { srv } = await makeServer();
    const addr = srv.httpServer.address();
    expect(typeof addr === 'object' && addr?.address).toBe('127.0.0.1');
  });

  it('GET /api/status returns real statuses (empty before any start)', async () => {
    const { base } = await makeServer();
    const res = await fetch(`${base}/api/status`);
    expect(res.ok).toBe(true);
    const body = (await res.json()) as any;
    expect(body.services).toEqual([]);
    expect(body.exposure).toBeNull();
    expect(body.lifecycle).toMatch(/only while this app is open/i);
  });

  it('POST /api/start reports the relay live only AFTER its real listening line', async () => {
    const { base } = await makeServer();
    await fetch(`${base}/api/config`, { method: 'POST', body: JSON.stringify(RELAY_ONLY) });

    const res = await fetch(`${base}/api/start`, { method: 'POST' });
    expect(res.ok).toBe(true);
    const body = (await res.json()) as any;
    const relay = body.services.find((s: { name: string }) => s.name === 'relay');
    expect(relay.state).toBe('live');
    expect(relay.port).toBe(8787);
    // Counts come only from the real /healthz field (here the injected probe -> 3).
    expect(relay.connections).toBe(3);
  });

  it('does NOT fabricate live: a child that never logs a listening line stays error', async () => {
    const { base } = await makeServer({ spawn: fixtureSpawn(NEVER_LISTENS), startTimeoutMs: 300 });
    await fetch(`${base}/api/config`, { method: 'POST', body: JSON.stringify(RELAY_ONLY) });
    const res = await fetch(`${base}/api/start`, { method: 'POST' });
    const body = (await res.json()) as any;
    const relay = body.services.find((s: { name: string }) => s.name === 'relay');
    expect(relay.state).toBe('error');
    expect(relay.port).toBeNull();
  });

  it('POST /api/config rejects a malformed config (400) and accepts a valid one', async () => {
    const { base } = await makeServer();
    const bad = await fetch(`${base}/api/config`, { method: 'POST', body: '{"exposure":"nope"}' });
    expect(bad.status).toBe(400);
    const ok = await fetch(`${base}/api/config`, { method: 'POST', body: JSON.stringify(RELAY_ONLY) });
    expect(ok.status).toBe(200);
    const body = (await ok.json()) as any;
    expect(body.config.services.communityNode).toBe(false);
  });

  it('GET /api/card WITHHOLDS the card while the relay is down', async () => {
    const { base } = await makeServer();
    const res = await fetch(`${base}/api/card`);
    const body = (await res.json()) as any;
    expect(body.available).toBe(false);
    expect(body.card).toBeUndefined();
    expect(body.state).toBe('relay-down');
  });

  it('GET /api/card WITHHOLDS a public card until off-host reachability is verified', async () => {
    const { base } = await makeServer({
      startExposure: async () => PUBLIC_TUNNEL,
      verifyReachability: async (): Promise<ReachabilityState> => 'unverified',
    });
    await fetch(`${base}/api/config`, { method: 'POST', body: JSON.stringify(RELAY_ONLY) });
    await fetch(`${base}/api/start`, { method: 'POST' });

    const res = await fetch(`${base}/api/card`);
    const body = (await res.json()) as any;
    expect(body.available).toBe(false);
    expect(body.state).toBe('unverified');
    // The card + QR are NEVER surfaced for an unverified public URL.
    expect(body.card).toBeUndefined();
    expect(body.qr).toBeUndefined();
  });

  it('GET /api/card SURFACES the card + QR once the relay is live AND reachable', async () => {
    const { base } = await makeServer({
      startExposure: async () => PUBLIC_TUNNEL,
      verifyReachability: async (): Promise<ReachabilityState> => 'reachable',
    });
    await fetch(`${base}/api/config`, { method: 'POST', body: JSON.stringify(RELAY_ONLY) });
    await fetch(`${base}/api/start`, { method: 'POST' });

    const res = await fetch(`${base}/api/card`);
    const body = (await res.json()) as any;
    expect(body.available).toBe(true);
    expect(typeof body.card).toBe('string');
    expect(body.card.startsWith('MKSERVER1:')).toBe(true);
    expect(body.card).toContain('wss://abc.trycloudflare.com');
    expect(body.qr.svg).toContain('<svg');
    expect(body.scope).toBe('public');
  });

  it('WITHHOLDS a live card once the tunnel child EXITS mid-session (relay still live)', async () => {
    // A candidate whose onExit callback we can fire to simulate the tunnel child
    // dying while the relay process itself stays up (object ref so TS keeps the
    // captured callback at its declared type).
    const exitHolder: { fire: (() => void) | null } = { fire: null };
    const dyingTunnel: ExposureCandidate = {
      kind: 'tunnel',
      scope: 'public',
      relayUrl: 'wss://abc.trycloudflare.com',
      onExit: (cb) => {
        exitHolder.fire = cb;
      },
    };
    const { base } = await makeServer({
      startExposure: async () => dyingTunnel,
      verifyReachability: async (): Promise<ReachabilityState> => 'reachable',
    });
    await fetch(`${base}/api/config`, { method: 'POST', body: JSON.stringify(RELAY_ONLY) });
    await fetch(`${base}/api/start`, { method: 'POST' });

    // Verified reachable at start -> the card is surfaced.
    const before = (await (await fetch(`${base}/api/card`)).json()) as any;
    expect(before.available).toBe(true);
    expect(before.card.startsWith('MKSERVER1:')).toBe(true);

    // The tunnel edge dies; the relay process never noticed.
    if (!exitHolder.fire) throw new Error('onExit was never registered on the exposure candidate');
    exitHolder.fire();

    // The relay is STILL live...
    const status = (await (await fetch(`${base}/api/status`)).json()) as any;
    expect(status.services.find((s: { name: string }) => s.name === 'relay').state).toBe('live');
    // ...but a card for a now-DEAD public URL must be withheld at once (card + QR gone).
    const after = (await (await fetch(`${base}/api/card`)).json()) as any;
    expect(after.available).toBe(false);
    expect(after.state).toBe('unverified');
    expect(after.card).toBeUndefined();
    expect(after.qr).toBeUndefined();
    // /api/status also downgrades the stale 'reachable' honestly.
    expect(status.exposure.reachable).toBe('unverified');
  });

  it('re-verifies past the TTL: a silently-dead URL withholds, a later success re-surfaces', async () => {
    // Deterministic clock so the re-verify TTL is exercised without wall-clock waits.
    let clock = 1_000;
    let nextState: ReachabilityState = 'reachable';
    const { base } = await makeServer({
      startExposure: async () => PUBLIC_TUNNEL,
      verifyReachability: async (): Promise<ReachabilityState> => nextState,
      reachabilityTtlMs: 30_000,
      now: () => clock,
    });
    await fetch(`${base}/api/config`, { method: 'POST', body: JSON.stringify(RELAY_ONLY) });
    await fetch(`${base}/api/start`, { method: 'POST' }); // verified reachable at clock=1000

    const first = (await (await fetch(`${base}/api/card`)).json()) as any;
    expect(first.available).toBe(true);

    // Connectivity silently drops (the process stays alive). Cross the TTL so
    // /api/card re-probes off-host instead of riding the stale 'reachable'.
    nextState = 'unverified';
    clock += 30_001;
    const dead = (await (await fetch(`${base}/api/card`)).json()) as any;
    expect(dead.available).toBe(false);
    expect(dead.state).toBe('unverified');
    expect(dead.card).toBeUndefined();
    expect(dead.qr).toBeUndefined();

    // Connectivity returns and a fresh off-host round-trip verifies -> re-surface.
    nextState = 'reachable';
    clock += 30_001;
    const back = (await (await fetch(`${base}/api/card`)).json()) as any;
    expect(back.available).toBe(true);
    expect(back.card.startsWith('MKSERVER1:')).toBe(true);
    expect(back.qr.svg).toContain('<svg');
  });

  it('serves the control-panel landing at /', async () => {
    const { base } = await makeServer();
    const res = await fetch(`${base}/`);
    expect(res.ok).toBe(true);
    expect(res.headers.get('content-type')).toMatch(/text\/html/);
    const html = await res.text();
    expect(html).toContain('Meerkat Host');
    // The landing routes to the wizard or the dashboard.
    expect(html).toContain('wizard.html');
    expect(html).toContain('dashboard.html');
  });

  // Static UI assets live in host/ui/ and are served at the root path (uiDir is
  // host/ui, so GET /wizard.html -> host/ui/wizard.html). ui-view-model.ts is the
  // typed source of truth; the browser is served its plain-JS twin, ui/ui-view-model.js.
  it('serves the first-run wizard at /wizard.html', async () => {
    const { base } = await makeServer();
    const res = await fetch(`${base}/wizard.html`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/html/);
    const html = await res.text();
    expect(html).toContain('first-run setup');
    expect(html).toContain('What do you want to run?');
    expect(html).toContain('How should people reach it?');
  });

  it('serves the dashboard at /dashboard.html', async () => {
    const { base } = await makeServer();
    const res = await fetch(`${base}/dashboard.html`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/html/);
    const html = await res.text();
    expect(html).toContain('Invite members');
    // The card section is hidden until cardView(...).show === true.
    expect(html).toContain('id="card-section"');
  });

  it('serves the view-model browser twin as JS at /ui-view-model.js', async () => {
    const { base } = await makeServer();
    const res = await fetch(`${base}/ui-view-model.js`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/javascript/);
    const js = await res.text();
    expect(js).toContain('export function cardView');
    expect(js).toContain('export function connectivityLabel');
    // The honesty banner is baked in (never drifts from the app).
    expect(js).toContain(
      'This server is reachable only while this app is open and this computer is awake.',
    );
  });

  it('serves the Open Burrow stylesheet at /styles.css', async () => {
    const { base } = await makeServer();
    const res = await fetch(`${base}/styles.css`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/css/);
    // The accent hex is copied verbatim from the app's brand tokens (MK_PALETTES).
    expect(await res.text()).toContain('#0e7c66');
  });
});
