/**
 * RelayHub content-host registry (share-link host discovery).
 *
 * The registry is the MULTI-announcer, NON-consuming twin of the single-record
 * one-time rendezvous. These tests prove that property and its caps with an
 * injected clock: many announcers under one rid, idempotent lookups, per-slot
 * refresh, TTL sweep, the rid + announcer caps, the size cap, and the shared
 * rendezvous rate limiter. The relay only ever holds opaque records.
 */

import { describe, it, expect } from 'vitest';
import { RelayHub } from '../hub';
import { RELAY_LIMITS, type ServerFrame } from '../protocol';

const RID = 'aa'.repeat(32); // 64 hex

function recorder() {
  const frames: ServerFrame[] = [];
  return { frames, send: (f: ServerFrame) => frames.push(f) };
}

function hosts(frames: ServerFrame[]): string[][] {
  return frames
    .filter((f): f is { t: 'hosts'; rid: string; recs: string[] } => f.t === 'hosts')
    .map((f) => f.recs);
}

describe('RelayHub content-host registry', () => {
  it('returns ALL announcers under one rid (multi-announcer, unlike rendezvous)', () => {
    const hub = new RelayHub();
    const a = recorder();
    const b = recorder();
    hub.announce('a', RID, 'REC-A', a.send, undefined, 'ip-a');
    hub.announce('b', RID, 'REC-B', b.send, undefined, 'ip-b');
    expect(a.frames.some((f) => f.t === 'annok' && f.rid === RID)).toBe(true);
    expect(hub.stats().registryRecords).toBe(2);

    const lk = recorder();
    hub.lookup('r', RID, lk.send, 'ip-r');
    const recs = hosts(lk.frames)[0]!;
    expect(recs.sort()).toEqual(['REC-A', 'REC-B']);
  });

  it('is idempotent: a second lookup returns the same set (not consumed)', () => {
    const hub = new RelayHub();
    hub.announce('a', RID, 'REC-A', () => {}, undefined, 'ip-a');
    const first = recorder();
    const second = recorder();
    hub.lookup('r1', RID, first.send, 'ip-1');
    hub.lookup('r2', RID, second.send, 'ip-2');
    expect(hosts(first.frames)[0]).toEqual(['REC-A']);
    expect(hosts(second.frames)[0]).toEqual(['REC-A']);
    expect(hub.stats().registryRecords).toBe(1);
  });

  it('re-announce by the same announcer refreshes its single slot (no duplicate)', () => {
    const hub = new RelayHub();
    hub.announce('a', RID, 'V1', () => {}, undefined, 'ip-a');
    hub.announce('a2', RID, 'V2', () => {}, undefined, 'ip-a'); // same client key
    expect(hub.stats().registryRecords).toBe(1);
    const lk = recorder();
    hub.lookup('r', RID, lk.send, 'ip-r');
    expect(hosts(lk.frames)[0]).toEqual(['V2']);
  });

  it('an unknown rid lookup returns an empty set, not an error', () => {
    const hub = new RelayHub();
    const lk = recorder();
    hub.lookup('r', RID, lk.send, 'ip-r');
    expect(hosts(lk.frames)[0]).toEqual([]);
    expect(lk.frames.some((f) => f.t === 'err')).toBe(false);
  });

  it('expires records by TTL on lookup and on sweep', () => {
    let t = 1000;
    const hub = new RelayHub({ now: () => t });
    hub.announce('a', RID, 'REC-A', () => {}, 5000, 'ip-a');
    expect(hub.stats().registryRecords).toBe(1);

    t += 5001;
    const lk = recorder();
    hub.lookup('r', RID, lk.send, 'ip-r');
    expect(hosts(lk.frames)[0]).toEqual([]); // expired slot skipped
    expect(hub.stats().registryRids).toBe(0); // rid dropped once empty
  });

  it('sweep purges expired announcer slots and empty rids', () => {
    let t = 1000;
    const hub = new RelayHub({ now: () => t });
    hub.announce('a', RID, 'REC-A', () => {}, 5000, 'ip-a');
    expect(hub.stats().registryRids).toBe(1);
    t += 5001;
    hub.sweep();
    expect(hub.stats().registryRids).toBe(0);
    expect(hub.stats().registryRecords).toBe(0);
  });

  it('caps the number of announcers per rid', () => {
    const hub = new RelayHub({ limits: { maxAnnouncersPerRid: 3, rendezvousMaxPerWindow: 1000 } });
    for (let i = 0; i < 3; i++) {
      hub.announce(`c${i}`, RID, `REC-${i}`, () => {}, undefined, `ip-${i}`);
    }
    const over = recorder();
    hub.announce('over', RID, 'REC-OVER', over.send, undefined, 'ip-over');
    expect(over.frames.some((f) => f.t === 'err' && f.code === 'rid_full')).toBe(true);
    expect(hub.stats().registryRecords).toBe(3);
  });

  it('caps the number of distinct rids', () => {
    const hub = new RelayHub({ limits: { maxRegistryRids: 2, rendezvousMaxPerWindow: 1000 } });
    hub.announce('a', 'aa'.repeat(32), 'R', () => {}, undefined, 'ip');
    hub.announce('b', 'bb'.repeat(32), 'R', () => {}, undefined, 'ip');
    const over = recorder();
    hub.announce('c', 'cc'.repeat(32), 'R', over.send, undefined, 'ip');
    expect(over.frames.some((f) => f.t === 'err' && f.code === 'registry_full')).toBe(true);
    expect(hub.stats().registryRids).toBe(2);
  });

  it('rejects an oversize announce record (shares the rendezvous size cap)', () => {
    const hub = new RelayHub();
    const a = recorder();
    hub.announce('a', RID, 'x'.repeat(RELAY_LIMITS.maxRendezvousChars + 1), a.send, undefined, 'ip-a');
    expect(a.frames.some((f) => f.t === 'err' && f.code === 'too_large')).toBe(true);
    expect(hub.stats().registryRecords).toBe(0);
  });

  it('rate-limits registry operations via the shared rendezvous limiter', () => {
    const hub = new RelayHub();
    const a = recorder();
    for (let i = 0; i < RELAY_LIMITS.rendezvousMaxPerWindow; i++) {
      hub.announce('a', RID, `V${i}`, a.send, undefined, 'ip-flood');
    }
    hub.announce('a', RID, 'ONE-TOO-MANY', a.send, undefined, 'ip-flood');
    expect(a.frames.some((f) => f.t === 'err' && f.code === 'rate_limited')).toBe(true);
  });

  it('copies the record verbatim (the relay never decodes it)', () => {
    const hub = new RelayHub();
    const opaque = 'bm9uY2U.Y2lwaGVydGV4dA==';
    hub.announce('a', RID, opaque, () => {}, undefined, 'ip-a');
    const lk = recorder();
    hub.lookup('r', RID, lk.send, 'ip-r');
    expect(hosts(lk.frames)[0]).toEqual([opaque]);
  });
});
