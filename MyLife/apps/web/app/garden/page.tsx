'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GardenEntry, GardenStats, HarvestRecord, Plant, SeasonalTask, WateringScheduleItem } from '@mylife/garden';
import {
  doCompleteSeasonalTask,
  doCreatePlant,
  doWaterPlant,
  engineGetCurrentFrostPhase,
  engineGetSeason,
  fetchEntriesByDate,
  fetchFrostConfig,
  fetchGardenStats,
  fetchHarvests,
  fetchPendingSeasonalTasks,
  fetchPlants,
  fetchWateringSchedule,
} from './actions';
import { GardenActionButton, GardenBadge, GardenEmptyState, GardenGhostButton, GardenImage, GardenKicker, GardenMetricCard, GardenPanel } from './_components/GardenPrimitives';
import { GARDEN_CHROME, alpha, formatGardenCount, formatGardenDate, formatGardenTime, getActionTone, humanizeGardenValue, pickImage } from './_lib/design';

type DashboardState = {
  stats: GardenStats;
  plants: Plant[];
  schedule: WateringScheduleItem[];
  entries: GardenEntry[];
  harvests: HarvestRecord[];
  seasonalTasks: SeasonalTask[];
  frostConfig: {
    usdaZone: string | null;
    avgLastFrost: string | null;
    avgFirstFrost: string | null;
    zipCode: string | null;
  } | null;
  season: string;
  frostPhase: {
    phase: string;
    daysUntilEvent: number;
    eventDate: string;
    eventName: string;
  } | null;
};

