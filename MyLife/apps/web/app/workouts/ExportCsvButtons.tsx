'use client';

import type { CSSProperties } from 'react';
import { useState } from 'react';
import { fetchWorkoutHistoryCSV, fetchWorkoutSetWeightsCSV } from './actions';

const ghostButton: CSSProperties = {
  minHeight: 38,
  padding: '0 16px',
  borderRadius: 999,
  border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(255,255,255,0.04)',
  color: '#E4E1E9',
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
};

function download(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ExportCsvButtons() {
  const [busy, setBusy] = useState<string | null>(null);

  async function run(kind: 'history' | 'sets') {
    setBusy(kind);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      if (kind === 'history') {
        download(`workout-history-${stamp}.csv`, await fetchWorkoutHistoryCSV());
      } else {
        download(`workout-sets-${stamp}.csv`, await fetchWorkoutSetWeightsCSV());
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button
        type="button"
        onClick={() => void run('history')}
        disabled={busy !== null}
        style={ghostButton}
      >
        {busy === 'history' ? 'Exporting...' : 'Export history CSV'}
      </button>
      <button
        type="button"
        onClick={() => void run('sets')}
        disabled={busy !== null}
        style={ghostButton}
      >
        {busy === 'sets' ? 'Exporting...' : 'Export sets CSV'}
      </button>
    </div>
  );
}
