'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchProfiles, fetchStats } from '../actions';
import type { BirthProfile, StarsStats } from '@mylife/stars';
import {
  InlineBadge,
  STARS_ACCENT_LIGHT,
  STARS_GOLD,
  STARS_TEXT,
  STARS_TEXT_SECONDARY,
  SectionTitle,
  StarsSymbol,
  panelStyle,
  secondaryButtonStyle,
  withAlpha,
} from '../ui';

export default function StarsSettingsPage() {
  const [profiles, setProfiles] = useState<BirthProfile[]>([]);
  const [stats, setStats] = useState<StarsStats | null>(null);
  const [notifications, setNotifications] = useState({
    dailyReading: true,
    moonAlerts: true,
    retrogradeAlerts: false,
    transitAlerts: false,
  });
  const [appearance, setAppearance] = useState({
    westernSymbols: true,
    degreePrecision: false,
    chartLines: true,
  });

  useEffect(() => {
    void Promise.all([fetchProfiles(), fetchStats()])
      .then(([profileItems, statItems]) => {
        setProfiles(profileItems);
        setStats(statItems);
      })
      .catch((error) => {
        console.error(error);
      });
  }, []);

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section className="stars-card-glow" style={{ ...panelStyle({ padding: 28, tone: '#15151B', glow: true }), display: 'grid', gap: 18 }}>
        <SectionTitle
          eyebrow="Settings"
          title="Private by default, cosmic when you want it"
          detail="The desktop settings surface groups every live stars preference into one place, while still honoring the module's local-first storage model."
        />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <InlineBadge label={`${profiles.length} profile${profiles.length === 1 ? '' : 's'}`} icon="group" />
          <InlineBadge label={`${stats?.totalReadings ?? 0} readings`} tone={withAlpha(STARS_GOLD, 0.16)} textColor={STARS_GOLD} />
          <InlineBadge label={`${stats?.totalSavedCharts ?? 0} saved charts`} tone={withAlpha(STARS_ACCENT_LIGHT, 0.16)} textColor={STARS_ACCENT_LIGHT} />
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
        <SectionCard title="Profiles" body="Manage profiles, switch chart focus, or launch into deeper detail views." action={<Link href="/stars/profile" style={secondaryButtonStyle()}><StarsSymbol name="group" size={18} color={STARS_ACCENT_LIGHT} />Open profiles</Link>} />
        <SectionCard title="Preferences" body="House system, zodiac type, and orb presets are exposed as shell-level presets here while the chart engine stays local." />
        <SectionCard title="Notifications" body="Daily reading reminders, moon alerts, retrograde starts, and major transit nudges can be toggled without leaving the web shell.">
          <ToggleRow label="Daily reading reminder" checked={notifications.dailyReading} onChange={() => setNotifications((value) => ({ ...value, dailyReading: !value.dailyReading }))} />
          <ToggleRow label="New and full moon alerts" checked={notifications.moonAlerts} onChange={() => setNotifications((value) => ({ ...value, moonAlerts: !value.moonAlerts }))} />
          <ToggleRow label="Retrograde start alerts" checked={notifications.retrogradeAlerts} onChange={() => setNotifications((value) => ({ ...value, retrogradeAlerts: !value.retrogradeAlerts }))} />
          <ToggleRow label="Major transit nudges" checked={notifications.transitAlerts} onChange={() => setNotifications((value) => ({ ...value, transitAlerts: !value.transitAlerts }))} />
        </SectionCard>
        <SectionCard title="Appearance" body="Western or alternate symbol sets, chart line visibility, and degree precision live here for the desktop surface.">
          <ToggleRow label="Western symbols" checked={appearance.westernSymbols} onChange={() => setAppearance((value) => ({ ...value, westernSymbols: !value.westernSymbols }))} />
          <ToggleRow label="Show exact degree precision" checked={appearance.degreePrecision} onChange={() => setAppearance((value) => ({ ...value, degreePrecision: !value.degreePrecision }))} />
          <ToggleRow label="Show chart aspect lines" checked={appearance.chartLines} onChange={() => setAppearance((value) => ({ ...value, chartLines: !value.chartLines }))} />
        </SectionCard>
        <SectionCard title="Data" body="The Stars module stays local-first. Use the archive screens to review and export before clearing anything.">
          <Link href="/stars/journal" style={secondaryButtonStyle()}>
            <StarsSymbol name="menu_book" size={18} color={STARS_ACCENT_LIGHT} />
            Review journal
          </Link>
          <Link href="/stars/readings" style={secondaryButtonStyle()}>
            <StarsSymbol name="history" size={18} color={STARS_ACCENT_LIGHT} />
            Review reading archive
          </Link>
        </SectionCard>
        <SectionCard title="About" body="MyStars uses local SQLite storage, deterministic moon calculations, tarot deck data, and chart heuristics to keep the entire module private." />
      </div>
    </div>
  );
}

function SectionCard({
  title,
  body,
  children,
  action,
}: {
  title: string;
  body: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section style={{ ...panelStyle({ padding: 22, tone: '#15151B' }), display: 'grid', gap: 12 }}>
      <strong style={{ color: STARS_TEXT, fontSize: 22, letterSpacing: '-0.04em' }}>{title}</strong>
      <p style={{ margin: 0, color: STARS_TEXT_SECONDARY, fontSize: 14, lineHeight: 1.8 }}>{body}</p>
      {children}
      {action}
    </section>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      style={{
        ...panelStyle({ padding: 14, tone: '#111117' }),
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <span style={{ color: STARS_TEXT, fontSize: 14 }}>{label}</span>
      <span
        style={{
          width: 48,
          height: 28,
          borderRadius: 999,
          background: checked ? `linear-gradient(90deg, ${STARS_ACCENT_LIGHT}, ${STARS_GOLD})` : withAlpha('#FFFFFF', 0.08),
          display: 'inline-flex',
          alignItems: 'center',
          padding: 3,
          justifyContent: checked ? 'flex-end' : 'flex-start',
        }}
      >
        <span style={{ width: 22, height: 22, borderRadius: 999, background: checked ? '#0E0E13' : '#E4E1E9' }} />
      </span>
    </button>
  );
}
