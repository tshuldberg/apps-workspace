import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SocialProfile } from '@mylife/social';

const mocks = vi.hoisted(() => ({
  ensureSubmissionAlias: vi.fn(async () => ({ ok: true, data: 'cloud-submission-1' })),
  getDishById: vi.fn(),
  getSubmissionById: vi.fn(),
  hasApprovedBestChefSeedContent: vi.fn(() => false),
  normalizePublicMediaUrl: vi.fn((value: string | null | undefined) => (
    value?.startsWith('https://') ? value : null
  )),
  slugify: vi.fn((value: string) => value.toLowerCase().replace(/\s+/g, '-')),
}));

vi.mock('@mylife/bestchef', () => ({
  ensureSubmissionAlias: mocks.ensureSubmissionAlias,
  getDishById: mocks.getDishById,
  getSubmissionById: mocks.getSubmissionById,
  hasApprovedBestChefSeedContent: mocks.hasApprovedBestChefSeedContent,
  normalizePublicMediaUrl: mocks.normalizePublicMediaUrl,
  slugify: mocks.slugify,
  getDishVisuals: vi.fn((_dish: string, _cuisine?: string) => ({
    from: '#F26A3A',
    to: '#F2A93A',
    emoji: '🍽️',
  })),
}));

import { DEMO_SUBMISSIONS } from '../demo';
import {
  ensureCloudSubmissionForDemoSubmission,
  ensureCloudSubmissionForLocalSubmission,
  getCloudSubmissionViewModel,
  isCloudSubmissionId,
} from '../cloud-submissions';
import type { LocalSubmission } from '../local-submissions';

const profile = {
  id: 'profile-1',
  userId: 'user-1',
  displayName: 'BestChef Tester',
  handle: 'bestchef_tester',
  avatarUrl: null,
  bio: null,
} as unknown as SocialProfile;

describe('BestChef cloud submission bridge', () => {
  beforeEach(() => {
    mocks.ensureSubmissionAlias.mockClear();
    mocks.getDishById.mockReset();
    mocks.getSubmissionById.mockReset();
    mocks.normalizePublicMediaUrl.mockClear();
  });

  it('does not write demo submission aliases when public data policy blocks them', async () => {
    const result = await ensureCloudSubmissionForDemoSubmission(profile, DEMO_SUBMISSIONS[0]!, {
      allowDemoCloudAliases: false,
    });

    expect(result).toBeNull();
    expect(mocks.ensureSubmissionAlias).not.toHaveBeenCalled();
  });

  it('writes demo submission aliases only when explicitly allowed', async () => {
    const result = await ensureCloudSubmissionForDemoSubmission(profile, DEMO_SUBMISSIONS[0]!, {
      allowDemoCloudAliases: true,
    });

    expect(result).toBe('cloud-submission-1');
    expect(mocks.ensureSubmissionAlias).toHaveBeenCalledWith(
      expect.objectContaining({
        alias: 'demo:s1',
        profileId: 'profile-1',
        dishSlug: 'pad-thai',
      }),
    );
  });

  it('does not pass local file photo URIs into cloud alias writes', async () => {
    const localSubmission: LocalSubmission = {
      id: 'local-photo',
      dishId: 'd1',
      dishName: 'Pad Thai',
      title: 'Local Pad Thai',
      description: 'Local draft',
      ingredients: ['noodles'],
      instructions: ['cook'],
      photoUri: 'file:///var/mobile/local-photo.jpg',
      videos: [],
      createdAt: '2026-04-27T00:00:00.000Z',
    };

    await ensureCloudSubmissionForLocalSubmission(profile, localSubmission);

    expect(mocks.ensureSubmissionAlias).toHaveBeenCalledWith(
      expect.objectContaining({
        alias: 'local:local-photo',
        photoUrl: null,
      }),
    );
  });

  it('prefers a caller-resolved https photoUrl over the local file URI', async () => {
    const localSubmission: LocalSubmission = {
      id: 'local-uploaded',
      dishId: 'd1',
      dishName: 'Pad Thai',
      title: 'Local Pad Thai',
      description: 'Local draft',
      ingredients: ['noodles'],
      instructions: ['cook'],
      photoUri: 'file:///var/mobile/local-uploaded.jpg',
      videos: [],
      createdAt: '2026-04-27T00:00:00.000Z',
    };

    await ensureCloudSubmissionForLocalSubmission(profile, localSubmission, {
      resolvedPhotoUrl: 'https://cdn.example.com/uploaded.jpg',
    });

    expect(mocks.ensureSubmissionAlias).toHaveBeenCalledWith(
      expect.objectContaining({
        alias: 'local:local-uploaded',
        photoUrl: 'https://cdn.example.com/uploaded.jpg',
      }),
    );
  });

  it('recognizes standard Supabase UUID submission ids as cloud ids', () => {
    expect(isCloudSubmissionId('00000000-0000-4000-8000-000000000101')).toBe(true);
    expect(isCloudSubmissionId('not-a-cloud-id')).toBe(false);
  });

  it('maps public cloud recipe details to the submission chef profile', async () => {
    mocks.getSubmissionById.mockResolvedValueOnce({
      ok: true,
      data: {
        submission: {
          id: '00000000-0000-4000-8000-000000000101',
          dishId: '00000000-0000-4000-8000-000000000102',
          recipeSnapshotId: '00000000-0000-4000-8000-000000000103',
          profileId: '00000000-0000-4000-8000-000000000104',
          photoUrl: null,
          photoVerified: true,
          voteScore: 1000,
          likeCount: 1000,
          rank: 1,
          createdAt: new Date('2026-05-06T00:00:00.000Z'),
          upvoteCount: 1000,
          downvoteCount: 0,
          reviewedCount: 1000,
        },
        snapshot: {
          title: 'ChefTom Roast Chicken',
          description: 'Crisp roast chicken.',
          ingredientsJson: ['whole chicken', 'kosher salt'],
          stepsJson: ['Roast until the skin is crisp and the thigh reaches 165 degrees F.'],
        },
        profile: {
          id: '00000000-0000-4000-8000-000000000104',
          displayName: 'ChefTom',
          handle: 'cheftom',
          avatarUrl: null,
        },
      },
    });
    mocks.getDishById.mockResolvedValueOnce({
      ok: true,
      data: { dish: { slug: 'roast-chicken' } },
    });

    const submission = await getCloudSubmissionViewModel(
      '00000000-0000-4000-8000-000000000101',
      null,
    );

    expect(submission).toMatchObject({
      title: 'ChefTom Roast Chicken',
      chefName: 'ChefTom',
      chefHandle: 'cheftom',
      voteScore: 1000,
      rank: 1,
    });
  });
});
