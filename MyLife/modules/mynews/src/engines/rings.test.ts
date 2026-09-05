import { describe, expect, it } from 'vitest';

import {
  DEFAULT_RING_CONFIG,
  detectEndorsementRings,
  type EndorsementEdge,
} from './rings';

const HOUR = 3_600_000;
const T0 = Date.parse('2026-07-01T00:00:00.000Z');

function edge(
  endorserId: string,
  beneficiaryId: string,
  offsetMs = 0,
  similarity = 0.9,
): EndorsementEdge {
  return { endorserId, beneficiaryId, createdAtMs: T0 + offsetMs, similarity };
}

/** Endorsements spread over days, each from a different account. Healthy. */
function healthyGraph(): EndorsementEdge[] {
  return [
    edge('alice', 'zoe', 0),
    edge('bob', 'zoe', 30 * HOUR),
    edge('carol', 'zoe', 70 * HOUR),
    edge('dave', 'zoe', 120 * HOUR),
    edge('zoe', 'erin', 200 * HOUR),
    edge('alice', 'frank', 260 * HOUR),
  ];
}

describe('detectEndorsementRings: healthy graphs', () => {
  it('finds nothing in a spread-out graph of independent endorsers', () => {
    const analysis = detectEndorsementRings(healthyGraph());
    expect(analysis.findings).toEqual([]);
    expect(analysis.flagged).toEqual([]);
    expect(analysis.suspicion).toEqual({});
  });

  it('finds nothing in an empty graph', () => {
    const analysis = detectEndorsementRings([]);
    expect(analysis.findings).toEqual([]);
    expect(analysis.flagged).toEqual([]);
  });

  it('does not flag a single reciprocal endorsement', () => {
    const analysis = detectEndorsementRings([edge('alice', 'bob', 0), edge('bob', 'alice', 90 * HOUR)]);
    expect(analysis.findings.filter((f) => f.code === 'mutual-pair')).toEqual([]);
  });
});

describe('detectEndorsementRings: mutual pairs', () => {
  it('flags a pair that endorses each other repeatedly', () => {
    const analysis = detectEndorsementRings([
      edge('alice', 'bob', 0),
      edge('alice', 'bob', HOUR),
      edge('bob', 'alice', 2 * HOUR),
      edge('bob', 'alice', 3 * HOUR),
    ]);
    const mutual = analysis.findings.filter((f) => f.code === 'mutual-pair');
    expect(mutual).toHaveLength(1);
    expect(mutual[0]!.memberIds).toEqual(['alice', 'bob']);
    // The minimum mutual pair is evidence worth a moderator's eyes but not
    // enough on its own to withdraw trust, so it scores just under flagAt.
    expect(mutual[0]!.score).toBeCloseTo(0.55, 5);
    expect(analysis.suspicion.alice).toBeCloseTo(0.55, 5);
    expect(analysis.flagged).toEqual([]);
  });

  it('flags a pair once the reciprocity is heavier than the minimum', () => {
    const analysis = detectEndorsementRings([
      ...Array.from({ length: 3 }, (_, i) => edge('alice', 'bob', i * HOUR)),
      ...Array.from({ length: 3 }, (_, i) => edge('bob', 'alice', (3 + i) * HOUR)),
    ]);
    expect(analysis.flagged).toEqual(['alice', 'bob']);
  });

  it('reports a pair once, not once per direction', () => {
    const analysis = detectEndorsementRings([
      edge('alice', 'bob'),
      edge('alice', 'bob'),
      edge('alice', 'bob'),
      edge('bob', 'alice'),
      edge('bob', 'alice'),
    ]);
    expect(analysis.findings.filter((f) => f.code === 'mutual-pair')).toHaveLength(1);
  });

  it('scores a heavier pair higher', () => {
    const light = detectEndorsementRings([
      edge('a', 'b'),
      edge('a', 'b'),
      edge('b', 'a'),
      edge('b', 'a'),
    ]).findings.find((f) => f.code === 'mutual-pair')!;
    const heavy = detectEndorsementRings([
      ...Array.from({ length: 6 }, () => edge('a', 'b')),
      ...Array.from({ length: 6 }, () => edge('b', 'a')),
    ]).findings.find((f) => f.code === 'mutual-pair')!;
    expect(heavy.score).toBeGreaterThan(light.score);
  });
});

