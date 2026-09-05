'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useState } from 'react';
import {
  fetchProtocols,
  fetchSetting,
  updateSetting,
  doExportFastsCSV,
  doExportWeightCSV,
} from '../actions';

const ACCENT = 'var(--accent-fast)';

type ProtocolRow = {
  id: string;
  name: string;
  fasting_hours: number;
  eating_hours: number;
  description: string | null;
  is_default: number;
};

const GLASS_CARD: CSSProperties = {
  background: 'var(--glass)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xl)',
  padding: 20,
};

function downloadCsv(filename: string, contents: string) {
  const blob = new Blob([contents], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function FastSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [protocols, setProtocols] = useState<ProtocolRow[]>([]);
  const [defaultProtocol, setDefaultProtocol] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [protos, defKey] = await Promise.all([
        fetchProtocols(),
        fetchSetting('default_protocol'),
      ]);
      const list = protos as ProtocolRow[];
      setProtocols(list);
      setDefaultProtocol(
        (defKey as string | null) ?? list.find((p) => p.is_default === 1)?.id ?? list[0]?.id ?? '',
      );
    } catch (err) {
      console.error('Failed to load fast settings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSelectDefault(id: string) {
    setDefaultProtocol(id);
    try {
      await updateSetting('default_protocol', id);
    } catch (err) {
      console.error('Failed to save default protocol:', err);
    }
  }

  async function handleExportFasts() {
    try {
      const csv = await doExportFastsCSV();
      downloadCsv('fasts.csv', csv as string);
    } catch (err) {
      console.error('Failed to export fasts:', err);
    }
  }

  async function handleExportWeight() {
    try {
      const csv = await doExportWeightCSV();
      downloadCsv('weight.csv', csv as string);
    } catch (err) {
      console.error('Failed to export weight:', err);
    }
  }

  return (
    <div style={{ padding: 'var(--space-xl)', maxWidth: 700 }}>
      <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: ACCENT }}>Settings</h1>
      <p style={{ margin: '4px 0 24px', color: 'var(--text-secondary)', fontSize: 14 }}>
        Default protocol and data export
      </p>

      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
          <section style={GLASS_CARD}>
            <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
              Default Protocol
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              {protocols.map((p) => {
                const selected = defaultProtocol === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectDefault(p.id)}
                    aria-pressed={selected}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: 2,
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-md)',
                      border: `1px solid ${selected ? 'var(--accent-fast)' : 'var(--border)'}`,
                      background: selected ? 'var(--glass-strong)' : 'var(--glass)',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: selected ? 700 : 600,
                        color: selected ? 'var(--accent-fast)' : 'var(--text)',
                      }}
                    >
                      {p.name} ({p.fasting_hours}:{p.eating_hours})
                    </span>
                    {p.description && (
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {p.description}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          <section style={GLASS_CARD}>
            <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
              Export Data
            </h2>
            <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleExportFasts}
                style={{
                  padding: '10px 20px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  background: 'var(--glass)',
                  color: 'var(--text)',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Export Fasts CSV
              </button>
              <button
                type="button"
                onClick={handleExportWeight}
                style={{
                  padding: '10px 20px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  background: 'var(--glass)',
                  color: 'var(--text)',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Export Weight CSV
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
