'use client';

import { useState } from 'react';
import Link from 'next/link';
import { doGenerateDoctorReport, doGenerateTherapyReport } from '../actions';

const T = {
  bg: '#131318',
  depth: '#0E0E13',
  low: '#1B1B20',
  mid: '#1F1F25',
  high: '#2A292F',
  highest: '#35343A',
  text: '#E4E1E9',
  textSecondary: '#D6C3B5',
  textDim: 'rgba(228,225,233,0.5)',
  textFaint: 'rgba(228,225,233,0.35)',
  border: 'rgba(255,255,255,0.06)',
  accent: '#EF4444',
  accentDim: 'rgba(239,68,68,0.15)',
} as const;

const font = "'Plus Jakarta Sans', -apple-system, system-ui, sans-serif";

type Format = 'txt' | 'pdf' | 'csv';
type DataType = 'all' | 'vitals' | 'sleep' | 'mood' | 'meds';
type ReportKind = 'doctor' | 'therapy';

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: T.bg,
    color: T.text,
    fontFamily: font,
    padding: '40px 32px 120px',
  },
  container: { maxWidth: 960, margin: '0 auto' },
  backLink: {
    color: T.textDim,
    textDecoration: 'none',
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
    display: 'inline-block',
    marginBottom: 24,
  },
  title: {
    fontSize: 40,
    fontWeight: 800,
    letterSpacing: '-0.02em',
    color: T.text,
    margin: 0,
  },
  subtitle: {
    fontSize: 14,
    color: T.textSecondary,
    marginTop: 8,
    marginBottom: 40,
  },

  twoCol: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 24,
    marginBottom: 32,
  },

  card: {
    background: T.low,
    borderRadius: 16,
    padding: 32,
    border: `1px solid ${T.border}`,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.2em',
    color: T.accent,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: T.text,
    marginBottom: 8,
  },
  cardDesc: {
    fontSize: 13,
    color: T.textSecondary,
    lineHeight: 1.6,
    marginBottom: 20,
  },

  fieldRow: { marginBottom: 16 },
  fieldLabel: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
    color: T.textDim,
    marginBottom: 8,
    display: 'block',
  },
  chipGroup: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  chip: {
    padding: '8px 16px',
    borderRadius: 9999,
    border: `1px solid ${T.border}`,
    background: T.depth,
    color: T.textSecondary,
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    cursor: 'pointer',
  },
  chipActive: {
    background: T.accent,
    borderColor: T.accent,
    color: '#fff',
  },
  input: {
    background: T.depth,
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 13,
    color: T.text,
    fontFamily: font,
    width: '100%',
    boxSizing: 'border-box',
  },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },

  previewPanel: {
    background: T.depth,
    border: `1px solid ${T.border}`,
    borderRadius: 12,
    padding: 20,
    marginTop: 16,
    maxHeight: 280,
    overflow: 'auto',
    whiteSpace: 'pre-wrap',
    fontFamily: "'SF Mono', Monaco, monospace",
    fontSize: 11,
    color: T.textSecondary,
    lineHeight: 1.6,
  },

  actionRow: {
    display: 'flex',
    gap: 12,
    marginTop: 24,
    paddingTop: 20,
    borderTop: `1px solid ${T.border}`,
  },
  btnPrimary: {
    padding: '12px 24px',
    borderRadius: 9999,
    background: T.accent,
    color: '#fff',
    border: 'none',
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    cursor: 'pointer',
  },
  btnOutline: {
    padding: '12px 24px',
    borderRadius: 9999,
    background: 'transparent',
    border: `1px solid ${T.border}`,
    color: T.text,
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    cursor: 'pointer',
  },
};

const FORMATS: { id: Format; label: string }[] = [
  { id: 'txt', label: 'Text' },
  { id: 'pdf', label: 'PDF' },
  { id: 'csv', label: 'CSV' },
];

const DATA_TYPES: { id: DataType; label: string }[] = [
  { id: 'all', label: 'All Data' },
  { id: 'vitals', label: 'Vitals' },
  { id: 'sleep', label: 'Sleep' },
  { id: 'mood', label: 'Mood' },
  { id: 'meds', label: 'Meds' },
];

