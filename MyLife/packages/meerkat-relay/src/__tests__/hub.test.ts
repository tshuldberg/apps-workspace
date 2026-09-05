import { describe, it, expect } from 'vitest';
import { RelayHub } from '../hub';
import { RELAY_LIMITS, type ServerFrame } from '../protocol';

const TOKEN_A = 'a'.repeat(64);
const TOKEN_B = 'b'.repeat(64);

function recorder() {
  const frames: ServerFrame[] = [];
  return { frames, send: (f: ServerFrame) => frames.push(f) };
}

function envs(frames: ServerFrame[]): string[] {
  return frames.filter((f): f is { t: 'env'; env: string; ts: number } => f.t === 'env').map((f) => f.env);
}

describe('RelayHub routing', () => {
  it('forwards an envelope to a peer on the same token, not back to the sender', () => {
    const hub = new RelayHub();
    const a = recorder();
    const b = recorder();
    hub.join('a', TOKEN_A, a.send);
    hub.join('b', TOKEN_A, b.send);

    hub.relay('a', 'CIPHERTEXT-1');

    expect(envs(b.frames)).toEqual(['CIPHERTEXT-1']);
    expect(envs(a.frames)).toEqual([]); // no echo to sender
  });

  it('isolates tokens: a peer never receives another token group envelope', () => {
    const hub = new RelayHub();
    const a = recorder();
    const other = recorder();
    hub.join('a', TOKEN_A, a.send);
    hub.join('other', TOKEN_B, other.send);

    hub.relay('a', 'SECRET');

    expect(envs(other.frames)).toEqual([]);
  });

  it('forwards verbatim: the relay never alters the opaque envelope', () => {
    const hub = new RelayHub();
    const a = recorder();
    const b = recorder();
    hub.join('a', TOKEN_A, a.send);
    hub.join('b', TOKEN_A, b.send);
    const opaque = 'bm9uY2U.Y2lwaGVydGV4dA=='; // looks like base64; hub must not decode it
    hub.relay('a', opaque);
    expect(envs(b.frames)).toEqual([opaque]);
  });
});

describe('RelayHub mailbox', () => {
  it('buffers an envelope for an absent peer and delivers it on join', () => {
    let t = 1000;
    const hub = new RelayHub({ now: () => t });
    const a = recorder();
    hub.join('a', TOKEN_A, a.send);

    hub.relay('a', 'EARLY'); // no peer yet -> mailboxed
    expect(hub.stats().mailboxedEnvelopes).toBe(1);

    const b = recorder();
    hub.join('b', TOKEN_A, b.send);
    const ready = b.frames.find((f) => f.t === 'ready') as { queued: number } | undefined;
    expect(ready?.queued).toBe(1);
    expect(envs(b.frames)).toEqual(['EARLY']);
    expect(hub.stats().mailboxedEnvelopes).toBe(0);
  });

  it('drops mailboxed envelopes past TTL', () => {
    let t = 0;
    const hub = new RelayHub({ now: () => t });
    const a = recorder();
    hub.join('a', TOKEN_A, a.send);
    hub.relay('a', 'STALE');

    t += RELAY_LIMITS.mailboxTtlMs + 1; // advance past TTL
    const b = recorder();
    hub.join('b', TOKEN_A, b.send);
    expect(envs(b.frames)).toEqual([]); // expired, not delivered
  });

  it('caps the mailbox, dropping the oldest', () => {
    let t = 0;
    const hub = new RelayHub({ now: () => t });
    const a = recorder();
    hub.join('a', TOKEN_A, a.send);
    for (let i = 0; i < RELAY_LIMITS.mailboxMax + 5; i++) {
      t += 1;
      hub.relay('a', `E${i}`);
    }
    expect(hub.stats().mailboxedEnvelopes).toBe(RELAY_LIMITS.mailboxMax);
    const b = recorder();
    hub.join('b', TOKEN_A, b.send);
    const delivered = envs(b.frames);
    expect(delivered).not.toContain('E0'); // oldest dropped
    expect(delivered).toContain(`E${RELAY_LIMITS.mailboxMax + 4}`); // newest kept
  });
});

