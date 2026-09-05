'use client';

import { useMemo, useState } from 'react';
import { fetchInsulinPageData } from '../actions';
import { DonutCard, ScatterCard } from '../charts';
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

type InsulinData = Awaited<ReturnType<typeof fetchInsulinPageData>>;

export default function InsulinPage() {
  const { data, loading, error } = useMedsLoader(fetchInsulinPageData, []);
  const [side, setSide] = useState<'front' | 'back'>('front');

  const regions = useMemo(() => {
    if (!data) {
      return [];
    }

    const counts = data.injectionSites.reduce<Record<string, number>>((acc, item) => {
      acc[item.siteName] = item.useCount;
      return acc;
    }, {});
    const max = Math.max(1, ...Object.values(counts));

    return [
      { key: 'abdomen_left', label: 'Left abdomen', front: true, x: 88, y: 132, width: 34, height: 72, intensity: (counts.abdomen_left ?? 0) / max },
      { key: 'abdomen_right', label: 'Right abdomen', front: true, x: 138, y: 132, width: 34, height: 72, intensity: (counts.abdomen_right ?? 0) / max },
      { key: 'arm_left', label: 'Left arm', front: true, x: 52, y: 104, width: 26, height: 92, intensity: (counts.arm_left ?? 0) / max },
      { key: 'arm_right', label: 'Right arm', front: true, x: 182, y: 104, width: 26, height: 92, intensity: (counts.arm_right ?? 0) / max },
      { key: 'thigh_left', label: 'Left thigh', front: true, x: 92, y: 238, width: 32, height: 86, intensity: (counts.thigh_left ?? 0) / max },
      { key: 'thigh_right', label: 'Right thigh', front: true, x: 136, y: 238, width: 32, height: 86, intensity: (counts.thigh_right ?? 0) / max },
      { key: 'buttock_left', label: 'Left glute', front: false, x: 92, y: 206, width: 32, height: 74, intensity: (counts.buttock_left ?? 0) / max },
      { key: 'buttock_right', label: 'Right glute', front: false, x: 136, y: 206, width: 32, height: 74, intensity: (counts.buttock_right ?? 0) / max },
      { key: 'arm_left_back', label: 'Left arm', front: false, x: 52, y: 104, width: 26, height: 92, intensity: (counts.arm_left ?? 0) / max },
      { key: 'arm_right_back', label: 'Right arm', front: false, x: 182, y: 104, width: 26, height: 92, intensity: (counts.arm_right ?? 0) / max },
      { key: 'thigh_left_back', label: 'Left thigh', front: false, x: 92, y: 270, width: 32, height: 86, intensity: (counts.thigh_left ?? 0) / max },
      { key: 'thigh_right_back', label: 'Right thigh', front: false, x: 136, y: 270, width: 32, height: 86, intensity: (counts.thigh_right ?? 0) / max },
    ];
  }, [data]);

  if (loading) {
    return <MedsLoadingState label="Loading insulin therapy…" />;
  }

  if (error || !data) {
    return <MedsErrorState message={error ?? 'Unable to load insulin therapy.'} />;
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <MedsPageLead
        eyebrow="Phase 8 / P8-C"
        title="Insulin therapy"
        description="A daily total hero, injection-site heatmap, dose distributions, insulin-vs-glucose correlation, and recent entry ledger."
        actions={
          <>
            <MedsChip tone="cyan">{data.stats.iob.toFixed(1)} IU on board</MedsChip>
            <MedsChip tone="warning">{data.stats.dailyAverage.toFixed(1)} IU / day</MedsChip>
          </>
        }
      />

      <div className="meds-grid-4">
        {[
          { label: 'Insulin on board', value: `${data.stats.iob.toFixed(1)} IU` },
          { label: 'Daily average', value: `${data.stats.dailyAverage.toFixed(1)} IU` },
          { label: 'Logged doses', value: `${data.entries.length}` },
          { label: 'Injection sites', value: `${data.injectionSites.length}` },
        ].map((item) => (
          <MedsPanel key={item.label} tone="muted">
            <div className="meds-stack">
              <span className="meds-label">{item.label}</span>
              <strong style={{ fontSize: 30, letterSpacing: '-0.05em' }}>{item.value}</strong>
            </div>
          </MedsPanel>
        ))}
      </div>

      <div className="meds-grid-2">
        <MedsPanel tone="accent">
          <MedsSectionTitle label="Injection site heatmap" title="Front and back rotation" />
          <AnatomyDiagram
            regions={regions}
            side={side}
            onSideChange={setSide}
            legend={
              <div className="meds-list">
                {data.injectionSites.map((site) => (
                  <div key={site.id} className="meds-row" style={{ justifyContent: 'space-between' }}>
                    <span>{site.siteName.replace(/_/g, ' ')}</span>
                    <MedsChip tone="warning">{site.useCount} uses</MedsChip>
                  </div>
                ))}
              </div>
            }
          />
        </MedsPanel>

        <div style={{ display: 'grid', gap: 18 }}>
          <DonutCard
            label="Dose category"
            title="Distribution by category"
            data={data.doseDistribution.map((item) => ({
              ...item,
              color: item.name === 'basal' ? '#22D3EE' : item.name === 'bolus' ? '#FFB877' : '#FFB4AB',
            }))}
            centerLabel={`${data.entries.length} total doses`}
          />
          <DonutCard
            label="Insulin type"
            title="Distribution by type"
            data={data.typeDistribution.map((item) => ({
              ...item,
              color: item.name.includes('rapid') ? '#22D3EE' : item.name.includes('long') ? '#FFB877' : '#8BCFF0',
            }))}
          />
        </div>
      </div>

      <ScatterCard
        label="Linked glucose"
        title="Glucose vs insulin scatter"
        data={data.scatter.map((item) => ({
          insulin: item.insulin,
          glucose: item.glucose,
        }))}
        xKey="insulin"
        yKey="glucose"
        xName="Insulin units"
        yName="Nearby glucose"
        color="#22D3EE"
      />

      <div className="meds-grid-2">
        <MedsPanel>
          <MedsSectionTitle label="Recent entries" title="Insulin ledger" />
          <div style={{ overflowX: 'auto' }}>
            <table className="meds-table">
              <thead>
                <tr>
                  <th>Recorded</th>
                  <th>Units</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Site</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.slice(-18).reverse().map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatClinicalDate(entry.administeredAt)}</td>
                    <td>
                      <strong style={{ color: '#22D3EE' }}>{entry.units} IU</strong>
                    </td>
                    <td>{entry.insulinType.replace(/_/g, ' ')}</td>
                    <td>{entry.doseCategory}</td>
                    <td>{entry.injectionSite?.replace(/_/g, ' ') ?? 'Unspecified'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </MedsPanel>

        <MedsPanel tone="muted">
          <MedsSectionTitle label="Daily totals" title="Recent 14-day totals" />
          <div className="meds-list">
            {data.stats.dailyTotals.slice(-10).reverse().map((item) => (
              <div key={item.date} className="meds-row" style={{ justifyContent: 'space-between' }}>
                <div className="meds-stack">
                  <strong style={{ fontSize: 15 }}>{formatClinicalDate(item.date)}</strong>
                  <span style={{ color: 'rgba(214,195,181,0.72)', fontSize: 12 }}>
                    Basal {item.basal} · Bolus {item.bolus} · Correction {item.correction}
                  </span>
                </div>
                <MedsChip tone="warning">{item.total} IU</MedsChip>
              </div>
            ))}
          </div>
        </MedsPanel>
      </div>
    </div>
  );
}
