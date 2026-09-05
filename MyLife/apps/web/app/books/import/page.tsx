'use client';

import { useState, useRef, useCallback } from 'react';
import { importFromCSV } from '../actions';

type ImportSource = 'goodreads' | 'storygraph';
type ImportTab = 'importData' | 'search';

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

interface PreviewRow {
  title: string;
  author: string;
  rating: number;
  status: 'ready' | 'duplicate' | 'error';
}

const ACCENT = 'var(--accent-books)';
const ACCENT_DIM = 'rgba(201,137,77,0.15)';
const ACCENT_BORDER = 'rgba(201,137,77,0.25)';
const TEXT = 'var(--text)';
const TEXT_SEC = 'var(--text-secondary)';
const TEXT_TER = 'var(--text-tertiary)';
const SURFACE = 'var(--surface)';
const BORDER = 'var(--border)';
const GLASS = 'var(--glass)';
const DANGER = 'var(--danger)';

const GOODREADS_STEPS = [
  <>Go to <strong style={{ color: ACCENT }}>Goodreads</strong> and find the <strong>Import and Export</strong> in the left sidebar menu.</>,
  <>Click the <strong style={{ color: ACCENT }}>Export Library</strong> button at the top right. Wait for the generation to complete.</>,
  <>Download your CSV file and drop it below.</>,
];

const STORYGRAPH_STEPS = [
  <>Go to <strong style={{ color: ACCENT }}>StoryGraph</strong> and navigate to <strong>Settings</strong>.</>,
  <>Find the <strong style={{ color: ACCENT }}>Export</strong> section and click <strong>Export your library</strong>.</>,
  <>Download the CSV and drop it below.</>,
];

function parseCSVPreview(csvText: string): PreviewRow[] {
  const lines = csvText.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];

  const header = lines[0].toLowerCase();
  const titleIdx = header.split(',').findIndex((h) => h.includes('title'));
  const authorIdx = header.split(',').findIndex((h) => h.includes('author'));
  const ratingIdx = header.split(',').findIndex((h) => h.includes('rating'));

  return lines.slice(1, 8).map((line) => {
    const cols = line.split(',').map((c) => c.replace(/^"|"$/g, '').trim());
    return {
      title: cols[titleIdx] ?? 'Unknown',
      author: cols[authorIdx] ?? 'Unknown',
      rating: parseInt(cols[ratingIdx] ?? '0') || 0,
      status: 'ready' as const,
    };
  });
}

function StatusDot({ status }: { status: PreviewRow['status'] }) {
  const color = status === 'ready' ? '#30D158' : status === 'duplicate' ? ACCENT : DANGER;
  return (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: 999,
        backgroundColor: color,
        flexShrink: 0,
      }}
    />
  );
}

