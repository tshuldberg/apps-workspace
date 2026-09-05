'use client';

import { useMemo, useState } from 'react';
import { fetchCGMPageData } from '../actions';
import { MultiLineCard, RadialScore } from '../charts';
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

type CGMData = Awaited<ReturnType<typeof fetchCGMPageData>>;

const RANGE_OPTIONS = [
  { label: '3h', hours: 3 },
  { label: '6h', hours: 6 },
  { label: '12h', hours: 12 },
  { label: '24h', hours: 24 },
  { label: '7d', hours: 24 * 7 },
] as const;

export default function CGMPage() {
  const { data, loading, error } = useMedsLoader(fetchCGMPageData, []);
  const [hours, setHours] = useState<number>(24);

  const filtered = useMemo(() => {
    if (!data) {
      return [];
    }

    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    return data.readings.filter((reading) => new Date(reading.measuredAt).getTime() >= cutoff);
  }, [data, hours]);

  if (loading) {
    return <MedsLoadingState label="Loading CGM hub…" />;
  }

  if (error || !data) {
    return <MedsErrorState message={error ?? 'Unable to load CGM analytics.'} />;
  }

  const current = filtered.at(-1) ?? data.currentReading;

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <MedsPageLead
        eyebrow="Phase 8 / P8-C"
        title="Real-time CGM hub"
        description="A current reading hero, full-width glucose stream, time-in-range gauges, event overlays, sync status, and alert context."
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.hours}
                type="button"
                className="meds-pill-button"
                style={{
                  background: hours === option.hours ? 'rgba(201,137,77,0.18)' : 'rgba(53,52,58,0.84)',
                  color: hours === option.hours ? '#FFB877' : 'rgba(214,195,181,0.74)',
                }}
                onClick={() => setHours(option.hours)}
              >
                {option.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="meds-grid-4">
        {[
          { label: 'Current reading', value: current ? `${current.value} ${current.unit}` : 'No data' },
          { label: 'Trend arrow', value: data.trendArrow.replace(/_/g, ' ') },
          { label: 'Average', value: `${Math.round(data.stats.averageGlucose)} mg/dL` },
          { label: 'GMI', value: `${data.stats.gmi.toFixed(1)}` },
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
        label="Sensor stream"
        title="Continuous glucose line"
        data={filtered.map((reading) => ({
          label: reading.measuredAt,
          glucose: reading.value,
        }))}
        lines={[{ key: 'glucose', name: 'CGM glucose', color: '#22D3EE' }]}
        lowerBand={70}
        upperBand={180}
      />

      <div className="meds-grid-3">
        <MedsPanel tone="cyan">
          <MedsSectionTitle label="Time in range" title="Primary gauge" />
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <RadialScore value={data.stats.timeInRange} label="in range" color="#22D3EE" />
          </div>
        </MedsPanel>
        <MedsPanel tone="accent">
          <MedsSectionTitle label="Below range" title="Low exposure" />
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <RadialScore value={data.stats.timeBelowRange} label="below" color="#8BCFF0" />
          </div>
        </MedsPanel>
        <MedsPanel>
          <MedsSectionTitle label="Above range" title="High exposure" />
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <RadialScore value={data.stats.timeAboveRange} label="above" color="#FFB877" />
          </div>
        </MedsPanel>
      </div>

      <div className="meds-grid-2">
        <MedsPanel>
          <MedsSectionTitle label="Event markers" title="Meals and insulin overlays" />
          <div className="meds-list">
            {data.events.slice(-12).reverse().map((item) => (
              <div key={item.id} className="meds-row" style={{ justifyContent: 'space-between' }}>
                <div className="meds-stack">
                  <strong style={{ fontSize: 15 }}>{item.kind === 'meal' ? item.label : `Insulin · ${item.label}`}</strong>
                  <span style={{ color: 'rgba(214,195,181,0.72)', fontSize: 12 }}>{formatClinicalDate(item.at)}</span>
                </div>
                <MedsChip tone={item.kind === 'meal' ? 'warning' : 'cyan'}>{item.kind}</MedsChip>
              </div>
            ))}
          </div>
        </MedsPanel>

        <div style={{ display: 'grid', gap: 18 }}>
          <MedsPanel tone="muted">
            <MedsSectionTitle label="Sensor status" title="Sync health" />
            <div className="meds-list">
              <div className="meds-row" style={{ justifyContent: 'space-between' }}>
                <span>Readings synced</span>
                <strong>{data.syncState?.readingsSynced ?? 0}</strong>
              </div>
              <div className="meds-row" style={{ justifyContent: 'space-between' }}>
                <span>Last sync</span>
                <strong>{data.syncState?.lastSyncAt ? formatClinicalDate(data.syncState.lastSyncAt) : 'Never'}</strong>
              </div>
              <div className="meds-row" style={{ justifyContent: 'space-between' }}>
                <span>Samples in view</span>
                <strong>{filtered.length}</strong>
              </div>
            </div>
          </MedsPanel>

          <MedsPanel tone="accent">
            <MedsSectionTitle label="Alert context" title="Recent trigger alerts" />
            <div className="meds-list">
              {data.sensorStatus.lastAlerts.length === 0 ? (
                <span style={{ color: 'rgba(214,195,181,0.72)', fontSize: 13 }}>
                  Alerts will appear here when thresholds or linked weather triggers activate.
                </span>
              ) : (
                data.sensorStatus.lastAlerts.map((item) => (
                  <div key={item.id} className="meds-stack">
                    <div className="meds-row" style={{ justifyContent: 'space-between' }}>
                      <strong style={{ fontSize: 15 }}>{item.title}</strong>
                      <MedsChip tone={item.level === 'high' ? 'danger' : item.level === 'medium' ? 'warning' : 'cyan'}>
                        {item.level}
                      </MedsChip>
                    </div>
                    <span style={{ color: 'rgba(214,195,181,0.72)', fontSize: 13 }}>{item.detail}</span>
                  </div>
                ))
              )}
            </div>
          </MedsPanel>
        </div>
      </div>
    </div>
  );
}
