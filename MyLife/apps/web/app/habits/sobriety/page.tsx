'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  SOBRIETY_DAY_MILESTONES,
  calculateLifetimeStats,
  calculateSobrietyDuration,
  getPledgeStreak,
} from '@mylife/habits';
import {
  doCreatePledge,
  doRecordCompletion,
  fetchAllSobrietyProfiles,
  fetchPledgeForDate,
  fetchRecentPledgeDates,
  fetchSlipDates,
} from '../actions';
import {
  EmptyState,
  GlassPanel,
  MetricTile,
  PageIntro,
  PrimaryButton,
  SecondaryButton,
  SectionHeading,
  formatCurrency,
} from '../ui';
import { HB_ACCENT_LIGHT, HB_STREAK, HB_TEXT_SECONDARY, withAlpha } from '@mylife/habits';

type SobrietyProfile = {
  id: string;
  habitId: string;
  quitDate: string;
  dailyCost: number;
  motivation: string | null;
};

type SobrietyDuration = {
  totalDays: number;
  hours: number;
  minutes: number;
  seconds: number;
};

type SobrietyLifetimeStats = {
  currentStreak: number;
  longestStreak: number;
  totalCleanDays: number;
  totalSlips: number;
  moneySavedCurrent: number;
  moneySavedLifetime: number;
};

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