export default function BooksImportPage() {
  const [source, setSource] = useState<ImportSource>('goodreads');
  const [activeTab, setActiveTab] = useState<ImportTab>('importData');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [totalLines, setTotalLines] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    setResult(null);
    setImportError(null);
    const text = await f.text();
    const lines = text.split('\n').filter((l) => l.trim());
    setTotalLines(Math.max(0, lines.length - 1));
    setPreview(parseCSVPreview(text));
  }, []);

  async function handleImport() {
    if (!file) return;

    setIsImporting(true);
    setImportError(null);
    try {
      const csvText = await file.text();
      const nextResult = await importFromCSV(source, csvText);
      setResult(nextResult);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed. Please check your CSV file.');
    } finally {
      setIsImporting(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith('.csv') || droppedFile.type === 'text/csv')) {
      void handleFile(droppedFile);
    }
  }

  const steps = source === 'goodreads' ? GOODREADS_STEPS : STORYGRAPH_STEPS;

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: 0 }}>
              {(['importData', 'search'] as ImportTab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: '8px 16px',
                    border: 'none',
                    borderBottom: activeTab === tab ? `2px solid ${ACCENT}` : '2px solid transparent',
                    backgroundColor: 'transparent',
                    color: activeTab === tab ? ACCENT : TEXT_TER,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {tab === 'importData' ? 'Import Data' : 'Search'}
                </button>
              ))}
            </div>
          </div>
          <input
            placeholder="Search collection..."
            style={{
              padding: '8px 14px',
              borderRadius: 10,
              border: `1px solid ${BORDER}`,
              backgroundColor: SURFACE,
              color: TEXT,
              fontSize: 13,
              fontFamily: 'inherit',
              outline: 'none',
              width: 200,
            }}
          />
        </div>

        <div style={{ marginTop: 20 }}>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, color: TEXT }}>
            Expand Your Sanctuary
          </h1>
          <p style={{ margin: '8px 0 0', color: TEXT_SEC, fontSize: 14, maxWidth: 520 }}>
            Sync your external collections from Goodreads or StoryGraph. We&apos;ll curate your data into the Obsidian format with archival precision.
          </p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 320px',
          gap: 24,
          alignItems: 'start',
        }}
      >
        {/* Left Column */}
        <div style={{ display: 'grid', gap: 20 }}>
          {/* 1. Select Source */}
          <section
            style={{
              padding: 20,
              borderRadius: 16,
              backgroundColor: SURFACE,
              border: `1px solid ${BORDER}`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, letterSpacing: 1.2, color: TEXT_TER, textTransform: 'uppercase' }}>
                1. Select Source
              </h2>
              <span style={{ fontSize: 11, fontWeight: 600, color: TEXT_TER, textTransform: 'uppercase', letterSpacing: 1 }}>
                Step 1 of 3
              </span>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {(['goodreads', 'storygraph'] as ImportSource[]).map((option) => {
                const active = source === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setSource(option)}
                    style={{
                      padding: '10px 20px',
                      borderRadius: 999,
                      border: active ? `1px solid ${ACCENT}` : `1px solid ${BORDER}`,
                      backgroundColor: active ? ACCENT : 'transparent',
                      color: active ? '#131318' : TEXT_SEC,
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {option === 'goodreads' ? 'Goodreads' : 'StoryGraph'}
                  </button>
                );
              })}
            </div>
          </section>

          {/* 2. How to Export */}
          <section
            style={{
              padding: 20,
              borderRadius: 16,
              backgroundColor: SURFACE,
              border: `1px solid ${BORDER}`,
            }}
          >
            <h2 style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, letterSpacing: 1.2, color: TEXT_TER, textTransform: 'uppercase' }}>
              2. How to Export
            </h2>
            <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 10 }}>
              {steps.map((step, i) => (
                <li key={i} style={{ color: TEXT_SEC, fontSize: 14, lineHeight: 1.6 }}>
                  {step}
                </li>
              ))}
            </ol>
          </section>

          {/* 3. Drop Zone */}
          <section
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            style={{
              padding: 40,
              borderRadius: 16,
              border: `2px dashed ${isDragging ? ACCENT : ACCENT_BORDER}`,
              backgroundColor: isDragging ? ACCENT_DIM : SURFACE,
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                const f = event.target.files?.[0];
                if (f) void handleFile(f);
              }}
              style={{ display: 'none' }}
            />
            <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.8 }}>&#9729;</div>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: TEXT }}>
              {file ? file.name : 'Drop your CSV here'}
            </p>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: TEXT_TER }}>
              Or click to browse your local library files
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              style={{
                marginTop: 16,
                padding: '10px 24px',
                borderRadius: 10,
                border: `1px solid ${ACCENT_BORDER}`,
                backgroundColor: ACCENT_DIM,
                color: ACCENT,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Choose File
            </button>
          </section>
        </div>

        {/* Right Column */}
        <div style={{ display: 'grid', gap: 20 }}>
          {/* Import Preview */}
          <section
            style={{
              padding: 20,
              borderRadius: 16,
              backgroundColor: SURFACE,
              border: `1px solid ${BORDER}`,
            }}
          >
            <h2 style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, letterSpacing: 1.2, color: TEXT_TER, textTransform: 'uppercase' }}>
              Import Preview
            </h2>

            {preview.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center' }}>
                <p style={{ margin: 0, color: TEXT_TER, fontSize: 13 }}>
                  Select a CSV file to preview
                </p>
              </div>
            ) : (
              <>
                {/* Table Header */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto auto',
                    gap: 8,
                    padding: '8px 0',
                    borderBottom: `1px solid ${BORDER}`,
                    marginBottom: 4,
                  }}
                >
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: TEXT_TER, textTransform: 'uppercase' }}>Title</span>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: TEXT_TER, textTransform: 'uppercase' }}>Author</span>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: TEXT_TER, textTransform: 'uppercase' }}>Rating</span>
                </div>

                {/* Rows */}
                {preview.map((row, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto auto',
                      gap: 8,
                      padding: '10px 0',
                      borderBottom: i < preview.length - 1 ? `1px solid rgba(255,255,255,0.03)` : 'none',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <StatusDot status={row.status} />
                      <span
                        style={{
                          fontSize: 13,
                          color: TEXT,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {row.title}
                      </span>
                    </div>
                    <span style={{ fontSize: 12, color: TEXT_SEC, whiteSpace: 'nowrap' }}>{row.author}</span>
                    <span style={{ fontSize: 12, color: ACCENT }}>{row.rating > 0 ? '★'.repeat(row.rating) : '-'}</span>
                  </div>
                ))}

                {totalLines > preview.length && (
                  <p style={{ margin: '8px 0 0', fontSize: 11, color: TEXT_TER, textAlign: 'center' }}>
                    +{totalLines - preview.length} more books
                  </p>
                )}

                {/* Import Button */}
                <button
                  type="button"
                  onClick={() => void handleImport()}
                  disabled={isImporting}
                  style={{
                    marginTop: 16,
                    width: '100%',
                    padding: '14px 0',
                    borderRadius: 12,
                    border: 'none',
                    background: isImporting
                      ? TEXT_TER
                      : `linear-gradient(135deg, ${ACCENT}, #E6A050)`,
                    color: '#131318',
                    fontSize: 14,
                    fontWeight: 800,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    cursor: isImporting ? 'default' : 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {isImporting ? 'Importing...' : `Import ${totalLines} Books`}
                </button>
              </>
            )}
          </section>

          {/* Previous Batch Summary */}
          {result && (
            <section
              style={{
                padding: 20,
                borderRadius: 16,
                backgroundColor: SURFACE,
                border: `1px solid ${BORDER}`,
              }}
            >
              <h2 style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 700, letterSpacing: 1.2, color: TEXT_TER, textTransform: 'uppercase' }}>
                Previous Batch Summary
              </h2>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    padding: 16,
                    borderRadius: 12,
                    backgroundColor: ACCENT_DIM,
                    border: `1px solid ${ACCENT_BORDER}`,
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: TEXT_TER, textTransform: 'uppercase', marginBottom: 4 }}>
                    Books Imported
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: ACCENT }}>{result.imported}</div>
                </div>
                <div
                  style={{
                    padding: 16,
                    borderRadius: 12,
                    backgroundColor: GLASS,
                    border: `1px solid ${BORDER}`,
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: TEXT_TER, textTransform: 'uppercase', marginBottom: 4 }}>
                    Errors
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: TEXT }}>{result.errors.length}</div>
                </div>
              </div>

              {result.skipped > 0 && (
                <div style={{ padding: '10px 14px', borderRadius: 10, backgroundColor: ACCENT_DIM, border: `1px solid ${ACCENT_BORDER}`, marginBottom: 12 }}>
                  <span style={{ fontSize: 12, color: ACCENT, fontWeight: 600 }}>
                    {result.skipped} duplicate{result.skipped !== 1 ? 's' : ''} skipped
                  </span>
                </div>
              )}

              {result.errors.length > 0 && (
                <div style={{ display: 'grid', gap: 6 }}>
                  {result.errors.slice(0, 5).map((error, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 8,
                        backgroundColor: 'rgba(255,180,171,0.06)',
                        border: '1px solid rgba(255,180,171,0.12)',
                        fontSize: 12,
                        color: DANGER,
                        lineHeight: 1.4,
                      }}
                    >
                      {error}
                    </div>
                  ))}
                  {result.errors.length > 5 && (
                    <p style={{ margin: 0, fontSize: 11, color: TEXT_TER, textAlign: 'center' }}>
                      +{result.errors.length - 5} more errors
                    </p>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Error State */}
          {importError && (
            <section
              style={{
                padding: 20,
                borderRadius: 16,
                border: `1px dashed ${DANGER}`,
                backgroundColor: GLASS,
                textAlign: 'center',
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16, color: DANGER }}>Import failed</h3>
              <p style={{ margin: '8px 0 0', fontSize: 13, color: TEXT_SEC }}>{importError}</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
