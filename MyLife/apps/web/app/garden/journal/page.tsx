'use client';

import type { CSSProperties } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type { CareAction, GardenEntry, Plant } from '@mylife/garden';
import { doCreateEntry, doDeleteEntry, doUpdateEntry, fetchEntriesByDate, fetchPlants } from '../actions';
import { GardenActionButton, GardenBadge, GardenEmptyState, GardenGhostButton, GardenImage, GardenKicker, GardenPanel } from '../_components/GardenPrimitives';
import { GARDEN_CHROME, alpha, formatGardenDate, getStatusTone, humanizeGardenValue, pickImage } from '../_lib/design';

const ACTIONS: CareAction[] = ['water', 'fertilize', 'prune', 'repot', 'harvest', 'pest_treatment', 'photo', 'note'];

function splitEntryContent(entry: GardenEntry): {
  title: string;
  body: string;
} {
  const text = entry.notes?.trim() ?? '';
  if (!text) {
    return {
      title: humanizeGardenValue(entry.action),
      body: 'No curator note was added for this archive entry.',
    };
  }
  const [title, ...rest] = text.split(/\n{2,}/);
  return {
    title: title.trim(),
    body: rest.join('\n\n').trim() || title.trim(),
  };
}

function serializeEntryContent(title: string, body: string, zone: string): string {
  const parts = [title.trim(), body.trim()];
  if (zone.trim()) parts.push(`Zone: ${zone.trim()}`);
  return parts.filter(Boolean).join('\n\n');
}

