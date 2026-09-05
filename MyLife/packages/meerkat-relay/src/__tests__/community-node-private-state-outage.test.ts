import { afterEach, describe, expect, it } from 'vitest';
import { CommunityNode } from '../community-node';
import { startCommunityNodeHttp } from '../community-node-http';
import {
  CommunityPrivateStateUnavailableError,
  InMemoryCommunityPrivateStateStore,
  type IssuePrivateChallengeInput,
} from '../community-private-state';
import type { SeederHttpServer } from '../seeder-http';

class FailingChallengeStore extends InMemoryCommunityPrivateStateStore {
  override issueChallenge(_input: IssuePrivateChallengeInput): never {
    throw new CommunityPrivateStateUnavailableError(
      'issue private community challenge',
      new Error('database unavailable'),
    );
  }
}

describe('community private-state outage boundary', () => {
  let server: SeederHttpServer | null = null;

  afterEach(async () => {
    await server?.close();
    server = null;
  });

  it('returns 503 instead of a missing or rate-limited challenge', async () => {
    server = await startCommunityNodeHttp({
      node: new CommunityNode({ privateStateStore: new FailingChallengeStore() }),
      host: '127.0.0.1',
    });
    const response = await fetch(`${server.url}/community/private-club/challenge`);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ reason: 'state_authority_unavailable' });
  });
});
