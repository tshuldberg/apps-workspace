import { describe, expect, it } from 'vitest';
import {
  BESTCHEF_PROFILE_OWNED_CLOUD_COLUMNS,
  classifyBestChefIdentity,
} from '../account-lifecycle';

describe('BestChef account lifecycle helpers', () => {
  it('classifies anonymous users as requiring durable account linking', () => {
    const status = classifyBestChefIdentity({
      id: 'user-anon',
      email: undefined,
      phone: undefined,
      identities: [],
      is_anonymous: true,
    });

    expect(status).toMatchObject({
      userId: 'user-anon',
      isAnonymous: true,
      providers: ['anonymous'],
      hasDurableProvider: false,
      requiresAccountLinking: true,
    });
  });

  it('classifies email linked users as durable', () => {
    const status = classifyBestChefIdentity(
      {
        id: 'user-linked',
        email: 'chef@example.com',
        phone: undefined,
        identities: [{ provider: 'email' } as never],
        is_anonymous: false,
      },
      'profile-1',
    );

    expect(status).toMatchObject({
      userId: 'user-linked',
      profileId: 'profile-1',
      isAnonymous: false,
      hasDurableProvider: true,
      requiresAccountLinking: false,
    });
    expect(status.providers).toEqual(['email']);
  });

  it('tracks every cloud owner column needed for account deletion and merge checks', () => {
    expect(BESTCHEF_PROFILE_OWNED_CLOUD_COLUMNS).toContain('bc_submissions.profile_id');
    expect(BESTCHEF_PROFILE_OWNED_CLOUD_COLUMNS).toContain('bc_submission_likes.profile_id');
    expect(BESTCHEF_PROFILE_OWNED_CLOUD_COLUMNS).toContain('bc_saved_submissions.profile_id');
    expect(BESTCHEF_PROFILE_OWNED_CLOUD_COLUMNS).toContain('bc_comments.profile_id');
    expect(BESTCHEF_PROFILE_OWNED_CLOUD_COLUMNS).toContain('bc_votes.voter_profile_id');
    expect(BESTCHEF_PROFILE_OWNED_CLOUD_COLUMNS).toContain('bc_media_assets.owner_profile_id');
    expect(BESTCHEF_PROFILE_OWNED_CLOUD_COLUMNS).toContain('bc_submission_aliases.created_by_profile_id');
  });
});
