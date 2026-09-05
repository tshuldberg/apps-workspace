import { beforeEach, describe, expect, it } from 'vitest';
import { resetBestChefClient } from '../client';
import { PAYMENTS_NOT_LAUNCHED, sendTip } from '../tips';

const TIPPER_ID = 'tipper-1';
const CHEF_ID = 'chef-1';
const TIP_AMOUNT_CENTS = 500;

describe('sendTip', () => {
  beforeEach(() => {
    resetBestChefClient();
  });

  it('reports that tip payments have not launched', async () => {
    // Arrange
    const options = { submissionId: 'submission-1', currency: 'USD' };

    // Act
    const result = await sendTip(
      TIPPER_ID,
      CHEF_ID,
      TIP_AMOUNT_CENTS,
      options,
    );

    // Assert
    expect(result).toEqual(PAYMENTS_NOT_LAUNCHED);
  });

  it('never returns a fabricated payment identifier', async () => {
    // Arrange
    const unavailableAmountCents = 1;

    // Act
    const result = await sendTip(
      TIPPER_ID,
      CHEF_ID,
      unavailableAmountCents,
    );

    // Assert
    expect(result).not.toHaveProperty('paymentIntentId');
  });
});
