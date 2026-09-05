'use client';

import type { CSSProperties } from 'react';
import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { importCsvAction, importGoogleMapsAction } from '../actions';

const ACCENT = '#DC2626';
const ACCENT_DIM = 'rgba(220,38,38,0.15)';
const TEXT = 'var(--text)';
const TEXT_SEC = 'var(--text-secondary)';
const TEXT_TER = 'var(--text-tertiary)';
const DANGER = 'var(--danger)';
const SUCCESS = '#30D158';

type ImportSource = 'csv' | 'google_maps' | null;
type Step = 'source' | 'input' | 'preview' | 'result';

interface ParsedRow {
  name: string;
  address?: string;
  city?: string;
}

interface ImportResultData {
  total: number;
  imported: number;
  skipped: number;
  errors: Array<{ row: number; reason: string }>;
}

export default function ImportPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('source');
  const [source, setSource] = useState<ImportSource>(null);
  const [rawText, setRawText] = useState('');
  const [previewRows, setPreviewRows] = useState<ParsedRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResultData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSourceSelect = useCallback((s: ImportSource) => {
    setSource(s);
    setStep('input');
    setRawText('');
    setPreviewRows([]);
    setError(null);
  }, []);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text === 'string') setRawText(text);
    };
    reader.readAsText(file);
  }, []);

  const handleParse = useCallback(() => {
    setError(null);
    try {
      if (source === 'google_maps') {
        const data = JSON.parse(rawText);
        const features = data?.features;
        if (!Array.isArray(features) || features.length === 0) {
          setError('No places found. Check that the JSON is a valid Google Maps export.');
          return;
        }
        const rows: ParsedRow[] = features
          .filter((f: Record<string, unknown>) => {
            const p = f.properties as Record<string, string> | undefined;
            return p?.Title || p?.title || p?.name;
          })
          .map((f: Record<string, unknown>) => {
            const p = f.properties as Record<string, string>;
            return {
              name: p.Title || p.title || p.name || '',
              address: p.Address || p.address || p.Location || '',
            };
          });
        if (rows.length === 0) {
          setError('No restaurant names found in the export.');
          return;
        }
        setPreviewRows(rows);
        setStep('preview');
      } else {
        // CSV
        const lines = rawText.split(/\r?\n/).filter((l) => l.trim());
        if (lines.length < 2) {
          setError('CSV needs at least a header row and one data row.');
          return;
        }
        // Quick client-side preview parse (server does the real import)
        const headers = lines[0].toLowerCase().split(',').map((h) => h.trim());
        const nameIdx = headers.findIndex((h) =>
          ['name', 'restaurant', 'place'].includes(h),
        );
        const addrIdx = headers.findIndex((h) =>
          ['address', 'street'].includes(h),
        );
        const cityIdx = headers.findIndex((h) => h === 'city');

        if (nameIdx === -1) {
          setError('CSV must have a "name" or "restaurant" column.');
          return;
        }

        const rows: ParsedRow[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
          const name = cols[nameIdx];
          if (!name) continue;
          rows.push({
            name,
            address: addrIdx >= 0 ? cols[addrIdx] : undefined,
            city: cityIdx >= 0 ? cols[cityIdx] : undefined,
          });
        }

        if (rows.length === 0) {
          setError('No valid rows found. Make sure at least one row has a name.');
          return;
        }
        setPreviewRows(rows);
        setStep('preview');
      }
    } catch {
      setError('Failed to parse input. Check the format and try again.');
    }
  }, [rawText, source]);

  const handleImport = useCallback(async () => {
    if (isImporting) return;
    setIsImporting(true);
    setError(null);

    try {
      let importResult: ImportResultData;
      if (source === 'google_maps') {
        importResult = (await importGoogleMapsAction(rawText)) as ImportResultData;
      } else {
        importResult = (await importCsvAction(rawText)) as ImportResultData;
      }
      setResult(importResult);
      setStep('result');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setIsImporting(false);
    }
  }, [isImporting, source, rawText]);

  const handleReset = useCallback(() => {
    setStep('source');
    setSource(null);
    setRawText('');
    setPreviewRows([]);
    setResult(null);
    setError(null);
  }, []);

  const stepNames = ['Source', 'Input', 'Preview', 'Done'];
  const stepKeys: Step[] = ['source', 'input', 'preview', 'result'];
  const currentIdx = stepKeys.indexOf(step);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <nav style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: TEXT_SEC, marginBottom: 24 }}>
        <Link href="/dining" style={{ color: TEXT_SEC, textDecoration: 'none' }}>Restaurants</Link>
        <span style={{ opacity: 0.4 }}>&gt;</span>
        <span style={{ color: TEXT }}>Import</span>
      </nav>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <button
          type="button"
          onClick={() => (step === 'source' ? router.back() : handleReset())}
          style={linkButtonStyle}
        >
          {step === 'source' ? 'Back' : 'Start Over'}
        </button>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: TEXT }}>Import Restaurants</h1>
        <div style={{ width: 80 }} />
      </div>

      {/* Step indicator */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginBottom: 32 }}>
        {stepNames.map((label, i) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: i <= currentIdx ? ACCENT : 'rgba(255,255,255,0.1)',
            }} />
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1,
              textTransform: 'uppercase' as const,
              color: i <= currentIdx ? TEXT_SEC : TEXT_TER,
            }}>
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 12,
          border: `1px solid ${DANGER}`,
          backgroundColor: 'rgba(220,38,38,0.08)',
          color: DANGER,
          fontSize: 14,
          marginBottom: 20,
        }}>
          {error}
        </div>
      )}

      {/* Step 1: Source */}
      {step === 'source' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <SourceCard
            icon="📄"
            title="CSV / Paste Text"
            desc="Paste or upload a CSV file with restaurant names, addresses, and details"
            onClick={() => handleSourceSelect('csv')}
          />
          <SourceCard
            icon="📍"
            title="Google Maps Export"
            desc="Paste your Google Maps Saved Places JSON export (GeoJSON)"
            onClick={() => handleSourceSelect('google_maps')}
          />
        </div>
      )}

      {/* Step 2: Input */}
      {step === 'input' && (
        <div style={{ display: 'grid', gap: 20 }}>
          <p style={{ margin: 0, fontSize: 14, color: TEXT_SEC, lineHeight: 1.5 }}>
            {source === 'google_maps'
              ? 'Paste the contents of your Google Maps Saved Places export (GeoJSON format), or upload the .json file.'
              : 'Paste CSV data or upload a .csv file. Headers should include: name, address, city, cuisine, rating, price, notes, etc.'}
          </p>

          {/* File upload */}
          <div>
            <input
              ref={fileRef}
              type="file"
              accept={source === 'google_maps' ? '.json' : '.csv,.txt'}
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              style={{
                ...secondaryButtonStyle,
                width: '100%',
                marginBottom: 12,
              }}
            >
              Upload {source === 'google_maps' ? '.json' : '.csv'} File
            </button>
          </div>

          <div>
            <label style={labelStyle}>Or paste content directly</label>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={
                source === 'google_maps'
                  ? '{"type":"FeatureCollection","features":[...]}'
                  : 'name,address,city,cuisine\nBestia,2121 E 7th Pl,Los Angeles,Italian'
              }
              rows={14}
              style={{
                ...inputStyle,
                fontFamily: 'monospace',
                resize: 'vertical' as const,
                minHeight: 200,
              }}
            />
          </div>

          <button
            type="button"
            onClick={handleParse}
            disabled={!rawText.trim()}
            style={{
              ...primaryButtonStyle,
              opacity: rawText.trim() ? 1 : 0.4,
              cursor: rawText.trim() ? 'pointer' : 'default',
            }}
          >
            Parse
          </button>
        </div>
      )}

      {/* Step 3: Preview */}
      {step === 'preview' && (
        <div style={{ display: 'grid', gap: 20 }}>
          <div style={{
            display: 'inline-flex',
            backgroundColor: ACCENT_DIM,
            padding: '8px 16px',
            borderRadius: 10,
            alignSelf: 'flex-start',
          }}>
            <span style={{ color: ACCENT, fontSize: 14, fontWeight: 600 }}>
              Found {previewRows.length} restaurant{previewRows.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Preview table */}
          <div style={{
            borderRadius: 14,
            border: '1px solid var(--border)',
            overflow: 'hidden',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--surface)' }}>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Address</th>
                  <th style={thStyle}>City</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.slice(0, 50).map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ ...tdStyle, color: TEXT }}>{row.name}</td>
                    <td style={tdStyle}>{row.address || '-'}</td>
                    <td style={tdStyle}>{row.city || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {previewRows.length > 50 && (
              <p style={{ padding: '10px 14px', margin: 0, fontSize: 13, color: TEXT_TER }}>
                Showing first 50 of {previewRows.length} rows
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              onClick={() => setStep('input')}
              style={secondaryButtonStyle}
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => void handleImport()}
              disabled={isImporting}
              style={{
                ...primaryButtonStyle,
                flex: 1,
                opacity: isImporting ? 0.6 : 1,
              }}
            >
              {isImporting ? 'Importing...' : `Import ${previewRows.length} Restaurant${previewRows.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Result */}
      {step === 'result' && result && (
        <div style={{ display: 'grid', gap: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <ResultCard value={result.imported} label="Imported" color={SUCCESS} />
            <ResultCard value={result.skipped} label="Skipped" color={TEXT_SEC} />
            <ResultCard value={result.errors.length} label="Errors" color={result.errors.length > 0 ? DANGER : TEXT_SEC} />
          </div>

          {result.errors.length > 0 && (
            <div style={{
              backgroundColor: 'rgba(220,38,38,0.06)',
              borderRadius: 14,
              padding: 20,
            }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase' as const, color: DANGER }}>
                Errors
              </h3>
              {result.errors.slice(0, 10).map((e, i) => (
                <p key={i} style={{ margin: '0 0 6px', fontSize: 13, color: TEXT_SEC }}>
                  Row {e.row}: {e.reason}
                </p>
              ))}
              {result.errors.length > 10 && (
                <p style={{ margin: 0, fontSize: 13, color: TEXT_TER }}>
                  + {result.errors.length - 10} more
                </p>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12 }}>
            <Link href="/dining" style={{ textDecoration: 'none', flex: 1 }}>
              <button type="button" style={{ ...primaryButtonStyle, width: '100%' }}>
                View Restaurants
              </button>
            </Link>
            <button type="button" onClick={handleReset} style={secondaryButtonStyle}>
              Import More
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SourceCard({ icon, title, desc, onClick }: {
  icon: string;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        padding: 24,
        borderRadius: 16,
        border: '1px solid var(--border)',
        backgroundColor: 'var(--glass)',
        cursor: 'pointer',
        textAlign: 'left' as const,
        fontFamily: 'inherit',
        width: '100%',
      }}
    >
      <span style={{ fontSize: 32 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 16, fontWeight: 600, color: TEXT, marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 13, color: TEXT_SEC, lineHeight: 1.4 }}>{desc}</div>
      </div>
    </button>
  );
}

function ResultCard({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div style={{
      textAlign: 'center' as const,
      padding: 24,
      borderRadius: 16,
      border: '1px solid var(--border)',
      backgroundColor: 'var(--glass)',
    }}>
      <div style={{ fontSize: 32, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase' as const, color: TEXT_TER, marginTop: 4 }}>
        {label}
      </div>
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  backgroundColor: 'var(--surface)',
  color: 'var(--text)',
  fontSize: 15,
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 1.2,
  color: 'var(--text-tertiary)',
  textTransform: 'uppercase',
  marginBottom: 8,
  display: 'block',
};

const primaryButtonStyle: CSSProperties = {
  padding: '16px',
  borderRadius: 14,
  border: 'none',
  backgroundColor: ACCENT,
  color: '#FFFFFF',
  fontSize: 16,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const secondaryButtonStyle: CSSProperties = {
  padding: '16px 24px',
  borderRadius: 14,
  border: '1px solid var(--border)',
  backgroundColor: 'transparent',
  color: 'var(--text-secondary)',
  fontSize: 16,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const linkButtonStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  color: ACCENT,
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
  padding: 0,
  width: 80,
  textAlign: 'left',
};

const thStyle: CSSProperties = {
  padding: '10px 14px',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 1,
  textTransform: 'uppercase',
  color: 'var(--text-tertiary)',
  textAlign: 'left',
  borderBottom: '1px solid var(--border)',
};

const tdStyle: CSSProperties = {
  padding: '10px 14px',
  fontSize: 14,
  color: 'var(--text-secondary)',
};