describe('RelayHub limits', () => {
  it('rejects an oversize envelope', () => {
    const hub = new RelayHub();
    const a = recorder();
    const b = recorder();
    hub.join('a', TOKEN_A, a.send);
    hub.join('b', TOKEN_A, b.send);
    hub.relay('a', 'x'.repeat(RELAY_LIMITS.maxEnvelopeChars + 1));
    expect(a.frames.some((f) => f.t === 'err' && f.code === 'too_large')).toBe(true);
    expect(envs(b.frames)).toEqual([]);
  });

  it('rate-limits a flooding connection', () => {
    let t = 0;
    const hub = new RelayHub({ now: () => t });
    const a = recorder();
    const b = recorder();
    hub.join('a', TOKEN_A, a.send);
    hub.join('b', TOKEN_A, b.send);
    for (let i = 0; i < RELAY_LIMITS.rateMaxPerWindow + 10; i++) {
      hub.relay('a', `E${i}`);
    }
    expect(a.frames.some((f) => f.t === 'err' && f.code === 'rate_limited')).toBe(true);
    expect(envs(b.frames).length).toBe(RELAY_LIMITS.rateMaxPerWindow);
  });

  it('resets the rate window after it elapses', () => {
    let t = 0;
    const hub = new RelayHub({ now: () => t });
    const a = recorder();
    const b = recorder();
    hub.join('a', TOKEN_A, a.send);
    hub.join('b', TOKEN_A, b.send);
    for (let i = 0; i < RELAY_LIMITS.rateMaxPerWindow; i++) hub.relay('a', `E${i}`);
    t += RELAY_LIMITS.rateWindowMs + 1;
    hub.relay('a', 'AFTER');
    expect(envs(b.frames)).toContain('AFTER');
  });

  it('rejects more than maxPeersPerToken connections on one token', () => {
    const hub = new RelayHub();
    for (let i = 0; i < RELAY_LIMITS.maxPeersPerToken; i++) {
      expect(hub.join(`c${i}`, TOKEN_A, () => {})).toBe(true);
    }
    const overflow = recorder();
    expect(hub.join('overflow', TOKEN_A, overflow.send)).toBe(false);
    expect(overflow.frames.some((f) => f.t === 'err' && f.code === 'token_full')).toBe(true);
  });

  it('cleans up the token group on leave', () => {
    const hub = new RelayHub();
    hub.join('a', TOKEN_A, () => {});
    expect(hub.stats().tokens).toBe(1);
    hub.leave('a');
    expect(hub.stats().tokens).toBe(0);
    expect(hub.stats().connections).toBe(0);
  });
});

describe('RelayHub DoS hardening (audit P2)', () => {
  const tok = (n: number) => `${n}`.padStart(64, '0');

  it('per-client rate limit is NOT reset by reconnecting with a new connId', () => {
    let t = 0;
    const hub = new RelayHub({ now: () => t });
    const peer = recorder();
    hub.join('peer', TOKEN_A, peer.send, 'ip-victim'); // a peer to receive
    // The attacker floods to the rate cap from one IP, then reconnects.
    hub.join('atk1', TOKEN_A, () => {}, 'ip-attacker');
    for (let i = 0; i < RELAY_LIMITS.rateMaxPerWindow; i++) hub.relay('atk1', `E${i}`);
    hub.leave('atk1');
    // Reconnect with a brand-new connId but the SAME client IP: the window
    // must carry over, so the next envelope is rate-limited immediately.
    const atk2 = recorder();
    hub.join('atk2', TOKEN_A, atk2.send, 'ip-attacker');
    hub.relay('atk2', 'ONE-MORE');
    expect(atk2.frames.some((f) => f.t === 'err' && f.code === 'rate_limited')).toBe(true);
  });

  it('per-client connection cap rejects the (N+1)th connection from one IP', () => {
    const hub = new RelayHub({ limits: { maxConnectionsPerClient: 3 } });
    for (let i = 0; i < 3; i++) {
      expect(hub.join(`c${i}`, tok(i), () => {}, 'one-ip')).toBe(true);
    }
    const over = recorder();
    expect(hub.join('over', tok(99), over.send, 'one-ip')).toBe(false);
    expect(over.frames.some((f) => f.t === 'err' && f.code === 'too_many_connections')).toBe(true);
    // A different IP is unaffected.
    expect(hub.join('other', tok(98), () => {}, 'other-ip')).toBe(true);
  });

  it('global token cap rejects a new token group once full', () => {
    const hub = new RelayHub({ limits: { maxTokens: 2, maxConnectionsPerClient: 100 } });
    expect(hub.join('a', tok(1), () => {}, 'ip')).toBe(true);
    expect(hub.join('b', tok(2), () => {}, 'ip')).toBe(true);
    const over = recorder();
    expect(hub.join('c', tok(3), over.send, 'ip')).toBe(false);
    expect(over.frames.some((f) => f.t === 'err' && f.code === 'server_full')).toBe(true);
  });

  it('global connection cap rejects beyond maxConnections', () => {
    const hub = new RelayHub({ limits: { maxConnections: 2, maxConnectionsPerClient: 100 } });
    expect(hub.join('a', tok(1), () => {}, 'ip1')).toBe(true);
    expect(hub.join('b', tok(2), () => {}, 'ip2')).toBe(true);
    const over = recorder();
    expect(hub.join('c', tok(3), over.send, 'ip3')).toBe(false);
    expect(over.frames.some((f) => f.t === 'err' && f.code === 'server_full')).toBe(true);
  });

  it('caps the number of distinct mailbox queues', () => {
    const hub = new RelayHub({ limits: { maxMailboxTokens: 2, maxConnectionsPerClient: 100 } });
    // Each sender relays one envelope with no peer present -> a new mailbox.
    for (let i = 0; i < 4; i++) {
      hub.join(`s${i}`, tok(i), () => {}, `ip${i}`);
      hub.relay(`s${i}`, `PARKED${i}`);
    }
    expect(hub.stats().mailboxedEnvelopes).toBeLessThanOrEqual(2);
  });

  it('sweep ages out stale per-client rate state (bounds memory)', () => {
    let t = 0;
    const hub = new RelayHub({ now: () => t });
    hub.join('a', TOKEN_A, () => {}, 'ip-gone');
    hub.relay('a', 'E0');
    hub.leave('a');
    // Far past the rate window: the stale rate entry is collected on sweep.
    t += RELAY_LIMITS.rateWindowMs + 1;
    hub.sweep();
    // A fresh client reusing the same IP starts with a clean window.
    const fresh = recorder();
    hub.join('b', TOKEN_A, fresh.send, 'ip-gone');
    hub.relay('b', 'E1');
    expect(fresh.frames.some((f) => f.t === 'err' && f.code === 'rate_limited')).toBe(false);
  });
});

