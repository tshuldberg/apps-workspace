'use client';

import { fetchGlucosePageData } from '../actions';
import { MultiLineCard, ScatterCard } from '../charts';
import {
  MedsChip,
  MedsErrorState,
  MedsLoadingState,
  MedsPageLead,
  MedsPanel,
  MedsSectionTitle,
  formatClinicalDate,
  formatPercent,
  useMedsLoader,
} from '../ui';

type GlucoseData = Awaited<ReturnType<typeof fetchGlucosePageData>>;

export default function GlucosePage() {
  const { data, loading, error } = useMedsLoader(fetchGlucosePageData, []);

  if (loading) {
    return <MedsLoadingState label="Loading glucose monitoring…" />;
  }

  if (error || !data) {
    return <MedsErrorState message={error ?? 'Unable to load glucose monitoring.'} />;
  }

  const latest = data.readings.at(-1) ?? null;

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <MedsPageLead
        eyebrow="Phase 8 / P8-C"
        title="Glucose monitoring"
        description="A large target-band time series with context breakdowns, linked insulin events, meal context, and a recent readings table."
        actions={
          <>
            <MedsChip tone="cyan">{formatPercent(data.stats.tir)} in range</MedsChip>
            <MedsChip tone="warning">
              {data.stats.estimatedA1c != null ? `${data.stats.estimatedA1c.toFixed(1)} A1c est.` : 'A1c pending'}
            </MedsChip>
          </>
        }
      />

      <div className="meds-grid-4">
        {[
          { label: 'Latest', value: latest ? `${latest.value} ${latest.unit}` : 'No data' },
          { label: 'Average', value: `${Math.round(data.stats.average)} mg/dL` },
          { label: 'Time in range', value: formatPercent(data.stats.tir) },
          { label: 'Coefficient of variation', value: `${data.stats.cv.toFixed(1)}%` },
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
        label="Target range"
        title="Glucose time series"
        data={data.readings.map((reading) => ({
          label: reading.measuredAt,
          glucose: reading.value,
        }))}
        lines={[{ key: 'glucose', name: 'Glucose', color: '#22D3EE' }]}
        lowerBand={70}
        upperBand={180}
      />

      <div className="meds-grid-2">
        <MedsPanel tone="accent">
          <MedsSectionTitle label="Context breakdown" title="By reading context" />
          <div className="meds-list">
            {data.byContext.map((item) => (
              <div key={item.context} className="meds-row" style={{ justifyContent: 'space-between' }}>
                <div className="meds-stack">
                  <strong style={{ fontSize: 15 }}>{item.context.replace(/_/g, ' ')}</strong>
                  <span style={{ color: 'rgba(214,195,181,0.72)', fontSize: 12 }}>{item.count} entries</span>
                </div>
                <MedsChip tone={item.average <= 140 ? 'success' : 'warning'}>
                  {item.average} mg/dL
                </MedsChip>
              </div>
            ))}
          </div>
        </MedsPanel>

        <ScatterCard
          label="Linked insulin"
          title="Insulin vs glucose"
          data={data.insulinCorrelation.map((item) => ({
            insulin: item.units,
            glucose: item.glucoseBefore,
          }))}
          xKey="insulin"
          yKey="glucose"
          xName="Insulin units"
          yName="Pre-dose glucose"
          color="#FFB877"
        />
      </div>

      <div className="meds-grid-2">
        <MedsPanel>
          <MedsSectionTitle label="Meal context" title="Recent linked meals" />
          <div className="meds-list">
            {data.mealCorrelation.slice(0, 8).map((item) => (
              <div key={item.id} className="meds-row" style={{ justifyContent: 'space-between' }}>
                <div className="meds-stack">
                  <strong style={{ fontSize: 15 }}>{item.foodItems}</strong>
                  <span style={{ color: 'rgba(214,195,181,0.72)', fontSize: 12 }}>
                    {item.mealType} · {formatClinicalDate(item.eatenAt)}
                  </span>
                </div>
                <MedsChip tone={item.fodmapRating === 'low' ? 'success' : item.fodmapRating === 'moderate' ? 'warning' : 'danger'}>
                  {item.fodmapRating}
                </MedsChip>
              </div>
            ))}
          </div>
        </MedsPanel>

        <MedsPanel>
          <MedsSectionTitle label="Medication signals" title="Recent correlations" />
          <div className="meds-list">
            {data.medicationInsights.slice(0, 5).map((item) => (
              <div key={item.id} className="meds-stack">
                <div className="meds-row" style={{ justifyContent: 'space-between' }}>
                  <strong style={{ fontSize: 15 }}>{item.title}</strong>
                  <MedsChip tone={item.severity === 'alert' ? 'danger' : item.severity === 'warning' ? 'warning' : 'cyan'}>
                    {item.severity}
                  </MedsChip>
                </div>
                <span style={{ color: 'rgba(214,195,181,0.72)', fontSize: 13 }}>{item.description}</span>
              </div>
            ))}
          </div>
        </MedsPanel>
      </div>

      <MedsPanel>
        <MedsSectionTitle label="Readings table" title="Latest glucose entries" />
        <div style={{ overflowX: 'auto' }}>
          <table className="meds-table">
            <thead>
              <tr>
                <th>Recorded</th>
                <th>Value</th>
                <th>Context</th>
                <th>Meal type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.recentEntries.map((reading) => (
                <tr key={reading.id}>
                  <td>{formatClinicalDate(reading.measuredAt)}</td>
                  <td>
                    <strong style={{ color: '#22D3EE' }}>{reading.value} {reading.unit}</strong>
                  </td>
                  <td>{reading.mealContext?.replace(/_/g, ' ') ?? 'Random'}</td>
                  <td>{reading.mealType ?? '—'}</td>
                  <td>
                    <MedsChip tone={reading.inRange ? 'success' : reading.rangeStatus.includes('low') ? 'warning' : 'danger'}>
                      {reading.rangeStatus.replace(/_/g, ' ')}
                    </MedsChip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </MedsPanel>
    </div>
  );
}
