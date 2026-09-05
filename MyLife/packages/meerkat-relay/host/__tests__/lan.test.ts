/**
 * Host LAN rung (Plan 20, Phase 5.2). Same-network dial URL + mDNS payload.
 *
 * Honesty: a LAN address is a SAME-NETWORK rung. The dial URL is plain ws://
 * (never wss://), and neither it nor the advertise payload may present the host
 * as internet-reachable -- public exposure goes through the tunnel + off-host
 * gateReachability path, never here.
 */

import { describe, it, expect } from 'vitest';
import { MDNS_SERVICE_TYPE } from '@mylife/sync';
import {
  LAN_DEFAULT_PORT,
  LAN_SCOPE,
  LAN_TXT_VERSION,
  buildLanAdvertisePayload,
  lanDialUrl,
  resolveLanPort,
} from '../lan';

describe('lanDialUrl', () => {
  it('derives the ws:// LAN URL from the REAL bound port', () => {
    expect(lanDialUrl({ address: '192.168.1.42', boundPort: 8787 })).toBe('ws://192.168.1.42:8787');
    // A shifted port is reflected honestly in the URL.
    expect(lanDialUrl({ address: '192.168.1.42', boundPort: 8790 })).toBe('ws://192.168.1.42:8790');
  });

  it('accepts a .local hostname and brackets a bare IPv6 literal', () => {
    expect(lanDialUrl({ address: 'adas-laptop.local', boundPort: 8787 })).toBe('ws://adas-laptop.local:8787');
    expect(lanDialUrl({ address: 'fe80::1', boundPort: 8787 })).toBe('ws://[fe80::1]:8787');
  });

  it('rejects a URL as the address and an out-of-range port', () => {
    expect(() => lanDialUrl({ address: 'ws://192.168.1.42', boundPort: 8787 })).toThrow();
    expect(() => lanDialUrl({ address: '192.168.1.42', boundPort: 0 })).toThrow();
    expect(() => lanDialUrl({ address: '192.168.1.42', boundPort: 70000 })).toThrow();
  });

  it('NEVER emits wss:// (a LAN address is not a public TLS endpoint)', () => {
    const url = lanDialUrl({ address: '10.0.0.5', boundPort: LAN_DEFAULT_PORT });
    expect(url.startsWith('ws://')).toBe(true);
    expect(url.startsWith('wss://')).toBe(false);
  });
});

describe('resolveLanPort (port-in-use -> next free port, reflected honestly)', () => {
  it('returns the desired port when it is free (not shifted)', () => {
    const r = resolveLanPort({ isPortInUse: () => false });
    expect(r.port).toBe(LAN_DEFAULT_PORT);
    expect(r.shifted).toBe(false);
    expect(r.probed).toBe(1);
  });

  it('walks forward to the next free port and reports the shift', () => {
    const taken = new Set([8787, 8788]);
    const r = resolveLanPort({ desiredPort: 8787, isPortInUse: (p) => taken.has(p) });
    expect(r.port).toBe(8789);
    expect(r.shifted).toBe(true);
    expect(r.probed).toBe(3);
  });

  it('throws when no free port is found within the probe window', () => {
    expect(() => resolveLanPort({ isPortInUse: () => true, maxProbes: 4 })).toThrow(/no free LAN port/);
  });
});

describe('buildLanAdvertisePayload (well-formed, same-network only)', () => {
  it('is a well-formed DNS-SD advertise record for the REAL bound port', () => {
    const payload = buildLanAdvertisePayload({ boundPort: 8789, instanceName: "Ada's burrow" });
    expect(payload.serviceType).toBe(MDNS_SERVICE_TYPE);
    expect(payload.port).toBe(8789);
    expect(payload.name).toBe("Ada's burrow");
    expect(payload.txt.v).toBe(LAN_TXT_VERSION);
    expect(payload.txt.role).toBe('relay');
    // TXT is a flat string->string map (DNS-SD compatible).
    for (const v of Object.values(payload.txt)) expect(typeof v).toBe('string');
  });

  it('tags a community-node advertisement in the TXT role', () => {
    const payload = buildLanAdvertisePayload({ boundPort: 8787, role: 'communityNode' });
    expect(payload.txt.role).toBe('community');
  });

  it('falls back to a neutral instance name and rejects a bad port', () => {
    expect(buildLanAdvertisePayload({ boundPort: 8787, instanceName: '   ' }).name).toBe('Meerkat host');
    expect(() => buildLanAdvertisePayload({ boundPort: -1 })).toThrow();
  });

  it('does NOT advertise the host as internet-reachable (no URL, same-network scope)', () => {
    const payload = buildLanAdvertisePayload({ boundPort: 8787, instanceName: 'burrow' });
    expect(payload.scope).toBe(LAN_SCOPE);
    expect(LAN_SCOPE).toBe('same-network');
    // The advertise record is DATA ONLY -- it carries a port + hints, never a
    // wss:// / public URL that a browser could mistake for an internet endpoint.
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toMatch(/wss?:\/\//);
    expect(serialized).not.toMatch(/https?:\/\//);
  });
});