export default function ExportPage() {
  const [format, setFormat] = useState<Format>('txt');
  const [dataType, setDataType] = useState<DataType>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [doctorReport, setDoctorReport] = useState<string | null>(null);
  const [therapyReport, setTherapyReport] = useState<string | null>(null);
  const [generating, setGenerating] = useState<ReportKind | null>(null);

  const handleGenerate = async (kind: ReportKind) => {
    setGenerating(kind);
    try {
      if (kind === 'doctor') {
        const report = await doGenerateDoctorReport();
        setDoctorReport(report);
      } else {
        const report = await doGenerateTherapyReport();
        setTherapyReport(report);
      }
    } catch (err) {
      console.error(`Failed to generate ${kind} report:`, err);
      if (kind === 'doctor') setDoctorReport('Failed to generate report.');
      else setTherapyReport('Failed to generate report.');
    } finally {
      setGenerating(null);
    }
  };

  const download = (text: string, name: string) => {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyText = (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(text);
    }
  };

  return (
    <div style={s.page}>
      <div style={s.container}>
        <Link href="/health" style={s.backLink}>
          ← MyHealth / Export
        </Link>
        <h1 style={s.title}>Data Export</h1>
        <p style={s.subtitle}>Generate reports and export your health data</p>

        {/* Configuration */}
        <div style={s.card}>
          <div style={s.sectionLabel}>Export Configuration</div>

          <div style={s.fieldRow}>
            <label style={s.fieldLabel}>Format</label>
            <div style={s.chipGroup}>
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  style={{ ...s.chip, ...(format === f.id ? s.chipActive : {}) }}
                  onClick={() => setFormat(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div style={s.fieldRow}>
            <label style={s.fieldLabel}>Data Type</label>
            <div style={s.chipGroup}>
              {DATA_TYPES.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  style={{ ...s.chip, ...(dataType === d.id ? s.chipActive : {}) }}
                  onClick={() => setDataType(d.id)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div style={s.fieldRow}>
            <label style={s.fieldLabel}>Date Range</label>
            <div style={s.row}>
              <input
                type="date"
                style={s.input}
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
              <input
                type="date"
                style={s.input}
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Reports */}
        <div style={{ ...s.twoCol, marginTop: 24 }}>
          {/* Doctor Report */}
          <div style={s.card}>
            <div style={s.sectionLabel}>Clinical</div>
            <div style={s.cardTitle}>Doctor Report</div>
            <div style={s.cardDesc}>
              90-day summary of medications, vitals, adherence, and health metrics. Share with your
              primary care provider.
            </div>
            <button
              type="button"
              style={{ ...s.btnPrimary, opacity: generating === 'doctor' ? 0.5 : 1 }}
              onClick={() => handleGenerate('doctor')}
              disabled={generating === 'doctor'}
            >
              {generating === 'doctor' ? 'Generating...' : 'Generate Report'}
            </button>
            {doctorReport && (
              <>
                <div style={s.previewPanel}>{doctorReport}</div>
                <div style={s.actionRow}>
                  <button
                    type="button"
                    style={s.btnOutline}
                    onClick={() => download(doctorReport, 'doctor-report.txt')}
                  >
                    Download
                  </button>
                  <button
                    type="button"
                    style={s.btnOutline}
                    onClick={() => copyText(doctorReport)}
                  >
                    Copy
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Therapy Report */}
          <div style={s.card}>
            <div style={s.sectionLabel}>Wellness</div>
            <div style={s.cardTitle}>Therapy Report</div>
            <div style={s.cardDesc}>
              Mood patterns, wellness timeline, and emotional health summary. Share with your
              therapist or counselor.
            </div>
            <button
              type="button"
              style={{ ...s.btnPrimary, opacity: generating === 'therapy' ? 0.5 : 1 }}
              onClick={() => handleGenerate('therapy')}
              disabled={generating === 'therapy'}
            >
              {generating === 'therapy' ? 'Generating...' : 'Generate Report'}
            </button>
            {therapyReport && (
              <>
                <div style={s.previewPanel}>{therapyReport}</div>
                <div style={s.actionRow}>
                  <button
                    type="button"
                    style={s.btnOutline}
                    onClick={() => download(therapyReport, 'therapy-report.txt')}
                  >
                    Download
                  </button>
                  <button
                    type="button"
                    style={s.btnOutline}
                    onClick={() => copyText(therapyReport)}
                  >
                    Copy
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
