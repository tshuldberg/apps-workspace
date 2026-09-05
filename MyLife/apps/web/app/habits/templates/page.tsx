'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchAllTemplates } from '../actions';
import {
  EmptyState,
  GlassPanel,
  PageIntro,
  PillButton,
  SectionHeading,
  SymbolIcon,
  groupLabel,
  habitTypeLabel,
  resolveAreaTone,
} from '../ui';
import { HB_ACCENT_LIGHT, HB_TEXT_SECONDARY, withAlpha } from '@mylife/habits';

type HabitTemplate = {
  name: string;
  icon: string;
  color: string;
  habitType: string;
  frequency: string;
  timeOfDay: string;
  targetCount: number;
  unit: string | null;
  areaName: string;
};

export default function HabitsTemplatesPage() {
  const [templates, setTemplates] = useState<HabitTemplate[]>([]);
  const [query, setQuery] = useState('');
  const [activeArea, setActiveArea] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setError(null);
        const result = (await fetchAllTemplates()) as HabitTemplate[];
        setTemplates(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load templates.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const areas = useMemo(() => ['All', ...new Set(templates.map((item) => item.areaName))], [templates]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return templates.filter((template) => {
      const matchesArea = activeArea === 'All' || template.areaName === activeArea;
      const matchesQuery = normalized.length === 0
        || template.name.toLowerCase().includes(normalized)
        || template.areaName.toLowerCase().includes(normalized);
      return matchesArea && matchesQuery;
    });
  }, [activeArea, query, templates]);

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <PageIntro
        eyebrow="Templates"
        title="Starter habits, already organized by life area."
        description="Pick from built-in templates to seed a new routine, browse by area, and scan target types without rebuilding the basics from scratch."
      />

      <GlassPanel level={1} style={{ padding: 20, display: 'grid', gap: 16 }}>
        <SectionHeading detail="Search the starter library or filter by area." title="Template library" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search templates"
          style={{
            width: '100%',
            borderRadius: 18,
            border: 'none',
            background: withAlpha('#ffffff', 0.05),
            color: 'white',
            padding: '14px 16px',
            fontSize: 14,
          }}
        />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {areas.map((area) => (
            <PillButton active={area === activeArea} key={area} onClick={() => setActiveArea(area)}>
              {area}
            </PillButton>
          ))}
        </div>
      </GlassPanel>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 18 }}>
          {Array.from({ length: 6 }).map((_, index) => (
            <GlassPanel key={index} level={1} style={{ minHeight: 180, opacity: 0.55 }}>
              <div />
            </GlassPanel>
          ))}
        </div>
      ) : error ? (
        <EmptyState body={error} title="Templates unavailable" />
      ) : filtered.length === 0 ? (
        <EmptyState body="Try a wider search or a different area filter." title="No templates match this filter" />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 18 }}>
          {filtered.map((template) => {
            const tone = resolveAreaTone(template.areaName, template.color);
            return (
              <GlassPanel key={`${template.areaName}-${template.name}`} level={1} style={{ padding: 22, display: 'grid', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 16, display: 'grid', placeItems: 'center', background: withAlpha(tone, 0.18), fontSize: 22 }}>
                      {template.icon}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, lineHeight: 1.3 }}>{template.name}</div>
                      <div style={{ color: HB_TEXT_SECONDARY, fontSize: 13 }}>{template.areaName}</div>
                    </div>
                  </div>
                  <div style={{ padding: '8px 10px', borderRadius: 999, background: withAlpha(tone, 0.16), color: tone, fontSize: 12, fontWeight: 700 }}>
                    {habitTypeLabel(template.habitType)}
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 8, color: HB_TEXT_SECONDARY, fontSize: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <SymbolIcon color={tone} filled name="schedule" size={16} />
                    <span>{groupLabel(template.timeOfDay)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <SymbolIcon color={HB_ACCENT_LIGHT} filled name="repeat" size={16} />
                    <span>{template.frequency.replace('_', ' ')}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <SymbolIcon color={HB_ACCENT_LIGHT} filled name="flag" size={16} />
                    <span>
                      {template.targetCount}
                      {template.unit ? ` ${template.unit}` : ''} target
                    </span>
                  </div>
                </div>
              </GlassPanel>
            );
          })}
        </div>
      )}
    </div>
  );
}
