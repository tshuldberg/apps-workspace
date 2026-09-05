'use client';

import { useEffect, useState, useCallback } from 'react';
import { fetchSettingsAction, setSettingAction } from '../actions';
import { SUPPORTED_LANGUAGES } from '@mylife/voice';
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
} from '../ui';

interface VoiceSetting {
  key: string;
  value: string;
}

const SETTING_DEFAULTS: Record<string, string> = {
  'recording.default_language': 'en-US',
  'recording.quality': 'standard',
  'recording.auto_save': 'true',
  'transcription.auto_detect_language': 'false',
  'transcription.speaker_identification': 'true',
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchSettingsAction();
      const map: Record<string, string> = {};
      for (const s of data as VoiceSetting[]) {
        map[s.key] = s.value;
      }
      setSettings({ ...SETTING_DEFAULTS, ...map });
    } catch {
      setError('Could not load settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleChange = async (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaving(key);
    try {
      await setSettingAction(key, value);
    } catch {
      // Revert on failure
      await load();
    } finally {
      setSaving(null);
    }
  };

  const getValue = (key: string): string => settings[key] ?? SETTING_DEFAULTS[key] ?? '';

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 24 }}>
        <div style={{ ...heroStyle(), height: 80 }} />
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ ...glassCard(), height: 120, opacity: 0.6, animation: 'pulse 2s infinite' }} />
        ))}
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
          <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.05, color: TEXT }}>Settings</h1>
          <p style={{ margin: '10px 0 0', color: TEXT_SEC, fontSize: 15 }}>
            Configure your voice preferences
          </p>
        </div>
      </div>

      {/* Recording */}
      <div style={glassCard()}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: TEXT }}>Recording</h3>
        <SettingRow label="Default Language" saving={saving === 'recording.default_language'}>
          <select
            value={getValue('recording.default_language')}
            onChange={(e) => void handleChange('recording.default_language', e.target.value)}
            style={selectStyle()}
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>{lang.name}</option>
            ))}
          </select>
        </SettingRow>
        <SettingRow label="Audio Quality" saving={saving === 'recording.quality'}>
          <select
            value={getValue('recording.quality')}
            onChange={(e) => void handleChange('recording.quality', e.target.value)}
            style={selectStyle()}
          >
            <option value="low">Low</option>
            <option value="standard">Standard</option>
            <option value="high">High</option>
          </select>
        </SettingRow>
        <SettingRow label="Auto-save recordings" saving={saving === 'recording.auto_save'}>
          <ToggleSwitch
            checked={getValue('recording.auto_save') === 'true'}
            onChange={(v) => void handleChange('recording.auto_save', v ? 'true' : 'false')}
          />
        </SettingRow>
      </div>

      {/* Transcription */}
      <div style={glassCard()}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: TEXT }}>Transcription</h3>
        <SettingRow label="Auto-detect language" saving={saving === 'transcription.auto_detect_language'}>
          <ToggleSwitch
            checked={getValue('transcription.auto_detect_language') === 'true'}
            onChange={(v) => void handleChange('transcription.auto_detect_language', v ? 'true' : 'false')}
          />
        </SettingRow>
        <SettingRow label="Speaker identification" saving={saving === 'transcription.speaker_identification'}>
          <ToggleSwitch
            checked={getValue('transcription.speaker_identification') === 'true'}
            onChange={(v) => void handleChange('transcription.speaker_identification', v ? 'true' : 'false')}
          />
        </SettingRow>
      </div>

      {/* Data */}
      <div style={glassCard()}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: TEXT }}>Data</h3>
        <SettingRow label="All data stored locally on-device" saving={false}>
          <span style={{ fontSize: 13, color: SUCCESS, fontWeight: 600 }}>Private</span>
        </SettingRow>
      </div>
    </div>
  );
}

function SettingRow({ label, children, saving }: { label: string; children: React.ReactNode; saving: boolean | string | null }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: `1px solid ${BORDER}` }}>
      <span style={{ fontSize: 15, color: TEXT }}>
        {label}
        {saving && <span style={{ fontSize: 12, color: ACCENT, marginLeft: 8 }}>Saving...</span>}
      </span>
      {children}
    </div>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        border: 'none',
        backgroundColor: checked ? SUCCESS : BORDER,
        cursor: 'pointer',
        position: 'relative',
        padding: 0,
        flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute',
        top: 2,
        left: checked ? 22 : 2,
        width: 20,
        height: 20,
        borderRadius: '50%',
        backgroundColor: '#fff',
        transition: 'left 200ms',
      }} />
    </button>
  );
}

function selectStyle(): React.CSSProperties {
  return {
    padding: '8px 12px',
    borderRadius: 8,
    border: `1px solid ${BORDER}`,
    backgroundColor: SURFACE,
    color: TEXT,
    fontSize: 14,
    outline: 'none',
    cursor: 'pointer',
  };
}
