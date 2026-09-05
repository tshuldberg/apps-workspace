import { describe, expect, it } from 'vitest';

import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import {
  buildPaymentsProfile,
  searchPaymentsProfiles,
} from '../index';
import type { PaymentsPaymentProfile } from '../types';

function makeProfile(index: number): PaymentsPaymentProfile {
  return buildPaymentsProfile({
    ownerUserId: `owner_${index}`,
    handle: `@user${index}`,
    displayName: `User ${index}`,
    identityStatus: 'verified',
    verificationState: 'verified',
    approvedTier: index % 2 === 0 ? 'standard' : 'basic',
    fields: {
      legalName: `User ${index}`,
      email: `user${index}@example.com`,
      phoneE164: `+1415555${String(index).padStart(4, '0')}`,
      dateOfBirth: '1990-01-01',
      addressLine1: '1 Main St',
      city: 'San Francisco',
      regionCode: 'CA',
      postalCode: '94105',
      governmentIdLast4: '1234',
    },
    discoverability: {
      visibility: index % 3 === 0 ? 'contacts_only' : 'searchable',
      allowEmailLookup: true,
      allowPhoneLookup: true,
    },
    email: {
      value: `user${index}@example.com`,
      verificationState: 'verified',
      discoverable: true,
    },
    phone: {
      value: `+1415555${String(index).padStart(4, '0')}`,
      verificationState: 'verified',
      discoverable: true,
    },
  });
}

describe('searchPaymentsProfiles function quality gate', () => {
  it('matches contract behavior for exact profile search', () => {
    const profiles = [makeProfile(1), makeProfile(2), makeProfile(3)];
    const results = searchPaymentsProfiles({
      profiles,
      query: '@user2',
      actorUserId: 'viewer_1',
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.ownerUserId).toBe('owner_2');
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'searchPaymentsProfiles fuzz',
      iterations: 100,
      seed: 42,
      makeCase: (rng, index) => {
        const profileCount = randomInt(rng, 10, 40);
        const profiles = Array.from({ length: profileCount }, (_, innerIndex) =>
          makeProfile(index * 100 + innerIndex),
        );
        const targetIndex = randomInt(rng, 0, profileCount - 1);
        const target = profiles[targetIndex]!;
        const relationship =
          target.discoverability.visibility === 'contacts_only'
            ? 'contact'
            : 'stranger';
        const relationshipByOwnerUserId = {
          [target.ownerUserId]: relationship,
        } as const;

        return {
          profiles,
          target,
          relationshipByOwnerUserId,
        };
      },
      assertCase: async (testCase) => {
        const byHandle = searchPaymentsProfiles({
          profiles: testCase.profiles,
          query: testCase.target.handleSearchKey ?? '',
          actorUserId: 'viewer_1',
          relationshipByOwnerUserId: testCase.relationshipByOwnerUserId,
        });
        const byEmail = searchPaymentsProfiles({
          profiles: testCase.profiles,
          query: testCase.target.email.value ?? '',
          actorUserId: 'viewer_1',
          relationshipByOwnerUserId: testCase.relationshipByOwnerUserId,
        });

        expect(byHandle.some((profile) => profile.ownerUserId === testCase.target.ownerUserId)).toBe(true);
        expect(byEmail.some((profile) => profile.ownerUserId === testCase.target.ownerUserId)).toBe(true);
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'searchPaymentsProfiles',
      sizes: [1000, 2000, 4000],
      expected: 'linear',
      warmupRuns: 2,
      sampleRuns: 7,
      maxRatios: [6.0, 6.0],
      setup: (size) => ({
        profiles: Array.from({ length: size }, (_, index) => makeProfile(index)),
        query: '@missing-user',
      }),
      run: async ({ profiles, query }) => {
        for (let index = 0; index < 80; index += 1) {
          searchPaymentsProfiles({
            profiles,
            query,
            actorUserId: 'viewer_1',
          });
        }
      },
    });
  });

  it('stays within memory budget under repeated search', async () => {
    await assertMemoryBudget({
      label: 'searchPaymentsProfiles',
      repeats: 10,
      maxHeapDeltaBytes: 24 * 1024 * 1024,
      setup: () => ({
        profiles: Array.from({ length: 500 }, (_, index) => makeProfile(index)),
        query: '@user499',
      }),
      run: async ({ profiles, query }) => {
        searchPaymentsProfiles({
          profiles,
          query,
          actorUserId: 'viewer_1',
        });
      },
    });
  });
});