const RID = '00112233445566778899aabbccddeeff';

function recs(frames: ServerFrame[]): string[] {
  return frames.filter((f): f is { t: 'rec'; rid: string; rec: string } => f.t === 'rec').map((f) => f.rec);
}

describe('RelayHub rendezvous (MK-016)', () => {
  it('publishes an opaque record and resolves it once, verbatim', () => {
    const hub = new RelayHub();
    const pub = recorder();
    const res = recorder();
    hub.publish('p', RID, 'OPAQUE-BUNDLE', pub.send);
    expect(pub.frames.some((f) => f.t === 'pubok' && f.rid === RID)).toBe(true);
    expect(hub.stats().rendezvousRecords).toBe(1);

    hub.resolve('r', RID, res.send);
    expect(recs(res.frames)).toEqual(['OPAQUE-BUNDLE']);
  });

  it('is one-time: a second resolve of the same id returns not_found', () => {
    const hub = new RelayHub();
    hub.publish('p', RID, 'BUNDLE', () => {});
    const first = recorder();
    const second = recorder();
    hub.resolve('r1', RID, first.send);
    hub.resolve('r2', RID, second.send);
    expect(recs(first.frames)).toEqual(['BUNDLE']);
    expect(second.frames.some((f) => f.t === 'err' && f.code === 'not_found')).toBe(true);
    expect(hub.stats().rendezvousRecords).toBe(0);
  });

  it('resolving an unknown id returns not_found', () => {
    const hub = new RelayHub();
    const r = recorder();
    hub.resolve('r', RID, r.send);
    expect(r.frames.some((f) => f.t === 'err' && f.code === 'not_found')).toBe(true);
  });

  it('expires a record after its TTL; resolve then reports not_found', () => {
    let t = 1000;
    const hub = new RelayHub({ now: () => t });
    hub.publish('p', RID, 'BUNDLE', () => {}, 5000);
    t += 5001;
    const r = recorder();
    hub.resolve('r', RID, r.send);
    expect(r.frames.some((f) => f.t === 'err' && f.code === 'not_found')).toBe(true);
  });

  it('sweep purges expired rendezvous records', () => {
    let t = 1000;
    const hub = new RelayHub({ now: () => t });
    hub.publish('p', RID, 'BUNDLE', () => {}, 5000);
    expect(hub.stats().rendezvousRecords).toBe(1);
    t += 5001;
    hub.sweep();
    expect(hub.stats().rendezvousRecords).toBe(0);
  });

  it('a republish refreshes the same id without growing the store', () => {
    const hub = new RelayHub();
    hub.publish('p', RID, 'V1', () => {});
    hub.publish('p', RID, 'V2', () => {});
    expect(hub.stats().rendezvousRecords).toBe(1);
    const r = recorder();
    hub.resolve('r', RID, r.send);
    expect(recs(r.frames)).toEqual(['V2']);
  });

  it('rejects an oversize record', () => {
    const hub = new RelayHub();
    const p = recorder();
    hub.publish('p', RID, 'x'.repeat(RELAY_LIMITS.maxRendezvousChars + 1), p.send);
    expect(p.frames.some((f) => f.t === 'err' && f.code === 'too_large')).toBe(true);
    expect(hub.stats().rendezvousRecords).toBe(0);
  });

  it('rate-limits a flood of rendezvous operations from one connection', () => {
    const hub = new RelayHub();
    const p = recorder();
    // Republishing the same id counts against the per-connection op rate.
    for (let i = 0; i < RELAY_LIMITS.rendezvousMaxPerWindow; i++) {
      hub.publish('p', RID, `V${i}`, p.send);
    }
    hub.publish('p', RID, 'ONE-TOO-MANY', p.send);
    expect(p.frames.some((f) => f.t === 'err' && f.code === 'rate_limited')).toBe(true);
  });
});
