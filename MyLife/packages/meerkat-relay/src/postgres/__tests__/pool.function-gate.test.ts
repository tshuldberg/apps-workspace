import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import { createMeerkatPostgresPoolConfig, type MeerkatPostgresPoolOptions } from '../pool';

const validOptions = (): MeerkatPostgresPoolOptions => ({
  connectionString: 'postgres://localhost/meerkat',
  applicationName: 'meerkat-test',
  sslMode: 'disable',
});

describe('createMeerkatPostgresPoolConfig function quality gate', () => {
  it('matches bounded pool and timeout contract behavior', () => {
    const config = createMeerkatPostgresPoolConfig({
      ...validOptions(),
      maxConnections: 8,
      statementTimeoutMs: 2_500,
      queryTimeoutMs: 3_500,
    });
    expect(config.max).toBe(8);
    expect(config.statement_timeout).toBe(2_500);
    expect(config.query_timeout).toBe(3_500);
    expect(config.options).toBe('-c transaction_timeout=60000');
    expect(config.ssl).toBe(false);
    expect(() => createMeerkatPostgresPoolConfig({
      ...validOptions(),
      sslMode: 'prefer' as never,
    })).toThrow(/Unsupported PostgreSQL TLS mode/);
    expect(() => createMeerkatPostgresPoolConfig({
      ...validOptions(),
      productionMode: true,
      sslMode: 'require',
    })).toThrow(/verify-full TLS/);
    expect(() => createMeerkatPostgresPoolConfig({
      connectionString: 'postgres://localhost/meerkat',
      applicationName: 'meerkat-test',
    })).toThrow(/explicit CA bundle/);
    for (const query of ['sslmode=disable', 'statement_timeout=0', 'application_name=spoofed']) {
      expect(() => createMeerkatPostgresPoolConfig({
        ...validOptions(),
        connectionString: `postgres://localhost/meerkat?${query}`,
      })).toThrow(/parameters are forbidden/);
    }
    expect(() => createMeerkatPostgresPoolConfig({
      ...validOptions(),
      connectionString: 'https://localhost/meerkat',
    })).toThrow(/must use postgres/);
    expect(() => createMeerkatPostgresPoolConfig({
      ...validOptions(),
      statementTimeoutMs: 10_000,
      queryTimeoutMs: 10_999,
    })).toThrow(/at least 1000ms greater/);
    expect(() => createMeerkatPostgresPoolConfig({
      ...validOptions(),
      statementTimeoutMs: 10_000,
      transactionTimeoutMs: 10_000,
    })).toThrow(/transactionTimeoutMs must be greater/);

    const boundaries: Array<[keyof MeerkatPostgresPoolOptions, number]> = [
      ['maxConnections', 100],
      ['connectionTimeoutMs', 120_000],
      ['idleTimeoutMs', 600_000],
      ['statementTimeoutMs', 300_000],
      ['lockTimeoutMs', 120_000],
      ['idleInTransactionTimeoutMs', 300_000],
      ['maxLifetimeSeconds', 86_400],
    ];
    for (const [field, maximum] of boundaries) {
      expect(() => createMeerkatPostgresPoolConfig({
        ...validOptions(),
        [field]: 1,
      })).not.toThrow();
      expect(() => createMeerkatPostgresPoolConfig({
        ...validOptions(),
        [field]: maximum,
      })).not.toThrow();
      expect(() => createMeerkatPostgresPoolConfig({
        ...validOptions(),
        [field]: 0,
      })).toThrow();
      expect(() => createMeerkatPostgresPoolConfig({
        ...validOptions(),
        [field]: maximum + 1,
      })).toThrow();
    }
    expect(() => createMeerkatPostgresPoolConfig({
      ...validOptions(),
      statementTimeoutMs: 300_000,
      queryTimeoutMs: 301_000,
      transactionTimeoutMs: 301_000,
    })).not.toThrow();
    expect(() => createMeerkatPostgresPoolConfig({
      ...validOptions(),
      queryTimeoutMs: 301_001,
    })).toThrow();
    expect(() => createMeerkatPostgresPoolConfig({
      ...validOptions(),
      transactionTimeoutMs: 900_000,
    })).not.toThrow();
    expect(() => createMeerkatPostgresPoolConfig({
      ...validOptions(),
      transactionTimeoutMs: 900_001,
    })).toThrow();
  });

  it('keeps fuzzed accepted configurations inside hard bounds', async () => {
    await runDeterministicFuzz({
      label: 'createMeerkatPostgresPoolConfig fuzz',
      iterations: 200,
      seed: 42,
      makeCase: (rng) => ({
        maxConnections: randomInt(rng, -20, 120),
        statementTimeoutMs: randomInt(rng, -100, 310_000),
        applicationName: rng() > 0.15 ? `meerkat-${randomInt(rng, 1, 9999)}` : 'unsafe name;',
      }),
      assertCase: ({ maxConnections, statementTimeoutMs, applicationName }) => {
        const input = {
          ...validOptions(),
          applicationName,
          maxConnections,
          statementTimeoutMs,
          queryTimeoutMs: Math.max(1, Math.min(301_000, statementTimeoutMs + 1_000)),
        };
        const valid = maxConnections >= 1 && maxConnections <= 100
          && statementTimeoutMs >= 1 && statementTimeoutMs <= 300_000
          && /^[A-Za-z0-9_.:-]{1,64}$/.test(applicationName);
        if (valid) {
          const result = createMeerkatPostgresPoolConfig(input);
          expect(result.max).toBeGreaterThanOrEqual(1);
          expect(result.max).toBeLessThanOrEqual(100);
          expect(result.statement_timeout).toBeGreaterThanOrEqual(1);
          expect(result.statement_timeout).toBeLessThanOrEqual(300_000);
        } else {
          expect(() => createMeerkatPostgresPoolConfig(input)).toThrow();
        }
      },
    });
  });

  it('stays within constant complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'createMeerkatPostgresPoolConfig',
      sizes: [250, 500, 1000],
      expected: 'constant',
      setup: () => validOptions(),
      run: (input) => createMeerkatPostgresPoolConfig(input),
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'createMeerkatPostgresPoolConfig',
      repeats: 200,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: validOptions,
      run: (input) => createMeerkatPostgresPoolConfig(input),
    });
  });
});