describe('detectEndorsementRings: closed cycles', () => {
  it('flags a three-account cycle', () => {
    const analysis = detectEndorsementRings([
      edge('a', 'b', 0),
      edge('b', 'c', 40 * HOUR),
      edge('c', 'a', 80 * HOUR),
    ]);
    const cycles = analysis.findings.filter((f) => f.code === 'closed-cycle');
    expect(cycles).toHaveLength(1);
    expect(cycles[0]!.memberIds).toEqual(['a', 'b', 'c']);
    expect(analysis.flagged).toEqual(['a', 'b', 'c']);
  });

  it('reports a cycle once regardless of which member is listed first', () => {
    const forward = detectEndorsementRings([edge('a', 'b'), edge('b', 'c'), edge('c', 'a')]);
    const shuffled = detectEndorsementRings([edge('c', 'a'), edge('a', 'b'), edge('b', 'c')]);
    expect(forward.findings.filter((f) => f.code === 'closed-cycle')).toHaveLength(1);
    expect(shuffled.findings).toEqual(forward.findings);
  });

  it('does not invent a cycle from a chain', () => {
    const analysis = detectEndorsementRings([
      edge('a', 'b', 0),
      edge('b', 'c', 40 * HOUR),
      edge('c', 'd', 80 * HOUR),
    ]);
    expect(analysis.findings.filter((f) => f.code === 'closed-cycle')).toEqual([]);
  });

  it('scores a longer cycle slightly lower than a tight one', () => {
    const three = detectEndorsementRings([
      edge('a', 'b'),
      edge('b', 'c'),
      edge('c', 'a'),
    ]).findings.find((f) => f.code === 'closed-cycle')!;
    const four = detectEndorsementRings([
      edge('a', 'b'),
      edge('b', 'c'),
      edge('c', 'd'),
      edge('d', 'a'),
    ]).findings.find((f) => f.code === 'closed-cycle')!;
    expect(four.score).toBeLessThan(three.score);
  });

  it('respects the configured cycle ceiling', () => {
    const fiveCycle = [
      edge('a', 'b'),
      edge('b', 'c'),
      edge('c', 'd'),
      edge('d', 'e'),
      edge('e', 'a'),
    ];
    expect(
      detectEndorsementRings(fiveCycle).findings.filter((f) => f.code === 'closed-cycle'),
    ).toEqual([]);
    expect(
      detectEndorsementRings(fiveCycle, { ...DEFAULT_RING_CONFIG, maxCycleLength: 5 }).findings.filter(
        (f) => f.code === 'closed-cycle',
      ),
    ).toHaveLength(1);
  });
});

describe('detectEndorsementRings: concentration', () => {
  it('flags a beneficiary whose endorsements come mostly from one account', () => {
    const analysis = detectEndorsementRings([
      edge('sock', 'target', 0),
      edge('sock', 'target', 40 * HOUR),
      edge('sock', 'target', 80 * HOUR),
      edge('other', 'target', 120 * HOUR),
    ]);
    const found = analysis.findings.filter((f) => f.code === 'concentrated-beneficiary');
    expect(found).toHaveLength(1);
    expect(found[0]!.memberIds).toEqual(['sock', 'target']);
    expect(found[0]!.score).toBeCloseTo(0.75, 5);
  });

  it('does not flag a well-distributed beneficiary', () => {
    const analysis = detectEndorsementRings([
      edge('a', 'target', 0),
      edge('b', 'target', 40 * HOUR),
      edge('c', 'target', 80 * HOUR),
      edge('d', 'target', 120 * HOUR),
    ]);
    expect(analysis.findings.filter((f) => f.code === 'concentrated-beneficiary')).toEqual([]);
  });

  it('needs a minimum sample before concentration means anything', () => {
    const analysis = detectEndorsementRings([
      edge('sock', 'target', 0),
      edge('sock', 'target', 40 * HOUR),
    ]);
    expect(analysis.findings.filter((f) => f.code === 'concentrated-beneficiary')).toEqual([]);
  });
});

describe('detectEndorsementRings: coordinated bursts', () => {
  it('flags several distinct accounts endorsing one profile inside the window', () => {
    const analysis = detectEndorsementRings([
      edge('a', 'target', 0),
      edge('b', 'target', 60_000),
      edge('c', 'target', 120_000),
    ]);
    const bursts = analysis.findings.filter((f) => f.code === 'burst-window');
    expect(bursts).toHaveLength(1);
    expect(bursts[0]!.memberIds).toEqual(['a', 'b', 'c', 'target']);
  });

  it('does not flag the same endorsements spread beyond the window', () => {
    const analysis = detectEndorsementRings([
      edge('a', 'target', 0),
      edge('b', 'target', 40 * HOUR),
      edge('c', 'target', 80 * HOUR),
    ]);
    expect(analysis.findings.filter((f) => f.code === 'burst-window')).toEqual([]);
  });

  it('does not treat one account posting repeatedly as a burst', () => {
    const analysis = detectEndorsementRings([
      edge('a', 'target', 0),
      edge('a', 'target', 1000),
      edge('a', 'target', 2000),
    ]);
    expect(analysis.findings.filter((f) => f.code === 'burst-window')).toEqual([]);
  });

  it('honors a widened window from config', () => {
    const spread = [
      edge('a', 'target', 0),
      edge('b', 'target', 40 * HOUR),
      edge('c', 'target', 80 * HOUR),
    ];
    const analysis = detectEndorsementRings(spread, {
      ...DEFAULT_RING_CONFIG,
      burstWindowMs: 100 * HOUR,
    });
    expect(analysis.findings.filter((f) => f.code === 'burst-window')).toHaveLength(1);
  });
});

