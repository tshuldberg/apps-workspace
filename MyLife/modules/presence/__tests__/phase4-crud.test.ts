import { beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import {
  createAccountabilityPartner,
  createCommitment,
  createReward,
  getAccountabilityPartners,
  getActiveCommitment,
  getAppOpen,
  getCommitments,
  getRewards,
  rateAppOpen,
  recordAppOpen,
  revokeAccountabilityPartner,
  updateAccountabilityPartner,
  updateCommitment,
} from '../src/db';
import { createTestAdapter } from './test-db';

describe('phase 4 CRUD', () => {
  let db: DatabaseAdapter;

  beforeEach(() => {
    db = createTestAdapter();
  });

  it('stores accountability partners and supports local updates', () => {
    const partner = createAccountabilityPartner(db, 'Alex');
    expect(partner.shareCode).toHaveLength(8);
    expect(partner.active).toBe(true);
    expect(partner.notifyOverGoal).toBe(true);

    const updated = updateAccountabilityPartner(db, partner.id, {
      partnerName: 'Alex P.',
      notifyOverGoal: false,
    });
    expect(updated.partnerName).toBe('Alex P.');
    expect(updated.notifyOverGoal).toBe(false);

    revokeAccountabilityPartner(db, partner.id);
    expect(getAccountabilityPartners(db, true)).toHaveLength(0);
    expect(getAccountabilityPartners(db)[0]?.active).toBe(false);
  });

  it('stores rewards and commitment history', () => {
    const reward = createReward(db, {
      milestoneType: 'sessions',
      milestoneValue: 5,
      rewardText: 'Buy a new book',
    });
    expect(getRewards(db)[0]?.id).toBe(reward.id);
    expect(getRewards(db)[0]?.earned).toBe(false);

    const firstCommitment = createCommitment(db, 'No social apps before lunch.');
    expect(getActiveCommitment(db)?.id).toBe(firstCommitment.id);

    const secondCommitment = createCommitment(db, 'Phone stays outside the bedroom.');
    expect(getActiveCommitment(db)?.id).toBe(secondCommitment.id);

    const revised = updateCommitment(db, firstCommitment.id, 'No social apps before 1 PM.');
    expect(revised.active).toBe(true);
    expect(getActiveCommitment(db)?.id).toBe(firstCommitment.id);

    const commitments = getCommitments(db);
    expect(commitments).toHaveLength(2);
    expect(commitments.filter((item) => item.active)).toHaveLength(1);
  });

  it('stores post-app reflection ratings and notes', () => {
    const open = recordAppOpen(db, {
      date: '2026-04-06',
      app_id: 'com.instagram',
      intention_text: 'Reply to messages only',
    });

    rateAppOpen(db, open.id, 2, 'Lost track and kept scrolling.');

    const updated = getAppOpen(db, open.id);
    expect(updated?.post_rating).toBe(2);
    expect(updated?.reflection_note).toBe('Lost track and kept scrolling.');
  });
});
