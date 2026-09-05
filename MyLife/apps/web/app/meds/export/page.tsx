'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { generateReport } from '../actions';

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '2rem', maxWidth: 960, margin: '0 auto' },
  header: { marginBottom: '2rem' },
  title: { fontSize: '1.75rem', fontWeight: 700, color: 'var(--text)', margin: 0 },
  subtitle: { fontSize: '0.95rem', color: 'var(--text-secondary)', marginTop: '0.25rem' },
  backLink: { color: 'var(--accent-meds)', textDecoration: 'none', fontSize: '0.85rem', display: 'inline-block', marginBottom: '0.75rem' },
  section: { marginBottom: '2rem' },
  sectionTitle: { fontSize: '1.15rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.75rem' },
  form: { background: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', marginBottom: '1.5rem' },
  formRow: { display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' as const, alignItems: 'center' as const },
  label: { fontSize: '0.85rem', color: 'var(--text-secondary)', minWidth: 40 },
  input: {
    flex: '1 1 140px', background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.75rem', fontSize: '0.85rem',
    color: 'var(--text)', outline: 'none',
  },
  btnRow: { display: 'flex', gap: '0.75rem', marginTop: '0.5rem' },
  btnPrimary: {
    background: 'var(--accent-meds)', color: '#fff', border: 'none',
    borderRadius: 'var(--radius-md)', padding: '0.5rem 1.25rem', fontSize: '0.85rem',
    fontWeight: 600, cursor: 'pointer',
  },
  btnSecondary: {
    background: 'transparent', color: 'var(--accent-meds)', border: '1px solid var(--accent-meds)',
    borderRadius: 'var(--radius-md)', padding: '0.5rem 1.25rem', fontSize: '0.85rem',
    fontWeight: 600, cursor: 'pointer',
  },
  btnCopy: {
    background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', padding: '0.3rem 0.65rem', fontSize: '0.75rem',
    cursor: 'pointer',
  },
  previewContainer: {
    background: 'var(--surface-elevated)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)', padding: '1.25rem', marginTop: '1rem',
  },
  previewHeader: {
    display: 'flex', justifyContent: 'space-between' as const, alignItems: 'center' as const,
    marginBottom: '0.75rem',
  },
  previewLabel: { fontWeight: 600, fontSize: '0.95rem', color: 'var(--text)' },
  previewContent: {
    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
    padding: '1rem', fontSize: '0.8rem', color: 'var(--text)', fontFamily: 'monospace',
    whiteSpace: 'pre-wrap' as const, maxHeight: 500, overflow: 'auto' as const,
    lineHeight: 1.6,
  },
  copied: { fontSize: '0.75rem', color: 'var(--accent-meds)', fontWeight: 600 },
  empty: { textAlign: 'center' as const, color: 'var(--text-tertiary)', padding: '2rem', fontSize: '0.9rem' },
};

export default function ExportPage() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  const [from, setFrom] = useState(thirtyDaysAgo);
  const [to, setTo] = useState(today);
  const [report, setReport] = useState<string | null>(null);
  const [reportType, setReportType] = useState<'doctor' | 'therapy' | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = useCallback(async (type: 'doctor' | 'therapy') => {
    setGenerating(true);
    setCopied(false);
    try {
      const result = await generateReport(type, from, to + 'T23:59:59');
      setReport(result as string);
      setReportType(type);
    } catch (err) {
      console.error('Failed to generate report:', err);
      setReport('Error generating report. Please try again.');
      setReportType(type);
    } finally {
      setGenerating(false);
    }
  }, [from, to]);

  const handleCopy = useCallback(async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = report;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [report]);

  return (
    <div style={styles.page}>
      <Link href="/meds" style={styles.backLink}>Back to Medications</Link>
      <div style={styles.header}>
        <h1 style={styles.title}>Export Reports</h1>
        <p style={styles.subtitle}>Generate shareable health reports for doctor visits or therapy sessions</p>
      </div>

      {/* Date Range Selection */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Date Range</h2>
        <div style={styles.form}>
          <div style={styles.formRow}>
            <span style={styles.label}>From</span>
            <input
              style={styles.input}
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
            <span style={styles.label}>To</span>
            <input
              style={styles.input}
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div style={styles.btnRow}>
            <button
              style={{ ...styles.btnPrimary, opacity: generating ? 0.5 : 1 }}
              onClick={() => handleGenerate('doctor')}
              disabled={generating}
            >
              {generating && reportType === 'doctor' ? 'Generating...' : 'Doctor Report'}
            </button>
            <button
              style={{ ...styles.btnSecondary, opacity: generating ? 0.5 : 1 }}
              onClick={() => handleGenerate('therapy')}
              disabled={generating}
            >
              {generating && reportType === 'therapy' ? 'Generating...' : 'Therapy Report'}
            </button>
          </div>
        </div>
      </div>

      {/* Report Preview */}
      {report && (
        <div style={styles.section}>
          <div style={styles.previewContainer}>
            <div style={styles.previewHeader}>
              <span style={styles.previewLabel}>
                {reportType === 'therapy' ? 'Therapy Report' : 'Doctor Report'} Preview
              </span>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {copied && <span style={styles.copied}>Copied!</span>}
                <button style={styles.btnCopy} onClick={handleCopy}>
                  Copy to Clipboard
                </button>
              </div>
            </div>
            <pre style={styles.previewContent}>{report}</pre>
          </div>
        </div>
      )}

      {!report && (
        <div style={styles.empty}>
          Select a date range and report type above to generate a report.
        </div>
      )}
    </div>
  );
}
