'use client';

import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import {
  PresenceCard,
  PresenceEmptyState,
  PresenceMetricCard,
  PresenceSectionHeading,
  TOKENS,
  chipStyle,
  gradientButtonStyle,
  inputStyle,
  modalBackdropStyle,
  modalCardStyle,
} from '../ui';
import { doCreateReward, doDeleteReward, fetchRewardsSnapshot } from '../actions';

type RewardMilestoneType = 'streak' | 'sessions' | 'xp' | 'goal-met-days';

interface RewardsSnapshot {
  rewards: Array<{
    id: string;
    milestoneType: RewardMilestoneType;
    milestoneValue: number;
    rewardText: string;
    earned: boolean;
    earnedAt: number | null;
  }>;
  stats: {
    currentStreak: number;
    completedSessions: number;
    totalXP: number;
    goalMetDays: number;
  };
  newlyEarned: string[];
}

const MILESTONES: RewardMilestoneType[] = ['streak', 'sessions', 'xp', 'goal-met-days'];

export default function RewardsPage() {
  const [data, setData] = useState<RewardsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [milestoneType, setMilestoneType] = useState<RewardMilestoneType>('streak');
  const [milestoneValue, setMilestoneValue] = useState('7');
  const [rewardText, setRewardText] = useState('');

  async function loadData() {
    try {
      setError(null);
      setData((await fetchRewardsSnapshot()) as RewardsSnapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rewards.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function saveReward() {
    try {
      await doCreateReward({
        milestoneType,
        milestoneValue: Number(milestoneValue),
        rewardText,
      });
      setModalOpen(false);
      setMilestoneType('streak');
      setMilestoneValue('7');
      setRewardText('');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the reward.');
    }
  }

  if (loading) {
    return <PresenceCard style={{ minHeight: 240 }} />;
  }

  if (error && data == null) {
    return (
      <PresenceEmptyState
        icon="warning"
        title="Rewards unavailable"
        body={error}
      />
    );
  }

  return (
    <div className="pr-main-stack">
      <PresenceCard>
        <PresenceSectionHeading
          title="Self-Set Rewards"
          subtitle="Turn streaks, completed sessions, XP, and goal-hit days into tangible rewards so the healthy behavior loop feels worth protecting."
          action={(
            <button type="button" onClick={() => setModalOpen(true)} style={gradientButtonStyle}>
              Add Reward
            </button>
          )}
        />
        <div className="pr-grid-4" style={{ marginTop: 20 }}>
          <PresenceMetricCard label="Current Streak" value={`${data?.stats.currentStreak ?? 0}`} tone={TOKENS.accentLight} detail="days under goal" />
          <PresenceMetricCard label="Sessions" value={`${data?.stats.completedSessions ?? 0}`} tone={TOKENS.info} detail="completed focus sessions" />
          <PresenceMetricCard label="XP" value={`${data?.stats.totalXP ?? 0}`} tone={TOKENS.warning} detail="total earned XP" />
          <PresenceMetricCard label="Goal Days" value={`${data?.stats.goalMetDays ?? 0}`} tone={TOKENS.success} detail="under-goal days" />
        </div>
      </PresenceCard>

      {data?.rewards.length === 0 ? (
        <PresenceEmptyState
          icon="card_giftcard"
          title="No rewards yet"
          body="Create a milestone and attach something small but meaningful to it so Presence can mark it earned automatically."
        />
      ) : (
        <PresenceCard>
          <PresenceSectionHeading title="Reward List" subtitle="Rewards are marked earned automatically when the current stats reach their milestone." />
          <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
            {data?.rewards.map((reward) => (
              <div key={reward.id} style={{ padding: 18, borderRadius: 24, border: `1.5px solid ${reward.earned ? TOKENS.borderStrong : TOKENS.border}`, background: reward.earned ? 'rgba(34,211,238,0.08)' : 'rgba(255,255,255,0.04)', display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{reward.rewardText}</div>
                    <div style={{ color: TOKENS.textSecondary, fontSize: 13, marginTop: 8 }}>
                      {reward.milestoneType} · {reward.milestoneValue}
                    </div>
                  </div>
                  <div style={{ color: reward.earned ? TOKENS.success : TOKENS.textTertiary, fontSize: 12, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                    {reward.earned ? 'Earned' : 'Locked'}
                  </div>
                </div>
                {reward.earnedAt ? (
                  <div style={{ color: TOKENS.textSecondary, fontSize: 13 }}>
                    Earned {new Date(reward.earnedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                ) : null}
                <div className="pr-chip-row">
                  <button type="button" onClick={() => void doDeleteReward(reward.id).then(loadData)} style={{ ...chipStyle(false), color: TOKENS.danger }}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </PresenceCard>
      )}

      {modalOpen ? (
        <div style={modalBackdropStyle} onClick={() => setModalOpen(false)}>
          <div style={modalCardStyle} onClick={(event) => event.stopPropagation()}>
            <PresenceSectionHeading title="Add reward" subtitle="Choose a milestone and attach a real-world reward that will feel meaningful when Presence marks it earned." />
            <div style={{ display: 'grid', gap: 16, marginTop: 18 }}>
              <div>
                <div style={sectionLabelStyle}>Milestone type</div>
                <div className="pr-chip-row" style={{ marginTop: 10 }}>
                  {MILESTONES.map((type) => (
                    <button key={type} type="button" onClick={() => setMilestoneType(type)} style={chipStyle(milestoneType === type)}>
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <label style={fieldStyle}>
                <span style={sectionLabelStyle}>Milestone value</span>
                <input value={milestoneValue} onChange={(event) => setMilestoneValue(event.target.value)} style={inputStyle} inputMode="numeric" />
              </label>
              <label style={fieldStyle}>
                <span style={sectionLabelStyle}>Reward</span>
                <input value={rewardText} onChange={(event) => setRewardText(event.target.value)} style={inputStyle} placeholder="Buy myself a coffee" />
              </label>
              <div className="pr-chip-row" style={{ justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setModalOpen(false)} style={chipStyle(false)}>
                  Cancel
                </button>
                <button type="button" onClick={() => void saveReward()} style={gradientButtonStyle}>
                  Save Reward
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const fieldStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
};

const sectionLabelStyle: CSSProperties = {
  color: TOKENS.textTertiary,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
};
