import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../test/function-quality';
import { accountSubjectTombstoneHash } from '../account-store';

describe('accountSubjectTombstoneHash function quality gate', () => {
  it('is stable, domain separated, and does not expose the provider subject', () => {
    const apple = accountSubjectTombstoneHash('apple', 'private-subject');
    expect(apple).toMatch(/^[0-9a-f]{64}$/u);
    expect(apple).toBe(accountSubjectTombstoneHash('apple', 'private-subject'));
    expect(apple).not.toBe(accountSubjectTombstoneHash('google', 'private-subject'));
    expect(apple).not.toContain('private-subject');
  });

  it('HMAC-keys the marker under a server secret (MED-1): unforgeable without the key', () => {
    const unkeyed = accountSubjectTombstoneHash('apple', 'private-subject');
    const keyed = accountSubjectTombstoneHash('apple', 'private-subject', 'server-secret');
    const otherKey = accountSubjectTombstoneHash('apple', 'private-subject', 'different-secret');
    // Same 64-hex shape (the deleted_subjects CHECK holds) but a keyed marker cannot
    // be recomputed by a DB reader who only holds the candidate subject.
    expect(keyed).toMatch(/^[0-9a-f]{64}$/u);
    expect(keyed).not.toBe(unkeyed);
    expect(keyed).not.toBe(otherKey);
    // Stable per key so the delete-time write and the recreate-time check match.
    expect(keyed).toBe(accountSubjectTombstoneHash('apple', 'private-subject', 'server-secret'));
    expect(keyed).not.toContain('private-subject');
  });

  it('passes deterministic subject fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'accountSubjectTombstoneHash fuzz',
      iterations: 200,
      seed: 42,
      makeCase: (rng) => Array.from(
        { length: randomInt(rng, 1, 500) },
        () => String.fromCharCode(randomInt(rng, 32, 126)),
      ).join(''),
      assertCase: (subject) => {
        const first = accountSubjectTombstoneHash('apple', subject);
        expect(first).toMatch(/^[0-9a-f]{64}$/u);
        expect(first).toBe(accountSubjectTombstoneHash('apple', subject));
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'accountSubjectTombstoneHash',
      sizes: [250, 500, 1000],
      expected: 'linear',
      setup: (size) => 'x'.repeat(size),
      run: (subject) => {
        accountSubjectTombstoneHash('apple', subject);
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'accountSubjectTombstoneHash',
      repeats: 40,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => 'x'.repeat(1000),
      run: (subject) => {
        accountSubjectTombstoneHash('apple', subject);
      },
    });
  });
});
