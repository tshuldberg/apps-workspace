import {
  fetchFriendInvitesAction,
  fetchFriendsAction,
  fetchVisibleBookShareEventsAction,
} from '../actions';
import { issueActorIdentityToken } from '@/lib/actor-identity';
import { callSyncEndpoint } from '@/lib/sync-adapter';

vi.mock('@/lib/db', () => ({
  getAdapter: vi.fn(() => ({
    query: vi.fn(),
    execute: vi.fn(),
    transaction: vi.fn((fn: () => unknown) => fn()),
  })),
  ensureModuleMigrations: vi.fn(),
}));

vi.mock('@/lib/sync-adapter', () => ({
  callSyncEndpoint: vi.fn(),
}));

const ORIGINAL_ENV = { ...process.env };

beforeAll(() => {
  process.env.MYLIFE_ACTOR_IDENTITY_SECRET = 'test-actor-secret-for-social-parity';
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

function tokenFor(userId: string): string {
  const token = issueActorIdentityToken(userId);
  if (!token) {
    throw new Error('Expected actor identity token to be issued in test environment.');
  }
  return token;
}

describe('social contract parity', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('normalizes invite payloads and forwards actor token in query', async () => {
    vi.mocked(callSyncEndpoint).mockResolvedValue({
      incoming: [
        {
          id: 'inv-1',
          fromUserId: 'demo-bob',
          toUserId: 'demo-alice',
          status: 'pending',
          createdAt: '2026-02-25T00:00:00.000Z',
          updatedAt: '2026-02-25T00:00:00.000Z',
          respondedAt: null,
        },
      ],
      outgoing: [
        {
          id: 'inv-2',
          from_user_id: 'demo-alice',
          to_user_id: 'demo-cara',
          status: 'pending',
          created_at: '2026-02-25T01:00:00.000Z',
          updated_at: '2026-02-25T01:00:00.000Z',
          responded_at: null,
        },
      ],
    });

    const actorToken = tokenFor('demo-alice');
    const result = await fetchFriendInvitesAction({ actorToken });

    expect(callSyncEndpoint).toHaveBeenCalledWith(expect.objectContaining({
      path: 'friends/invites',
      method: 'GET',
      query: expect.objectContaining({
        actorToken,
        userId: 'demo-alice',
      }),
    }));

    expect(result.incoming[0]?.from_user_id).toBe('demo-bob');
    expect(result.incoming[0]?.to_user_id).toBe('demo-alice');
    expect(result.outgoing[0]?.from_user_id).toBe('demo-alice');
    expect(result.outgoing[0]?.to_user_id).toBe('demo-cara');
  });

  it('normalizes friend payloads across camelCase and snake_case', async () => {
    vi.mocked(callSyncEndpoint).mockResolvedValue({
      friends: [
        {
          userId: 'demo-alice',
          friendUserId: 'demo-bob',
          status: 'accepted',
          createdAt: '2026-02-25T02:00:00.000Z',
          updatedAt: '2026-02-25T02:00:00.000Z',
          displayName: 'Bob',
          handle: 'bob',
        },
        {
          user_id: 'demo-alice',
          friend_user_id: 'demo-cara',
          status: 'accepted',
          created_at: '2026-02-25T03:00:00.000Z',
          updated_at: '2026-02-25T03:00:00.000Z',
          display_name: 'Cara',
          handle: 'cara',
        },
      ],
    });

    const actorToken = tokenFor('demo-alice');
    const result = await fetchFriendsAction(actorToken);

    expect(callSyncEndpoint).toHaveBeenCalledWith(expect.objectContaining({
      path: 'friends',
      method: 'GET',
      query: expect.objectContaining({
        actorToken,
        userId: 'demo-alice',
      }),
    }));

    expect(result).toHaveLength(2);
    expect(result[0]?.friend_user_id).toBe('demo-bob');
    expect(result[1]?.friend_user_id).toBe('demo-cara');
  });

  it('normalizes share event payloads and forwards viewer token', async () => {
    vi.mocked(callSyncEndpoint).mockResolvedValue({
      items: [
        {
          id: 'share-1',
          actorUserId: 'demo-bob',
          objectType: 'book_review',
          objectId: 'book-1',
          visibility: 'friends',
          payload: { note: 'Great book' },
          createdAt: '2026-02-25T04:00:00.000Z',
          updatedAt: '2026-02-25T04:00:00.000Z',
        },
        {
          id: 'share-2',
          actor_user_id: 'demo-cara',
          object_type: 'book_rating',
          object_id: 'book-1',
          visibility: 'public',
          payload_json: '{"rating":5}',
          created_at: '2026-02-25T05:00:00.000Z',
          updated_at: '2026-02-25T05:00:00.000Z',
        },
      ],
    });

    const viewerToken = tokenFor('demo-alice');
    const result = await fetchVisibleBookShareEventsAction({
      viewerToken,
      objectId: 'book-1',
      limit: 20,
    });

    expect(callSyncEndpoint).toHaveBeenCalledWith(expect.objectContaining({
      path: 'share/events',
      method: 'GET',
      query: expect.objectContaining({
        viewerToken,
        viewerUserId: 'demo-alice',
      }),
    }));

    expect(result).toHaveLength(2);
    expect(result[0]?.actor_user_id).toBe('demo-bob');
    expect(result[0]?.payload_json).toContain('Great book');
    expect(result[1]?.actor_user_id).toBe('demo-cara');
    expect(result[1]?.payload_json).toContain('"rating":5');
  });
});
