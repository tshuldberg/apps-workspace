import { beforeEach, describe, expect, it } from 'vitest';
import { resetBestChefClient } from '../client';
import { subscribe } from '../subscriptions';
import { PAYMENTS_NOT_LAUNCHED } from '../tips';

const SUBSCRIBER_ID = 'subscriber-1';
const CHEF_ID = 'chef-1';
const TIER_ID = 'tier-1';

describe('subscribe', () => {
  beforeEach(() => {
    resetBestChefClient();
  });

  it('reports that paid chef subscriptions have not launched', async () => {
    // Arrange
    const tierId = TIER_ID;

    // Act
    const result = await subscribe(SUBSCRIBER_ID, CHEF_ID, tierId);

    // Assert
    expect(result).toEqual(PAYMENTS_NOT_LAUNCHED);
  });

  it('never returns a fabricated subscription identifier', async () => {
    // Arrange
    const tierId = 'another-tier';

    // Act
    const result = await subscribe(SUBSCRIBER_ID, CHEF_ID, tierId);

    // Assert
    expect(result).not.toHaveProperty('stripeSubscriptionId');
  });
});
