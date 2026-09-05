'use client';

import { useState } from 'react';
import { doCreateA1cLabRecord, fetchA1cPageData } from '../actions';
import { MultiLineCard } from '../charts';
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

type A1cData = Awaited<ReturnType<typeof fetchA1cPageData>>;

export default function A1cPage() {
  const { data, loading, error, setData } = useMedsLoader(fetchA1cPageData, []);
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function refresh() {
    const next = await fetchA1cPageData();
    setData(next);
  }

  async function saveRecord() {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return;
    }

    setSaving(true);
    try {
      await doCreateA1cLabRecord({
        value: numeric,
        source: 'lab',
        notes: notes || undefined,
      });
      setValue('');
      setNotes('');
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <MedsLoadingState label="Loading A1c analytics…" />;
  }

  if (error || !data) {
    return <MedsErrorState message={error ?? 'Unable to load A1c analytics.'} />;
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <MedsPageLead
        eyebrow="Phase 8 / P8-C"
        title="A1c analytics"
        description="A blended lab and estimated view with conversion curves, confidence, factor analysis, and a lightweight lab-entry control."
        actions={
          <>
            <MedsChip tone="cyan">{data.confidence} confidence</MedsChip>
            {data.interpretation ? <MedsChip tone="warning">{data.interpretation.label}</MedsChip> : null}
          </>
        }
      />

      <div className="meds-grid-4">
        {[
          { label: 'Estimated A1c', value: data.estimated != null ? data.estimated.toFixed(1) : 'No data' },
          { label: 'Average glucose', value: data.averageGlucose != null ? `${Math.round(data.averageGlucose)} mg/dL` : 'No data' },
          { label: 'Time in range', value: `${data.tir}%` },
          { label: 'Readings', value: `${data.readingCount}` },
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
        label="Lab trend"
        title="A1c over time"
        data={data.records.map((record) => ({
          label: record.recordedAt,
          a1c: record.value,
        }))}
        lines={[{ key: 'a1c', name: 'A1c', color: '#22D3EE' }]}
      />

      <div className="meds-grid-2">
        <MultiLineCard
          label="Conversion"
          title="Glucose to A1c curve"
          data={data.conversionCurve.map((point) => ({
            label: `${point.averageGlucose} mg/dL`,
            a1c: point.estimatedA1c,
          }))}
          lines={[{ key: 'a1c', name: 'Estimated A1c', color: '#FFB877' }]}
        />

        <MedsPanel tone="accent">
          <MedsSectionTitle label="Factor analysis" title="Interpretation" />
          <div className="meds-list">
            <div className="meds-row" style={{ justifyContent: 'space-between' }}>
              <span>Confidence</span>
              <MedsChip tone="cyan">{data.confidence}</MedsChip>
            </div>
            <div className="meds-row" style={{ justifyContent: 'space-between' }}>
              <span>Interpretation</span>
              <strong>{data.interpretation?.label ?? 'Awaiting more data'}</strong>
            </div>
            <div className="meds-row" style={{ justifyContent: 'space-between' }}>
              <span>Average glucose</span>
              <strong>{data.averageGlucose != null ? `${Math.round(data.averageGlucose)} mg/dL` : 'No data'}</strong>
            </div>
            <div className="meds-row" style={{ justifyContent: 'space-between' }}>
              <span>Time in range</span>
              <strong>{data.tir}%</strong>
            </div>
          </div>
        </MedsPanel>
      </div>

      <div className="meds-grid-2">
        <MedsPanel>
          <MedsSectionTitle label="Add lab result" title="Record a new A1c" />
          <div className="meds-stack">
            <input
              className="meds-inline-field"
              type="number"
              step="0.1"
              min="3"
              max="20"
              placeholder="A1c value"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
            <textarea
              className="meds-textarea"
              placeholder="Lab note or provider detail"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
            <button type="button" className="meds-action" onClick={saveRecord} disabled={saving}>
              {saving ? 'Saving…' : 'Add lab result'}
            </button>
          </div>
        </MedsPanel>

        <MedsPanel>
          <MedsSectionTitle label="Lab history" title="Recorded A1c values" />
          <div style={{ overflowX: 'auto' }}>
            <table className="meds-table">
              <thead>
                <tr>
                  <th>Recorded</th>
                  <th>Value</th>
                  <th>Source</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {data.records
                  .slice()
                  .reverse()
                  .map((record) => (
                    <tr key={record.id}>
                      <td>{formatClinicalDate(record.recordedAt)}</td>
                      <td>
                        <strong style={{ color: '#22D3EE' }}>{record.value.toFixed(1)}</strong>
                      </td>
                      <td>{record.source}</td>
                      <td>{record.notes ?? '—'}</td>
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
