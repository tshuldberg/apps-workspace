'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Plant, WateringScheduleItem } from '@mylife/garden';
import { doWaterPlant, fetchPlants, fetchWateringSchedule } from '../actions';
import { GardenActionButton, GardenBadge, GardenEmptyState, GardenGhostButton, GardenImage, GardenKicker, GardenPanel } from '../_components/GardenPrimitives';
import { GARDEN_CHROME, alpha, formatGardenDate, getStatusTone } from '../_lib/design';

export default function GardenSchedulePage() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [schedule, setSchedule] = useState<WateringScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([fetchPlants(), fetchWateringSchedule()])
      .then(([plantRows, scheduleRows]) => {
        if (cancelled) return;
        setPlants(plantRows as Plant[]);
        setSchedule(scheduleRows as WateringScheduleItem[]);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Failed to load watering schedule');
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
    plants.forEach((plant) => map.set(plant.id, plant));
    return map;
  }, [plants]);

  const overdue = schedule.filter((item) => item.isOverdue);
  const dueToday = schedule.filter((item) => !item.isOverdue && item.daysOverdue === 0);
  const upcoming = schedule.filter((item) => !item.isOverdue && item.daysOverdue < 0).slice(0, 6);

  const waterPlant = useCallback(async (plantId: string) => {
    await doWaterPlant(plantId);
    refresh();
  }, [refresh]);

  const waterAllOverdue = useCallback(async () => {
    for (const item of overdue.slice(0, 5)) {
      await doWaterPlant(item.plantId);
    }
    refresh();
  }, [overdue, refresh]);

  if (loading) return <ScheduleSkeleton />;
  if (error) return <ScheduleError message={error} onRetry={refresh} />;

  if (!schedule.length) {
    return (
      <GardenEmptyState
        title="No watering cadence yet"
        description="Add water frequency settings to your plant records and MyGarden will turn them into this desktop schedule queue."
        action={<Link href="/garden/plants" style={linkButton}>Open Inventory</Link>}
      />
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: 10 }}>
          <h1 style={{ margin: 0, fontSize: 40, fontWeight: 800, letterSpacing: -1.2 }}>Watering Schedule</h1>
          <p style={{ margin: 0, color: GARDEN_CHROME.textMuted, lineHeight: 1.7 }}>
            Live cadence queue for every plant with hydration tracking enabled.
          </p>
        </div>
        <GardenActionButton onClick={waterAllOverdue}>Water Overdue</GardenActionButton>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 18 }}>
        <QueueColumn title="Overdue" items={overdue} tone={GARDEN_CHROME.danger} plantLookup={plantLookup} onWater={waterPlant} />
        <QueueColumn title="Due Today" items={dueToday} tone={GARDEN_CHROME.accent} plantLookup={plantLookup} onWater={waterPlant} />
        <QueueColumn title="Upcoming" items={upcoming} tone={GARDEN_CHROME.tertiary} plantLookup={plantLookup} onWater={waterPlant} />
      </div>
    </div>
  );
}

function QueueColumn({
  title,
  items,
  tone,
  plantLookup,
  onWater,
}: {
  title: string;
  items: WateringScheduleItem[];
  tone: string;
  plantLookup: Map<string, Plant>;
  onWater: (plantId: string) => Promise<void>;
}) {
  return (
    <GardenPanel tone="lift" style={{ padding: 22 }}>
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <GardenKicker color={tone}>{title}</GardenKicker>
          <GardenBadge text={`${items.length}`} color={tone} background={alpha(tone, 0.14)} />
        </div>
        {items.length === 0 ? (
          <p style={{ margin: 0, color: GARDEN_CHROME.textMuted, lineHeight: 1.7 }}>Nothing in this queue right now.</p>
        ) : (
          items.map((item) => {
            const plant = plantLookup.get(item.plantId);
            const statusTone = getStatusTone(plant?.status);
            return (
              <GardenPanel key={item.plantId} tone="base" style={{ padding: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr', gap: 12, alignItems: 'center' }}>
                  <GardenImage src={plant?.imageUri} alt={item.plantName} title={item.plantName} style={{ width: 56, height: 56, borderRadius: 18 }} />
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                      <Link href={`/garden/${item.plantId}`} style={{ color: GARDEN_CHROME.text, textDecoration: 'none', fontSize: 15, fontWeight: 800 }}>
                        {item.plantName}
                      </Link>
                      <GardenBadge text={statusTone.label} color={statusTone.color} background={statusTone.background} />
                    </div>
                    <div style={{ color: item.isOverdue ? GARDEN_CHROME.danger : GARDEN_CHROME.textMuted, fontSize: 13 }}>
                      {item.isOverdue
                        ? `${item.daysOverdue} day${item.daysOverdue === 1 ? '' : 's'} overdue`
                        : item.nextWaterDate
                          ? `Next water ${formatGardenDate(item.nextWaterDate, { month: 'short', day: 'numeric' })}`
                          : 'Schedule pending'}
                    </div>
                    <GardenGhostButton onClick={() => onWater(item.plantId)}>Water Now</GardenGhostButton>
                  </div>
                </div>
              </GardenPanel>
            );
          })
        )}
      </div>
    </GardenPanel>
  );
}

function ScheduleSkeleton() {
  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div style={{ ...skeleton, height: 88 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 18 }}>
        {[0, 1, 2].map((item) => <div key={item} style={{ ...skeleton, minHeight: 480 }} />)}
      </div>
    </div>
  );
}

function ScheduleError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <GardenPanel tone="base" style={{ padding: 36, textAlign: 'center' }}>
      <div style={{ display: 'grid', gap: 12, justifyItems: 'center' }}>
        <GardenKicker color={GARDEN_CHROME.danger}>Load Failure</GardenKicker>
        <h2 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -0.8 }}>Watering queue failed to load.</h2>
        <p style={{ margin: 0, color: GARDEN_CHROME.textMuted }}>{message}</p>
        <GardenGhostButton onClick={onRetry}>Retry</GardenGhostButton>
      </div>
    </GardenPanel>
  );
}

const skeleton: CSSProperties = {
  borderRadius: 28,
  background: alpha('#FFFFFF', 0.05),
};

const linkButton: CSSProperties = {
  textDecoration: 'none',
  borderRadius: 999,
  minHeight: 46,
  padding: '0 18px',
  display: 'grid',
  placeItems: 'center',
  background: `linear-gradient(135deg, ${GARDEN_CHROME.accentLight}, ${GARDEN_CHROME.accent})`,
  color: '#081105',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: 1.4,
  textTransform: 'uppercase',
};
