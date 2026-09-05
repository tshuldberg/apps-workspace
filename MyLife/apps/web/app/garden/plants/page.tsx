'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type { Plant, WateringScheduleItem } from '@mylife/garden';
import { doCreatePlant, fetchPlants, fetchWateringSchedule } from '../actions';
import { GardenActionButton, GardenBadge, GardenEmptyState, GardenGhostButton, GardenImage, GardenKicker, GardenPanel } from '../_components/GardenPrimitives';
import { GARDEN_CHROME, alpha, formatGardenCount, formatGardenDate, getStatusTone } from '../_lib/design';

type FilterMode = 'all' | 'needs_attention' | 'healthy' | 'by_zone';
type SortMode = 'name' | 'zone' | 'recent';

function GardenPlantsPageContent() {
  const searchParams = useSearchParams();
  const [plants, setPlants] = useState<Plant[]>([]);
  const [schedule, setSchedule] = useState<WateringScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [sort, setSort] = useState<SortMode>('name');
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [showComposer, setShowComposer] = useState(searchParams.get('composer') === '1');
  const [formName, setFormName] = useState('');
  const [formSpecies, setFormSpecies] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Failed to load inventory');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tick]);

  const scheduleLookup = useMemo(() => {
    const map = new Map<string, WateringScheduleItem>();
    schedule.forEach((item) => map.set(item.plantId, item));
    return map;
  }, [schedule]);

  const zones = useMemo(() => {
    const values = new Set<string>();
    plants.forEach((plant) => {
      if (plant.zone) values.add(plant.zone);
    });
    return ['all', ...Array.from(values).sort((left, right) => left.localeCompare(right))];
  }, [plants]);

  const filteredPlants = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    let result = [...plants];

    if (normalized) {
      result = result.filter((plant) => {
        const species = plant.species?.toLowerCase() ?? '';
        const zone = plant.zone?.toLowerCase() ?? '';
        return plant.name.toLowerCase().includes(normalized)
          || species.includes(normalized)
          || zone.includes(normalized);
      });
    }

    if (filter === 'needs_attention') {
      result = result.filter((plant) => plant.status === 'needs_attention' || scheduleLookup.get(plant.id)?.isOverdue);
    }

    if (filter === 'healthy') {
      result = result.filter((plant) => plant.status === 'healthy');
    }

    if (filter === 'by_zone' && selectedZone !== 'all') {
      result = result.filter((plant) => (plant.zone ?? 'Unassigned') === selectedZone);
    }

    result.sort((left, right) => {
      if (sort === 'zone') {
        return (left.zone ?? 'Unassigned').localeCompare(right.zone ?? 'Unassigned') || left.name.localeCompare(right.name);
      }
      if (sort === 'recent') {
        return (right.lastWatered ?? '').localeCompare(left.lastWatered ?? '');
      }
      return left.name.localeCompare(right.name);
    });

    return result;
  }, [filter, plants, query, scheduleLookup, selectedZone, sort]);

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
      setShowComposer(false);
      refresh();
    } finally {
      setSubmitting(false);
    }
  }, [formName, formSpecies, refresh]);

  if (loading) return <PlantsSkeleton />;
  if (error) return <PlantsError message={error} onRetry={refresh} />;

  if (plants.length === 0) {
    return (
      <GardenEmptyState
        title="No plants archived yet"
        description="Build your desktop inventory with hero photos, zone labels, and watering metadata. The first plant unlocks the rest of this screen."
        action={<GardenActionButton onClick={() => setShowComposer(true)}>Add Plant</GardenActionButton>}
      />
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, fontSize: 40, fontWeight: 800, letterSpacing: -1.2 }}>My Plants</h1>
            <GardenBadge text={`${formatGardenCount(filteredPlants.length)} specimens`} color={GARDEN_CHROME.accent} />
          </div>
          <p style={{ margin: 0, color: GARDEN_CHROME.textMuted, lineHeight: 1.7 }}>
            Desktop inventory for every plant record, sorted by health, zone, and care cadence.
          </p>
        </div>
        <GardenActionButton onClick={() => setShowComposer((value) => !value)}>
          Add Plant
        </GardenActionButton>
      </div>

      <GardenPanel tone="lift" style={{ padding: 22 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1.1fr) auto auto auto', gap: 14, alignItems: 'center' }}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search cultivars, species, or zones..."
            style={searchInput}
          />
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {([
              ['all', 'All'],
              ['needs_attention', 'Needs Attention'],
              ['healthy', 'Healthy'],
              ['by_zone', 'By Zone'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                style={{
                  ...chipButton,
                  background: filter === value ? alpha(GARDEN_CHROME.accent, 0.14) : alpha('#FFFFFF', 0.05),
                  color: filter === value ? GARDEN_CHROME.accent : GARDEN_CHROME.textMuted,
                  boxShadow: filter === value ? `inset 0 0 0 1px ${alpha(GARDEN_CHROME.accent, 0.2)}` : `inset 0 0 0 1px ${alpha('#FFFFFF', 0.04)}`,
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {filter === 'by_zone' ? (
            <select value={selectedZone} onChange={(event) => setSelectedZone(event.target.value)} style={selectStyle}>
              {zones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone === 'all' ? 'All zones' : zone}
                </option>
              ))}
            </select>
          ) : <span />}
          <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)} style={selectStyle}>
            <option value="name">Sort: Name</option>
            <option value="zone">Sort: Zone</option>
            <option value="recent">Sort: Last Watered</option>
          </select>
        </div>
      </GardenPanel>

      {showComposer ? (
        <GardenPanel tone="focus" style={{ padding: 24 }}>
          <div style={{ display: 'grid', gap: 14 }}>
            <GardenKicker>Create Specimen</GardenKicker>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr auto', gap: 12 }}>
              <input value={formName} onChange={(event) => setFormName(event.target.value)} placeholder="Plant name" style={searchInput} />
              <input value={formSpecies} onChange={(event) => setFormSpecies(event.target.value)} placeholder="Species" style={searchInput} />
              <GardenActionButton onClick={handleCreatePlant} disabled={submitting}>
                {submitting ? 'Saving' : 'Archive'}
              </GardenActionButton>
            </div>
          </div>
        </GardenPanel>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 18 }}>
        {filteredPlants.map((plant) => (
          <PlantInventoryCard key={plant.id} plant={plant} schedule={scheduleLookup.get(plant.id) ?? null} />
        ))}
      </div>
    </div>
  );
}

