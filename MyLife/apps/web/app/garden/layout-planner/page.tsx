'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Layout, LayoutItem, Plant } from '@mylife/garden';
import {
  doCreateLayout,
  doCreateLayoutItem,
  doDeleteLayout,
  doDeleteLayoutItem,
  fetchLayoutItems,
  fetchLayouts,
  fetchPlants,
} from '../actions';
import { GardenActionButton, GardenBadge, GardenEmptyState, GardenGhostButton, GardenImage, GardenKicker, GardenPanel } from '../_components/GardenPrimitives';
import { GARDEN_CHROME, alpha, humanizeGardenValue } from '../_lib/design';

type PlantCategory = 'vegetables' | 'herbs' | 'flowers';

type PlantPaletteItem = Plant & {
  category: PlantCategory;
};

type DeletedSnapshot = {
  plantId: string | null;
  label: string;
  x: number;
  y: number;
  widthCells: number;
  heightCells: number;
  color: string | null;
};

const CELL_SIZE = 52;

const PALETTE = ['#A3E635', '#F59E0B', '#38BDF8', '#F472B6', '#C4B5FD', '#FB7185', '#22C55E', '#F97316'] as const;

function categorizePlant(plant: Plant): PlantCategory {
  const label = `${plant.name} ${plant.species ?? ''}`.toLowerCase();
  if (/(basil|mint|rosemary|oregano|thyme|sage|parsley|cilantro|chive|lavender|dill)/.test(label)) return 'herbs';
  if (/(marigold|rose|sunflower|cosmos|petunia|jasmine|zinnia|dahlia|lily)/.test(label)) return 'flowers';
  return 'vegetables';
}

function getPlantSpecs(plant: PlantPaletteItem | null): { spacing: string; sunlight: string } {
  if (!plant) return { spacing: '18-24 in', sunlight: 'Full sun' };
  if (plant.category === 'herbs') return { spacing: '8-12 in', sunlight: 'Bright indirect' };
  if (plant.category === 'flowers') return { spacing: '12-18 in', sunlight: 'Full sun' };
  return { spacing: '18-24 in', sunlight: 'Full sun' };
}

