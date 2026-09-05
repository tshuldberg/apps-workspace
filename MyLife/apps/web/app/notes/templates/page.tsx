'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchTemplates, seedTemplatesAction, createNoteAction, applyTemplateAction, createTemplateAction, deleteTemplateAction } from '../actions';
import { expandVariables, buildVariableMap } from '@mylife/notes';
import type { NoteTemplate } from '@mylife/notes';

const ACCENT = 'var(--accent-notes)';
const TEXT = 'var(--text)';
const TEXT_SEC = 'var(--text-secondary)';
const SURFACE = 'var(--surface)';
const BORDER = 'var(--border)';
const GLASS = 'var(--glass)';
const DANGER = '#FF453A';

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<NoteTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBody, setNewBody] = useState('');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      await seedTemplatesAction();
      const t = await fetchTemplates();
      setTemplates(t);
    } catch {
      setError('Failed to load templates.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleUse(template: NoteTemplate) {
    try {
      await applyTemplateAction(template.id);
      const vars = buildVariableMap();
      const body = expandVariables(template.body, vars);
      const id = await createNoteAction({ title: `From: ${template.name}`, body });
      router.push(`/notes/${id}`);
    } catch {
      setError('Failed to create note from template.');
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    try {
      await createTemplateAction({ name: newName, body: newBody });
      setNewName('');
      setNewBody('');
      setShowCreate(false);
      load();
    } catch {
      setError('Failed to create template.');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this template?')) return;
    try {
      await deleteTemplateAction(id);
      load();
    } catch {
      setError('Failed to delete template.');
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
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{ height: 120, borderRadius: 16, backgroundColor: SURFACE, border: `1px solid ${BORDER}`, animation: 'pulse 1.5s ease-in-out infinite', animationDelay: `${i * 100}ms` }} />
        ))}
        <style>{`@keyframes pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 0.3; } }`}</style>
      </div>
    );
  }

  const builtIn = templates.filter((t) => t.isBuiltIn);
  const custom = templates.filter((t) => !t.isBuiltIn);

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: TEXT }}>Note Templates</h2>
        <button type="button" onClick={() => setShowCreate(true)}
          style={{ borderRadius: 999, backgroundColor: ACCENT, color: '#0A0A0F', padding: '10px 16px', fontWeight: 700, border: 'none', cursor: 'pointer' }}>
          + New Template
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div style={{ padding: 20, borderRadius: 16, border: `1px solid ${BORDER}`, backgroundColor: SURFACE }}>
          <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Template name"
            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${BORDER}`, backgroundColor: GLASS, color: TEXT, outline: 'none', marginBottom: 12 }} />
          <textarea value={newBody} onChange={(e) => setNewBody(e.target.value)} placeholder="Template body (supports {{date}}, {{time}}, {{title}})"
            style={{ width: '100%', minHeight: 120, padding: '10px 14px', borderRadius: 8, border: `1px solid ${BORDER}`, backgroundColor: GLASS, color: TEXT, outline: 'none', fontFamily: 'monospace', fontSize: 13, lineHeight: 1.6, resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button type="button" onClick={handleCreate}
              style={{ padding: '8px 16px', borderRadius: 8, backgroundColor: ACCENT, color: '#0A0A0F', fontWeight: 700, border: 'none', cursor: 'pointer' }}>
              Create
            </button>
            <button type="button" onClick={() => setShowCreate(false)}
              style={{ padding: '8px 16px', borderRadius: 8, backgroundColor: GLASS, color: TEXT_SEC, border: `1px solid ${BORDER}`, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Built-in */}
      {builtIn.length > 0 && (
        <section>
          <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: TEXT_SEC }}>Built-in</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {builtIn.map((t) => (
              <TemplateCard key={t.id} template={t} onUse={() => handleUse(t)} />
            ))}
          </div>
        </section>
      )}

      {/* Custom */}
      <section>
        <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: TEXT_SEC }}>Custom</p>
        {custom.length === 0 ? (
          <p style={{ padding: 24, textAlign: 'center', color: TEXT_SEC, fontSize: 14 }}>No custom templates yet. Create one above.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {custom.map((t) => (
              <TemplateCard key={t.id} template={t} onUse={() => handleUse(t)} onDelete={() => handleDelete(t.id)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function TemplateCard({ template, onUse, onDelete }: { template: NoteTemplate; onUse: () => void; onDelete?: () => void }) {
  return (
    <div style={{ padding: 16, borderRadius: 16, border: `1px solid ${BORDER}`, backgroundColor: GLASS }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 24 }}>{template.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: TEXT }}>{template.name}</p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: TEXT_SEC }}>{template.description || template.category}</p>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
        <span style={{ fontSize: 11, color: TEXT_SEC }}>Used: {template.useCount}</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" onClick={onUse}
            style={{ padding: '4px 10px', borderRadius: 6, backgroundColor: ACCENT, color: '#0A0A0F', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
            Use
          </button>
          {onDelete && (
            <button type="button" onClick={onDelete}
              style={{ padding: '4px 10px', borderRadius: 6, backgroundColor: GLASS, color: DANGER, fontSize: 12, fontWeight: 600, border: `1px solid ${BORDER}`, cursor: 'pointer' }}>
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
