'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  fetchSettings,
  updateSetting,
  fetchDataStats,
  exportJSON,
  exportTableCSV,
  deleteAll,
} from './actions';
import type { DataStats, FriendsSettingKey } from '@mylife/friends';

const ACCENT = '#EC4899';
const TEXT = 'var(--text, #E4E1E9)';
const TEXT_SEC = 'var(--text-secondary, #D6C3B5)';
const BORDER = 'var(--border, rgba(255,255,255,0.06))';
const SURFACE = '#1B1B20';
const SURFACE_ELEVATED = '#2A292F';
const DANGER = '#FFB4AB';
const DANGER_BG = '#93000A';
const SUCCESS = '#30D158';

const NUDGE_THRESHOLDS = [14, 30, 60, 90];

const CSV_TABLES = [
  { label: 'People', table: 'fn_people' },
  { label: 'Circles', table: 'fn_circles' },
  { label: 'Hangouts', table: 'fn_hangouts' },
  { label: 'Gifts', table: 'fn_gifts' },
  { label: 'Gift Ideas', table: 'fn_gift_ideas' },
  { label: 'Memories', table: 'fn_memories' },
  { label: 'Life Events', table: 'fn_life_events' },
];

export default function FriendsSettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [stats, setStats] = useState<DataStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [showDeleteInput, setShowDeleteInput] = useState(false);
  const [csvTable, setCsvTable] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [s, d] = await Promise.all([fetchSettings(), fetchDataStats()]);
      setSettings(s);
      setStats(d);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const toggle = useCallback(
    async (key: FriendsSettingKey, current: boolean) => {
      const newVal = String(!current);
      setSettings((prev) => ({ ...prev, [key]: newVal }));
      await updateSetting(key, newVal);
    },
    [],
  );

  const selectNudgeDays = useCallback(async (days: number) => {
    setSettings((prev) => ({ ...prev, default_nudge_days: String(days) }));
    await updateSetting('default_nudge_days', String(days));
  }, []);

  const handleExportJSON = useCallback(async () => {
    try {
      const data = await exportJSON();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `myfriends-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silently handle
    }
  }, []);

  const handleExportCSV = useCallback(async () => {
    if (!csvTable) return;
    try {
      const csv = await exportTableCSV(csvTable);
      if (!csv) {
        alert('No data in this table.');
        return;
      }
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const label =
        CSV_TABLES.find((t) => t.table === csvTable)?.label ?? csvTable;
      a.download = `myfriends-${label.toLowerCase()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silently handle
    }
  }, [csvTable]);

  const handleDeleteAll = useCallback(async () => {
    if (deleteConfirm !== 'DELETE') return;
    if (!confirm('This will permanently erase all MyFriends data. Continue?')) {
      return;
    }
    try {
      await deleteAll();
      setDeleteConfirm('');
      setShowDeleteInput(false);
      const newStats = await fetchDataStats();
      setStats(newStats);
      alert('All MyFriends data has been deleted.');
    } catch {
      // silently handle
    }
  }, [deleteConfirm]);

  const biometric = settings.biometric_lock_enabled === 'true';
  const nudge = settings.nudge_enabled !== 'false';
  const drift = settings.drift_detection_enabled !== 'false';
  const effortBalance = settings.effort_balance_visible === 'true';
  const nudgeDays = Number(settings.default_nudge_days) || 30;

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: TEXT_SEC }}>Loading...</p>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Privacy Badge */}
      <div style={privacyBadgeStyle}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={SUCCESS} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <span style={{ fontSize: 13, fontWeight: 600, color: SUCCESS }}>
          Device-only. Zero cloud. Zero tracking.
        </span>
      </div>

      {/* Privacy & Security */}
      <Section title="Privacy & Security" icon={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
        </svg>
      }>
        <Card>
          <SettingRow
            label="Biometric Lock"
            description="Set the flag for Face ID / Fingerprint protection (mobile only)"
            checked={biometric}
            onChange={() => toggle('biometric_lock_enabled', biometric)}
          />
          <p style={privacyNoteStyle}>
            This is the most private module. Your data never leaves this device.
          </p>
        </Card>
      </Section>

      {/* Notifications */}
      <Section title="Notifications">
        <Card>
          <SettingRow
            label="Nudge Reminders"
            description="Gentle reminders to reach out to friends"
            checked={nudge}
            onChange={() => toggle('nudge_enabled', nudge)}
          />
          <div style={dividerStyle} />
          <SettingRow
            label="Drift Detection"
            description="Alert when you are losing touch with someone"
            checked={drift}
            onChange={() => toggle('drift_detection_enabled', drift)}
          />
          <div style={dividerStyle} />
          <p style={{ ...labelStyle, marginBottom: 2 }}>Default Nudge Threshold</p>
          <p style={descStyle}>Days before a nudge reminder fires</p>
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            {NUDGE_THRESHOLDS.map((days) => (
              <button
                key={days}
                onClick={() => selectNudgeDays(days)}
                style={nudgeDays === days ? dayChipActiveStyle : dayChipStyle}
              >
                {days}d
              </button>
            ))}
          </div>
        </Card>
      </Section>

      {/* Insights */}
      <Section title="Insights">
        <Card>
          <SettingRow
            label="Effort Balance"
            description="Show who initiates vs who responds in relationships"
            checked={effortBalance}
            onChange={() => toggle('effort_balance_visible', effortBalance)}
          />
        </Card>
      </Section>

      {/* Data */}
      <Section title="Data">
        <Card>
          {stats && (
            <div style={statsGridStyle}>
              <StatItem label="People" count={stats.people} />
              <StatItem label="Circles" count={stats.circles} />
              <StatItem label="Hangouts" count={stats.hangouts} />
              <StatItem label="Gifts" count={stats.gifts} />
              <StatItem label="Ideas" count={stats.giftIdeas} />
              <StatItem label="Memories" count={stats.memories} />
              <StatItem label="Events" count={stats.lifeEvents} />
              <StatItem label="Nudges" count={stats.nudges} />
              <StatItem label="Photos" count={stats.photos} />
            </div>
          )}
          <div style={dividerStyle} />

          <button onClick={handleExportJSON} style={exportButtonStyle}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export as JSON
          </button>

          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <select
              value={csvTable}
              onChange={(e) => setCsvTable(e.target.value)}
              style={selectStyle}
            >
              <option value="">Select table...</option>
              {CSV_TABLES.map((t) => (
                <option key={t.table} value={t.table}>
                  {t.label}
                </option>
              ))}
            </select>
            <button
              onClick={handleExportCSV}
              disabled={!csvTable}
              style={{
                ...exportButtonStyle,
                marginTop: 0,
                opacity: csvTable ? 1 : 0.4,
              }}
            >
              Export CSV
            </button>
          </div>
        </Card>
      </Section>

      {/* Danger Zone */}
      <Section title="Danger Zone" titleColor={DANGER}>
        <div style={dangerCardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={DANGER} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
            <span style={{ fontSize: 15, fontWeight: 700, color: DANGER }}>
              Delete All MyFriends Data
            </span>
          </div>
          <p style={{ fontSize: 13, color: TEXT_SEC, lineHeight: 1.5, margin: '0 0 16px' }}>
            Permanently removes all people, hangouts, memories, gifts, and
            settings. This cannot be undone.
          </p>

          {showDeleteInput ? (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value.toUpperCase())}
                placeholder="Type DELETE to confirm"
                style={deleteInputStyle}
              />
              <button
                onClick={handleDeleteAll}
                disabled={deleteConfirm !== 'DELETE'}
                style={{
                  ...deleteButtonStyle,
                  opacity: deleteConfirm === 'DELETE' ? 1 : 0.4,
                  cursor: deleteConfirm === 'DELETE' ? 'pointer' : 'not-allowed',
                }}
              >
                Confirm
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteInput(true)}
              style={dangerTriggerStyle}
            >
              Delete all data...
            </button>
          )}
        </div>
      </Section>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────

