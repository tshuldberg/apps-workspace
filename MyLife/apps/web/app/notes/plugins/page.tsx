'use client';

import { useEffect, useState } from 'react';
import { fetchPlugins, togglePluginAction, uninstallPluginAction } from '../actions';
import type { NotePlugin } from '@mylife/notes';

const ACCENT = 'var(--accent-notes)';
const TEXT = 'var(--text)';
const TEXT_SEC = 'var(--text-secondary)';
const SURFACE = 'var(--surface)';
const BORDER = 'var(--border)';
const GLASS = 'var(--glass)';
const DANGER = '#FF453A';

export default function PluginsPage() {
  const [plugins, setPlugins] = useState<NotePlugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const p = await fetchPlugins();
      setPlugins(p);
    } catch {
      setError('Failed to load plugins.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleToggle(id: string, enabled: boolean) {
    try {
      await togglePluginAction(id, enabled);
      setPlugins((prev) => prev.map((p) => p.id === id ? { ...p, isEnabled: enabled } : p));
    } catch {
      setError('Failed to toggle plugin.');
    }
  }

  async function handleUninstall(id: string) {
    if (!confirm('Uninstall this plugin?')) return;
    try {
      await uninstallPluginAction(id);
      load();
    } catch {
      setError('Failed to uninstall plugin.');
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
      <div style={{ display: 'grid', gap: 12 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ height: 72, borderRadius: 16, backgroundColor: SURFACE, border: `1px solid ${BORDER}`, animation: 'pulse 1.5s ease-in-out infinite' }} />
        ))}
        <style>{`@keyframes pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 0.3; } }`}</style>
      </div>
    );
  }

  const builtIn = plugins.filter((p) => p.isBuiltIn);
  const installed = plugins.filter((p) => !p.isBuiltIn);

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: TEXT }}>Plugins</h2>

      {plugins.length === 0 ? (
        <div style={{ padding: 48, borderRadius: 20, border: '1px dashed rgba(100,116,139,0.25)', backgroundColor: GLASS, textAlign: 'center' }}>
          <p style={{ fontSize: 48, margin: 0 }}>🔌</p>
          <h3 style={{ margin: '12px 0 8px', fontSize: 24, color: TEXT }}>No plugins installed</h3>
          <p style={{ color: TEXT_SEC, maxWidth: 400, margin: '0 auto' }}>
            Plugins extend MyNotes with additional features like word count, focus mode, and more.
          </p>
        </div>
      ) : (
        <>
          {builtIn.length > 0 && (
            <section>
              <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: TEXT_SEC }}>Built-in ({builtIn.length})</p>
              <div style={{ display: 'grid', gap: 8 }}>
                {builtIn.map((p) => (
                  <PluginRow key={p.id} plugin={p} onToggle={handleToggle} />
                ))}
              </div>
            </section>
          )}

          {installed.length > 0 && (
            <section>
              <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: TEXT_SEC }}>Installed ({installed.length})</p>
              <div style={{ display: 'grid', gap: 8 }}>
                {installed.map((p) => (
                  <PluginRow key={p.id} plugin={p} onToggle={handleToggle} onUninstall={handleUninstall} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function PluginRow({ plugin, onToggle, onUninstall }: {
  plugin: NotePlugin;
  onToggle: (id: string, enabled: boolean) => void;
  onUninstall?: (id: string) => void;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: 16,
      borderRadius: 16, border: `1px solid ${BORDER}`, backgroundColor: GLASS,
    }}>
      <span style={{ fontSize: 24 }}>🔌</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: TEXT }}>{plugin.name}</span>
          <span style={{ fontSize: 11, color: TEXT_SEC }}>v{plugin.version}</span>
        </div>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: TEXT_SEC }}>{plugin.description}</p>
        {plugin.author && <p style={{ margin: '2px 0 0', fontSize: 11, color: TEXT_SEC }}>By: {plugin.author}</p>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" onClick={() => onToggle(plugin.id, !plugin.isEnabled)}
          style={{
            padding: '6px 14px', borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: 'pointer',
            border: `1px solid ${BORDER}`,
            backgroundColor: plugin.isEnabled ? ACCENT : GLASS,
            color: plugin.isEnabled ? '#0A0A0F' : TEXT_SEC,
          }}>
          {plugin.isEnabled ? 'Enabled' : 'Disabled'}
        </button>
        {onUninstall && (
          <button type="button" onClick={() => onUninstall(plugin.id)}
            style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${BORDER}`, backgroundColor: GLASS, color: DANGER, cursor: 'pointer', fontSize: 12 }}>
            Uninstall
          </button>
        )}
      </div>
    </div>
  );
}
