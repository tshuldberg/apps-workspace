'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  fetchAreas,
  fetchHabits,
  doCreateArea,
  doDeleteArea,
  doReorderAreas,
  doUpdateArea,
} from '../actions';
import {
  EmptyState,
  GlassPanel,
  PageIntro,
  PrimaryButton,
  SecondaryButton,
  SectionHeading,
  SymbolIcon,
  resolveAreaTone,
} from '../ui';
import { HB_ACCENT_LIGHT, HB_TEXT_SECONDARY, withAlpha } from '@mylife/habits';

type Area = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  sortOrder: number;
};

type Habit = {
  id: string;
  areaId: string | null;
};

const COLOR_SWATCHES = ['#30D158', '#A78BFA', '#FFB877', '#8BCFF0', '#84CC16', '#FFB4AB', '#C4B5FD'];

export default function HabitsAreasPage() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [draft, setDraft] = useState({ name: '', icon: 'favorite', color: COLOR_SWATCHES[0] });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setError(null);
      const [areaRows, habitRows] = await Promise.all([
        fetchAreas(),
        fetchHabits({ isArchived: false }),
      ]);
      setAreas(areaRows as Area[]);
      setHabits(habitRows as Habit[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load areas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const usageCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const habit of habits) {
      if (!habit.areaId) continue;
      map.set(habit.areaId, (map.get(habit.areaId) ?? 0) + 1);
    }
    return map;
  }, [habits]);

  const reorder = async (sourceIndex: number, targetIndex: number) => {
    const next = [...areas];
    const [item] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, item);
    setAreas(next);
    try {
      await doReorderAreas(next.map((entry) => entry.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reorder areas.');
    }
  };

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <PageIntro
        eyebrow="Areas"
        title="Life-area chips, colors, and ordering."
        description="Use areas to cluster habits by domain, give each cluster a clear tone, and keep the habits list readable at a glance."
      />

      <div style={{ display: 'grid', gridTemplateColumns: '0.85fr 1.15fr', gap: 20 }}>
        <GlassPanel level={1} style={{ padding: 24, display: 'grid', gap: 16 }}>
          <SectionHeading detail="Create a new area for the habits library." title="Add area" />
          <input
            value={draft.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            placeholder="Health, Work, Learning..."
            style={{ borderRadius: 16, border: 'none', background: withAlpha('#ffffff', 0.05), color: 'white', padding: '14px 16px' }}
          />
          <input
            value={draft.icon}
            onChange={(event) => setDraft((current) => ({ ...current, icon: event.target.value }))}
            placeholder="favorite"
            style={{ borderRadius: 16, border: 'none', background: withAlpha('#ffffff', 0.05), color: 'white', padding: '14px 16px' }}
          />
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {COLOR_SWATCHES.map((swatch) => (
              <button
                key={swatch}
                onClick={() => setDraft((current) => ({ ...current, color: swatch }))}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 999,
                  border: draft.color === swatch ? `2px solid ${HB_ACCENT_LIGHT}` : 'none',
                  background: swatch,
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
          <PrimaryButton
            onClick={() => {
              if (!draft.name.trim()) return;
              void doCreateArea(crypto.randomUUID(), {
                name: draft.name.trim(),
                icon: draft.icon.trim() || undefined,
                color: draft.color,
              }).then(() => {
                setDraft({ name: '', icon: 'favorite', color: COLOR_SWATCHES[0] });
                return load();
              }).catch((err) => setError(err instanceof Error ? err.message : 'Failed to create area.'));
            }}
          >
            <SymbolIcon color="#0E0E13" filled name="add" size={18} />
            Create area
          </PrimaryButton>
          {error ? <div style={{ color: '#FFB4AB', fontSize: 13 }}>{error}</div> : null}
        </GlassPanel>

        <GlassPanel level={2} style={{ padding: 24, display: 'grid', gap: 16 }}>
          <SectionHeading detail="Reorder, rename, or remove categories." title="Current areas" />
          {loading ? (
            <div style={{ display: 'grid', gap: 12 }}>
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} style={{ height: 86, borderRadius: 20, background: withAlpha('#ffffff', 0.04) }} />
              ))}
            </div>
          ) : areas.length === 0 ? (
            <EmptyState body="Create your first area to group habits by life domain." title="No areas yet" />
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {areas.map((area, index) => {
                const tone = resolveAreaTone(area.name, area.color);
                return (
                  <div key={area.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 14, alignItems: 'center', padding: 16, borderRadius: 22, background: withAlpha('#ffffff', 0.04) }}>
                    <div style={{ width: 44, height: 44, borderRadius: 16, display: 'grid', placeItems: 'center', background: withAlpha(tone, 0.18) }}>
                      <SymbolIcon color={tone} filled name={area.icon ?? 'category'} size={20} />
                    </div>
                    <div>
                      {editingId === area.id ? (
                        <input
                          autoFocus
                          value={editingName}
                          onChange={(event) => setEditingName(event.target.value)}
                          onBlur={() => {
                            if (!editingName.trim()) {
                              setEditingId(null);
                              return;
                            }
                            void doUpdateArea(area.id, { name: editingName.trim() }).then(load).catch((err) => setError(err instanceof Error ? err.message : 'Failed to update area.'));
                            setEditingId(null);
                          }}
                          style={{ borderRadius: 14, border: 'none', background: withAlpha('#ffffff', 0.05), color: 'white', padding: '12px 14px', width: '100%' }}
                        />
                      ) : (
                        <div style={{ fontWeight: 700, cursor: 'pointer' }} onClick={() => { setEditingId(area.id); setEditingName(area.name); }}>
                          {area.name}
                        </div>
                      )}
                      <div style={{ color: HB_TEXT_SECONDARY, fontSize: 13, marginTop: 4 }}>
                        {(usageCount.get(area.id) ?? 0)} active habit{usageCount.get(area.id) === 1 ? '' : 's'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <SecondaryButton onClick={() => index > 0 ? void reorder(index, index - 1) : undefined}>
                        <SymbolIcon name="keyboard_arrow_up" size={18} />
                      </SecondaryButton>
                      <SecondaryButton onClick={() => index < areas.length - 1 ? void reorder(index, index + 1) : undefined}>
                        <SymbolIcon name="keyboard_arrow_down" size={18} />
                      </SecondaryButton>
                      <SecondaryButton onClick={() => void doDeleteArea(area.id).then(load).catch((err) => setError(err instanceof Error ? err.message : 'Failed to delete area.'))}>
                        <SymbolIcon name="delete" size={18} />
                      </SecondaryButton>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </GlassPanel>
      </div>
    </div>
  );
}
