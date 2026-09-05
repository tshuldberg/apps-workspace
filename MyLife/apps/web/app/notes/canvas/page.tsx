'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchCanvases, createCanvasAction, deleteCanvasAction } from '../actions';

interface CanvasSummary {
  id: string;
  title: string;
  nodeCount: number;
  edgeCount: number;
  updatedAt: string;
}

const ACCENT = 'var(--accent-notes)';
const TEXT = 'var(--text)';
const TEXT_SEC = 'var(--text-secondary)';
const SURFACE = 'var(--surface)';
const BORDER = 'var(--border)';
const GLASS = 'var(--glass)';
const DANGER = '#FF453A';

export default function CanvasListPage() {
  const [canvases, setCanvases] = useState<CanvasSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const c = await fetchCanvases();
      setCanvases(c as CanvasSummary[]);
    } catch {
      setError('Failed to load canvases.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    try {
      const id = await createCanvasAction({ title: 'Untitled Canvas' });
      window.location.href = `/notes/canvas/${id}`;
    } catch {
      setError('Failed to create canvas.');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this canvas?')) return;
    try {
      await deleteCanvasAction(id);
      load();
    } catch {
      setError('Failed to delete canvas.');
    }
  }

  if (error) {
    return (
      <div style={{ padding: 32, borderRadius: 20, border: `1px solid ${BORDER}`, backgroundColor: SURFACE, textAlign: 'center' }}>
        <p style={{ color: TEXT, fontSize: 18, fontWeight: 600, margin: 0 }}>{error}</p>
        <button type="button" onClick={load}
          style={{ marginTop: 16, padding: '10px 20px', borderRadius: 8, backgroundColor: ACCENT, color: '#0A0A0F', fontWeight: 700, border: 'none', cursor: 'pointer' }}>
          Retry
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ height: 160, borderRadius: 16, backgroundColor: SURFACE, border: `1px solid ${BORDER}`, animation: 'pulse 1.5s ease-in-out infinite' }} />
        ))}
        <style>{`@keyframes pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 0.3; } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: TEXT }}>Your Canvases</h2>
        <button type="button" onClick={handleCreate}
          style={{ borderRadius: 999, backgroundColor: ACCENT, color: '#0A0A0F', padding: '10px 16px', fontWeight: 700, border: 'none', cursor: 'pointer' }}>
          + New Canvas
        </button>
      </div>

      {canvases.length === 0 ? (
        <div style={{ padding: 48, borderRadius: 20, border: '1px dashed rgba(100,116,139,0.25)', backgroundColor: GLASS, textAlign: 'center' }}>
          <p style={{ fontSize: 48, margin: 0 }}>🎨</p>
          <h3 style={{ margin: '12px 0 8px', fontSize: 24, color: TEXT }}>Create your first canvas</h3>
          <p style={{ color: TEXT_SEC, maxWidth: 400, margin: '0 auto' }}>
            Arrange notes, images, and ideas on an infinite whiteboard with connections and groups.
          </p>
          <button type="button" onClick={handleCreate}
            style={{ marginTop: 20, borderRadius: 999, backgroundColor: ACCENT, color: '#0A0A0F', padding: '10px 16px', fontWeight: 700, border: 'none', cursor: 'pointer' }}>
            + New Canvas
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {canvases.map((c) => (
            <div key={c.id} style={{ borderRadius: 16, border: `1px solid ${BORDER}`, backgroundColor: SURFACE, overflow: 'hidden' }}>
              <Link href={`/notes/canvas/${c.id}`} style={{ textDecoration: 'none', color: TEXT, display: 'block', padding: 16 }}>
                <div style={{ height: 80, borderRadius: 12, backgroundColor: GLASS, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 28, opacity: 0.3 }}>🎨</span>
                </div>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{c.title}</p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: TEXT_SEC }}>{c.nodeCount} nodes / {c.edgeCount} edges</p>
              </Link>
              <div style={{ padding: '0 16px 12px', display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => handleDelete(c.id)}
                  style={{ background: 'none', border: 'none', color: DANGER, cursor: 'pointer', fontSize: 12 }}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