describe('detectEndorsementRings: self-endorsement', () => {
  it('flags a self-endorsement as an integrity violation at full score', () => {
    const analysis = detectEndorsementRings([edge('a', 'a', 0)]);
    const found = analysis.findings.filter((f) => f.code === 'self-endorsement');
    expect(found).toHaveLength(1);
    expect(found[0]!.score).toBe(1);
    expect(analysis.flagged).toEqual(['a']);
    expect(found[0]!.explain).toContain('bypass');
  });

  it('excludes self-edges from every other detector', () => {
    const analysis = detectEndorsementRings([
      edge('a', 'a', 0),
      edge('a', 'a', HOUR),
      edge('a', 'a', 2 * HOUR),
      edge('a', 'a', 3 * HOUR),
    ]);
    expect(analysis.findings.map((f) => f.code)).toEqual(['self-endorsement']);
  });
});

describe('detectEndorsementRings: determinism and aggregation', () => {
  it('produces byte-identical output regardless of input order', () => {
    const edges = [
      edge('a', 'b', 0),
      edge('b', 'a', HOUR),
      edge('a', 'b', 2 * HOUR),
      edge('b', 'a', 3 * HOUR),
      edge('c', 'a', 4 * HOUR),
      edge('d', 'a', 5 * HOUR),
      edge('e', 'a', 6 * HOUR),
    ];
    const forward = detectEndorsementRings(edges);
    const reversed = detectEndorsementRings([...edges].reverse());
    expect(JSON.stringify(reversed)).toBe(JSON.stringify(forward));
  });

  it('orders SEVERAL findings of the same kind identically whatever the input order', () => {
    // One mutual pair can be emitted in only one order, so a single-pair graph
    // cannot detect a missing sort. Two independent pairs can, and the console
    // reads these findings straight through, so unstable ordering would make the
    // review queue shuffle between refreshes.
    const edges = [
      edge('zed', 'yan', 0),
      edge('zed', 'yan', HOUR),
      edge('yan', 'zed', 2 * HOUR),
      edge('yan', 'zed', 3 * HOUR),
      edge('abe', 'bea', 4 * HOUR),
      edge('abe', 'bea', 5 * HOUR),
      edge('bea', 'abe', 6 * HOUR),
      edge('bea', 'abe', 7 * HOUR),
    ];
    const forward = detectEndorsementRings(edges);
    const reversed = detectEndorsementRings([...edges].reverse());
    const pairs = forward.findings.filter((f) => f.code === 'mutual-pair');
    expect(pairs).toHaveLength(2);
    // Sorted by member ids, so 'abe|bea' precedes 'yan|zed' either way in.
    expect(pairs.map((f) => f.memberIds.join('|'))).toEqual(['abe|bea', 'yan|zed']);
    expect(JSON.stringify(reversed)).toBe(JSON.stringify(forward));
  });

  it('caps per-profile suspicion at 1 while summing several findings', () => {
    const analysis = detectEndorsementRings([
      edge('a', 'b', 0),
      edge('a', 'b', HOUR),
      edge('b', 'a', 2 * HOUR),
      edge('b', 'a', 3 * HOUR),
      edge('c', 'b', 4 * HOUR),
      edge('d', 'b', 4 * HOUR + 1000),
      edge('e', 'b', 4 * HOUR + 2000),
    ]);
    for (const value of Object.values(analysis.suspicion)) {
      expect(value).toBeLessThanOrEqual(1);
      expect(value).toBeGreaterThan(0);
    }
    expect(analysis.findings.length).toBeGreaterThan(1);
  });

  it('only lists profiles at or above the flag threshold', () => {
    const analysis = detectEndorsementRings([
      edge('a', 'target', 0),
      edge('b', 'target', 60_000),
      edge('c', 'target', 120_000),
    ]);
    for (const id of analysis.flagged) {
      expect(analysis.suspicion[id]!).toBeGreaterThanOrEqual(DEFAULT_RING_CONFIG.flagAt);
    }
    for (const [id, value] of Object.entries(analysis.suspicion)) {
      if (value < DEFAULT_RING_CONFIG.flagAt) expect(analysis.flagged).not.toContain(id);
    }
  });

  it('writes explanations without em dashes', () => {
    const analysis = detectEndorsementRings([
      edge('a', 'b'),
      edge('a', 'b'),
      edge('b', 'a'),
      edge('b', 'a'),
      edge('a', 'a'),
    ]);
    for (const finding of analysis.findings) {
      expect(finding.explain).not.toContain('—');
      expect(finding.explain.length).toBeGreaterThan(20);
    }
  });

  it('pins the default config', () => {
    expect(DEFAULT_RING_CONFIG).toEqual({
      mutualMinEach: 2,
      maxCycleLength: 4,
      concentrationMinReceived: 4,
      concentrationShare: 0.6,
      burstWindowMs: 15 * 60_000,
      burstMinEndorsers: 3,
      flagAt: 0.6,
    });
  });
});
