'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  fetchReaderDocumentsAction,
  createReaderDocumentAction,
} from '../actions';

interface ReaderDocumentSummary {
  id: string;
  title: string;
  author?: string | null;
  progress_percent?: number | null;
  total_words?: number | null;
  updated_at?: string | null;
  last_opened_at?: string | null;
  file_name?: string | null;
  file_extension?: string | null;
  source_type?: string | null;
}

type ViewMode = 'grid' | 'list';
type SortKey = 'last_opened_at' | 'updated_at' | 'created_at' | 'title';

const ACCENT = 'var(--accent-books)';
const ACCENT_DIM = 'rgba(201,137,77,0.15)';
const ACCENT_BORDER = 'rgba(201,137,77,0.25)';
const TEXT = 'var(--text)';
const TEXT_SEC = 'var(--text-secondary)';
const SURFACE = 'var(--surface)';
const SURFACE_EL = 'var(--surface-elevated)';
const BORDER = 'var(--border)';
const GLASS = 'var(--glass)';
const BG = 'var(--background)';

function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

function pillStyle(active: boolean): CSSProperties {
  return {
    borderRadius: 999,
    border: active ? `1px solid ${ACCENT}` : `1px solid ${BORDER}`,
    backgroundColor: active ? ACCENT : 'transparent',
    color: active ? BG : TEXT_SEC,
    padding: '8px 16px',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  };
}

