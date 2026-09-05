'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  fetchCommandsAction,
  createCommandAction,
  updateCommandAction,
  deleteCommandAction,
} from '../actions';
import { matchCommand, PRESET_TEMPLATES } from '@mylife/voice';
import {
  ACCENT,
  TEXT,
  TEXT_SEC,
  BORDER,
  SURFACE,
  DANGER,
  SUCCESS,
  heroStyle,
  glassCard,
  glassStrong,
  primaryButton,
  pillButton,
  emptyState as emptyStyleFn,
} from '../ui';

interface VoiceCommand {
  id: string;
  phrase: string;
  action: string;
  moduleTarget: string | null;
  params: string | null;
  isEnabled: boolean;
  priority: number;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function CommandsPage() {
  const [commands, setCommands] = useState<VoiceCommand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testPhrase, setTestPhrase] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [showPresets, setShowPresets] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newPhrase, setNewPhrase] = useState('');
  const [newAction, setNewAction] = useState('');
  const [newTarget, setNewTarget] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchCommandsAction();
      setCommands(data as VoiceCommand[]);
    } catch {
      setError('Could not load commands.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleTest = () => {
    if (!testPhrase.trim()) return;
    const candidates = commands.map((c) => ({
      id: c.id,
      phrase: c.phrase,
      action: c.action,
      moduleTarget: c.moduleTarget,
      params: c.params,
      priority: c.priority,
      isEnabled: c.isEnabled,
    }));
    const result = matchCommand(testPhrase, candidates);
    if (result) {
      setTestResult(`Matched: "${result.phrase}" -> ${result.moduleTarget ?? 'voice'} module, action: ${result.action} (confidence: ${Math.round(result.confidence * 100)}%)`);
    } else {
      setTestResult('No matching command found.');
    }
  };

  const handleToggleEnabled = async (cmd: VoiceCommand) => {
    try {
      await updateCommandAction(cmd.id, { isEnabled: !cmd.isEnabled });
      setCommands((prev) => prev.map((c) => c.id === cmd.id ? { ...c, isEnabled: !c.isEnabled } : c));
    } catch { /* silent */ }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCommandAction(id);
      setCommands((prev) => prev.filter((c) => c.id !== id));
    } catch { /* silent */ }
  };

  const handleCreate = async () => {
    if (!newPhrase.trim() || !newAction.trim()) return;
    try {
      await createCommandAction({
        phrase: newPhrase.trim(),
        action: newAction.trim(),
        moduleTarget: newTarget.trim() || null,
      });
      setNewPhrase('');
      setNewAction('');
      setNewTarget('');
      setShowCreate(false);
      await load();
    } catch { /* stay on form */ }
  };

  const handleAddPreset = async (preset: { phrase: string; action: string; moduleTarget: string }) => {
    try {
      await createCommandAction({
        phrase: preset.phrase,
        action: preset.action,
        moduleTarget: preset.moduleTarget,
      });
      await load();
    } catch { /* silent */ }
  };

  const existingPhrases = useMemo(() => new Set(commands.map((c) => c.phrase)), [commands]);

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 24 }}>
        <div style={{ ...heroStyle(), height: 80 }} />
        <div style={{ ...glassStrong(), height: 80, opacity: 0.6, animation: 'pulse 2s infinite' }} />
        <div style={{ ...glassCard(), height: 200, opacity: 0.6, animation: 'pulse 2s infinite' }} />
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
          <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.05, color: TEXT }}>Voice Commands</h1>
          <p style={{ margin: '10px 0 0', color: TEXT_SEC, fontSize: 15 }}>
            Control MyLife modules with your voice
          </p>
        </div>
        <button type="button" onClick={() => setShowCreate(true)} style={primaryButton()}>
          + New Command
        </button>
      </div>

      {/* Test Area */}
      <div style={glassStrong()}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ color: TEXT_SEC, fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' }}>Try a command:</span>
          <input
            type="text"
            placeholder="Type a phrase to test..."
            value={testPhrase}
            onChange={(e) => setTestPhrase(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleTest(); }}
            style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: `1px solid ${BORDER}`, backgroundColor: SURFACE, color: TEXT, fontSize: 14, outline: 'none' }}
          />
          <button type="button" onClick={handleTest} style={primaryButton()}>Test</button>
        </div>
        {testResult && (
          <p style={{ margin: '10px 0 0', fontSize: 14, color: testResult.startsWith('No') ? TEXT_SEC : SUCCESS }}>{testResult}</p>
        )}
      </div>

      {/* Create Form */}
      {showCreate && (
        <div style={glassCard()}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600, color: TEXT }}>New Command</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
            <input type="text" placeholder="Phrase (e.g. 'Start timer')" value={newPhrase} onChange={(e) => setNewPhrase(e.target.value)} style={{ padding: '10px 14px', borderRadius: 8, border: `1px solid ${BORDER}`, backgroundColor: SURFACE, color: TEXT, fontSize: 14, outline: 'none' }} />
            <input type="text" placeholder="Action (e.g. 'start_timer')" value={newAction} onChange={(e) => setNewAction(e.target.value)} style={{ padding: '10px 14px', borderRadius: 8, border: `1px solid ${BORDER}`, backgroundColor: SURFACE, color: TEXT, fontSize: 14, outline: 'none' }} />
            <input type="text" placeholder="Target module (optional)" value={newTarget} onChange={(e) => setNewTarget(e.target.value)} style={{ padding: '10px 14px', borderRadius: 8, border: `1px solid ${BORDER}`, backgroundColor: SURFACE, color: TEXT, fontSize: 14, outline: 'none' }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => void handleCreate()} style={primaryButton()}>Create</button>
            <button type="button" onClick={() => { setShowCreate(false); setNewPhrase(''); setNewAction(''); setNewTarget(''); }} style={{ ...pillButton(false), cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Commands Table */}
      {commands.length === 0 ? (
        <div style={emptyStyleFn()}>
          <p style={{ margin: 0, fontSize: 32 }}>🗣️</p>
          <h2 style={{ margin: '12px 0 0', fontSize: 24, color: TEXT }}>Voice commands let you control MyLife by speaking</h2>
          <p style={{ margin: '12px auto 0', maxWidth: 480, color: TEXT_SEC }}>
            Create custom commands or add from preset templates below.
          </p>
          <button type="button" onClick={() => setShowPresets(true)} style={{ ...primaryButton(), marginTop: 16 }}>
            Show Preset Templates
          </button>
        </div>
      ) : (
        <div style={glassCard()}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 80px 60px 60px 50px 40px', gap: 12, padding: '0 0 8px', borderBottom: `1px solid ${BORDER}` }}>
            <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: TEXT_SEC, letterSpacing: 0.8 }}>Phrase</span>
            <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: TEXT_SEC, letterSpacing: 0.8 }}>Action</span>
            <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: TEXT_SEC, letterSpacing: 0.8 }}>Target</span>
            <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: TEXT_SEC, letterSpacing: 0.8 }}>Priority</span>
            <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: TEXT_SEC, letterSpacing: 0.8 }}>Uses</span>
            <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: TEXT_SEC, letterSpacing: 0.8 }}>On</span>
            <span />
          </div>
          {commands.map((cmd) => (
            <div key={cmd.id} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 80px 60px 60px 50px 40px', gap: 12, alignItems: 'center', padding: '12px 0', borderTop: `1px solid ${BORDER}` }}>
              <span style={{ fontSize: 14, color: TEXT, fontFamily: 'monospace' }}>{cmd.phrase}</span>
              <span style={{ fontSize: 13, color: TEXT_SEC }}>{cmd.action}</span>
              <span style={{ fontSize: 13, color: ACCENT }}>{cmd.moduleTarget ?? '--'}</span>
              <span style={{ fontSize: 13, color: TEXT_SEC }}>{cmd.priority}</span>
              <span style={{ fontSize: 13, color: TEXT_SEC }}>{cmd.usageCount}</span>
              <button
                type="button"
                onClick={() => void handleToggleEnabled(cmd)}
                style={{
                  width: 36,
                  height: 20,
                  borderRadius: 10,
                  border: 'none',
                  backgroundColor: cmd.isEnabled ? SUCCESS : BORDER,
                  cursor: 'pointer',
                  position: 'relative',
                }}
              >
                <span style={{
                  position: 'absolute',
                  top: 2,
                  left: cmd.isEnabled ? 18 : 2,
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  backgroundColor: '#fff',
                  transition: 'left 200ms',
                }} />
              </button>
              <button type="button" onClick={() => void handleDelete(cmd.id)} style={{ background: 'none', border: 'none', color: TEXT_SEC, cursor: 'pointer', fontSize: 14, padding: 4 }} title="Delete">
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Preset Templates */}
      <div>
        <button type="button" onClick={() => setShowPresets(!showPresets)} style={{ ...pillButton(false), cursor: 'pointer' }}>
          {showPresets ? 'Hide' : 'Show'} {PRESET_TEMPLATES.length} preset templates
        </button>
      </div>
      {showPresets && (
        <div style={glassCard()}>
          {PRESET_TEMPLATES.map((preset) => {
            const alreadyAdded = existingPhrases.has(preset.phrase);
            return (
              <div key={preset.phrase} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: `1px solid ${BORDER}` }}>
                <div>
                  <span style={{ fontSize: 14, color: TEXT, fontFamily: 'monospace' }}>&ldquo;{preset.phrase}&rdquo;</span>
                  <span style={{ fontSize: 13, color: ACCENT, marginLeft: 12 }}>{preset.moduleTarget}</span>
                </div>
                <button
                  type="button"
                  disabled={alreadyAdded}
                  onClick={() => void handleAddPreset(preset)}
                  style={{
                    ...primaryButton(),
                    padding: '6px 12px',
                    fontSize: 13,
                    opacity: alreadyAdded ? 0.4 : 1,
                    cursor: alreadyAdded ? 'default' : 'pointer',
                  }}
                >
                  {alreadyAdded ? 'Added' : 'Add'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