export default function HabitsSobrietyPage() {
  const [profile, setProfile] = useState<SobrietyProfile | null>(null);
  const [slips, setSlips] = useState<string[]>([]);
  const [duration, setDuration] = useState<SobrietyDuration | null>(null);
  const [stats, setStats] = useState<SobrietyLifetimeStats | null>(null);
  const [pledgeStreak, setPledgeStreak] = useState(0);
  const [hasPledged, setHasPledged] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setError(null);
      const profiles = (await fetchAllSobrietyProfiles()) as SobrietyProfile[];
      const nextProfile = profiles[0] ?? null;
      setProfile(nextProfile);

      if (!nextProfile) {
        setSlips([]);
        return;
      }

      const today = todayString();
      const [slipDates, pledge, pledgeDates] = await Promise.all([
        fetchSlipDates(nextProfile.habitId),
        fetchPledgeForDate(nextProfile.id, today),
        fetchRecentPledgeDates(nextProfile.id),
      ]);
      setSlips((slipDates as string[]) ?? []);
      setHasPledged(Boolean(pledge));
      setPledgeStreak(getPledgeStreak((pledgeDates as string[]) ?? [], today));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sobriety dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!profile) return;
    const update = () => {
      const now = Date.now();
      setDuration(calculateSobrietyDuration(profile.quitDate, now, slips));
      setStats(calculateLifetimeStats(profile.quitDate, profile.dailyCost, slips, now));
    };
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [profile, slips]);

  const nextMilestone = useMemo(() => {
    const days = duration?.totalDays ?? 0;
    return SOBRIETY_DAY_MILESTONES.find((value) => value > days) ?? null;
  }, [duration?.totalDays]);

  const handlePledge = async () => {
    if (!profile) return;
    await doCreatePledge(crypto.randomUUID(), profile.id, todayString());
    await load();
  };

  const handleSlip = async () => {
    if (!profile) return;
    await doRecordCompletion(crypto.randomUUID(), profile.habitId, new Date().toISOString(), -1);
    await load();
  };

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <PageIntro
        eyebrow="Sobriety"
        title="Clock, savings, and recovery milestones in one view."
        description="Keep the streak visible, log the daily pledge without friction, and show the user how much time and money has already been reclaimed."
      />

      {error ? <EmptyState body={error} title="Sobriety dashboard unavailable" /> : null}

      {!profile && !loading ? (
        <EmptyState body="Create a negative-type habit with sobriety tracking to unlock the clock and pledge flow." title="No sobriety profile yet" />
      ) : (
        <>
          <GlassPanel level={2} style={{ padding: 28, display: 'grid', gap: 18 }}>
            <SectionHeading detail="Live sobriety clock." title="Current streak" />
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 18, alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 72, lineHeight: 1, fontWeight: 800, color: HB_STREAK.fire }}>{duration?.totalDays ?? 0}d</div>
                <div style={{ marginTop: 10, color: '#D6C3B5', fontSize: 18 }}>
                  {String(duration?.hours ?? 0).padStart(2, '0')}h · {String(duration?.minutes ?? 0).padStart(2, '0')}m · {String(duration?.seconds ?? 0).padStart(2, '0')}s
                </div>
                <div style={{ color: HB_TEXT_SECONDARY, marginTop: 14 }}>
                  {profile?.motivation ?? 'One honest day at a time.'}
                </div>
              </div>
              <div style={{ padding: 20, borderRadius: 24, background: withAlpha('#ffffff', 0.04), display: 'grid', gap: 12 }}>
                <div style={{ color: HB_TEXT_SECONDARY, fontSize: 13 }}>Next milestone</div>
                <div style={{ fontSize: 30, fontWeight: 800, color: HB_ACCENT_LIGHT }}>{nextMilestone ? `${nextMilestone} days` : 'Legend'}</div>
                <div style={{ color: HB_TEXT_SECONDARY, fontSize: 13 }}>Pledge streak: {pledgeStreak} days</div>
              </div>
            </div>
          </GlassPanel>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16 }}>
            <MetricTile detail="clean days on the active run" label="Current" tone={HB_STREAK.fire} value={`${stats?.currentStreak ?? 0}d`} />
            <MetricTile detail="best streak to date" label="Longest" tone={HB_ACCENT_LIGHT} value={`${stats?.longestStreak ?? 0}d`} />
            <MetricTile detail="saved this streak" label="Current savings" tone="#84CC16" value={formatCurrency((stats?.moneySavedCurrent ?? 0) / 100)} />
            <MetricTile detail="saved lifetime" label="Lifetime savings" tone="#8BCFF0" value={formatCurrency((stats?.moneySavedLifetime ?? 0) / 100)} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <GlassPanel level={1} style={{ padding: 24, display: 'grid', gap: 16 }}>
              <SectionHeading detail="Daily commitment and safety valve." title="Today" />
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <PrimaryButton onClick={() => void handlePledge()}>
                  {hasPledged ? 'Pledged today' : 'Take today’s pledge'}
                </PrimaryButton>
                <SecondaryButton onClick={() => void handleSlip()}>
                  Log slip
                </SecondaryButton>
              </div>
              <div style={{ padding: 18, borderRadius: 20, background: withAlpha('#ffffff', 0.04), color: HB_TEXT_SECONDARY, lineHeight: 1.7 }}>
                Logging a slip resets the current run while preserving lifetime totals, which keeps the dashboard honest instead of hiding setbacks.
              </div>
            </GlassPanel>

            <GlassPanel level={1} style={{ padding: 24, display: 'grid', gap: 16 }}>
              <SectionHeading detail="Major recovery checkpoints." title="Milestones" />
              <div style={{ display: 'grid', gap: 10 }}>
                {SOBRIETY_DAY_MILESTONES.slice(0, 8).map((milestone) => {
                  const reached = (duration?.totalDays ?? 0) >= milestone;
                  return (
                    <div key={milestone} style={{ padding: 14, borderRadius: 18, background: reached ? withAlpha(HB_ACCENT_LIGHT, 0.18) : withAlpha('#ffffff', 0.04), display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <span>{milestone} days</span>
                      <span style={{ color: reached ? HB_ACCENT_LIGHT : HB_TEXT_SECONDARY }}>{reached ? 'Reached' : 'Ahead'}</span>
                    </div>
                  );
                })}
              </div>
            </GlassPanel>
          </div>
        </>
      )}
    </div>
  );
}
