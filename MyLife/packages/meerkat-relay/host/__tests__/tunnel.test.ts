/**
 * Host tunnel half (Plan 20, Phase 5.2). TC-11 / honesty L3.
 *
 * Uses an injected fake spawn so the "spawn cloudflared -> parse the assigned
 * https://*.trycloudflare.com -> derive the wss:// dial URL" path is deterministic
 * without the binary or the internet. The derived URL is a CANDIDATE ONLY: the
 * result is tagged unverified, because a tunnel edge printing a URL is NOT proof
 * of external reachability (that stays the off-host probe's job, gateReachability).
 */

import { describe, it, expect, vi } from 'vitest';
import {
  startTunnel,
  parseCloudflaredUrl,
  deriveWssUrl,
  type TunnelChild,
  type TunnelSpawnFn,
} from '../tunnel';

/** A fake cloudflared child that lets the test push stdout lines + an exit. */
function makeFakeChild(): TunnelChild & {
  emitStdout: (s: string) => void;
  emitStderr: (s: string) => void;
  emitExit: (code?: number | null) => void;
  killed: boolean;
} {
  const outCbs: ((c: string) => void)[] = [];
  const errCbs: ((c: string) => void)[] = [];
  const exitCbs: ((c: number | null) => void)[] = [];
  return {
    killed: false,
    stdout: { on: (_e, cb) => outCbs.push(cb) },
    stderr: { on: (_e, cb) => errCbs.push(cb) },
    on(event, cb) {
      if (event === 'exit') exitCbs.push(cb as (c: number | null) => void);
    },
    kill() {
      this.killed = true;
      for (const cb of exitCbs) cb(0);
    },
    emitStdout: (s) => outCbs.forEach((cb) => cb(s)),
    emitStderr: (s) => errCbs.forEach((cb) => cb(s)),
    emitExit: (code = 0) => exitCbs.forEach((cb) => cb(code)),
  };
}

// A representative cloudflared quick-tunnel banner (it prints the URL in a box).
const CLOUDFLARED_BANNER =
  '2026-07-01T00:00:00Z INF +----------------------------------------------------+\n' +
  '2026-07-01T00:00:00Z INF |  Your quick Tunnel has been created! Visit it at:   |\n' +
  '2026-07-01T00:00:00Z INF |  https://calm-otter-1234.trycloudflare.com          |\n' +
  '2026-07-01T00:00:00Z INF +----------------------------------------------------+\n';

describe('parseCloudflaredUrl', () => {
  it('extracts the trycloudflare.com URL from a log line', () => {
    expect(parseCloudflaredUrl('foo https://calm-otter-1234.trycloudflare.com bar')).toBe(
      'https://calm-otter-1234.trycloudflare.com',
    );
  });
  it('returns null for a line without a tunnel URL', () => {
    expect(parseCloudflaredUrl('2026-07-01 INF Starting tunnel')).toBeNull();
    expect(parseCloudflaredUrl('https://evil.example.com')).toBeNull();
  });
});

describe('deriveWssUrl', () => {
  it('rewrites https -> wss (the relay dial scheme)', () => {
    expect(deriveWssUrl('https://calm-otter-1234.trycloudflare.com')).toBe(
      'wss://calm-otter-1234.trycloudflare.com',
    );
  });
});

describe('startTunnel (TC-11)', () => {
  it('parses the public URL from cloudflared stdout and derives the wss:// candidate (unverified)', async () => {
    const child = makeFakeChild();
    const spawn: TunnelSpawnFn = () => child;
    const handle = startTunnel({ localUrl: 'http://127.0.0.1:8787' }, { spawn });
    child.emitStdout(CLOUDFLARED_BANNER);
    const result = await handle.ready;

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provider).toBe('cloudflared');
      expect(result.publicUrl).toBe('https://calm-otter-1234.trycloudflare.com');
      expect(result.relayUrl).toBe('wss://calm-otter-1234.trycloudflare.com');
      // A tunnel URL is a CANDIDATE, never proof of reachability.
      expect(result.verified).toBe(false);
    }
  });

  it('also reads the URL when cloudflared logs to stderr', async () => {
    const child = makeFakeChild();
    const handle = startTunnel({ localUrl: 'http://127.0.0.1:8787' }, { spawn: () => child });
    child.emitStderr(CLOUDFLARED_BANNER);
    const result = await handle.ready;
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.publicUrl).toBe('https://calm-otter-1234.trycloudflare.com');
  });

  it('returns tunnel-failed (never a fabricated URL) when the child exits before a URL arrives', async () => {
    const child = makeFakeChild();
    const handle = startTunnel({ localUrl: 'http://127.0.0.1:8787' }, { spawn: () => child });
    child.emitExit(1);
    const result = await handle.ready;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.provider).toBe('cloudflared');
      expect(result.reason).toMatch(/exited/i);
      // no URL fields on a failed result
      expect((result as { publicUrl?: string }).publicUrl).toBeUndefined();
    }
  });

  it('returns tunnel-failed when no URL is reported before the timeout', async () => {
    vi.useFakeTimers();
    try {
      const child = makeFakeChild();
      const handle = startTunnel(
        { localUrl: 'http://127.0.0.1:8787', timeoutMs: 1000 },
        { spawn: () => child },
      );
      await vi.advanceTimersByTimeAsync(1001);
      const result = await handle.ready;
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toMatch(/in time/i);
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns tunnel-failed when spawning the provider throws (binary missing)', async () => {
    const handle = startTunnel(
      { localUrl: 'http://127.0.0.1:8787' },
      {
        spawn: () => {
          throw new Error('spawn cloudflared ENOENT');
        },
      },
    );
    const result = await handle.ready;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/ENOENT|cloudflared/i);
  });

  it('spawns cloudflared with the quick-tunnel args pointed at the local relay URL', () => {
    let seenBin = '';
    let seenArgs: string[] = [];
    const child = makeFakeChild();
    const spawn: TunnelSpawnFn = (bin, args) => {
      seenBin = bin;
      seenArgs = args;
      return child;
    };
    startTunnel({ localUrl: 'http://127.0.0.1:8787' }, { spawn });
    expect(seenBin).toBe('cloudflared');
    expect(seenArgs).toContain('tunnel');
    expect(seenArgs).toContain('--url');
    expect(seenArgs).toContain('http://127.0.0.1:8787');
  });

  it('stop() kills the child (tears the tunnel down)', async () => {
    const child = makeFakeChild();
    const handle = startTunnel({ localUrl: 'http://127.0.0.1:8787' }, { spawn: () => child });
    child.emitStdout(CLOUDFLARED_BANNER);
    await handle.ready;
    handle.stop();
    expect(child.killed).toBe(true);
  });
});
