'use client';

import { useMemo, useState } from 'react';
import { TEXT, TEXT_SEC } from './ui';

type ExportBundle = {
  recordings: Array<Record<string, unknown>>;
  waypoints: Array<Record<string, unknown>>;
  photos: Array<Record<string, unknown>>;
  trails: Array<Record<string, unknown>>;
  segments: Array<Record<string, unknown>>;
  reviews: Array<Record<string, unknown>>;
  trips: Array<Record<string, unknown>>;
};

const INCLUDE_KEYS = ['recordings', 'waypoints', 'photos', 'trails', 'segments', 'reviews', 'trips'] as const;
type IncludeKey = (typeof INCLUDE_KEYS)[number];

export function ExportDownloads({ bundle }: { bundle: ExportBundle }) {
  const [format, setFormat] = useState<'json' | 'csv'>('json');
  const [selectedKeys, setSelectedKeys] = useState<IncludeKey[]>([...INCLUDE_KEYS]);

  const filteredBundle = useMemo(() => {
    return selectedKeys.reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = bundle[key];
      return acc;
    }, {});
  }, [bundle, selectedKeys]);

  const exportString = useMemo(() => {
    if (format === 'json') {
      return JSON.stringify(filteredBundle, null, 2);
    }

    return buildCsv(filteredBundle);
  }, [filteredBundle, format]);

  const handleDownload = () => {
    const blob = new Blob([exportString], { type: format === 'json' ? 'application/json' : 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `mytrails-export.${format}`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const toggleKey = (key: IncludeKey) => {
    setSelectedKeys((current) =>
      current.includes(key)
        ? current.filter((value) => value !== key)
        : [...current, key],
    );
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {(['json', 'csv'] as const).map((value) => (
          <button key={value} type="button" onClick={() => setFormat(value)} style={formatButtonStyle(format === value)}>
            {value.toUpperCase()}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {INCLUDE_KEYS.map((key) => (
          <button key={key} type="button" onClick={() => toggleKey(key)} style={includeButtonStyle(selectedKeys.includes(key))}>
            {key}
          </button>
        ))}
      </div>

      <div
        style={{
          maxHeight: 280,
          overflow: 'auto',
          padding: 16,
          borderRadius: 22,
          background: 'rgba(8,10,12,0.8)',
          boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.08)',
        }}
      >
        <pre style={{ margin: 0, color: TEXT_SEC, fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {exportString.slice(0, 3200)}
          {exportString.length > 3200 ? '\n…' : ''}
        </pre>
      </div>

      <button type="button" onClick={handleDownload} style={downloadButtonStyle}>
        Download {format.toUpperCase()}
      </button>

      <span style={{ color: TEXT, fontSize: 13 }}>
        {selectedKeys.length} data groups selected · {exportString.length.toLocaleString()} characters
      </span>
    </div>
  );
}

function buildCsv(bundle: Record<string, unknown>) {
  return Object.entries(bundle)
    .map(([key, value]) => {
      const rows = Array.isArray(value) ? value : [];
      if (rows.length === 0) {
        return `${key}\n`;
      }

      const headers = Array.from(
        rows.reduce<Set<string>>((set, row) => {
          Object.keys(row as Record<string, unknown>).forEach((column) => set.add(column));
          return set;
        }, new Set<string>()),
      );

      const lines = [
        headers.join(','),
        ...rows.map((row) =>
          headers
            .map((header) => escapeCsv((row as Record<string, unknown>)[header]))
            .join(','),
        ),
      ];

      return `${key}\n${lines.join('\n')}`;
    })
    .join('\n\n');
}

function escapeCsv(value: unknown) {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }

  return stringValue;
}

const formatButtonStyle = (active: boolean) => ({
  border: 'none',
  borderRadius: 999,
  padding: '10px 14px',
  background: active ? 'linear-gradient(135deg, #84CC16, #65A30D)' : 'rgba(255,255,255,0.05)',
  color: active ? '#102108' : TEXT_SEC,
  cursor: 'pointer',
  fontWeight: 700,
});

const includeButtonStyle = (active: boolean) => ({
  border: 'none',
  borderRadius: 999,
  padding: '8px 12px',
  background: active ? 'rgba(132,204,22,0.18)' : 'rgba(255,255,255,0.05)',
  color: active ? '#84CC16' : TEXT_SEC,
  cursor: 'pointer',
  fontWeight: 600,
});

const downloadButtonStyle = {
  border: 'none',
  borderRadius: 999,
  padding: '12px 16px',
  background: 'linear-gradient(135deg, #84CC16, #65A30D)',
  color: '#102108',
  cursor: 'pointer',
  fontWeight: 700,
};
