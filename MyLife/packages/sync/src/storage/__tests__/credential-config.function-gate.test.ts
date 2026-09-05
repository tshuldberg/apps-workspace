import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import {
  parseCredentialDestinationConfig,
  serializeCredentialDestinationConfig,
  type CredentialDestinationConfig,
} from '../credential-config';

describe('parseCredentialDestinationConfig function quality gate', () => {
  it('round-trips exact WebDAV and S3 configurations and rejects extra fields', () => {
    const webdav = { kind: 'webdav', baseUrl: 'https://dav.example.test/meerkat' } as const;
    const s3 = {
      kind: 's3',
      endpoint: 'https://s3.example.test',
      bucket: 'backups',
      region: 'us-east-1',
      prefix: 'meerkat',
    } as const;

    expect(parseCredentialDestinationConfig(serializeCredentialDestinationConfig(webdav))).toEqual(webdav);
    expect(parseCredentialDestinationConfig(serializeCredentialDestinationConfig(s3))).toEqual(s3);
    expect(parseCredentialDestinationConfig('{"kind":"webdav","baseUrl":"https://dav.test","secret":"x"}'))
      .toBeNull();
    expect(parseCredentialDestinationConfig(null)).toBeNull();
  });

  it('passes deterministic configuration fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'parseCredentialDestinationConfig fuzz',
      iterations: 200,
      seed: 41,
      makeCase: (rng, index): CredentialDestinationConfig => randomInt(rng, 0, 1) === 0
        ? { kind: 'webdav', baseUrl: `https://dav.example.test/${index}/${'a'.repeat(randomInt(rng, 1, 200))}` }
        : {
          kind: 's3',
          endpoint: `https://s3-${index}.example.test`,
          bucket: `bucket-${randomInt(rng, 1, 9999)}`,
          region: `region-${randomInt(rng, 1, 99)}`,
          prefix: `prefix-${randomInt(rng, 1, 9999)}`,
        },
      assertCase: async (config) => {
        const serialized = serializeCredentialDestinationConfig(config);
        expect(parseCredentialDestinationConfig(serialized)).toEqual(config);
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'parseCredentialDestinationConfig',
      sizes: [512, 1024, 2048],
      expected: 'linear',
      setup: (size) => JSON.stringify({
        kind: 'webdav',
        baseUrl: `https://dav.example.test/${'a'.repeat(size)}`,
      }),
      run: async (value) => {
        for (let iteration = 0; iteration < 25; iteration += 1) parseCredentialDestinationConfig(value);
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'parseCredentialDestinationConfig',
      repeats: 40,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => JSON.stringify({
        kind: 'webdav',
        baseUrl: `https://dav.example.test/${'a'.repeat(1000)}`,
      }),
      run: async (value) => parseCredentialDestinationConfig(value),
    });
  });
});