function daysAgo(days: number): string {
  const value = new Date();
  value.setDate(value.getDate() - days);
  return value.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function GardenDashboardPage() {
  const [state, setState] = useState<DashboardState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formSpecies, setFormSpecies] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchGardenStats(),
      fetchPlants(),
      fetchWateringSchedule(),
      fetchEntriesByDate(daysAgo(60), today()),
      fetchHarvests(),
      engineGetSeason(new Date().getMonth() + 1),
      fetchFrostConfig(),
    ])
      .then(async ([stats, plants, schedule, entries, harvests, season, frostConfig]) => {
        const seasonalTasks = await fetchPendingSeasonalTasks(season as SeasonalTask['season']);
        const frostPhase = frostConfig?.avgLastFrost && frostConfig?.avgFirstFrost
          ? await engineGetCurrentFrostPhase(frostConfig.avgLastFrost, frostConfig.avgFirstFrost)
          : null;

        if (cancelled) return;
        setState({
          stats: stats as GardenStats,
          plants: plants as Plant[],
          schedule: schedule as WateringScheduleItem[],
          entries: entries as GardenEntry[],
          harvests: harvests as HarvestRecord[],
          seasonalTasks: seasonalTasks as SeasonalTask[],
          frostConfig: (frostConfig as DashboardState['frostConfig']) ?? null,
          season: season as string,
          frostPhase: (frostPhase as DashboardState['frostPhase']) ?? null,
        });
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : 'Failed to load dashboard');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tick]);

  const plantLookup = useMemo(() => {
    const map = new Map<string, Plant>();
    state?.plants.forEach((plant) => map.set(plant.id, plant));
    return map;
  }, [state?.plants]);

  const hydrationRows = useMemo(() => {
    if (!state) return [];
    return state.schedule.slice(0, 5);
  }, [state]);

  const urgentAlerts = useMemo(() => {
    if (!state) return [];
    const alerts: Array<{ label: string; body: string; tone: 'danger' | 'accent' | 'tertiary' }> = [];
    if (state.stats.overdueWateringCount > 0) {
      alerts.push({
        label: 'Watering backlog',
        body: `${state.stats.overdueWateringCount} plant${state.stats.overdueWateringCount === 1 ? '' : 's'} need hydration attention.`,
        tone: 'danger',
      });
    }
    if (state.frostPhase) {
      alerts.push({
        label: humanizeGardenValue(state.frostPhase.phase),
        body: `${state.frostPhase.eventName} lands in ${state.frostPhase.daysUntilEvent} day${state.frostPhase.daysUntilEvent === 1 ? '' : 's'}.`,
        tone: 'tertiary',
      });
    }
    if (state.seasonalTasks.length > 0) {
      alerts.push({
        label: 'Seasonal queue',
        body: `${state.seasonalTasks.length} open ${state.season} garden task${state.seasonalTasks.length === 1 ? '' : 's'} ready to clear.`,
        tone: 'accent',
      });
    }
    return alerts.slice(0, 3);
  }, [state]);

  const recentActivity = useMemo(() => {
    if (!state) return [];
    return [...state.entries]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, 4);
  }, [state]);

  const upcomingTasks = useMemo(() => {
    if (!state) return [];
    return state.seasonalTasks.slice(0, 4);
  }, [state]);

  const handleCreatePlant = useCallback(async () => {
    if (!formName.trim()) return;
    setSubmitting(true);
    try {
      await doCreatePlant({
        name: formName.trim(),
        species: formSpecies.trim() || undefined,
      });
      setFormName('');
      setFormSpecies('');
      setShowCreateForm(false);
      refresh();
    } finally {
      setSubmitting(false);
    }
  }, [formName, formSpecies, refresh]);

  const handleWaterPlant = useCallback(async (plantId: string) => {
    await doWaterPlant(plantId);
    refresh();
  }, [refresh]);

  const handleWaterQueue = useCallback(async () => {
    if (!state) return;
    const dueNow = state.schedule.filter((item) => item.isOverdue || item.daysOverdue === 0).slice(0, 3);
    for (const item of dueNow) {
      await doWaterPlant(item.plantId);
    }
    refresh();
  }, [refresh, state]);

  const handleCompleteTask = useCallback(async (taskId: string) => {
    await doCompleteSeasonalTask(taskId);
    refresh();
  }, [refresh]);

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError message={error} onRetry={refresh} />;
  if (!state) return null;

  if (state.plants.length === 0) {
    return (
      <GardenEmptyState
        title="Your library is ready for its first specimen"
        description="Add a plant to unlock the hydration queue, task panels, photo archive, and the rest of the MyGarden desktop shell."
        action={(
          <GardenActionButton onClick={() => setShowCreateForm(true)}>
            Add Plant
          </GardenActionButton>
        )}
      />
    );
  }

  return (
    <div style={{ display: 'grid', gap: 28 }}>
      <div style={{ display: 'grid', gap: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: 20, alignItems: 'start' }}>
          <div style={{ gridColumn: 'span 3', display: 'grid', gap: 16 }}>
            <GardenMetricCard label="Active Plants" value={formatGardenCount(state.stats.totalPlants)} detail="Live flora under care" />
            <GardenMetricCard label="Overdue Watering" value={String(state.stats.overdueWateringCount).padStart(2, '0')} detail="Needs triage now" accent={GARDEN_CHROME.danger} />
            <GardenMetricCard label="Healthy Growth" value={formatGardenCount(state.stats.healthyCount)} detail="Strong canopy and root health" accent={GARDEN_CHROME.tertiary} />
            <GardenMetricCard label="Harvest Logged" value={formatGardenCount(state.harvests.length)} detail={`${formatGardenCount(state.stats.totalEntries)} total archive records`} accent={GARDEN_CHROME.gold} />
          </div>

          <div style={{ gridColumn: 'span 6', display: 'grid', gap: 18 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <GardenActionButton onClick={() => setShowCreateForm((value) => !value)}>Add Plant</GardenActionButton>
              <GardenGhostButton onClick={handleWaterQueue}>Log Watering</GardenGhostButton>
            </div>

            {showCreateForm ? (
              <GardenPanel tone="focus" style={{ padding: 24 }}>
                <div style={{ display: 'grid', gap: 14 }}>
                  <div>
                    <GardenKicker>Create Specimen</GardenKicker>
                    <h3 style={{ margin: '10px 0 0', fontSize: 24, fontWeight: 800, letterSpacing: -0.8 }}>Add a new plant record</h3>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr auto', gap: 12 }}>
                    <input value={formName} onChange={(event) => setFormName(event.target.value)} placeholder="Plant name" style={inputStyle} />
                    <input value={formSpecies} onChange={(event) => setFormSpecies(event.target.value)} placeholder="Species or cultivar" style={inputStyle} />
                    <GardenActionButton onClick={handleCreatePlant} disabled={submitting} style={{ minWidth: 130 }}>
                      {submitting ? 'Saving' : 'Archive'}
                    </GardenActionButton>
                  </div>
                </div>
              </GardenPanel>
            ) : null}

            <GardenPanel tone="lift" style={{ padding: 28 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <GardenKicker color={GARDEN_CHROME.tertiary}>Live Overview</GardenKicker>
                  <h3 style={{ margin: '10px 0 0', fontSize: 28, fontWeight: 800, letterSpacing: -0.9 }}>Today&apos;s Hydration</h3>
                </div>
                <span style={{ color: GARDEN_CHROME.textDim, fontSize: 12, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase' }}>{formatGardenDate(today())}</span>
              </div>

              <div style={{ display: 'grid', gap: 12 }}>
                {hydrationRows.map((item) => {
                  const plant = plantLookup.get(item.plantId);
                  const overdue = item.isOverdue;
                  return (
                    <div
                      key={item.plantId}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '20px 1fr auto',
                        gap: 14,
                        alignItems: 'center',
                        padding: '16px 18px',
                        borderRadius: 20,
                        background: overdue ? 'rgba(255,180,171,0.08)' : alpha('#FFFFFF', 0.04),
                        boxShadow: `inset 0 0 0 1px ${overdue ? alpha(GARDEN_CHROME.danger, 0.18) : alpha('#FFFFFF', 0.03)}`,
                      }}
                    >
                      <span
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: 999,
                          boxShadow: `inset 0 0 0 1px ${overdue ? alpha(GARDEN_CHROME.danger, 0.7) : alpha('#FFFFFF', 0.18)}`,
                          background: overdue ? alpha(GARDEN_CHROME.danger, 0.16) : 'transparent',
                        }}
                      />
                      <div style={{ display: 'grid', gap: 4 }}>
                        <Link href={`/garden/${item.plantId}`} style={{ color: GARDEN_CHROME.text, textDecoration: 'none', fontSize: 15, fontWeight: 700 }}>
                          {item.plantName}
                        </Link>
                        <span style={{ color: overdue ? GARDEN_CHROME.danger : GARDEN_CHROME.textDim, fontSize: 13 }}>
                          {overdue
                            ? `Overdue by ${item.daysOverdue} day${item.daysOverdue === 1 ? '' : 's'}`
                            : item.nextWaterDate
                              ? `Due ${formatGardenDate(item.nextWaterDate, { month: 'short', day: 'numeric' })}`
                              : `Last watered ${plant?.lastWatered ? formatGardenDate(plant.lastWatered, { month: 'short', day: 'numeric' }) : 'not yet logged'}`}
                        </span>
                      </div>
                      <GardenGhostButton onClick={() => handleWaterPlant(item.plantId)} style={{ minWidth: 120 }}>
                        Water Now
                      </GardenGhostButton>
                    </div>
                  );
                })}
              </div>
            </GardenPanel>

            <GardenPanel tone="base" style={{ padding: 28 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <div>
                  <GardenKicker color={GARDEN_CHROME.gold}>Obsidian Record</GardenKicker>
                  <h3 style={{ margin: '10px 0 0', fontSize: 28, fontWeight: 800, letterSpacing: -0.9 }}>Garden Journal</h3>
                </div>
                <Link href="/garden/journal" style={secondaryLink}>
                  Open Archive
                </Link>
              </div>

              <div style={{ display: 'grid', gap: 18 }}>
                {recentActivity.map((entry, index) => {
                  const tone = getActionTone(entry.action);
                  const plant = entry.plantId ? plantLookup.get(entry.plantId) : null;
                  return (
                    <div key={entry.id} style={{ display: 'grid', gridTemplateColumns: '20px 1fr', gap: 16 }}>
                      <div style={{ display: 'grid', justifyItems: 'center', gap: 8 }}>
                        <span style={{ width: 12, height: 12, borderRadius: 999, background: tone.color, marginTop: 8, boxShadow: `0 0 0 6px ${alpha(tone.color, 0.16)}` }} />
                        {index < recentActivity.length - 1 ? <span style={{ width: 2, flex: 1, minHeight: 46, background: alpha('#FFFFFF', 0.08) }} /> : null}
                      </div>
                      <GardenPanel tone="lift" style={{ padding: 18 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 14 }}>
                          <div style={{ display: 'grid', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                              <GardenBadge text={tone.label} color={tone.color} background={tone.background} />
                              <span style={{ color: GARDEN_CHROME.textDim, fontSize: 12 }}>{formatGardenTime(entry.createdAt)}</span>
                            </div>
                            <div style={{ display: 'grid', gap: 4 }}>
                              <div style={{ fontSize: 18, fontWeight: 700 }}>{plant?.name ?? 'Garden-wide note'}</div>
                              <p style={{ margin: 0, color: GARDEN_CHROME.textMuted, lineHeight: 1.6 }}>
                                {entry.notes || `${tone.label} recorded for the archive.`}
                              </p>
                            </div>
                          </div>
                          <GardenImage
                            src={pickImage(entry.imageUri, plant?.imageUri)}
                            alt={plant?.name ?? 'Garden activity'}
                            title={plant?.name ?? 'MyGarden'}
                            style={{ width: 132, height: 104, borderRadius: 22 }}
                          />
                        </div>
                      </GardenPanel>
                    </div>
                  );
                })}
              </div>
            </GardenPanel>
          </div>

          <div style={{ gridColumn: 'span 3', display: 'grid', gap: 18 }}>
            <GardenPanel tone="focus" style={{ padding: 24 }}>
              <div style={{ display: 'grid', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <GardenKicker color={GARDEN_CHROME.gold}>Climate</GardenKicker>
                  {state.frostConfig?.usdaZone ? <GardenBadge text={`Zone ${state.frostConfig.usdaZone}`} color={GARDEN_CHROME.gold} background={alpha(GARDEN_CHROME.gold, 0.14)} /> : null}
                </div>
                <div style={{ fontSize: 48, fontWeight: 800, letterSpacing: -1.4 }}>{humanizeGardenValue(state.season)}</div>
                <div style={{ display: 'grid', gap: 4, color: GARDEN_CHROME.textMuted }}>
                  <div>{state.frostPhase ? humanizeGardenValue(state.frostPhase.phase) : 'Frost profile not set'}</div>
                  <div>{state.frostConfig?.zipCode ? `ZIP ${state.frostConfig.zipCode}` : 'Add a ZIP or USDA zone for local timing'}</div>
                </div>
                <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
                  <ForecastRow label="Last Frost" value={state.frostConfig?.avgLastFrost ? formatGardenDate(state.frostConfig.avgLastFrost, { month: 'short', day: 'numeric' }) : 'Unset'} />
                  <ForecastRow label="First Frost" value={state.frostConfig?.avgFirstFrost ? formatGardenDate(state.frostConfig.avgFirstFrost, { month: 'short', day: 'numeric' }) : 'Unset'} />
                  <ForecastRow label="Next Event" value={state.frostPhase ? `${state.frostPhase.eventName} in ${state.frostPhase.daysUntilEvent}d` : 'Awaiting frost profile'} />
                </div>
              </div>
            </GardenPanel>

            <GardenPanel tone="lift" style={{ padding: 24 }}>
              <div style={{ display: 'grid', gap: 14 }}>
                <GardenKicker color={GARDEN_CHROME.tertiary}>Environmental Alerts</GardenKicker>
                {urgentAlerts.length === 0 ? (
                  <p style={{ margin: 0, color: GARDEN_CHROME.textMuted, lineHeight: 1.7 }}>No active environmental alerts. Your garden is running clean today.</p>
                ) : (
                  urgentAlerts.map((alert) => (
                    <div
                      key={alert.label}
                      style={{
                        padding: '16px 18px',
                        borderRadius: 22,
                        background: alert.tone === 'danger'
                          ? 'rgba(255,180,171,0.08)'
                          : alert.tone === 'tertiary'
                            ? alpha(GARDEN_CHROME.tertiary, 0.12)
                            : alpha(GARDEN_CHROME.accent, 0.12),
                      }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{alert.label}</div>
                      <div style={{ color: GARDEN_CHROME.textMuted, fontSize: 13, lineHeight: 1.6 }}>{alert.body}</div>
                    </div>
                  ))
                )}
              </div>
            </GardenPanel>

            <GardenPanel tone="lift" style={{ padding: 24 }}>
              <div style={{ display: 'grid', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <GardenKicker>Upcoming Tasks</GardenKicker>
                  <Link href="/garden/seasonal" style={secondaryLink}>View planner</Link>
                </div>
                {upcomingTasks.length === 0 ? (
                  <p style={{ margin: 0, color: GARDEN_CHROME.textMuted, lineHeight: 1.7 }}>No queued seasonal tasks. Your task rail is clear for the week.</p>
                ) : (
                  upcomingTasks.map((task) => (
                    <div key={task.id} style={{ display: 'grid', gridTemplateColumns: '2px 1fr auto', gap: 12, alignItems: 'center' }}>
                      <span style={{ width: 2, height: '100%', minHeight: 44, borderRadius: 999, background: GARDEN_CHROME.gold }} />
                      <div style={{ display: 'grid', gap: 4 }}>
                        <div style={{ fontSize: 15, fontWeight: 700 }}>{humanizeGardenValue(task.taskType)}</div>
                        <div style={{ color: GARDEN_CHROME.textMuted, fontSize: 13 }}>
                          {task.description || `Due in ${humanizeGardenValue(state.season)}.`}
                        </div>
                      </div>
                      <GardenGhostButton onClick={() => handleCompleteTask(task.id)} style={{ minWidth: 98 }}>
                        Done
                      </GardenGhostButton>
                    </div>
                  ))
                )}
              </div>
            </GardenPanel>
          </div>
        </div>
      </div>

      <Link href="/garden/journal?composer=1" style={fabLink}>
        +
      </Link>
    </div>
  );
}

function ForecastRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
      <span style={{ color: GARDEN_CHROME.textDim, textTransform: 'uppercase', letterSpacing: 1.3, fontWeight: 700 }}>{label}</span>
      <span style={{ color: GARDEN_CHROME.text }}>{value}</span>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: 20 }}>
        <div style={{ gridColumn: 'span 3', display: 'grid', gap: 16 }}>
          {[0, 1, 2, 3].map((item) => <div key={item} style={{ ...skeletonCard, minHeight: 160 }} />)}
        </div>
        <div style={{ gridColumn: 'span 6', display: 'grid', gap: 18 }}>
          <div style={{ ...skeletonCard, minHeight: 64 }} />
          <div style={{ ...skeletonCard, minHeight: 300 }} />
          <div style={{ ...skeletonCard, minHeight: 360 }} />
        </div>
        <div style={{ gridColumn: 'span 3', display: 'grid', gap: 18 }}>
          {[0, 1, 2].map((item) => <div key={item} style={{ ...skeletonCard, minHeight: item === 0 ? 220 : 200 }} />)}
        </div>
      </div>
    </div>
  );
}

function DashboardError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <GardenPanel tone="base" style={{ padding: 36, textAlign: 'center' }}>
      <div style={{ display: 'grid', gap: 12, justifyItems: 'center' }}>
        <GardenKicker color={GARDEN_CHROME.danger}>Load Failure</GardenKicker>
        <h2 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -0.8 }}>The mission control feed did not load.</h2>
        <p style={{ margin: 0, maxWidth: 520, color: GARDEN_CHROME.textMuted }}>{message}</p>
        <GardenGhostButton onClick={onRetry}>Retry</GardenGhostButton>
      </div>
    </GardenPanel>
  );
}

const inputStyle: CSSProperties = {
  minHeight: 48,
  padding: '0 16px',
  borderRadius: 18,
  border: `1px solid ${alpha('#FFFFFF', 0.08)}`,
  background: alpha('#FFFFFF', 0.04),
  color: GARDEN_CHROME.text,
  fontSize: 14,
  outline: 'none',
};

const secondaryLink: CSSProperties = {
  color: GARDEN_CHROME.accent,
  textDecoration: 'none',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: 1.3,
  textTransform: 'uppercase',
};

const fabLink: CSSProperties = {
  position: 'fixed',
  right: 32,
  bottom: 32,
  width: 58,
  height: 58,
  borderRadius: 999,
  display: 'grid',
  placeItems: 'center',
  textDecoration: 'none',
  background: `linear-gradient(135deg, ${GARDEN_CHROME.accentLight}, ${GARDEN_CHROME.accent})`,
  color: '#081105',
  fontSize: 34,
  fontWeight: 700,
  boxShadow: `0 18px 34px ${alpha(GARDEN_CHROME.accent, 0.32)}`,
};

const skeletonCard: CSSProperties = {
  borderRadius: 28,
  background: alpha('#FFFFFF', 0.05),
};
