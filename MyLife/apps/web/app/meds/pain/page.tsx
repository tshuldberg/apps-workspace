'use client';

import { useMemo, useState } from 'react';
import { fetchPainPageData } from '../actions';
import { DonutCard } from '../charts';
import {
  AnatomyDiagram,
  MedsChip,
  MedsErrorState,
  MedsLoadingState,
  MedsPageLead,
  MedsPanel,
  MedsSectionTitle,
  formatClinicalDate,
  useMedsLoader,
} from '../ui';

type PainData = Awaited<ReturnType<typeof fetchPainPageData>>;

const REGION_GROUPS = [
  { key: 'head', label: 'Head', zones: ['head_'], front: true, x: 98, y: 40, width: 64, height: 64 },
  { key: 'neck', label: 'Neck', zones: ['neck', 'throat'], front: true, x: 108, y: 104, width: 44, height: 24 },
  { key: 'shoulders', label: 'Shoulders', zones: ['shoulder_'], front: true, x: 66, y: 118, width: 128, height: 26 },
  { key: 'arms', label: 'Arms', zones: ['upper_arm_', 'elbow_', 'forearm_', 'wrist_', 'hand_'], front: true, x: 36, y: 132, width: 188, height: 70 },
  { key: 'chest', label: 'Chest', zones: ['chest_'], front: true, x: 84, y: 144, width: 92, height: 42 },
  { key: 'abdomen', label: 'Abdomen', zones: ['abdomen_'], front: true, x: 92, y: 196, width: 76, height: 78 },
  { key: 'hips', label: 'Hips', zones: ['hip_'], front: true, x: 86, y: 280, width: 88, height: 34 },
  { key: 'legs', label: 'Legs', zones: ['thigh_', 'knee_', 'shin_', 'ankle_', 'foot_'], front: true, x: 90, y: 318, width: 80, height: 108 },
  { key: 'head-back', label: 'Head', zones: ['head_'], front: false, x: 98, y: 40, width: 64, height: 64 },
  { key: 'upper-back', label: 'Upper back', zones: ['upper_back', 'mid_back', 'shoulder_'], front: false, x: 76, y: 130, width: 108, height: 64 },
  { key: 'lower-back', label: 'Lower back', zones: ['lower_back', 'hip_'], front: false, x: 88, y: 204, width: 84, height: 56 },
  { key: 'back-arms', label: 'Arms', zones: ['upper_arm_', 'elbow_', 'forearm_', 'wrist_', 'hand_'], front: false, x: 38, y: 144, width: 184, height: 74 },
  { key: 'back-legs', label: 'Legs', zones: ['thigh_', 'knee_', 'shin_', 'ankle_', 'foot_'], front: false, x: 90, y: 270, width: 80, height: 118 },
] as const;