function Section({
  title,
  titleColor,
  icon,
  children,
}: {
  title: string;
  titleColor?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        {icon}
        <h2 style={{ fontSize: 16, fontWeight: 700, color: titleColor ?? TEXT, margin: 0 }}>
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div style={cardStyle}>{children}</div>;
}

function SettingRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div style={settingRowStyle}>
      <div style={{ flex: 1, marginRight: 12 }}>
        <p style={labelStyle}>{label}</p>
        <p style={descStyle}>{description}</p>
      </div>
      <button
        onClick={onChange}
        style={{
          ...toggleStyle,
          backgroundColor: checked ? ACCENT : SURFACE_ELEVATED,
        }}
      >
        <span
          style={{
            ...toggleThumbStyle,
            transform: checked ? 'translateX(18px)' : 'translateX(0)',
          }}
        />
      </button>
    </div>
  );
}

function StatItem({ label, count }: { label: string; count: number }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 60 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: TEXT }}>{count}</div>
      <div style={{ fontSize: 11, color: TEXT_SEC, marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  padding: 24,
  maxWidth: 640,
};

const privacyBadgeStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  background: 'rgba(48, 209, 88, 0.08)',
  borderRadius: 12,
  border: '1px solid rgba(48, 209, 88, 0.2)',
  padding: '10px 14px',
  marginBottom: 24,
};

