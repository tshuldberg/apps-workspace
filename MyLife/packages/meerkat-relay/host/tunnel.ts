/**
 * Host tunnel half (Plan 20, Phase 5.2). TC-11 / honesty L3.
 *
 * Spawns `cloudflared` (the default quick-tunnel provider) as a child, reads the
 * assigned `https://*.trycloudflare.com` URL from its output, and derives the
 * `wss://` dial URL a member's connection card adopts. Both the spawn and the
 * line->URL parse are INJECTABLE, so the lifecycle is unit-testable without the
 * binary or the internet (mirrors the process-supervisor injection that sidesteps
 * the sandbox tsx-IO gotcha).
 *
 * HONESTY (L3): a tunnel edge printing a URL is NOT proof of external
 * reachability -- NAT/edge quirks can print a URL that never round-trips. The
 * success result is therefore tagged `verified: false`; the caller MUST run the
 * off-host probe (`gateReachability`) before it ever surfaces a public connection
 * card/QR. On no-URL / child-exit / spawn failure we return a typed
 * tunnel-failed result and NEVER fabricate a URL.
 */

import { spawn as nodeSpawn } from 'node:child_process';

export type TunnelProvider = 'cloudflared';

export interface TunnelChild {
  stdout: { on(event: 'data', cb: (chunk: Buffer | string) => void): void };
  stderr?: { on(event: 'data', cb: (chunk: Buffer | string) => void): void };
  on(event: 'exit', cb: (code: number | null) => void): void;
  kill(signal?: string): void;
}

export type TunnelSpawnFn = (bin: string, args: string[]) => TunnelChild;

export interface StartTunnelInput {
  /** The local plaintext URL the tunnel fronts (the relay's http bind), e.g. http://127.0.0.1:8787. */
  localUrl: string;
  /** How long to wait for the provider to print its public URL. Default 30s. */
  timeoutMs?: number;
  provider?: TunnelProvider;
}

export interface TunnelDeps {
  /** Injected child spawner. Defaults to a real `node:child_process` cloudflared spawn. */
  spawn?: TunnelSpawnFn;
  /** Injected line->URL parser. Defaults to the cloudflared trycloudflare matcher. */
  parsePublicUrl?: (line: string) => string | null;
  /** Override the provider binary name (default 'cloudflared'). */
  bin?: string;
}

export interface TunnelReadyResult {
  ok: true;
  provider: TunnelProvider;
  /** The assigned https:// public URL (usable as an https community-node address). */
  publicUrl: string;
  /** The derived wss:// relay dial URL for the connection card. */
  relayUrl: string;
  /**
   * A tunnel URL is a CANDIDATE only. Reachability is proven separately by the
   * off-host probe, so this is always false here (never claim reachable).
   */
  verified: false;
}

export interface TunnelFailedResult {
  ok: false;
  provider: TunnelProvider;
  reason: string;
}

export type TunnelResult = TunnelReadyResult | TunnelFailedResult;

export interface TunnelHandle {
  /** Resolves once the public URL is parsed, the child exits, or the timeout elapses. */
  ready: Promise<TunnelResult>;
  /** Tear the tunnel down (kills the child). */
  stop(): void;
  /**
   * Register a callback fired when the tunnel child EXITS -- even after `ready`
   * has already resolved. A still-running relay process is NOT proof the tunnel
   * edge still round-trips, so the host server uses this to reset a live card
   * back to unverified the instant the tunnel dies. Each callback fires at most
   * once; a callback registered after the child already exited fires immediately.
   */
  onExit(cb: () => void): void;
}

const TRYCLOUDFLARE_RE = /https:\/\/[a-z0-9]+(?:-[a-z0-9]+)*\.trycloudflare\.com/i;

/** Extract the cloudflared quick-tunnel URL from one log line (null if absent). */
export function parseCloudflaredUrl(line: string): string | null {
  const m = line.match(TRYCLOUDFLARE_RE);
  return m ? m[0] : null;
}

/** Derive the relay dial URL (wss://) from the tunnel's https:// public URL. */
export function deriveWssUrl(publicUrl: string): string {
  if (/^https:\/\//i.test(publicUrl)) return publicUrl.replace(/^https:\/\//i, 'wss://');
  if (/^http:\/\//i.test(publicUrl)) return publicUrl.replace(/^http:\/\//i, 'ws://');
  return publicUrl;
}

function cloudflaredArgs(localUrl: string): string[] {
  return ['tunnel', '--no-autoupdate', '--url', localUrl];
}

/**
 * Default real spawn: `cloudflared tunnel --url <localUrl>`. Node-only (this host
 * module is never bundled for RN); tests inject their own spawn and never hit it.
 */
function defaultCloudflaredSpawn(bin: string, args: string[]): TunnelChild {
  return nodeSpawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] }) as unknown as TunnelChild;
}

export function startTunnel(input: StartTunnelInput, deps: TunnelDeps = {}): TunnelHandle {
  const provider: TunnelProvider = input.provider ?? 'cloudflared';
  const bin = deps.bin ?? provider;
  const spawn = deps.spawn ?? defaultCloudflaredSpawn;
  const parsePublicUrl = deps.parsePublicUrl ?? parseCloudflaredUrl;
  const timeoutMs = input.timeoutMs ?? 30_000;

  let child: TunnelChild | null = null;
  let exited = false;
  const exitCbs: Array<() => void> = [];

  const ready = new Promise<TunnelResult>((resolve) => {
    let settled = false;
    const fail = (reason: string): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ok: false, provider, reason });
    };
    const succeed = (publicUrl: string): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ok: true, provider, publicUrl, relayUrl: deriveWssUrl(publicUrl), verified: false });
    };

    const timer = setTimeout(
      () => fail(`${provider} did not report a public URL in time`),
      timeoutMs,
    );
    (timer as { unref?: () => void }).unref?.();

    try {
      child = spawn(bin, cloudflaredArgs(input.localUrl));
    } catch (err) {
      fail(`failed to spawn ${bin}: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    const onData = (chunk: Buffer | string): void => {
      for (const line of chunk.toString().split('\n')) {
        const url = parsePublicUrl(line);
        if (url) {
          succeed(url);
          return;
        }
      }
    };
    child.stdout.on('data', onData);
    child.stderr?.on('data', onData);
    child.on('exit', (code) => {
      exited = true;
      // Pre-URL exit fails `ready`; post-URL exit is a no-op on the (settled)
      // promise but STILL fires onExit so the caller can drop a stale card.
      fail(`${provider} tunnel process exited (code ${code ?? 'null'}) before it reported a public URL`);
      for (const cb of exitCbs.splice(0)) cb();
    });
  });

  return {
    ready,
    stop: () => child?.kill('SIGTERM'),
    onExit: (cb) => {
      if (exited) cb();
      else exitCbs.push(cb);
    },
  };
}