export default function PainPage() {
  const { data, loading, error } = useMedsLoader(fetchPainPageData, []);
  const [side, setSide] = useState<'front' | 'back'>('front');
  const [selected, setSelected] = useState<string>('head');

  const { regions, regionEntries } = useMemo(() => {
    if (!data) {
      return { regions: [], regionEntries: {} as Record<string, PainData['entries']> };
    }

    const maxSeverity = Math.max(1, ...data.byRegion.map((item) => item.averageSeverity));
    const entriesByRegion = REGION_GROUPS.reduce<Record<string, PainData['entries']>>((acc, group) => {
      acc[group.key] = data.entries.filter((entry) => group.zones.some((zone) => entry.bodyZone.startsWith(zone)));
      return acc;
    }, {});

    return {
      regions: REGION_GROUPS.map((group) => ({
        ...group,
        intensity:
          (entriesByRegion[group.key].reduce((sum, entry) => sum + entry.severity, 0) /
            Math.max(1, entriesByRegion[group.key].length)) /
          maxSeverity,
      })),
      regionEntries: entriesByRegion,
    };
  }, [data]);

  if (loading) {
    return <MedsLoadingState label="Loading pain analysis…" />;
  }

  if (error || !data) {
    return <MedsErrorState message={error ?? 'Unable to load pain analysis.'} />;
  }

  const detailEntries = regionEntries[selected] ?? [];

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <MedsPageLead
        eyebrow="Phase 8 / P8-D"
        title="Pain analysis"
        description="An interactive front/back body diagram, region-level severity timelines, medication correlation, and anatomical distribution cues."
        actions={
          <>
            <MedsChip tone="warning">{data.insights.mostPainfulRegion?.label ?? 'No dominant region'}</MedsChip>
            <MedsChip tone="danger">{data.insights.peakWindow ?? 'Window pending'}</MedsChip>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 380px', gap: 18 }}>
        <MedsPanel tone="accent">
          <MedsSectionTitle label="Body diagram" title="Interactive pain map" />
          <AnatomyDiagram
            regions={regions}
            side={side}
            selectedKey={selected}
            onSideChange={setSide}
            onSelect={setSelected}
            legend={
              <div className="meds-list">
                {(data.byRegion.slice(0, 6)).map((item) => (
                  <div key={item.zone} className="meds-row" style={{ justifyContent: 'space-between' }}>
                    <span>{item.label}</span>
                    <MedsChip tone={item.averageSeverity >= 7 ? 'danger' : item.averageSeverity >= 4 ? 'warning' : 'cyan'}>
                      {item.averageSeverity}/10
                    </MedsChip>
                  </div>
                ))}
              </div>
            }
          />
        </MedsPanel>

        <div style={{ display: 'grid', gap: 18 }}>
          <DonutCard
            label="Pain types"
            title="Distribution"
            data={data.painTypeDistribution.map((item) => ({
              ...item,
              color: item.name === 'sharp' ? '#FF453A' : item.name === 'aching' ? '#FFB877' : '#22D3EE',
            }))}
            centerLabel={`${data.entries.length} entries`}
          />

          <MedsPanel>
            <MedsSectionTitle label="Correlation" title="Medication impact" />
            {data.insights.topMedicationCorrelation ? (
              <div className="meds-stack">
                <strong style={{ fontSize: 20 }}>{data.insights.topMedicationCorrelation.medName}</strong>
                <span style={{ color: 'rgba(214,195,181,0.72)', fontSize: 13 }}>
                  {data.insights.topMedicationCorrelation.zone.replace(/_/g, ' ')} improved by{' '}
                  {Math.abs(data.insights.topMedicationCorrelation.severityDelta)} points after therapy started.
                </span>
              </div>
            ) : (
              <span style={{ color: 'rgba(214,195,181,0.72)', fontSize: 13 }}>
                More longitudinal pain entries are needed before medication impact can be estimated.
              </span>
            )}
          </MedsPanel>
        </div>
      </div>

      <MedsPanel>
        <MedsSectionTitle label="Detail sheet" title="Selected region history" />
        {detailEntries.length === 0 ? (
          <span style={{ color: 'rgba(214,195,181,0.72)', fontSize: 13 }}>
            Select a highlighted region to review recent pain entries.
          </span>
        ) : (
          <div className="meds-list">
            {detailEntries.slice(0, 12).map((entry) => (
              <div key={entry.id} className="meds-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="meds-stack">
                  <strong style={{ fontSize: 15 }}>{entry.bodyZone.replace(/_/g, ' ')}</strong>
                  <span style={{ color: 'rgba(214,195,181,0.72)', fontSize: 12 }}>
                    {entry.painType ?? 'Pain episode'} · {formatClinicalDate(entry.startedAt)}
                  </span>
                  {entry.notes ? <span style={{ color: 'rgba(214,195,181,0.66)', fontSize: 12 }}>{entry.notes}</span> : null}
                </div>
                <MedsChip tone={entry.severity >= 7 ? 'danger' : entry.severity >= 4 ? 'warning' : 'cyan'}>
                  {entry.severity}/10
                </MedsChip>
              </div>
            ))}
          </div>
        )}
      </MedsPanel>
    </div>
  );
}
