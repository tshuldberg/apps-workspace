'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  doCreateDocument,
  doDeleteDocument,
  fetchDocuments,
} from '../actions';
import type { DocumentType } from '@mylife/health';

interface DocRow {
  id: string;
  title: string;
  type: DocumentType;
  mime_type: string;
  file_size: number;
  thumbnail: Uint8Array | Buffer | null;
  notes: string | null;
  document_date: string | null;
  is_starred: number;
  tags: string | null;
  created_at: string;
  updated_at: string;
}

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

const CATEGORIES: { id: DocumentType | 'all'; label: string; icon: string }[] = [
  { id: 'all', label: 'All', icon: '◉' },
  { id: 'lab_result', label: 'Labs', icon: '⚗' },
  { id: 'prescription', label: 'Rx', icon: '℞' },
  { id: 'imaging', label: 'Imaging', icon: '◎' },
  { id: 'vaccination', label: 'Vaccines', icon: '+' },
  { id: 'insurance', label: 'Insurance', icon: '◈' },
  { id: 'referral', label: 'Referrals', icon: '→' },
  { id: 'discharge', label: 'Discharge', icon: '✓' },
  { id: 'other', label: 'Other', icon: '·' },
];

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: T.bg,
    color: T.text,
    fontFamily: font,
    padding: '40px 32px 120px',
  },
  container: { maxWidth: 1280, margin: '0 auto' },
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
  titleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 32,
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
  },
  uploadBtn: {
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

  toolbar: {
    display: 'flex',
    gap: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  search: {
    flex: 1,
    background: T.low,
    border: `1px solid ${T.border}`,
    borderRadius: 12,
    padding: '12px 16px',
    fontSize: 13,
    color: T.text,
    fontFamily: font,
    boxSizing: 'border-box',
  },

  tabsRow: {
    display: 'flex',
    gap: 8,
    marginBottom: 24,
    flexWrap: 'wrap',
  },
  tab: {
    padding: '8px 16px',
    borderRadius: 9999,
    background: T.low,
    border: `1px solid ${T.border}`,
    color: T.textSecondary,
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  tabActive: {
    background: T.accent,
    borderColor: T.accent,
    color: '#fff',
  },

  /* Drop zone */
  dropZone: {
    border: `2px dashed ${T.border}`,
    borderRadius: 16,
    padding: 32,
    textAlign: 'center',
    marginBottom: 24,
    background: T.low,
    transition: 'border-color 0.2s, background 0.2s',
  },
  dropZoneActive: {
    borderColor: T.accent,
    background: T.accentDim,
  },
  dropHint: {
    fontSize: 13,
    color: T.textSecondary,
    marginBottom: 8,
  },
  dropAction: {
    fontSize: 11,
    color: T.textDim,
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
  },

  /* Document grid */
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 16,
  },
  docCard: {
    background: T.low,
    borderRadius: 16,
    overflow: 'hidden',
    border: `1px solid ${T.border}`,
    cursor: 'pointer',
    transition: 'transform 0.2s, border-color 0.2s',
  },
  thumb: {
    aspectRatio: '4/3',
    background: `linear-gradient(135deg, ${T.high} 0%, ${T.low} 100%)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 48,
    color: T.textDim,
  },
  docBody: { padding: 16 },
  docType: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
    color: T.accent,
    marginBottom: 6,
  },
  docTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: T.text,
    marginBottom: 4,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  docMeta: { fontSize: 11, color: T.textDim },

  /* Modal */
  modal: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    padding: 32,
  },
  modalPanel: {
    background: T.low,
    borderRadius: 24,
    padding: 40,
    border: `1px solid ${T.border}`,
    maxWidth: 640,
    width: '100%',
    maxHeight: '90vh',
    overflow: 'auto',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 800,
    color: T.text,
    marginBottom: 8,
  },
  modalMeta: { fontSize: 12, color: T.textDim, marginBottom: 24 },
  modalActions: {
    display: 'flex',
    gap: 12,
    marginTop: 24,
    paddingTop: 24,
    borderTop: `1px solid ${T.border}`,
  },
  btnDanger: {
    background: 'transparent',
    border: `1px solid ${T.accent}`,
    color: T.accent,
    borderRadius: 9999,
    padding: '10px 20px',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    cursor: 'pointer',
  },
  btnClose: {
    background: 'transparent',
    border: `1px solid ${T.border}`,
    color: T.text,
    borderRadius: 9999,
    padding: '10px 20px',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    cursor: 'pointer',
    marginLeft: 'auto',
  },

  empty: {
    padding: 48,
    textAlign: 'center',
    color: T.textFaint,
    fontSize: 13,
  },
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function iconForType(type: DocumentType): string {
  const c = CATEGORIES.find((c) => c.id === type);
  return c?.icon ?? '·';
}

export default function VaultPage() {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<DocumentType | 'all'>('all');
  const [search, setSearch] = useState('');
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState<DocRow | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchDocuments();
      setDocs(data as DocRow[]);
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      for (const file of Array.from(files)) {
        const buffer = new Uint8Array(await file.arrayBuffer());
        await doCreateDocument({
          title: file.name,
          type: 'other',
          mime_type: file.type || 'application/octet-stream',
          content: buffer,
        });
      }
      await load();
    } catch (err) {
      console.error('Failed to upload document:', err);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleDelete = async (id: string) => {
    try {
      await doDeleteDocument(id);
      setSelected(null);
      await load();
    } catch (err) {
      console.error('Failed to delete document:', err);
    }
  };

  const filtered = docs.filter((d) => {
    if (category !== 'all' && d.type !== category) return false;
    if (search && !d.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={s.page}>
      <div style={s.container}>
        <Link href="/health" style={s.backLink}>
          ← MyHealth / Vault
        </Link>

        <div style={s.titleRow}>
          <div>
            <h1 style={s.title}>Health Vault</h1>
            <p style={s.subtitle}>Secure storage for lab results, prescriptions, and medical records</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <button type="button" style={s.uploadBtn} onClick={() => fileInputRef.current?.click()}>
            + Upload
          </button>
        </div>

        {/* Search */}
        <div style={s.toolbar}>
          <input
            style={s.search}
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Category tabs */}
        <div style={s.tabsRow}>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              style={{ ...s.tab, ...(category === c.id ? s.tabActive : {}) }}
              onClick={() => setCategory(c.id)}
            >
              <span>{c.icon}</span>
              <span>{c.label}</span>
            </button>
          ))}
        </div>

        {/* Drop zone */}
        <div
          style={{ ...s.dropZone, ...(dragging ? s.dropZoneActive : {}) }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <div style={s.dropHint}>Drag and drop files here</div>
          <div style={s.dropAction}>or click Upload above</div>
        </div>

        {/* Documents grid */}
        {loading ? (
          <div style={s.empty}>Loading documents...</div>
        ) : filtered.length === 0 ? (
          <div style={s.empty}>
            {docs.length === 0
              ? 'No documents yet. Upload your first one above.'
              : 'No matches in this category.'}
          </div>
        ) : (
          <div style={s.grid}>
            {filtered.map((doc) => (
              <div key={doc.id} style={s.docCard} onClick={() => setSelected(doc)}>
                <div style={s.thumb}>{iconForType(doc.type)}</div>
                <div style={s.docBody}>
                  <div style={s.docType}>{doc.type.replace('_', ' ')}</div>
                  <div style={s.docTitle}>{doc.title}</div>
                  <div style={s.docMeta}>
                    {formatSize(doc.file_size)} ·{' '}
                    {new Date(doc.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Document viewer modal */}
      {selected && (
        <div style={s.modal} onClick={() => setSelected(null)}>
          <div style={s.modalPanel} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 72, textAlign: 'center', marginBottom: 16 }}>
              {iconForType(selected.type)}
            </div>
            <div style={s.modalTitle}>{selected.title}</div>
            <div style={s.modalMeta}>
              {selected.type.replace('_', ' ')} · {formatSize(selected.file_size)} ·{' '}
              {selected.mime_type}
            </div>
            {selected.notes && (
              <div style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.6 }}>
                {selected.notes}
              </div>
            )}
            <div style={s.modalActions}>
              <button
                type="button"
                style={s.btnDanger}
                onClick={() => handleDelete(selected.id)}
              >
                Delete
              </button>
              <button type="button" style={s.btnClose} onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