export default function ReaderLibraryPage() {
  const [documents, setDocuments] = useState<ReaderDocumentSummary[]>([]);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortKey, setSortKey] = useState<SortKey>('last_opened_at');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocuments = useCallback(() => {
    void fetchReaderDocumentsAction({
      search: search || undefined,
      sort_by: sortKey,
      sort_dir: 'DESC',
    }).then((result) => {
      setDocuments(result as ReaderDocumentSummary[]);
    });
  }, [search, sortKey]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const currentlyReading = documents.find(
    (d) => (d.progress_percent ?? 0) > 0 && (d.progress_percent ?? 0) < 100,
  );

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const text = await file.text();
        const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
        await createReaderDocumentAction({
          title: file.name.replace(/\.[^.]+$/, ''),
          text_content: text,
          file_name: file.name,
          file_extension: ext,
          mime_type: file.type || null,
          source_type: 'upload',
        });
      }
      loadDocuments();
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    void handleFiles(e.dataTransfer.files);
  }

  const manuscripts = documents.filter(
    (d) => d.id !== currentlyReading?.id,
  );

  return (
    <div style={{ display: 'grid', gap: 28 }}>
      {/* Header */}
      <section>
        <h1 style={{ margin: 0, fontSize: 34, fontWeight: 800, color: TEXT }}>
          Private Reader
        </h1>
        <p style={{ margin: '8px 0 0', color: TEXT_SEC, fontSize: 15 }}>
          Manage your intellectual collection and continue your progress.
        </p>
      </section>

      {/* Toolbar: search + view toggle + sort */}
      <section
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <input
          type="text"
          placeholder="Search manuscripts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: '1 1 220px',
            padding: '10px 16px',
            borderRadius: 14,
            border: `1px solid ${BORDER}`,
            backgroundColor: SURFACE,
            color: TEXT,
            fontSize: 14,
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: 0 }}>
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            style={{
              ...pillStyle(viewMode === 'grid'),
              borderTopRightRadius: 0,
              borderBottomRightRadius: 0,
              borderRight: viewMode === 'grid' ? undefined : 'none',
            }}
          >
            Grid
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            style={{
              ...pillStyle(viewMode === 'list'),
              borderTopLeftRadius: 0,
              borderBottomLeftRadius: 0,
            }}
          >
            List
          </button>
        </div>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          style={{
            padding: '10px 14px',
            borderRadius: 14,
            border: `1px solid ${BORDER}`,
            backgroundColor: SURFACE,
            color: TEXT_SEC,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          <option value="last_opened_at">Last Opened</option>
          <option value="updated_at">Recently Updated</option>
          <option value="created_at">Date Added</option>
          <option value="title">Title</option>
        </select>
      </section>

      {/* Currently Reading Hero */}
      {currentlyReading && (
        <section
          style={{
            display: 'flex',
            gap: 28,
            padding: 28,
            borderRadius: 24,
            backgroundColor: SURFACE_EL,
            border: `1px solid ${BORDER}`,
            flexWrap: 'wrap',
          }}
        >
          {/* Cover placeholder */}
          <div
            style={{
              width: 140,
              minWidth: 140,
              aspectRatio: '2 / 3',
              borderRadius: 16,
              background: `linear-gradient(145deg, ${ACCENT_DIM} 0%, rgba(201,137,77,0.35) 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 42,
            }}
          >
            📖
          </div>
          <div style={{ flex: 1, minWidth: 200, display: 'grid', gap: 10, alignContent: 'center' }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                color: ACCENT,
              }}
            >
              Currently Reading
            </span>
            <h2 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: TEXT, lineHeight: 1.15 }}>
              {currentlyReading.title}
            </h2>
            <p style={{ margin: 0, color: TEXT_SEC, fontSize: 15 }}>
              {currentlyReading.author ?? 'Unknown author'}
            </p>

            {/* Progress bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
              <div
                style={{
                  flex: 1,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${Math.round(currentlyReading.progress_percent ?? 0)}%`,
                    height: '100%',
                    borderRadius: 3,
                    backgroundColor: ACCENT,
                  }}
                />
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: ACCENT, whiteSpace: 'nowrap' }}>
                {Math.round(currentlyReading.progress_percent ?? 0)}% Complete
              </span>
            </div>

            <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
              {currentlyReading.total_words ? (
                <span style={{ fontSize: 13, color: TEXT_SEC }}>
                  {currentlyReading.total_words.toLocaleString()} words
                </span>
              ) : null}
              <Link
                href={`/books/reader/${currentlyReading.id}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '10px 22px',
                  borderRadius: 999,
                  backgroundColor: ACCENT,
                  color: BG,
                  fontWeight: 700,
                  fontSize: 14,
                  textDecoration: 'none',
                  letterSpacing: 0.3,
                }}
              >
                Resume
              </Link>
              {currentlyReading.last_opened_at && (
                <span style={{ fontSize: 12, color: TEXT_SEC, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  Last opened {timeAgo(currentlyReading.last_opened_at)}
                </span>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Upload section */}
      <section
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{
          display: 'flex',
          gap: 20,
          padding: 24,
          borderRadius: 24,
          border: dragOver
            ? `2px dashed ${ACCENT}`
            : `1px solid ${BORDER}`,
          backgroundColor: dragOver ? ACCENT_DIM : SURFACE,
          alignItems: 'center',
          flexWrap: 'wrap',
          transition: 'border-color 0.15s, background-color 0.15s',
        }}
      >
        <div style={{ flex: 1, minWidth: 200 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: TEXT }}>
            Upload manuscripts
          </h3>
          <p style={{ margin: '6px 0 0', color: TEXT_SEC, fontSize: 14 }}>
            Drag and drop PDF, EPUB, or MOBI files into your sanctuary.
          </p>
        </div>
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          style={{
            padding: '10px 22px',
            borderRadius: 14,
            border: `1px solid ${ACCENT_BORDER}`,
            backgroundColor: ACCENT_DIM,
            color: ACCENT,
            fontWeight: 700,
            fontSize: 14,
            cursor: uploading ? 'wait' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {uploading ? 'Uploading...' : 'Select Files'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.epub,.mobi,.txt"
          style={{ display: 'none' }}
          onChange={(e) => void handleFiles(e.target.files)}
        />
      </section>

      {/* Manuscripts grid */}
      <section>
        <h2 style={{ margin: '0 0 16px', fontSize: 22, fontWeight: 700, color: TEXT }}>
          Your Manuscripts{' '}
          <span style={{ color: TEXT_SEC, fontWeight: 500, fontSize: 16 }}>
            ({manuscripts.length})
          </span>
        </h2>

        {manuscripts.length === 0 && !currentlyReading ? (
          <div
            style={{
              padding: 40,
              borderRadius: 24,
              border: `1px dashed ${ACCENT_BORDER}`,
              backgroundColor: GLASS,
              textAlign: 'center',
            }}
          >
            <p style={{ margin: 0, fontSize: 42 }}>📚</p>
            <h3 style={{ margin: '12px 0 0', fontSize: 20, color: TEXT }}>
              No manuscripts yet
            </h3>
            <p style={{ margin: '8px auto 0', maxWidth: 380, color: TEXT_SEC, fontSize: 14 }}>
              Upload documents to read them privately alongside your book collection.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                viewMode === 'grid'
                  ? 'repeat(auto-fill, minmax(200px, 1fr))'
                  : '1fr',
              gap: 16,
            }}
          >
            {manuscripts.map((doc) => (
              <ManuscriptCard key={doc.id} doc={doc} viewMode={viewMode} />
            ))}
            {/* Add button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: viewMode === 'grid' ? 260 : 72,
                borderRadius: 20,
                border: `1px dashed ${BORDER}`,
                backgroundColor: 'transparent',
                color: TEXT_SEC,
                fontSize: 32,
                cursor: 'pointer',
              }}
            >
              +
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function ManuscriptCard({
  doc,
  viewMode,
}: {
  doc: ReaderDocumentSummary;
  viewMode: ViewMode;
}) {
  const isCompleted = (doc.progress_percent ?? 0) >= 100;
  const updated = timeAgo(doc.updated_at);

  if (viewMode === 'list') {
    return (
      <Link
        href={`/books/reader/${doc.id}`}
        style={{
          display: 'flex',
          gap: 16,
          padding: 16,
          borderRadius: 20,
          border: `1px solid ${BORDER}`,
          backgroundColor: SURFACE,
          textDecoration: 'none',
          color: TEXT,
          alignItems: 'center',
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: `linear-gradient(135deg, ${ACCENT_DIM} 0%, rgba(201,137,77,0.3) 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            flexShrink: 0,
          }}
        >
          📄
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h4
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 700,
              color: TEXT,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {doc.title}
          </h4>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: TEXT_SEC }}>
            {doc.author ?? 'Unknown author'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
          {isCompleted && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 1,
                textTransform: 'uppercase',
                color: 'var(--success, #30D158)',
                padding: '4px 10px',
                borderRadius: 8,
                backgroundColor: 'rgba(48,209,88,0.12)',
              }}
            >
              Completed
            </span>
          )}
          <span style={{ fontSize: 12, color: TEXT_SEC }}>{updated}</span>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/books/reader/${doc.id}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 20,
        border: `1px solid ${BORDER}`,
        backgroundColor: SURFACE,
        textDecoration: 'none',
        color: TEXT,
        overflow: 'hidden',
      }}
    >
      {/* Cover */}
      <div
        style={{
          width: '100%',
          aspectRatio: '4 / 3',
          background: `linear-gradient(145deg, ${ACCENT_DIM} 0%, rgba(201,137,77,0.35) 100%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 42,
          position: 'relative',
        }}
      >
        📄
        {isCompleted && (
          <span
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 1,
              textTransform: 'uppercase',
              color: 'var(--success, #30D158)',
              padding: '4px 8px',
              borderRadius: 6,
              backgroundColor: 'rgba(0,0,0,0.6)',
            }}
          >
            Completed
          </span>
        )}
      </div>
      {/* Info */}
      <div style={{ padding: '14px 16px 16px' }}>
        <h4
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 700,
            color: TEXT,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {doc.title}
        </h4>
        <p
          style={{
            margin: '4px 0 0',
            fontSize: 13,
            color: TEXT_SEC,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {doc.author ?? 'Unknown author'}
        </p>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 8,
          }}
        >
          <span style={{ fontSize: 12, color: TEXT_SEC }}>{updated}</span>
          {!isCompleted && (doc.progress_percent ?? 0) > 0 && (
            <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>
              {Math.round(doc.progress_percent ?? 0)}%
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
