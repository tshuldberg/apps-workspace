import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSocialClientMock } = vi.hoisted(() => ({
  getSocialClientMock: vi.fn(),
}));

vi.mock('../client-store', () => ({
  getSocialClient: getSocialClientMock,
}));

import { emitActivity } from '../activity-emitter';

describe('emitActivity', () => {
  beforeEach(() => {
    getSocialClientMock.mockReset();
  });

  it('does not auto-post when the module has no explicit privacy setting', async () => {
    getSocialClientMock.mockReturnValue({
      getMyProfile: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          id: '8dd0e403-04c2-4e2a-a951-9a39aa00d001',
          privacySettings: {
            discoverable: false,
            showModules: false,
            showStreaks: false,
            openFollows: false,
            moduleSettings: [],
          },
        },
      }),
      postActivity: vi.fn(),
    });

    const result = await emitActivity({
      moduleId: 'forums',
      type: 'forums_thread_created',
      title: 'Started a thread',
    });

    expect(result).toEqual({
      emitted: false,
      reason: 'auto_post_disabled',
    });
  });

  it('posts when the module is explicitly opted in and uses the module visibility', async () => {
    const postActivity = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        id: 'act-1',
        profileId: 'profile-1',
        moduleId: 'market',
        type: 'market_listing_created',
        title: 'Listed camera gear',
        description: null,
        metadata: {},
        visibility: 'public',
        kudosCount: 0,
        commentCount: 0,
        createdAt: '2026-03-10T00:00:00.000Z',
      },
    });

    getSocialClientMock.mockReturnValue({
      getMyProfile: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          id: '8dd0e403-04c2-4e2a-a951-9a39aa00d001',
          privacySettings: {
            discoverable: false,
            showModules: false,
            showStreaks: false,
            openFollows: false,
            moduleSettings: [
              {
                moduleId: 'market',
                autoPost: true,
                defaultVisibility: 'public',
              },
            ],
          },
        },
      }),
      postActivity,
    });

    const result = await emitActivity({
      moduleId: 'market',
      type: 'market_listing_created',
      title: 'Listed camera gear',
    });

    expect(postActivity).toHaveBeenCalledWith({
      moduleId: 'market',
      type: 'market_listing_created',
      title: 'Listed camera gear',
      description: undefined,
      metadata: undefined,
      visibility: 'public',
    });
    expect(result).toMatchObject({
      emitted: true,
      activity: {
        id: 'act-1',
      },
    });
  });
});
