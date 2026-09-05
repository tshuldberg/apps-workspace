'use client';

import { useEffect, useState } from 'react';
import {
  fetchDatabases,
  createDatabaseAction,
  deleteDatabaseAction,
  fetchDatabaseDetail,
  createDbRowAction,
  createDbColumnAction,
  setCellValueAction,
  deleteDbRowAction,
} from '../actions';
import type { NoteDatabase, NoteDbColumn, NoteDbRow, NoteDbCell } from '@mylife/notes';

const ACCENT = 'var(--accent-notes)';
const TEXT = 'var(--text)';
const TEXT_SEC = 'var(--text-secondary)';
const SURFACE = 'var(--surface)';
const BORDER = 'var(--border)';
const GLASS = 'var(--glass)';
const DANGER = '#FF453A';

interface DbDetail {
  database: NoteDatabase;
  columns: NoteDbColumn[];
  rows: NoteDbRow[];
  cellsByRow: Record<string, NoteDbCell[]>;
}

export default function DatabasesPage() {
  const [databases, setDatabases] = useState<NoteDatabase[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DbDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const dbs = await fetchDatabases();
      setDatabases(dbs);
    } catch {
      setError('Failed to load databases.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    try {
      await createDatabaseAction({ title: 'Untitled Database' });
      load();
    } catch {
      setError('Failed to create database.');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this database and all its data?')) return;
    try {
      await deleteDatabaseAction(id);
      if (expandedId === id) { setExpandedId(null); setDetail(null); }
      load();
    } catch {
      setError('Failed to delete database.');
    }
  }

  async function handleExpand(id: string) {
    if (expandedId === id) { setExpandedId(null); setDetail(null); return; }
    setExpandedId(id);
    try {
      const d = await fetchDatabaseDetail(id);
      setDetail(d);
    } catch {
      setError('Failed to load database detail.');
    }
  }

  async function handleAddRow() {
    if (!expandedId) return;
    try {
      await createDbRowAction(expandedId);
      const d = await fetchDatabaseDetail(expandedId);
      setDetail(d);
    } catch { /* silent */ }
  }

  async function handleAddColumn() {
    if (!expandedId) return;
    const name = prompt('Column name:');
    if (!name) return;
    try {
      await createDbColumnAction(expandedId, { name, columnType: 'text' });
      const d = await fetchDatabaseDetail(expandedId);
      setDetail(d);
    } catch { /* silent */ }
  }

  async function handleCellChange(rowId: string, columnId: string, value: string) {
    try {
      await setCellValueAction(rowId, columnId, { text: value });
    } catch { /* silent */ }
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
      <div style={{ display: 'grid', gap: 12 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ height: 80, borderRadius: 16, backgroundColor: SURFACE, border: `1px solid ${BORDER}`, animation: 'pulse 1.5s ease-in-out infinite' }} />
        ))}
        <style>{`@keyframes pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 0.3; } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: TEXT }}>Your Databases</h2>
        <button type="button" onClick={handleCreate}
          style={{ borderRadius: 999, backgroundColor: ACCENT, color: '#0A0A0F', padding: '10px 16px', fontWeight: 700, border: 'none', cursor: 'pointer' }}>
          + New Database
        </button>
      </div>

      {databases.length === 0 ? (
        <div style={{ padding: 48, borderRadius: 20, border: '1px dashed rgba(100,116,139,0.25)', backgroundColor: GLASS, textAlign: 'center' }}>
          <p style={{ fontSize: 48, margin: 0 }}>🗄️</p>
          <h3 style={{ margin: '12px 0 8px', fontSize: 24, color: TEXT }}>Create your first database</h3>
          <p style={{ color: TEXT_SEC, maxWidth: 400, margin: '0 auto' }}>
            Organize structured data with custom columns, table views, and filters. Great for reading lists, project trackers, or habit logs.
          </p>
          <button type="button" onClick={handleCreate}
            style={{ marginTop: 20, borderRadius: 999, backgroundColor: ACCENT, color: '#0A0A0F', padding: '10px 16px', fontWeight: 700, border: 'none', cursor: 'pointer' }}>
            + New Database
          </button>
        </div>
      ) : (
        databases.map((db) => (
          <div key={db.id} style={{ borderRadius: 16, border: `1px solid ${BORDER}`, backgroundColor: SURFACE, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, cursor: 'pointer' }}
              onClick={() => handleExpand(db.id)}>
              <div>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: TEXT }}>{db.title}</p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: TEXT_SEC }}>{db.defaultView} view</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ fontSize: 12, color: TEXT_SEC }}>{expandedId === db.id ? '▲' : '▼'}</span>
                <button type="button" onClick={(e) => { e.stopPropagation(); handleDelete(db.id); }}
                  style={{ padding: '4px 8px', borderRadius: 6, backgroundColor: GLASS, color: DANGER, fontSize: 12, border: `1px solid ${BORDER}`, cursor: 'pointer' }}>
                  Delete
                </button>
              </div>
            </div>

            {expandedId === db.id && detail && (
              <div style={{ borderTop: `1px solid ${BORDER}`, padding: 16, overflowX: 'auto' }}>
                {detail.columns.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 24 }}>
                    <p style={{ color: TEXT_SEC, margin: '0 0 12px' }}>No columns yet.</p>
                    <button type="button" onClick={handleAddColumn}
                      style={{ padding: '8px 14px', borderRadius: 8, backgroundColor: ACCENT, color: '#0A0A0F', fontWeight: 600, border: 'none', cursor: 'pointer', fontSize: 13 }}>
                      + Add Column
                    </button>
                  </div>
                ) : (
                  <>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          {detail.columns.map((col) => (
                            <th key={col.id} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: TEXT_SEC, borderBottom: `1px solid ${BORDER}` }}>
                              {col.name}
                            </th>
                          ))}
                          <th style={{ padding: '8px 12px', borderBottom: `1px solid ${BORDER}`, width: 40 }} />
                        </tr>
                      </thead>
                      <tbody>
                        {detail.rows.map((row) => {
                          const cells = detail.cellsByRow[row.id] ?? [];
                          return (
                            <tr key={row.id}>
                              {detail.columns.map((col) => {
                                const cell = cells.find((c) => c.columnId === col.id);
                                return (
                                  <td key={col.id} style={{ padding: '4px 12px', borderBottom: `1px solid ${BORDER}` }}>
                                    <input
                                      type="text"
                                      defaultValue={cell?.valueText ?? ''}
                                      onBlur={(e) => handleCellChange(row.id, col.id, e.target.value)}
                                      style={{ width: '100%', background: 'transparent', border: 'none', color: TEXT, fontSize: 13, outline: 'none', padding: '4px 0' }}
                                    />
                                  </td>
                                );
                              })}
                              <td style={{ padding: '4px 8px', borderBottom: `1px solid ${BORDER}` }}>
                                <button type="button" onClick={() => { deleteDbRowAction(row.id).then(() => fetchDatabaseDetail(db.id).then(setDetail)); }}
                                  style={{ background: 'none', border: 'none', color: DANGER, cursor: 'pointer', fontSize: 12 }}>×</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button type="button" onClick={handleAddRow}
                        style={{ padding: '6px 12px', borderRadius: 8, backgroundColor: GLASS, color: TEXT_SEC, border: `1px solid ${BORDER}`, cursor: 'pointer', fontSize: 12 }}>
                        + Add Row
                      </button>
                      <button type="button" onClick={handleAddColumn}
                        style={{ padding: '6px 12px', borderRadius: 8, backgroundColor: GLASS, color: TEXT_SEC, border: `1px solid ${BORDER}`, cursor: 'pointer', fontSize: 12 }}>
                        + Add Column
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
