'use client';

import { useMemo, useState } from 'react';
import { fetchBPAnalyticsData } from '../actions';
import { DonutCard, HeatmapMatrix, MultiLineCard } from '../charts';
import {
  MedsChip,
  MedsErrorState,
  MedsLoadingState,
  MedsPageLead,
  MedsPanel,
  MedsSectionTitle,
  formatClinicalDate,
  useMedsLoader,
} from '../ui';

type BPData = Awaited<ReturnType<typeof fetchBPAnalyticsData>>;

const DAY_OPTIONS = [
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
] as const;

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOUR_LABELS = Array.from({ length: 24 }, (_, index) => `${index}`.padStart(2, '0'));

function categoryColor(name: string) {
  switch (name) {
    case 'normal':
      return '#30D158';
    case 'elevated':
      return '#FFD60A';
    case 'hypertension_1':
      return '#FFB877';
    case 'hypertension_2':
      return '#FFB4AB';
    case 'crisis':
      return '#FF453A';
    default:
      return '#22D3EE';
  }
}

export default function BPPage() {
  const { data, loading, error } = useMedsLoader(fetchBPAnalyticsData, []);
  const [periodDays, setPeriodDays] = useState<number>(30);

  const filtered = useMemo(() => {
    if (!data) {
      return [];
    }

    const cutoff = Date.now() - periodDays * 24 * 60 * 60 * 1000;
    return data.readings.filter((reading) => new Date(reading.measuredAt).getTime() >= cutoff);
  }, [data, periodDays]);

  const summary = useMemo(() => {
    if (filtered.length === 0) {
      return {
        averageSystolic: 0,
        averageDiastolic: 0,
        averagePulse: 0,
        distribution: [] as Array<{ name: string; value: number; color: string }>,
        heatmap: [] as Array<{ row: number; column: number; value: number }>,
      };
    }

    const distributionMap = filtered.reduce<Record<string, number>>((acc, reading) => {
      acc[reading.category] = (acc[reading.category] ?? 0) + 1;
      return acc;
    }, {});

    const heatBuckets = filtered.reduce<Record<string, number>>((acc, reading) => {
      const date = new Date(reading.measuredAt);
      const key = `${date.getDay()}-${date.getHours()}`;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    return {
      averageSystolic: Math.round(filtered.reduce((sum, reading) => sum + reading.systolic, 0) / filtered.length),
      averageDiastolic: Math.round(filtered.reduce((sum, reading) => sum + reading.diastolic, 0) / filtered.length),
      averagePulse: Math.round(
        filtered.reduce((sum, reading) => sum + (reading.pulse ?? 0), 0) /
          Math.max(1, filtered.filter((reading) => reading.pulse != null).length),
      ),
      distribution: Object.entries(distributionMap).map(([name, value]) => ({
        name: name.replace(/_/g, ' '),
        value,
        color: categoryColor(name),
      })),
      heatmap: Object.entries(heatBuckets).map(([key, value]) => {
        const [row, column] = key.split('-').map(Number);
        return { row, column, value };
      }),
    };
  }, [filtered]);

  if (loading) {
    return <MedsLoadingState label="Loading blood pressure analytics…" />;
  }

  if (error || !data) {
    return <MedsErrorState message={error ?? 'Unable to load blood pressure analytics.'} />;
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <MedsPageLead
        eyebrow="Phase 8 / P8-B"
        title="Blood pressure analytics"
        description="A clinical comparison view with period controls, target zones, distribution, hourly heatmapping, medication impact, and a sortable readings ledger."
        actions={
          <>
            <div style={{ display: 'flex', gap: 8 }}>
              {DAY_OPTIONS.map((option) => (
                <button
                  key={option.days}
                  type="button"
                  className="meds-pill-button"
                  style={{
                    background: periodDays === option.days ? 'rgba(201,137,77,0.18)' : 'rgba(53,52,58,0.84)',
                    color: periodDays === option.days ? '#FFB877' : 'rgba(214,195,181,0.74)',
                  }}
                  onClick={() => setPeriodDays(option.days)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <MedsChip tone="warning">
              Compare {data.periodComparison ? `${Math.round(data.periodComparison.systolicDelta)} sys` : 'Baseline pending'}
            </MedsChip>
          </>
        }
      />

      <div className="meds-grid-4">
        {[
          { label: 'Average systolic', value: `${summary.averageSystolic || data.currentStats.avgSystolic} mmHg` },
          { label: 'Average diastolic', value: `${summary.averageDiastolic || data.currentStats.avgDiastolic} mmHg` },
          { label: 'Average pulse', value: `${summary.averagePulse || data.currentStats.avgPulse || 0} bpm` },
          { label: 'Reading count', value: `${filtered.length}` },
        ].map((item) => (
          <MedsPanel key={item.label} tone="muted">
            <div className="meds-stack">
              <span className="meds-label">{item.label}</span>
              <strong style={{ fontSize: 30, letterSpacing: '-0.05em' }}>{item.value}</strong>
            </div>
          </MedsPanel>
        ))}
      </div>

      <MultiLineCard
        label="Target zones"
        title="Systolic and diastolic trends"
        data={filtered.map((reading) => ({
          label: reading.measuredAt,
          systolic: reading.systolic,
          diastolic: reading.diastolic,
        }))}
        lines={[
          { key: 'systolic', name: 'Systolic', color: '#22D3EE' },
          { key: 'diastolic', name: 'Diastolic', color: '#FFB877' },
        ]}
        lowerBand={70}
        upperBand={120}
        footer={
          <div className="meds-row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <span style={{ color: 'rgba(214,195,181,0.72)', fontSize: 13 }}>
              {data.periodComparison
                ? `Previous period shift: ${Math.round(data.periodComparison.systolicDelta)} systolic / ${Math.round(data.periodComparison.diastolicDelta)} diastolic`
                : 'Compare mode activates after two periods of readings.'}
            </span>
            <MedsChip tone="cyan">{data.currentStats.trendDirection}</MedsChip>
          </div>
        }
      />

      <div className="meds-grid-2">
        <DonutCard
          label="Classification"
          title="Distribution by category"
          data={(summary.distribution.length > 0 ? summary.distribution : data.distribution).map((item: {
            name: string;
            value: number;
            color?: string;
          }) => ({
            name: item.name,
            value: item.value,
            color: item.color ?? categoryColor(item.name.replace(/ /g, '_')),
          }))}
          centerLabel={`${filtered.length} readings`}
        />
        <HeatmapMatrix
          label="Time-of-day"
          title="Hourly heatmap"
          rows={DAY_LABELS}
          columns={HOUR_LABELS}
          cells={summary.heatmap}
          valueLabel="readings"
        />
      </div>

      <div className="meds-grid-2">
        <MedsPanel tone="accent">
          <MedsSectionTitle label="Medication impact" title="Before and after medication changes" />
          <div className="meds-list">
            {data.medicationImpact.length === 0 ? (
              <span style={{ color: 'rgba(214,195,181,0.72)', fontSize: 13 }}>
                More longitudinal medication history is needed before this card can estimate change windows.
              </span>
            ) : (
              data.medicationImpact.map((item) => (
                <div key={item.medicationId} className="meds-row" style={{ justifyContent: 'space-between' }}>
                  <div className="meds-stack">
                    <strong style={{ fontSize: 15 }}>{item.medicationName}</strong>
                    <span style={{ color: 'rgba(214,195,181,0.72)', fontSize: 12 }}>
                      {item.beforeAverage} before · {item.afterAverage} after
                    </span>
                  </div>
                  <MedsChip tone={item.delta <= 0 ? 'success' : 'warning'}>
                    {item.delta > 0 ? '+' : ''}
                    {item.delta}
                  </MedsChip>
                </div>
              ))
            )}
          </div>
        </MedsPanel>

        <MedsPanel>
          <MedsSectionTitle label="Readings ledger" title="Recent measurements" />
          <div style={{ overflowX: 'auto' }}>
            <table className="meds-table">
              <thead>
                <tr>
                  <th>Recorded</th>
                  <th>Reading</th>
                  <th>Pulse</th>
                  <th>Context</th>
                  <th>Classification</th>
                </tr>
              </thead>
              <tbody>
                {filtered
                  .slice()
                  .reverse()
                  .slice(0, 18)
                  .map((reading) => (
                    <tr key={reading.id}>
                      <td>{formatClinicalDate(reading.measuredAt)}</td>
                      <td>
                        <strong style={{ color: '#22D3EE' }}>
                          {reading.systolic}/{reading.diastolic}
                        </strong>
                      </td>
                      <td>{reading.pulse ?? '—'}</td>
                      <td>{reading.context?.replace(/_/g, ' ') ?? 'Routine'}</td>
                      <td>
                        <MedsChip tone={reading.category === 'normal' ? 'success' : reading.category === 'elevated' ? 'warning' : 'danger'}>
                          {reading.category.replace(/_/g, ' ')}
                        </MedsChip>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </MedsPanel>
      </div>
    </div>
  );
}
