'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  fetchLanguageProfilesAction,
  createLanguageProfileAction,
  setDefaultProfileAction,
  deleteLanguageProfileAction,
} from '../actions';
import { SUPPORTED_LANGUAGES } from '@mylife/voice';
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
  getLanguageColor,
} from '../ui';

interface LanguageProfile {
  id: string;
  name: string;
  languages: string[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function LanguagesPage() {
  const [profiles, setProfiles] = useState<LanguageProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedLangs, setSelectedLangs] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchLanguageProfilesAction();
      setProfiles(data as LanguageProfile[]);
    } catch {
      setError('Could not load language profiles.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleCreate = async () => {
    if (!newName.trim() || selectedLangs.length === 0) return;
    try {
      await createLanguageProfileAction({
        name: newName.trim(),
        languages: selectedLangs,
        isDefault: profiles.length === 0,
      });
      setNewName('');
      setSelectedLangs([]);
      setShowCreate(false);
      await load();
    } catch { /* stay on form */ }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await setDefaultProfileAction(id);
      setProfiles((prev) => prev.map((p) => ({ ...p, isDefault: p.id === id })));
    } catch { /* silent */ }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteLanguageProfileAction(id);
      setProfiles((prev) => prev.filter((p) => p.id !== id));
    } catch { /* silent */ }
  };

  const toggleLang = (code: string) => {
    setSelectedLangs((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : prev.length < 5 ? [...prev, code] : prev,
    );
  };

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 24 }}>
        <div style={{ ...heroStyle(), height: 80 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24 }}>
          <div style={{ ...glassCard(), height: 200, opacity: 0.6, animation: 'pulse 2s infinite' }} />
          <div style={{ ...glassCard(), height: 400, opacity: 0.6, animation: 'pulse 2s infinite' }} />
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
          <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.05, color: TEXT }}>Languages</h1>
          <p style={{ margin: '10px 0 0', color: TEXT_SEC, fontSize: 15 }}>
            {SUPPORTED_LANGUAGES.length} supported languages, {profiles.length} profile{profiles.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button type="button" onClick={() => setShowCreate(true)} style={primaryButton()}>
          + New Profile
        </button>
      </div>

      {showCreate && (
        <div style={glassCard()}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600, color: TEXT }}>New Language Profile</h3>
          <input
            type="text"
            placeholder="Profile name (e.g. 'Bilingual')"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${BORDER}`, backgroundColor: SURFACE, color: TEXT, fontSize: 14, marginBottom: 12, outline: 'none', boxSizing: 'border-box' }}
          />
          <p style={{ margin: '0 0 8px', fontSize: 13, color: TEXT_SEC }}>Select up to 5 languages:</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isSelected = selectedLangs.includes(lang.code);
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => toggleLang(lang.code)}
                  style={pillButton(isSelected)}
                >
                  {lang.name}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => void handleCreate()} style={primaryButton()}>Create</button>
            <button type="button" onClick={() => { setShowCreate(false); setNewName(''); setSelectedLangs([]); }} style={{ ...pillButton(false), cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24, alignItems: 'start' }}>
        {/* Profiles Sidebar */}
        <div style={glassCard()}>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: TEXT_SEC, textTransform: 'uppercase', letterSpacing: 0.8 }}>Profiles</h3>
          {profiles.length === 0 ? (
            <p style={{ margin: 0, fontSize: 14, color: TEXT_SEC }}>No profiles yet. Create one to get started.</p>
          ) : (
            profiles.map((profile) => (
              <div key={profile.id} style={{ padding: '10px 0', borderTop: `1px solid ${BORDER}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: 15, fontWeight: 600, color: TEXT }}>
                      {profile.isDefault && '★ '}{profile.name}
                    </span>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: TEXT_SEC }}>
                      {profile.languages.join(', ')}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  {!profile.isDefault && (
                    <button type="button" onClick={() => void handleSetDefault(profile.id)} style={{ background: 'none', border: 'none', color: TEXT_SEC, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                      Set Default
                    </button>
                  )}
                  <button type="button" onClick={() => void handleDelete(profile.id)} style={{ background: 'none', border: 'none', color: DANGER, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Languages Grid */}
        <div style={glassCard()}>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: TEXT_SEC, textTransform: 'uppercase', letterSpacing: 0.8 }}>Supported Languages</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
            {SUPPORTED_LANGUAGES.map((lang) => (
              <div key={lang.code} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, border: `1px solid ${BORDER}` }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: getLanguageColor(lang.code), display: 'inline-block', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 14, color: TEXT }}>{lang.name}</span>
                </div>
                <span style={{ fontSize: 12, color: TEXT_SEC, fontFamily: 'monospace' }}>{lang.code}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