function PlantInventoryCard({ plant, schedule }: { plant: Plant; schedule: WateringScheduleItem | null }) {
  const statusTone = getStatusTone(plant.status);
  const overdue = schedule?.isOverdue ?? false;
  const wateringText = overdue
    ? `${schedule?.daysOverdue ?? 0} day${schedule?.daysOverdue === 1 ? '' : 's'} overdue`
    : schedule?.nextWaterDate
      ? `Next water ${formatGardenDate(schedule.nextWaterDate, { month: 'short', day: 'numeric' })}`
      : plant.lastWatered
        ? `Last watered ${formatGardenDate(plant.lastWatered, { month: 'short', day: 'numeric' })}`
        : 'Watering cadence not set';

  return (
    <Link
      href={`/garden/${plant.id}`}
      style={{
        textDecoration: 'none',
        color: GARDEN_CHROME.text,
        transform: 'translateZ(0)',
      }}
    >
      <GardenPanel tone="lift" style={{ padding: 12, display: 'grid', gap: 14, minHeight: 332 }}>
        <GardenImage
          src={plant.imageUri}
          alt={plant.name}
          title={plant.name}
          style={{ height: 188, borderRadius: 22 }}
          overlay={(
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.18))' }}>
              <span
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  width: 12,
                  height: 12,
                  borderRadius: 999,
                  background: statusTone.color,
                  boxShadow: `0 0 0 5px ${statusTone.background}`,
                }}
              />
            </div>
          )}
        />

        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'grid', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.4 }}>{plant.name}</div>
                <div style={{ color: GARDEN_CHROME.textMuted, fontSize: 13, fontStyle: 'italic' }}>{plant.species || 'Species pending'}</div>
              </div>
              <GardenBadge text={statusTone.label} color={statusTone.color} background={statusTone.background} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <GardenBadge text={plant.zone || 'Unassigned'} color={GARDEN_CHROME.gold} background={alpha(GARDEN_CHROME.gold, 0.12)} />
            <span style={{ color: overdue ? GARDEN_CHROME.danger : GARDEN_CHROME.textDim, fontSize: 12 }}>
              {overdue ? 'Attention' : 'On cadence'}
            </span>
          </div>

          <div style={{ color: overdue ? GARDEN_CHROME.danger : GARDEN_CHROME.textMuted, fontSize: 13, lineHeight: 1.6 }}>
            {wateringText}
          </div>
        </div>
      </GardenPanel>
    </Link>
  );
}

function PlantsSkeleton() {
  return (
    <div style={{ display: 'grid', gap: 22 }}>
      <div style={{ ...skeleton, height: 88 }} />
      <div style={{ ...skeleton, height: 92 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 18 }}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((item) => <div key={item} style={{ ...skeleton, minHeight: 320 }} />)}
      </div>
    </div>
  );
}

function PlantsError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <GardenPanel tone="base" style={{ padding: 36, textAlign: 'center' }}>
      <div style={{ display: 'grid', gap: 12, justifyItems: 'center' }}>
        <GardenKicker color={GARDEN_CHROME.danger}>Load Failure</GardenKicker>
        <h2 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -0.8 }}>Inventory failed to render.</h2>
        <p style={{ margin: 0, color: GARDEN_CHROME.textMuted }}>{message}</p>
        <GardenGhostButton onClick={onRetry}>Retry</GardenGhostButton>
      </div>
    </GardenPanel>
  );
}

const searchInput: CSSProperties = {
  minHeight: 48,
  padding: '0 16px',
  borderRadius: 18,
  border: `1px solid ${alpha('#FFFFFF', 0.08)}`,
  background: alpha('#FFFFFF', 0.04),
  color: GARDEN_CHROME.text,
  fontSize: 14,
  outline: 'none',
};

const selectStyle: CSSProperties = {
  ...searchInput,
  minWidth: 160,
};

const chipButton: CSSProperties = {
  border: 'none',
  minHeight: 40,
  padding: '0 14px',
  borderRadius: 999,
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: 1.1,
  textTransform: 'uppercase',
};

const skeleton: CSSProperties = {
  borderRadius: 28,
  background: alpha('#FFFFFF', 0.05),
};

export default function GardenPlantsPage() {
  return (
    <Suspense fallback={null}>
      <GardenPlantsPageContent />
    </Suspense>
  );
}