const cardStyle: React.CSSProperties = {
  background: SURFACE,
  borderRadius: 16,
  border: `1px solid ${BORDER}`,
  padding: 16,
};

const settingRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '4px 0',
};

const labelStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: TEXT,
  margin: 0,
};

const descStyle: React.CSSProperties = {
  fontSize: 13,
  color: TEXT_SEC,
  lineHeight: 1.4,
  margin: 0,
};

const privacyNoteStyle: React.CSSProperties = {
  fontSize: 12,
  color: TEXT_SEC,
  fontStyle: 'italic',
  marginTop: 12,
  paddingTop: 12,
  borderTop: `1px solid ${BORDER}`,
  marginBottom: 0,
};

const dividerStyle: React.CSSProperties = {
  height: 1,
  background: BORDER,
  margin: '14px 0',
};

const toggleStyle: React.CSSProperties = {
  width: 44,
  height: 26,
  borderRadius: 13,
  border: 'none',
  cursor: 'pointer',
  position: 'relative',
  padding: 2,
  transition: 'background-color 0.2s',
  flexShrink: 0,
};

const toggleThumbStyle: React.CSSProperties = {
  display: 'block',
  width: 22,
  height: 22,
  borderRadius: 11,
  background: '#E4E1E9',
  transition: 'transform 0.2s',
};

const dayChipStyle: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 20,
  background: SURFACE_ELEVATED,
  border: `1px solid ${BORDER}`,
  color: TEXT_SEC,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};

const dayChipActiveStyle: React.CSSProperties = {
  ...dayChipStyle,
  background: ACCENT,
  borderColor: ACCENT,
  color: '#FFFFFF',
};

const statsGridStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
};

const exportButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '12px 14px',
  borderRadius: 12,
  background: SURFACE_ELEVATED,
  border: 'none',
  color: TEXT,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  marginTop: 10,
};

const selectStyle: React.CSSProperties = {
  flex: 1,
  padding: '10px 12px',
  borderRadius: 10,
  background: '#131318',
  border: `1px solid ${BORDER}`,
  color: TEXT,
  fontSize: 14,
};

const dangerCardStyle: React.CSSProperties = {
  ...cardStyle,
  borderColor: 'rgba(255, 180, 171, 0.2)',
};

const deleteInputStyle: React.CSSProperties = {
  flex: 1,
  background: '#131318',
  borderRadius: 10,
  border: `1px solid ${BORDER}`,
  padding: '10px 12px',
  fontSize: 14,
  color: TEXT,
};

const deleteButtonStyle: React.CSSProperties = {
  background: DANGER_BG,
  padding: '10px 16px',
  borderRadius: 10,
  border: 'none',
  fontSize: 14,
  fontWeight: 700,
  color: DANGER,
  cursor: 'pointer',
};

const dangerTriggerStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 10,
  background: 'rgba(147, 0, 10, 0.2)',
  border: 'none',
  fontSize: 14,
  fontWeight: 600,
  color: DANGER,
  cursor: 'pointer',
};
