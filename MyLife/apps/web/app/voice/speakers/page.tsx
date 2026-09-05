'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  fetchSpeakersAction,
  createSpeakerAction,
  updateSpeakerAction,
  deleteSpeakerAction,
} from '../actions';
import {
  TEXT,
  TEXT_SEC,
  BORDER,
  SURFACE,
  DANGER,
  heroStyle,
  glassCard,
  primaryButton,
  pillButton,
  emptyState as emptyStyleFn,
  SPEAKER_COLORS,
} from '../ui';

interface Speaker {
  id: string;
  name: string;
  voicePrintHash: string | null;
  sampleCount: number;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export default function SpeakersPage() {
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<string>(SPEAKER_COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchSpeakersAction();
      setSpeakers(data as Speaker[]);
    } catch {
      setError('Could not load speakers.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await createSpeakerAction({ name: newName.trim(), color: newColor });
      setNewName('');
      setNewColor(SPEAKER_COLORS[0]);
      setShowCreate(false);
      await load();
    } catch { /* stay on form */ }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSpeakerAction(id);
      setSpeakers((prev) => prev.filter((s) => s.id !== id));
    } catch { /* silent */ }
  };

  const handleStartEdit = (speaker: Speaker) => {
    setEditingId(speaker.id);
    setEditName(speaker.name);
    setEditColor(speaker.color);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    try {
      await updateSpeakerAction(editingId, { name: editName.trim(), color: editColor });
      setEditingId(null);
      await load();
    } catch { /* stay editing */ }
  };

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 24 }}>
        <div style={{ ...heroStyle(), height: 80 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ ...glassCard(), height: 100, opacity: 0.6, animation: 'pulse 2s infinite' }} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ ...glassCard(), textAlign: 'center', padding: 48 }}>
        <p style={{ color: DANGER, fontSize: 16, margin: 0 }}>{error}</p>
        <button type="button" onClick={() => void load()} style={{ marginTop: 16, padding: '10px 20px', borderRadius: 8, border: `1px solid ${BORDER}`, backgroundColor: SURFACE, color: TEXT_SEC, cursor: 'pointer', fontWeight: 600 }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div style={heroStyle()}>
        <div>
          <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.05, color: TEXT }}>Speakers</h1>
          <p style={{ margin: '10px 0 0', color: TEXT_SEC, fontSize: 15 }}>
            Manage identified speakers
          </p>
        </div>
        <button type="button" onClick={() => setShowCreate(true)} style={primaryButton()}>
          + Add Speaker
        </button>
      </div>

      {showCreate && (
        <div style={glassCard()}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600, color: TEXT }}>Add Speaker</h3>
          <input
            type="text"
            placeholder="Speaker name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${BORDER}`, backgroundColor: SURFACE, color: TEXT, fontSize: 14, marginBottom: 12, outline: 'none', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            {SPEAKER_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setNewColor(color)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  backgroundColor: color,
                  border: newColor === color ? '3px solid #fff' : '2px solid transparent',
                  cursor: 'pointer',
                  padding: 0,
                }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => void handleCreate()} style={primaryButton()}>Add</button>
            <button type="button" onClick={() => { setShowCreate(false); setNewName(''); }} style={{ ...pillButton(false), cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {speakers.length === 0 ? (
        <div style={emptyStyleFn()}>
          <p style={{ margin: 0, fontSize: 32 }}>👤</p>
          <h2 style={{ margin: '12px 0 0', fontSize: 24, color: TEXT }}>No speakers identified yet</h2>
          <p style={{ margin: '12px auto 0', maxWidth: 480, color: TEXT_SEC }}>
            Speaker identification happens automatically during transcription. Add speakers manually to label them.
          </p>
          <button type="button" onClick={() => setShowCreate(true)} style={{ ...primaryButton(), marginTop: 16 }}>
            Add Speaker
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          {speakers.map((speaker) => (
            <div key={speaker.id} style={glassCard()}>
              {editingId === speaker.id ? (
                <div>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${BORDER}`, backgroundColor: SURFACE, color: TEXT, fontSize: 14, marginBottom: 8, outline: 'none', boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                    {SPEAKER_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setEditColor(color)}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          backgroundColor: color,
                          border: editColor === color ? '3px solid #fff' : '2px solid transparent',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      />
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={() => void handleSaveEdit()} style={{ ...primaryButton(), padding: '6px 12px', fontSize: 13 }}>Save</button>
                    <button type="button" onClick={() => setEditingId(null)} style={{ ...pillButton(false), cursor: 'pointer', fontSize: 13 }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ width: 16, height: 16, borderRadius: '50%', backgroundColor: speaker.color, display: 'inline-block', flexShrink: 0 }} />
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: TEXT }}>{speaker.name}</h3>
                  </div>
                  <p style={{ margin: '8px 0 0', fontSize: 13, color: TEXT_SEC }}>
                    {speaker.sampleCount} sample{speaker.sampleCount !== 1 ? 's' : ''}
                  </p>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button type="button" onClick={() => handleStartEdit(speaker)} style={{ background: 'none', border: 'none', color: TEXT_SEC, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Edit</button>
                    <button type="button" onClick={() => void handleDelete(speaker.id)} style={{ background: 'none', border: 'none', color: DANGER, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Delete</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