function daysAgo(days: number): string {
  const value = new Date();
  value.setDate(value.getDate() - days);
  return value.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function GardenJournalPageContent() {
  const searchParams = useSearchParams();
  const [entries, setEntries] = useState<GardenEntry[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [showComposer, setShowComposer] = useState(searchParams.get('composer') === '1');
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [formPlantId, setFormPlantId] = useState('');
  const [formAction, setFormAction] = useState<CareAction>('note');
  const [formZone, setFormZone] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formImageUri, setFormImageUri] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([fetchEntriesByDate(daysAgo(365), today()), fetchPlants()])
      .then(([entryRows, plantRows]) => {
        if (cancelled) return;
        const nextEntries = entryRows as GardenEntry[];
        setEntries(nextEntries);
        setPlants(plantRows as Plant[]);
        setSelectedEntryId((current) => current ?? nextEntries[0]?.id ?? null);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Failed to load journal');
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

  const orderedEntries = useMemo(() => {
    const next = [...entries];
    next.sort((left, right) => sortOrder === 'newest'
      ? right.date.localeCompare(left.date)
      : left.date.localeCompare(right.date));
    return next;
  }, [entries, sortOrder]);

  const selectedEntry = useMemo(() => orderedEntries.find((entry) => entry.id === selectedEntryId) ?? orderedEntries[0] ?? null, [orderedEntries, selectedEntryId]);
  const selectedPlant = selectedEntry?.plantId ? plantLookup.get(selectedEntry.plantId) ?? null : null;
  const selectedContent = selectedEntry ? splitEntryContent(selectedEntry) : null;
  const selectedImages = useMemo(() => {
    if (!selectedEntry) return [];
    return [pickImage(selectedEntry.imageUri, selectedPlant?.imageUri)].filter((value): value is string => Boolean(value));
  }, [selectedEntry, selectedPlant?.imageUri]);

  const zones = useMemo(() => {
    const values = new Set<string>();
    plants.forEach((plant) => {
      if (plant.zone) values.add(plant.zone);
    });
    return Array.from(values).sort((left, right) => left.localeCompare(right));
  }, [plants]);

  const openComposerForCreate = useCallback(() => {
    setEditingEntryId(null);
    setFormPlantId('');
    setFormAction('note');
    setFormZone('');
    setFormTitle('');
    setFormBody('');
    setFormImageUri('');
    setShowComposer(true);
  }, []);

  const openComposerForEdit = useCallback(() => {
    if (!selectedEntry) return;
    const content = splitEntryContent(selectedEntry);
    setEditingEntryId(selectedEntry.id);
    setFormPlantId(selectedEntry.plantId ?? '');
    setFormAction(selectedEntry.action);
    setFormZone(selectedPlant?.zone ?? '');
    setFormTitle(content.title);
    setFormBody(content.body);
    setFormImageUri(selectedEntry.imageUri ?? '');
    setShowComposer(true);
  }, [selectedEntry, selectedPlant?.zone]);

  const handleSave = useCallback(async () => {
    setSubmitting(true);
    try {
      const payload = {
        plantId: formPlantId || null,
        action: formAction,
        notes: serializeEntryContent(formTitle, formBody, formZone),
        imageUri: formImageUri.trim() || null,
      };
      if (editingEntryId) {
        await doUpdateEntry(editingEntryId, payload);
      } else {
        await doCreateEntry(payload);
      }
      setShowComposer(false);
      setEditingEntryId(null);
      refresh();
    } finally {
      setSubmitting(false);
    }
  }, [editingEntryId, formAction, formBody, formImageUri, formPlantId, formTitle, formZone, refresh]);

  const handleDelete = useCallback(async () => {
    if (!selectedEntry) return;
    if (!confirm('Delete this journal entry?')) return;
    await doDeleteEntry(selectedEntry.id);
    setSelectedEntryId(null);
    refresh();
  }, [refresh, selectedEntry]);

  const handleExport = useCallback(() => {
    window.print();
  }, []);

  if (loading) return <JournalSkeleton />;
  if (error) return <JournalError message={error} onRetry={refresh} />;

  if (!entries.length) {
    return (
      <GardenEmptyState
        title="The archive is quiet"
        description="Log waterings, harvests, and photo notes to build the split-pane garden journal. Entries become your desktop archive immediately."
        action={<GardenActionButton onClick={openComposerForCreate}>New Entry</GardenActionButton>}
      />
    );
  }

  const profileTone = selectedPlant ? getStatusTone(selectedPlant.status) : null;

  return (
    <div style={{ display: 'grid', gap: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: 10 }}>
          <h1 style={{ margin: 0, fontSize: 40, fontWeight: 800, letterSpacing: -1.2 }}>Journal Archive</h1>
          <p style={{ margin: 0, color: GARDEN_CHROME.textMuted, lineHeight: 1.7 }}>
            Browse every garden note in a desktop archive with a dedicated reading pane and media rail.
          </p>
        </div>
        <GardenActionButton onClick={openComposerForCreate}>New Entry</GardenActionButton>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px minmax(0, 1fr) 192px', gap: 18, alignItems: 'start' }}>
        <GardenPanel tone="lift" style={{ padding: 22, maxHeight: 'calc(100vh - 180px)', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gap: 16, height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 30, fontWeight: 800, letterSpacing: -0.9 }}>Archive</h2>
              <button type="button" onClick={() => setSortOrder((value) => value === 'newest' ? 'oldest' : 'newest')} style={sortButton}>
                Sort
              </button>
            </div>
            <div style={{ display: 'grid', gap: 10, overflowY: 'auto', paddingRight: 4 }}>
              {orderedEntries.map((entry) => {
                const content = splitEntryContent(entry);
                const active = entry.id === selectedEntry?.id;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setSelectedEntryId(entry.id)}
                    style={{
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      padding: '18px 18px 16px',
                      borderRadius: 22,
                      background: active ? alpha(GARDEN_CHROME.gold, 0.12) : alpha('#FFFFFF', 0.04),
                      boxShadow: active
                        ? `inset 4px 0 0 ${GARDEN_CHROME.accent}`
                        : `inset 0 0 0 1px ${alpha('#FFFFFF', 0.03)}`,
                      color: GARDEN_CHROME.text,
                    }}
                  >
                    <div style={{ color: active ? GARDEN_CHROME.gold : GARDEN_CHROME.textDim, fontSize: 11, fontWeight: 800, letterSpacing: 1.3, textTransform: 'uppercase', marginBottom: 10 }}>
                      {formatGardenDate(entry.date)}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.5, marginBottom: 6 }}>{content.title}</div>
                    <div style={{ color: GARDEN_CHROME.textMuted, lineHeight: 1.7, fontSize: 13, marginBottom: 12 }}>{content.body}</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <GardenBadge text={humanizeGardenValue(entry.action)} color={GARDEN_CHROME.gold} background={alpha(GARDEN_CHROME.gold, 0.12)} />
                      {selectedPlant?.zone ? <GardenBadge text={selectedPlant.zone} color={GARDEN_CHROME.textMuted} background={alpha('#FFFFFF', 0.06)} /> : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </GardenPanel>

        <GardenPanel tone="base" style={{ overflow: 'hidden' }}>
          <div style={{ position: 'relative' }}>
            <GardenImage
              src={pickImage(selectedEntry?.imageUri, selectedPlant?.imageUri)}
              alt={selectedContent?.title ?? 'Journal entry'}
              title={selectedContent?.title ?? 'Journal'}
              style={{ height: 280 }}
              overlay={(
                <>
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.12), rgba(10,10,15,0.82))' }} />
                  <div style={{ position: 'absolute', inset: 0, padding: 26, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <GardenBadge text="Obsidian Record" color={GARDEN_CHROME.gold} background={alpha(GARDEN_CHROME.gold, 0.18)} />
                      <span style={{ color: 'rgba(228,225,233,0.8)', fontSize: 12 }}>
                        {selectedPlant?.location ? humanizeGardenValue(selectedPlant.location) : 'Garden archive'} • {formatGardenDate(selectedEntry?.date)}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gap: 10 }}>
                      <div style={{ fontSize: 52, fontWeight: 800, letterSpacing: -1.8, maxWidth: 640 }}>
                        {selectedContent?.title}
                      </div>
                      <div style={{ color: 'rgba(228,225,233,0.82)', fontSize: 16, maxWidth: 540 }}>
                        {selectedPlant?.name ?? 'Garden-wide note'}
                      </div>
                    </div>
                  </div>
                </>
              )}
            />
          </div>

          <div style={{ padding: 26, display: 'grid', gap: 24 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <GardenGhostButton onClick={openComposerForEdit}>Edit Entry</GardenGhostButton>
              <GardenGhostButton onClick={handleExport}>Export PDF</GardenGhostButton>
              <GardenGhostButton onClick={handleDelete} style={{ color: GARDEN_CHROME.danger }}>Delete</GardenGhostButton>
            </div>

            <div style={{ display: 'grid', gap: 18 }}>
              <div style={{ color: GARDEN_CHROME.text, fontSize: 18, lineHeight: 1.95, whiteSpace: 'pre-wrap' }}>
                {selectedContent?.body}
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                <GardenKicker color={GARDEN_CHROME.gold}>Curator&apos;s Notes</GardenKicker>
                <div style={{ color: GARDEN_CHROME.textMuted, fontSize: 18, fontStyle: 'italic', lineHeight: 1.9 }}>
                  “{selectedPlant?.notes || 'Observation windows sharpen when the archive captures both the care event and the visual state of the plant.'}”
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
                {selectedImages.map((source) => (
                  <GardenImage key={source} src={source} alt={selectedContent?.title ?? 'Entry media'} title={selectedContent?.title ?? 'Entry'} style={{ height: 128, borderRadius: 20 }} />
                ))}
                <button type="button" onClick={() => setShowComposer(true)} style={mediaPlaceholder}>
                  Add Media
                </button>
              </div>
            </div>
          </div>
        </GardenPanel>

        <GardenPanel tone="lift" style={{ padding: 18 }}>
          <div style={{ display: 'grid', gap: 16 }}>
            <GardenKicker color={GARDEN_CHROME.gold}>Plant Profile</GardenKicker>
            {selectedPlant ? (
              <>
                <div style={{ display: 'grid', gap: 10 }}>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>{selectedPlant.name}</div>
                  <div style={{ color: GARDEN_CHROME.textMuted, fontSize: 13 }}>{selectedPlant.species || 'Species pending'}</div>
                </div>
                <ProfileRow label="Taxonomy" value={selectedPlant.species || 'Unknown'} />
                <ProfileRow label="Location" value={humanizeGardenValue(selectedPlant.location)} />
                <ProfileRow label="Health" value={profileTone?.label ?? 'Unknown'} />
                <div style={{ display: 'grid', gap: 8 }}>
                  <div style={{ height: 8, borderRadius: 999, background: alpha('#FFFFFF', 0.08), overflow: 'hidden' }}>
                    <div style={{ width: `${selectedPlant.status === 'healthy' ? 92 : selectedPlant.status === 'needs_attention' ? 58 : 66}%`, height: '100%', borderRadius: 999, background: profileTone?.color ?? GARDEN_CHROME.accent }} />
                  </div>
                </div>
              </>
            ) : (
              <p style={{ margin: 0, color: GARDEN_CHROME.textMuted, lineHeight: 1.7 }}>This entry is not attached to a specific plant profile.</p>
            )}
          </div>
        </GardenPanel>
      </div>

      {showComposer ? (
        <div style={composerBackdrop} onClick={() => setShowComposer(false)}>
          <div style={composerPanel} onClick={(event) => event.stopPropagation()}>
            <div style={{ display: 'grid', gap: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <GardenKicker color={GARDEN_CHROME.gold}>{editingEntryId ? 'Edit Entry' : 'New Entry'}</GardenKicker>
                  <h2 style={{ margin: '10px 0 0', fontSize: 30, fontWeight: 800, letterSpacing: -0.9 }}>{editingEntryId ? 'Revise archive record' : 'Archive a new note'}</h2>
                </div>
                <GardenGhostButton onClick={() => setShowComposer(false)}>Close</GardenGhostButton>
              </div>

              <input value={formTitle} onChange={(event) => setFormTitle(event.target.value)} placeholder="Entry title" style={inputStyle} />
              <textarea value={formBody} onChange={(event) => setFormBody(event.target.value)} placeholder="Body" style={{ ...inputStyle, minHeight: 180, paddingTop: 14 }} />
              <select value={formAction} onChange={(event) => setFormAction(event.target.value as CareAction)} style={inputStyle}>
                {ACTIONS.map((action) => <option key={action} value={action}>{humanizeGardenValue(action)}</option>)}
              </select>
              <select value={formPlantId} onChange={(event) => setFormPlantId(event.target.value)} style={inputStyle}>
                <option value="">General note</option>
                {plants.map((plant) => <option key={plant.id} value={plant.id}>{plant.name}</option>)}
              </select>
              <select value={formZone} onChange={(event) => setFormZone(event.target.value)} style={inputStyle}>
                <option value="">No zone tag</option>
                {zones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
              </select>
              <input value={formImageUri} onChange={(event) => setFormImageUri(event.target.value)} placeholder="Photo URL" style={inputStyle} />

              <GardenActionButton onClick={handleSave} disabled={submitting}>
                {submitting ? 'Saving' : editingEntryId ? 'Update Entry' : 'Archive Entry'}
              </GardenActionButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <div style={{ color: GARDEN_CHROME.textDim, fontSize: 11, fontWeight: 800, letterSpacing: 1.3, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function JournalSkeleton() {
  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div style={{ ...skeleton, height: 88 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '380px minmax(0, 1fr) 192px', gap: 18 }}>
        {[0, 1, 2].map((item) => <div key={item} style={{ ...skeleton, minHeight: 640 }} />)}
      </div>
    </div>
  );
}

function JournalError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <GardenPanel tone="base" style={{ padding: 36, textAlign: 'center' }}>
      <div style={{ display: 'grid', gap: 12, justifyItems: 'center' }}>
        <GardenKicker color={GARDEN_CHROME.danger}>Load Failure</GardenKicker>
        <h2 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -0.8 }}>Journal archive failed to load.</h2>
        <p style={{ margin: 0, color: GARDEN_CHROME.textMuted }}>{message}</p>
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

const sortButton: CSSProperties = {
  border: 'none',
  cursor: 'pointer',
  minHeight: 34,
  padding: '0 12px',
  borderRadius: 999,
  background: alpha('#FFFFFF', 0.05),
  color: GARDEN_CHROME.gold,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 1.2,
  textTransform: 'uppercase',
};

const mediaPlaceholder: CSSProperties = {
  border: `1px dashed ${alpha('#FFFFFF', 0.12)}`,
  cursor: 'pointer',
  minHeight: 128,
  borderRadius: 20,
  background: alpha('#FFFFFF', 0.03),
  color: GARDEN_CHROME.textDim,
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: 1.2,
  textTransform: 'uppercase',
};

const composerBackdrop: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.48)',
  display: 'flex',
  justifyContent: 'flex-end',
  zIndex: 50,
};

const composerPanel: CSSProperties = {
  width: 450,
  height: '100%',
  background: GARDEN_CHROME.surfaceBase,
  padding: 24,
  boxShadow: `-24px 0 60px ${alpha('#000000', 0.34)}`,
  overflowY: 'auto',
};

const skeleton: CSSProperties = {
  borderRadius: 28,
  background: alpha('#FFFFFF', 0.05),
};

export default function GardenJournalPage() {
  return (
    <Suspense fallback={null}>
      <GardenJournalPageContent />
    </Suspense>
  );
}