export default function GardenLayoutPlannerPage() {
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [items, setItems] = useState<LayoutItem[]>([]);
  const [plants, setPlants] = useState<PlantPaletteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [activeLayoutId, setActiveLayoutId] = useState<string | null>(null);
  const [category, setCategory] = useState<PlantCategory>('vegetables');
  const [dragPlantId, setDragPlantId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [deletedSnapshot, setDeletedSnapshot] = useState<DeletedSnapshot | null>(null);
  const [saveMessage, setSaveMessage] = useState('Auto-saving placement data');
  const [showCreateLayout, setShowCreateLayout] = useState(false);
  const [layoutName, setLayoutName] = useState('');
  const [layoutWidth, setLayoutWidth] = useState('8');
  const [layoutHeight, setLayoutHeight] = useState('8');
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([fetchLayouts(), fetchPlants()])
      .then(([layoutRows, plantRows]) => {
        if (cancelled) return;
        const nextLayouts = layoutRows as Layout[];
        setLayouts(nextLayouts);
        setPlants((plantRows as Plant[]).map((plant, index) => ({
          ...plant,
          category: categorizePlant(plant),
          imageUri: plant.imageUri,
          notes: plant.notes,
          waterFrequencyDays: plant.waterFrequencyDays,
          status: plant.status,
          createdAt: plant.createdAt,
          updatedAt: plant.updatedAt,
          acquiredDate: plant.acquiredDate,
          zone: plant.zone,
          location: plant.location,
          species: plant.species,
          lastWatered: plant.lastWatered,
          id: plant.id,
          name: plant.name,
          color: PALETTE[index % PALETTE.length],
        } as PlantPaletteItem & { color: string })));
        setActiveLayoutId((current) => current ?? nextLayouts[0]?.id ?? null);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Failed to load planner');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tick]);

  useEffect(() => {
    if (!activeLayoutId) {
      setItems([]);
      return;
    }

    let cancelled = false;
    fetchLayoutItems(activeLayoutId)
      .then((rows) => {
        if (!cancelled) setItems(rows as LayoutItem[]);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });

    return () => {
      cancelled = true;
    };
  }, [activeLayoutId, tick]);

  const activeLayout = useMemo(() => layouts.find((layout) => layout.id === activeLayoutId) ?? null, [activeLayoutId, layouts]);
  const visiblePlants = useMemo(() => plants.filter((plant) => plant.category === category), [category, plants]);
  const selectedItem = useMemo(() => items.find((item) => item.id === selectedItemId) ?? null, [items, selectedItemId]);
  const selectedPlant = useMemo(() => plants.find((plant) => plant.id === selectedItem?.plantId) ?? null, [plants, selectedItem?.plantId]);
  const lastPlacedItem = items[items.length - 1] ?? null;

  const handleCreateLayout = useCallback(async () => {
    if (!layoutName.trim()) return;
    setSubmitting(true);
    try {
      await doCreateLayout({
        name: layoutName.trim(),
        widthCells: Number.parseInt(layoutWidth, 10) || 8,
        heightCells: Number.parseInt(layoutHeight, 10) || 8,
      });
      setLayoutName('');
      setLayoutWidth('8');
      setLayoutHeight('8');
      setShowCreateLayout(false);
      refresh();
    } finally {
      setSubmitting(false);
    }
  }, [layoutHeight, layoutName, layoutWidth, refresh]);

  const handleDrop = useCallback(async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!activeLayout || !dragPlantId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(activeLayout.widthCells - 1, Math.floor((event.clientX - rect.left) / CELL_SIZE)));
    const y = Math.max(0, Math.min(activeLayout.heightCells - 1, Math.floor((event.clientY - rect.top) / CELL_SIZE)));
    const occupied = items.some((item) => item.x === x && item.y === y);
    if (occupied) {
      setSaveMessage('That cell is occupied');
      return;
    }
    const plant = plants.find((candidate) => candidate.id === dragPlantId);
    if (!plant) return;
    const color = PALETTE[plants.findIndex((candidate) => candidate.id === plant.id) % PALETTE.length];
    await doCreateLayoutItem({
      layoutId: activeLayout.id,
      plantId: plant.id,
      label: plant.name,
      x,
      y,
      color,
    });
    setSaveMessage(`Placed ${plant.name} at row ${y + 1}, column ${x + 1}`);
    setSelectedItemId(null);
    refresh();
  }, [activeLayout, dragPlantId, items, plants, refresh]);

  const handleUndo = useCallback(async () => {
    const target = selectedItem ?? lastPlacedItem;
    if (!target) return;
    setDeletedSnapshot({
      plantId: target.plantId,
      label: target.label,
      x: target.x,
      y: target.y,
      widthCells: target.widthCells,
      heightCells: target.heightCells,
      color: target.color,
    });
    await doDeleteLayoutItem(target.id);
    setSelectedItemId(null);
    setSaveMessage(`Removed ${target.label}`);
    refresh();
  }, [lastPlacedItem, refresh, selectedItem]);

  const handleRedo = useCallback(async () => {
    if (!activeLayout || !deletedSnapshot) return;
    await doCreateLayoutItem({
      layoutId: activeLayout.id,
      plantId: deletedSnapshot.plantId ?? undefined,
      label: deletedSnapshot.label,
      x: deletedSnapshot.x,
      y: deletedSnapshot.y,
      widthCells: deletedSnapshot.widthCells,
      heightCells: deletedSnapshot.heightCells,
      color: deletedSnapshot.color ?? undefined,
    });
    setSaveMessage(`Restored ${deletedSnapshot.label}`);
    setDeletedSnapshot(null);
    refresh();
  }, [activeLayout, deletedSnapshot, refresh]);

  const handleDeleteLayout = useCallback(async () => {
    if (!activeLayout) return;
    if (!confirm('Delete this layout and all placed items?')) return;
    await doDeleteLayout(activeLayout.id);
    setActiveLayoutId(null);
    refresh();
  }, [activeLayout, refresh]);

  const createLayoutPanel = showCreateLayout ? (
    <GardenPanel tone="focus" style={{ padding: 24 }}>
      <div style={{ display: 'grid', gap: 12 }}>
        <GardenKicker>Create Bed</GardenKicker>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 120px 120px auto', gap: 12 }}>
          <input value={layoutName} onChange={(event) => setLayoutName(event.target.value)} placeholder="Bed A-04" style={selectStyle} />
          <input value={layoutWidth} onChange={(event) => setLayoutWidth(event.target.value)} placeholder="Width" style={selectStyle} />
          <input value={layoutHeight} onChange={(event) => setLayoutHeight(event.target.value)} placeholder="Height" style={selectStyle} />
          <GardenActionButton onClick={handleCreateLayout} disabled={submitting}>
            {submitting ? 'Saving' : 'Create'}
          </GardenActionButton>
        </div>
      </div>
    </GardenPanel>
  ) : null;

  if (loading) return <PlannerSkeleton />;
  if (error) return <PlannerError message={error} onRetry={refresh} />;

  if (!layouts.length) {
    return (
      <div style={{ display: 'grid', gap: 24 }}>
        {createLayoutPanel}
        <GardenEmptyState
          title="Create your first bed layout"
          description="MyGarden will turn every drag placement into a persisted layout item so the desktop planner mirrors your real raised beds and container maps."
          action={<GardenActionButton onClick={() => setShowCreateLayout(true)}>New Layout</GardenActionButton>}
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: 10 }}>
          <h1 style={{ margin: 0, fontSize: 40, fontWeight: 800, letterSpacing: -1.2 }}>Layout Planner</h1>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <GardenBadge text={`Active: ${activeLayout?.name ?? 'No layout'}`} color={GARDEN_CHROME.gold} background={alpha(GARDEN_CHROME.gold, 0.12)} />
            <span style={{ color: GARDEN_CHROME.textMuted }}>{saveMessage}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <select value={activeLayoutId ?? ''} onChange={(event) => setActiveLayoutId(event.target.value)} style={selectStyle}>
            {layouts.map((layout) => (
              <option key={layout.id} value={layout.id}>{layout.name}</option>
            ))}
          </select>
          <GardenActionButton onClick={() => setShowCreateLayout((value) => !value)}>New Layout</GardenActionButton>
        </div>
      </div>

      {createLayoutPanel}

      <div style={{ display: 'grid', gridTemplateColumns: '288px minmax(0, 1fr) 320px', gap: 18, alignItems: 'start' }}>
        <GardenPanel tone="base" style={{ padding: 20, height: 'calc(100vh - 170px)', position: 'sticky', top: 104 }}>
          <div style={{ display: 'grid', gap: 16, height: '100%' }}>
            <div>
              <GardenKicker color={GARDEN_CHROME.gold}>Plant Library</GardenKicker>
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                {(['vegetables', 'herbs', 'flowers'] as PlantCategory[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setCategory(value)}
                    style={{
                      ...pillButton,
                      background: category === value ? alpha(GARDEN_CHROME.gold, 0.16) : alpha('#FFFFFF', 0.05),
                      color: category === value ? GARDEN_CHROME.gold : GARDEN_CHROME.textMuted,
                    }}
                  >
                    {humanizeGardenValue(value)}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gap: 12, overflowY: 'auto', paddingRight: 4 }}>
              {visiblePlants.map((plant) => (
                <button
                  key={plant.id}
                  type="button"
                  draggable
                  onDragStart={() => setDragPlantId(plant.id)}
                  onClick={() => setDragPlantId(plant.id)}
                  style={{
                    border: 'none',
                    cursor: 'grab',
                    textAlign: 'left',
                    display: 'grid',
                    gridTemplateColumns: '52px 1fr',
                    gap: 12,
                    alignItems: 'center',
                    padding: 12,
                    borderRadius: 20,
                    background: dragPlantId === plant.id ? alpha(GARDEN_CHROME.accent, 0.14) : alpha('#FFFFFF', 0.05),
                    boxShadow: `inset 0 0 0 1px ${dragPlantId === plant.id ? alpha(GARDEN_CHROME.accent, 0.16) : alpha('#FFFFFF', 0.03)}`,
                    color: GARDEN_CHROME.text,
                  }}
                >
                  <GardenImage src={plant.imageUri} alt={plant.name} title={plant.name} style={{ width: 52, height: 52, borderRadius: 16 }} />
                  <div style={{ display: 'grid', gap: 4 }}>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>{plant.name}</div>
                    <div style={{ color: GARDEN_CHROME.textMuted, fontSize: 12 }}>{plant.species || humanizeGardenValue(plant.category)}</div>
                  </div>
                </button>
              ))}
            </div>

            <GardenPanel tone="lift" style={{ padding: 16 }}>
              <div style={{ display: 'grid', gap: 10 }}>
                <GardenKicker color={GARDEN_CHROME.accent}>Companion Legend</GardenKicker>
                <LegendRow color={GARDEN_CHROME.accent} label="Compatible" />
                <LegendRow color={GARDEN_CHROME.danger} label="Incompatible" />
              </div>
            </GardenPanel>
          </div>
        </GardenPanel>

        <GardenPanel tone="base" style={{ padding: 22, minHeight: 'calc(100vh - 170px)', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div>
              <GardenKicker>Layout Planner</GardenKicker>
              <h2 style={{ margin: '10px 0 0', fontSize: 32, fontWeight: 800, letterSpacing: -1 }}>{activeLayout?.name}</h2>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <GardenGhostButton onClick={handleUndo}>Undo</GardenGhostButton>
              <GardenGhostButton onClick={handleRedo}>Redo</GardenGhostButton>
              <GardenActionButton onClick={() => setSaveMessage('Layout already saved')}>Save</GardenActionButton>
            </div>
          </div>

          <div
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
            style={{
              position: 'relative',
              minHeight: 560,
              borderRadius: 32,
              background: `radial-gradient(circle at center, ${alpha(GARDEN_CHROME.gold, 0.03)}, transparent 55%), ${GARDEN_CHROME.surfaceLift}`,
              boxShadow: `inset 0 0 0 1px ${alpha('#FFFFFF', 0.03)}`,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: `radial-gradient(circle, ${alpha(GARDEN_CHROME.gold, 0.18)} 1px, transparent 1px)`,
                backgroundSize: `${CELL_SIZE}px ${CELL_SIZE}px`,
                opacity: 0.6,
              }}
            />
            <div
              style={{
                position: 'relative',
                width: activeLayout ? activeLayout.widthCells * CELL_SIZE : 0,
                height: activeLayout ? activeLayout.heightCells * CELL_SIZE : 0,
                margin: '56px auto 0',
                borderRadius: 32,
                background: alpha('#12121A', 0.62),
                boxShadow: `0 18px 40px ${alpha('#000000', 0.28)}, inset 0 0 0 1px ${alpha(GARDEN_CHROME.gold, 0.08)}`,
              }}
            >
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedItemId(item.id)}
                  style={{
                    position: 'absolute',
                    left: item.x * CELL_SIZE + 8,
                    top: item.y * CELL_SIZE + 8,
                    width: (item.widthCells || 1) * CELL_SIZE - 16,
                    height: (item.heightCells || 1) * CELL_SIZE - 16,
                    borderRadius: '50%',
                    border: 'none',
                    cursor: 'pointer',
                    background: alpha(item.color ?? GARDEN_CHROME.gold, selectedItemId === item.id ? 0.34 : 0.22),
                    boxShadow: `0 0 0 1px ${alpha(item.color ?? GARDEN_CHROME.gold, 0.34)}, inset 0 0 0 2px ${alpha('#FFFFFF', 0.1)}`,
                    color: '#F8F5EC',
                    fontWeight: 800,
                    letterSpacing: -0.5,
                  }}
                >
                  {item.label.slice(0, 1)}
                </button>
              ))}
            </div>

            <div style={{ position: 'absolute', right: 24, top: 24, display: 'grid', gap: 10 }}>
              {['+', '-', '◫'].map((label) => (
                <button key={label} type="button" style={toolButton}>{label}</button>
              ))}
            </div>

            <div style={{ position: 'absolute', left: 24, bottom: 24, display: 'flex', gap: 10 }}>
              <GardenGhostButton onClick={() => setSaveMessage('Zoom is visual only in this prototype')}>100%</GardenGhostButton>
              <GardenGhostButton onClick={handleDeleteLayout} style={{ color: GARDEN_CHROME.danger }}>Delete Bed</GardenGhostButton>
            </div>
          </div>
        </GardenPanel>

        <GardenPanel tone="base" style={{ padding: 22, height: 'calc(100vh - 170px)', position: 'sticky', top: 104 }}>
          <div style={{ display: 'grid', gap: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <GardenKicker color={GARDEN_CHROME.gold}>Selected Object</GardenKicker>
              {selectedItem ? <GardenBadge text={selectedItem.label} color={GARDEN_CHROME.gold} background={alpha(GARDEN_CHROME.gold, 0.12)} /> : null}
            </div>

            <GardenImage
              src={selectedPlant?.imageUri}
              alt={selectedPlant?.name ?? 'Layout selection'}
              title={selectedPlant?.name ?? 'Planner'}
              style={{ height: 188, borderRadius: 24 }}
            />

            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.9 }}>{selectedPlant?.name ?? 'Select a placed plant'}</div>
              <div style={{ color: GARDEN_CHROME.textMuted }}>{selectedPlant?.species || 'Drag a plant from the library to view its detail panel.'}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <SpecCell label="Spacing" value={getPlantSpecs(selectedPlant).spacing} />
              <SpecCell label="Sunlight" value={getPlantSpecs(selectedPlant).sunlight} />
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              <GardenKicker color={GARDEN_CHROME.tertiary}>Synergy Alerts</GardenKicker>
              {selectedItem ? (
                items
                  .filter((item) => item.id !== selectedItem.id)
                  .slice(0, 3)
                  .map((item) => (
                    <div
                      key={item.id}
                      style={{
                        padding: '14px 16px',
                        borderRadius: 20,
                        background: alpha(item.label === selectedItem.label ? '#FFFFFF' : GARDEN_CHROME.accent, 0.12),
                      }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 800 }}>{item.label}</div>
                      <div style={{ color: GARDEN_CHROME.textMuted, fontSize: 13, lineHeight: 1.6 }}>
                        Maintain one spacing unit between {selectedItem.label} and {item.label} for cleaner canopy airflow.
                      </div>
                    </div>
                  ))
              ) : (
                <p style={{ margin: 0, color: GARDEN_CHROME.textMuted, lineHeight: 1.7 }}>Select a placed plant to inspect spacing and companion notes.</p>
              )}
            </div>

            {selectedPlant ? (
              <Link
                href={`/garden/${selectedPlant.id}`}
                style={{
                  display: 'grid',
                  placeItems: 'center',
                  minHeight: 44,
                  padding: '0 16px',
                  borderRadius: 999,
                  textDecoration: 'none',
                  border: `1px solid ${alpha('#FFFFFF', 0.08)}`,
                  background: alpha('#FFFFFF', 0.04),
                  color: GARDEN_CHROME.text,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: 1.1,
                  textTransform: 'uppercase',
                }}
              >
                View Full Profile
              </Link>
            ) : (
              <GardenGhostButton disabled style={{ opacity: 0.5, cursor: 'default' }}>
                View Full Profile
              </GardenGhostButton>
            )}
          </div>
        </GardenPanel>
      </div>
    </div>
  );
}

