'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Diagnosis, GardenEntry, HarvestRecord, Identification, Plant, WateringScheduleItem } from '@mylife/garden';
import {
  doCreateEntry,
  doDeletePlant,
  doUpdateDiagnosisStatus,
  doUpdatePlant,
  doWaterPlant,
  engineGetCompanions,
  fetchActiveDiagnoses,
  fetchEntriesForPlant,
  fetchHarvests,
  fetchIdentificationsForPlant,
  fetchPlantById,
  fetchWateringSchedule,
} from '../actions';
import { GardenActionButton, GardenBadge, GardenGhostButton, GardenImage, GardenKicker, GardenMetricCard, GardenPanel } from '../_components/GardenPrimitives';
import { GARDEN_CHROME, alpha, clamp, formatGardenDate, getActionTone, getStatusTone, humanizeGardenValue, pickImage } from '../_lib/design';

type CompanionCard = {
  label: string;
  benefit: string;
  relationship: 'companion' | 'antagonist' | 'neutral';
};

export default function GardenPlantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [plant, setPlant] = useState<Plant | null>(null);
  const [entries, setEntries] = useState<GardenEntry[]>([]);
  const [waterInfo, setWaterInfo] = useState<WateringScheduleItem | null>(null);
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([]);
  const [harvests, setHarvests] = useState<HarvestRecord[]>([]);
  const [identifications, setIdentifications] = useState<Identification[]>([]);
  const [companions, setCompanions] = useState<CompanionCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [editing, setEditing] = useState(false);
  const [shareState, setShareState] = useState<'idle' | 'copied'>('idle');
  const [editName, setEditName] = useState('');
  const [editSpecies, setEditSpecies] = useState('');
  const [editZone, setEditZone] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const refresh = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchPlantById(id),
      fetchEntriesForPlant(id, 30),
      fetchWateringSchedule(),
      fetchActiveDiagnoses(id),
      fetchHarvests({ plantId: id }),
      fetchIdentificationsForPlant(id),
    ])
      .then(async ([plantRow, entryRows, scheduleRows, diagnosisRows, harvestRows, identificationRows]) => {
        const specimen = plantRow as Plant | null;
        const watering = (scheduleRows as WateringScheduleItem[]).find((row) => row.plantId === id) ?? null;
        const companionQuery = specimen?.name || specimen?.species || '';
        const companionRows = companionQuery ? await engineGetCompanions(companionQuery) : [];

        if (cancelled) return;
        setPlant(specimen);
        setEntries(entryRows as GardenEntry[]);
        setWaterInfo(watering);
        setDiagnoses(diagnosisRows as Diagnosis[]);
        setHarvests(harvestRows as HarvestRecord[]);
        setIdentifications(identificationRows as Identification[]);
        setCompanions((companionRows as Array<{ plantA: string; plantB: string; benefit: string; relationship: CompanionCard['relationship'] }>).map((row) => ({
          label: row.plantA === companionQuery.toLowerCase() ? row.plantB : row.plantA,
          benefit: row.benefit,
          relationship: row.relationship,
        })));
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : 'Failed to load plant profile');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, tick]);

  const photoStrip = useMemo(() => {
    return [pickImage(plant?.imageUri), ...entries.map((entry) => entry.imageUri), ...harvests.map((harvest) => harvest.imageUri)]
      .filter((value, index, list): value is string => Boolean(value) && list.indexOf(value) === index)
      .slice(0, 6);
  }, [entries, harvests, plant?.imageUri]);

  const healthScore = useMemo(() => {
    if (!plant) return 48;
    if (plant.status === 'healthy') return 92;
    if (plant.status === 'needs_attention') return 58;
    if (plant.status === 'dormant') return 66;
    return 18;
  }, [plant]);

  const handleWater = useCallback(async () => {
    await doWaterPlant(id);
    refresh();
  }, [id, refresh]);

  const handleDelete = useCallback(async () => {
    if (!confirm('Delete this plant? This cannot be undone.')) return;
    await doDeletePlant(id);
    router.push('/garden/plants');
  }, [id, router]);

  const handleSaveEdit = useCallback(async () => {
    await doUpdatePlant(id, {
      name: editName.trim() || undefined,
      species: editSpecies.trim() || null,
      zone: editZone.trim() || null,
      notes: editNotes.trim() || null,
    });
    setEditing(false);
    refresh();
  }, [editName, editNotes, editSpecies, editZone, id, refresh]);

  const handleQuickLog = useCallback(async (action: GardenEntry['action']) => {
    await doCreateEntry({
      plantId: id,
      action,
    });
    if (action === 'water') {
      await doWaterPlant(id);
    }
    refresh();
  }, [id, refresh]);

  const handleShare = useCallback(async () => {
    await navigator.clipboard.writeText(window.location.href);
    setShareState('copied');
    window.setTimeout(() => setShareState('idle'), 1600);
  }, []);

  const handleResolveDiagnosis = useCallback(async (diagnosisId: string) => {
    await doUpdateDiagnosisStatus(diagnosisId, 'resolved');
    refresh();
  }, [refresh]);

  if (loading) return <PlantSkeleton />;
  if (error) return <PlantError message={error} onRetry={refresh} />;
  if (!plant) {
    return (
      <GardenPanel tone="base" style={{ padding: 36, textAlign: 'center' }}>
        <div style={{ display: 'grid', gap: 12, justifyItems: 'center' }}>
          <GardenKicker color={GARDEN_CHROME.danger}>Missing Specimen</GardenKicker>
          <h2 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -0.8 }}>This plant record no longer exists.</h2>
          <Link href="/garden/plants" style={secondaryLink}>Back to Inventory</Link>
        </div>
      </GardenPanel>
    );
  }

  const statusTone = getStatusTone(plant.status);
  const heroImage = pickImage(
    plant.imageUri,
    entries.find((entry) => Boolean(entry.imageUri))?.imageUri,
    harvests.find((harvest) => Boolean(harvest.imageUri))?.imageUri,
  );

  return (
    <div style={{ display: 'grid', gap: 26 }}>
      <Link href="/garden/plants" style={secondaryLink}>
        Back to Inventory
      </Link>

      <GardenPanel tone="base" style={{ overflow: 'hidden' }}>
        <div style={{ position: 'relative' }}>
          <GardenImage
            src={heroImage}
            alt={plant.name}
            title={plant.name}
            style={{ height: 340 }}
            overlay={(
              <>
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.12), rgba(10,10,15,0.82))' }} />
                <div style={{ position: 'absolute', inset: 0, padding: 28, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <GardenBadge text={plant.zone || 'Unassigned'} color={GARDEN_CHROME.gold} background={alpha(GARDEN_CHROME.gold, 0.16)} />
                      <GardenBadge text={statusTone.label} color={statusTone.color} background={statusTone.background} />
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <GardenActionButton onClick={handleWater}>Water Now</GardenActionButton>
                      <GardenGhostButton onClick={() => {
                        setEditName(plant.name);
                        setEditSpecies(plant.species ?? '');
                        setEditZone(plant.zone ?? '');
                        setEditNotes(plant.notes ?? '');
                        setEditing((value) => !value);
                      }}
                      >
                        Edit
                      </GardenGhostButton>
                      <GardenGhostButton onClick={handleShare}>
                        {shareState === 'copied' ? 'Copied' : 'Share'}
                      </GardenGhostButton>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gap: 10 }}>
                    <GardenKicker color={GARDEN_CHROME.accent}>Specimen Record</GardenKicker>
                    <div style={{ fontSize: 48, fontWeight: 800, letterSpacing: -1.6, maxWidth: 720 }}>{plant.name}</div>
                    <div style={{ color: 'rgba(228,225,233,0.8)', fontSize: 18 }}>{plant.species || 'Species pending classification'}</div>
                  </div>
                </div>
              </>
            )}
          />
        </div>
      </GardenPanel>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 24, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 24 }}>
          {editing ? (
            <GardenPanel tone="focus" style={{ padding: 24 }}>
              <div style={{ display: 'grid', gap: 12 }}>
                <GardenKicker>Edit Dossier</GardenKicker>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <input value={editName} onChange={(event) => setEditName(event.target.value)} placeholder="Plant name" style={inputStyle} />
                  <input value={editSpecies} onChange={(event) => setEditSpecies(event.target.value)} placeholder="Species" style={inputStyle} />
                  <input value={editZone} onChange={(event) => setEditZone(event.target.value)} placeholder="Zone" style={inputStyle} />
                  <div />
                </div>
                <textarea value={editNotes} onChange={(event) => setEditNotes(event.target.value)} placeholder="Curator notes" style={{ ...inputStyle, minHeight: 120, paddingTop: 14 }} />
                <div style={{ display: 'flex', gap: 12 }}>
                  <GardenActionButton onClick={handleSaveEdit}>Save Changes</GardenActionButton>
                  <GardenGhostButton onClick={() => setEditing(false)}>Cancel</GardenGhostButton>
                </div>
              </div>
            </GardenPanel>
          ) : null}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14 }}>
            <GardenMetricCard label="Water Cadence" value={plant.waterFrequencyDays ? `${plant.waterFrequencyDays}d` : 'Unset'} detail="Target interval" />
            <GardenMetricCard label="Entries Logged" value={entries.length} detail="Journal + actions" accent={GARDEN_CHROME.tertiary} />
            <GardenMetricCard label="Harvests" value={harvests.length} detail="Yield events" accent={GARDEN_CHROME.gold} />
            <GardenMetricCard label="Alerts" value={diagnoses.length} detail="Open diagnoses" accent={diagnoses.length ? GARDEN_CHROME.danger : GARDEN_CHROME.accent} />
          </div>

          <GardenPanel tone="lift" style={{ padding: 24 }}>
            <div style={{ display: 'grid', gap: 18 }}>
              <div>
                <GardenKicker color={GARDEN_CHROME.gold}>Taxonomy</GardenKicker>
                <h3 style={{ margin: '10px 0 0', fontSize: 28, fontWeight: 800, letterSpacing: -0.9 }}>Plant profile</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                <TaxonomyCell label="Species" value={plant.species || 'Unknown'} />
                <TaxonomyCell label="Location" value={humanizeGardenValue(plant.location)} />
                <TaxonomyCell label="Zone" value={plant.zone || 'Unassigned'} />
                <TaxonomyCell label="Acquired" value={plant.acquiredDate ? formatGardenDate(plant.acquiredDate) : 'Not logged'} />
                <TaxonomyCell label="Last Watered" value={plant.lastWatered ? formatGardenDate(plant.lastWatered) : 'Not yet watered'} />
                <TaxonomyCell label="Next Water" value={waterInfo?.nextWaterDate ? formatGardenDate(waterInfo.nextWaterDate) : 'No cadence'} />
              </div>
              {plant.notes ? (
                <p style={{ margin: 0, color: GARDEN_CHROME.textMuted, lineHeight: 1.8 }}>{plant.notes}</p>
              ) : null}
            </div>
          </GardenPanel>

          <GardenPanel tone="base" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div>
                <GardenKicker>Growth Log</GardenKicker>
                <h3 style={{ margin: '10px 0 0', fontSize: 28, fontWeight: 800, letterSpacing: -0.9 }}>Journal timeline</h3>
              </div>
              <Link href="/garden/journal" style={secondaryLink}>Open archive</Link>
            </div>
            <div style={{ display: 'grid', gap: 16 }}>
              {entries.length === 0 ? (
                <p style={{ margin: 0, color: GARDEN_CHROME.textMuted }}>No journal entries recorded for this specimen yet.</p>
              ) : (
                entries.map((entry) => {
                  const tone = getActionTone(entry.action);
                  return (
                    <div key={entry.id} style={{ display: 'grid', gridTemplateColumns: '16px 1fr', gap: 16 }}>
                      <div style={{ display: 'grid', justifyItems: 'center', gap: 8 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 999, background: tone.color, marginTop: 9 }} />
                        <span style={{ width: 2, flex: 1, minHeight: 48, background: alpha('#FFFFFF', 0.06) }} />
                      </div>
                      <GardenPanel tone="lift" style={{ padding: 18 }}>
                        <div style={{ display: 'grid', gap: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <GardenBadge text={tone.label} color={tone.color} background={tone.background} />
                            <span style={{ color: GARDEN_CHROME.textDim, fontSize: 12 }}>{formatGardenDate(entry.date)}</span>
                          </div>
                          <p style={{ margin: 0, color: GARDEN_CHROME.textMuted, lineHeight: 1.7 }}>
                            {entry.notes || `${tone.label} recorded for this plant.`}
                          </p>
                        </div>
                      </GardenPanel>
                    </div>
                  );
                })
              )}
            </div>
          </GardenPanel>

          <GardenPanel tone="lift" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div>
                <GardenKicker color={GARDEN_CHROME.tertiary}>Photo Strip</GardenKicker>
                <h3 style={{ margin: '10px 0 0', fontSize: 24, fontWeight: 800, letterSpacing: -0.8 }}>Gallery</h3>
              </div>
              <Link href="/garden/photos" style={secondaryLink}>Open photos</Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
              {photoStrip.length === 0 ? (
                <p style={{ margin: 0, color: GARDEN_CHROME.textMuted }}>No photos stored for this plant yet.</p>
              ) : (
                photoStrip.map((source) => (
                  <GardenImage key={source} src={source} alt={plant.name} title={plant.name} style={{ height: 108, borderRadius: 20 }} />
                ))
              )}
            </div>
          </GardenPanel>
        </div>

        <div style={{ display: 'grid', gap: 18, position: 'sticky', top: 104 }}>
          <GardenPanel tone="focus" style={{ padding: 24 }}>
            <div style={{ display: 'grid', gap: 18 }}>
              <div>
                <GardenKicker color={GARDEN_CHROME.tertiary}>Care Window</GardenKicker>
                <h3 style={{ margin: '10px 0 0', fontSize: 26, fontWeight: 800, letterSpacing: -0.8 }}>
                  {waterInfo?.isOverdue
                    ? `${waterInfo.daysOverdue} day${waterInfo.daysOverdue === 1 ? '' : 's'} overdue`
                    : waterInfo?.nextWaterDate
                      ? `Water ${formatGardenDate(waterInfo.nextWaterDate, { month: 'short', day: 'numeric' })}`
                      : 'Cadence not set'}
                </h3>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ height: 8, borderRadius: 999, background: alpha('#FFFFFF', 0.08), overflow: 'hidden' }}>
                  <div style={{ width: `${clamp(healthScore, 0, 100)}%`, height: '100%', borderRadius: 999, background: statusTone.color }} />
                </div>
                <div style={{ color: GARDEN_CHROME.textMuted, fontSize: 13 }}>Last watered {plant.lastWatered ? formatGardenDate(plant.lastWatered) : 'never'}.</div>
              </div>
            </div>
          </GardenPanel>

          <GardenPanel tone="lift" style={{ padding: 24 }}>
            <div style={{ display: 'grid', gap: 16 }}>
              <GardenKicker color={GARDEN_CHROME.gold}>Health Score</GardenKicker>
              <div style={{ display: 'grid', placeItems: 'center' }}>
                <div
                  style={{
                    width: 148,
                    height: 148,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    background: `conic-gradient(${statusTone.color} 0deg ${healthScore * 3.6}deg, ${alpha('#FFFFFF', 0.08)} ${healthScore * 3.6}deg 360deg)`,
                  }}
                >
                  <div style={{ width: 114, height: 114, borderRadius: '50%', display: 'grid', placeItems: 'center', background: GARDEN_CHROME.surfaceBase }}>
                    <div style={{ display: 'grid', justifyItems: 'center', gap: 2 }}>
                      <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1.2 }}>{healthScore}</span>
                      <span style={{ color: GARDEN_CHROME.textDim, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', fontWeight: 800 }}>Index</span>
                    </div>
                  </div>
                </div>
              </div>
              <GardenBadge text={statusTone.label} color={statusTone.color} background={statusTone.background} style={{ justifySelf: 'center' }} />
            </div>
          </GardenPanel>

          <GardenPanel tone="lift" style={{ padding: 24 }}>
            <div style={{ display: 'grid', gap: 14 }}>
              <GardenKicker color={GARDEN_CHROME.tertiary}>Companions</GardenKicker>
              {companions.length === 0 ? (
                <p style={{ margin: 0, color: GARDEN_CHROME.textMuted, lineHeight: 1.7 }}>No companion planting matches found for this cultivar yet.</p>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {companions.slice(0, 3).map((companion) => (
                    <div key={`${companion.label}-${companion.relationship}`} style={{ padding: '14px 16px', borderRadius: 20, background: alpha(companion.relationship === 'antagonist' ? GARDEN_CHROME.danger : companion.relationship === 'neutral' ? '#FFFFFF' : GARDEN_CHROME.accent, 0.12) }}>
                      <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>{humanizeGardenValue(companion.label)}</div>
                      <div style={{ color: GARDEN_CHROME.textMuted, fontSize: 13, lineHeight: 1.6 }}>{companion.benefit}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </GardenPanel>

          <GardenPanel tone="lift" style={{ padding: 24 }}>
            <div style={{ display: 'grid', gap: 10 }}>
              <GardenKicker>Quick Actions</GardenKicker>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {(['water', 'fertilize', 'prune', 'harvest', 'photo', 'note'] as Array<GardenEntry['action']>).map((action) => (
                  <GardenGhostButton key={action} onClick={() => handleQuickLog(action)}>
                    {humanizeGardenValue(action)}
                  </GardenGhostButton>
                ))}
              </div>
            </div>
          </GardenPanel>

          {diagnoses.length > 0 ? (
            <GardenPanel tone="lift" style={{ padding: 24 }}>
              <div style={{ display: 'grid', gap: 12 }}>
                <GardenKicker color={GARDEN_CHROME.danger}>Synergy Alerts</GardenKicker>
                {diagnoses.slice(0, 2).map((diagnosis) => (
                  <div key={diagnosis.id} style={{ padding: '14px 16px', borderRadius: 20, background: alpha(GARDEN_CHROME.danger, 0.12) }}>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>{diagnosis.diagnosisName || humanizeGardenValue(diagnosis.type)}</div>
                    <div style={{ color: GARDEN_CHROME.textMuted, fontSize: 13, lineHeight: 1.6, marginTop: 4 }}>
                      {diagnosis.treatmentNotes || `Severity ${diagnosis.severity}. Status ${humanizeGardenValue(diagnosis.treatmentStatus)}.`}
                    </div>
                    <GardenGhostButton onClick={() => handleResolveDiagnosis(diagnosis.id)} style={{ marginTop: 10 }}>
                      Resolve
                    </GardenGhostButton>
                  </div>
                ))}
              </div>
            </GardenPanel>
          ) : null}

          {identifications.length > 0 ? (
            <GardenPanel tone="lift" style={{ padding: 24 }}>
              <div style={{ display: 'grid', gap: 12 }}>
                <GardenKicker color={GARDEN_CHROME.gold}>Identifications</GardenKicker>
                {identifications.slice(0, 2).map((identification) => (
                  <div key={identification.id} style={{ color: GARDEN_CHROME.textMuted, fontSize: 13, lineHeight: 1.7 }}>
                    <strong style={{ color: GARDEN_CHROME.text }}>{identification.topCommonName || identification.topSpecies || 'Unknown specimen'}</strong>
                    {identification.topConfidence != null ? ` • ${Math.round(identification.topConfidence * 100)}% confidence` : ''}
                  </div>
                ))}
              </div>
            </GardenPanel>
          ) : null}

          <GardenGhostButton onClick={handleDelete} style={{ color: GARDEN_CHROME.danger, justifyContent: 'center' }}>
            Delete Plant
          </GardenGhostButton>
        </div>
      </div>
    </div>
  );
}

function TaxonomyCell({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '14px 16px', borderRadius: 20, background: alpha('#FFFFFF', 0.04) }}>
      <div style={{ color: GARDEN_CHROME.textDim, fontSize: 11, fontWeight: 800, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function PlantSkeleton() {
  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div style={{ ...skeleton, height: 24, width: 180 }} />
      <div style={{ ...skeleton, height: 340 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 24 }}>
        <div style={{ display: 'grid', gap: 18 }}>
          <div style={{ ...skeleton, minHeight: 180 }} />
          <div style={{ ...skeleton, minHeight: 180 }} />
          <div style={{ ...skeleton, minHeight: 320 }} />
        </div>
        <div style={{ display: 'grid', gap: 18 }}>
          {[0, 1, 2, 3].map((item) => <div key={item} style={{ ...skeleton, minHeight: 180 }} />)}
        </div>
      </div>
    </div>
  );
}

function PlantError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <GardenPanel tone="base" style={{ padding: 36, textAlign: 'center' }}>
      <div style={{ display: 'grid', gap: 12, justifyItems: 'center' }}>
        <GardenKicker color={GARDEN_CHROME.danger}>Load Failure</GardenKicker>
        <h2 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -0.8 }}>Plant dossier could not load.</h2>
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

const secondaryLink: CSSProperties = {
  color: GARDEN_CHROME.accent,
  textDecoration: 'none',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: 1.3,
  textTransform: 'uppercase',
};

const skeleton: CSSProperties = {
  borderRadius: 28,
  background: alpha('#FFFFFF', 0.05),
};
