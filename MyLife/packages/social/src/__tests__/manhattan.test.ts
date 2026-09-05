import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSocialClientMock } = vi.hoisted(() => ({
  getSocialClientMock: vi.fn(),
}));

vi.mock('../client-store', () => ({
  getSocialClient: getSocialClientMock,
}));

import {
  emitManhattanEventSaved,
  emitManhattanPlanShared,
} from '../activity-emitter';
import { generateManhattanPlanCard } from '../share-card';
import type { SocialProfile } from '../types';

function mockOptedInClient(moduleId: string) {
  const postActivity = vi.fn().mockImplementation(async (input) => ({
    ok: true,
    data: {
      id: 'act-1',
      profileId: 'profile-1',
      moduleId,
      type: input.type,
      title: input.title,
      description: null,
      metadata: input.metadata ?? {},
      visibility: input.visibility,
      kudosCount: 0,
      commentCount: 0,
      createdAt: '2026-06-07T00:00:00.000Z',
    },
  }));

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
              moduleId,
              autoPost: true,
              defaultVisibility: 'followers',
            },
          ],
        },
      },
    }),
    postActivity,
  });

  return postActivity;
}

describe('Manhattan activity emitters', () => {
  beforeEach(() => {
    getSocialClientMock.mockReset();
  });

  it('emits manhattan_event_saved with the manhattan module id', async () => {
    const postActivity = mockOptedInClient('manhattan');

    const result = await emitManhattanEventSaved('Saved Broadway show', {
      eventTitle: 'Hamilton',
      location: 'Richard Rodgers Theatre',
    });

    expect(postActivity).toHaveBeenCalledWith({
      moduleId: 'manhattan',
      type: 'manhattan_event_saved',
      title: 'Saved Broadway show',
      description: undefined,
      metadata: { eventTitle: 'Hamilton', location: 'Richard Rodgers Theatre' },
      visibility: 'followers',
    });
    expect(result).toMatchObject({ emitted: true, activity: { id: 'act-1' } });
  });

  it('emits manhattan_plan_shared with the manhattan module id', async () => {
    const postActivity = mockOptedInClient('manhattan');

    const result = await emitManhattanPlanShared('Shared a day in NYC', {
      planTitle: 'Perfect Saturday',
      location: 'Manhattan',
      eventCount: 4,
    });

    expect(postActivity).toHaveBeenCalledWith({
      moduleId: 'manhattan',
      type: 'manhattan_plan_shared',
      title: 'Shared a day in NYC',
      description: undefined,
      metadata: { planTitle: 'Perfect Saturday', location: 'Manhattan', eventCount: 4 },
      visibility: 'followers',
    });
    expect(result).toMatchObject({ emitted: true, activity: { id: 'act-1' } });
  });
});

describe('generateManhattanPlanCard', () => {
  const profile = {
    id: 'profile-1',
    handle: 'nyc_explorer',
    displayName: 'NYC Explorer',
  } as unknown as SocialProfile;

  it('builds a manhattan_plan share card with plural event label', () => {
    const card = generateManhattanPlanCard(profile, {
      title: 'Perfect Saturday',
      location: 'Manhattan',
      eventCount: 3,
      duration: 'Full day',
    });

    expect(card).toEqual({
      type: 'manhattan_plan',
      profileId: 'profile-1',
      moduleId: 'manhattan',
      headline: 'Perfect Saturday',
      subtext: 'Manhattan',
      statValue: '3',
      statLabel: 'events',
      data: {
        planTitle: 'Perfect Saturday',
        location: 'Manhattan',
        eventCount: 3,
        duration: 'Full day',
        handle: 'nyc_explorer',
        displayName: 'NYC Explorer',
      },
    });
  });

  it('uses the singular event label when eventCount is 1', () => {
    const card = generateManhattanPlanCard(profile, {
      title: 'Quick Visit',
      location: 'SoHo',
      eventCount: 1,
    });

    expect(card.statValue).toBe('1');
    expect(card.statLabel).toBe('event');
    expect(card.data.duration).toBeUndefined();
  });
});