function SpecCell({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '14px 16px', borderRadius: 20, background: alpha('#FFFFFF', 0.04) }}>
      <div style={{ color: GARDEN_CHROME.textDim, fontSize: 11, fontWeight: 800, letterSpacing: 1.3, textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: GARDEN_CHROME.textMuted, fontSize: 13 }}>
      <span style={{ width: 10, height: 10, borderRadius: 999, background: color }} />
      <span>{label}</span>
    </div>
  );
}

function PlannerSkeleton() {
  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div style={{ ...skeleton, height: 88 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '288px minmax(0, 1fr) 320px', gap: 18 }}>
        {[0, 1, 2].map((item) => <div key={item} style={{ ...skeleton, minHeight: 720 }} />)}
      </div>
    </div>
  );
}

function PlannerError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <GardenPanel tone="base" style={{ padding: 36, textAlign: 'center' }}>
      <div style={{ display: 'grid', gap: 12, justifyItems: 'center' }}>
        <GardenKicker color={GARDEN_CHROME.danger}>Load Failure</GardenKicker>
        <h2 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -0.8 }}>Planner canvas could not load.</h2>
        <p style={{ margin: 0, color: GARDEN_CHROME.textMuted }}>{message}</p>
        <GardenGhostButton onClick={onRetry}>Retry</GardenGhostButton>
      </div>
    </GardenPanel>
  );
}

const selectStyle: CSSProperties = {
  minHeight: 46,
  padding: '0 16px',
  borderRadius: 18,
  border: `1px solid ${alpha('#FFFFFF', 0.08)}`,
  background: alpha('#FFFFFF', 0.04),
  color: GARDEN_CHROME.text,
  fontSize: 14,
  outline: 'none',
};

const pillButton: CSSProperties = {
  minHeight: 36,
  padding: '0 12px',
  borderRadius: 999,
  border: 'none',
  cursor: 'pointer',
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 1.2,
  textTransform: 'uppercase',
};

const toolButton: CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 999,
  border: 'none',
  cursor: 'pointer',
  background: alpha('#FFFFFF', 0.08),
  color: GARDEN_CHROME.text,
  fontSize: 16,
  fontWeight: 800,
};

const skeleton: CSSProperties = {
  borderRadius: 28,
  background: alpha('#FFFFFF', 0.05),
};
