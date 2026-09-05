'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  PresenceCard,
  PresenceEmptyState,
  PresenceSectionHeading,
  MaterialSymbol,
  TOKENS,
  ghostButtonStyle,
  gradientButtonStyle,
} from '../ui';
import { doCreateSession, fetchPresenceHubSnapshot } from '../actions';

interface HubSnapshot {
  daysTracked: number;
  hubVisitCount: number;
  unlocks: Array<{ label: string; title: string; unlocked: boolean }>;
}

const QUICK_STARTS = [
  { title: '5-Minute Reset', subtitle: 'Short solo reset', icon: 'psychology', minutes: 5, type: 'solo' as const },
  { title: 'Deep Work', subtitle: '90 minute solo block', icon: 'timer', minutes: 90, type: 'solo' as const },
  { title: 'No Phone Hour', subtitle: '60 minute boundary block', icon: 'bedtime', minutes: 60, type: 'solo' as const },
  { title: 'Beast Mode', subtitle: 'High-intensity sprint', icon: 'local_fire_department', minutes: 45, type: 'beast' as const },
];

const EDUCATION_CARDS = [
  { title: 'ADHD and screen time', subtitle: 'Attention-friendly boundaries', icon: 'psychology' },
  { title: 'Sleep hygiene', subtitle: 'Wind-down rhythms that stick', icon: 'bedtime' },
  { title: 'Mindfulness', subtitle: 'Presence over reaction', icon: 'lightbulb' },
  { title: 'Behavior design', subtitle: 'Make friction work for you', icon: 'science' },
];

const BRIDGES = [
  { title: 'Pair with MyMood', subtitle: 'Catch the feeling behind the scroll.', href: '/mood', icon: 'psychology' },
  { title: 'Pair with MyHabits', subtitle: 'Turn focus blocks into repeatable routines.', href: '/habits', icon: 'check_circle' },
  { title: 'Pair with MyHealth', subtitle: 'Use wind-downs to protect sleep.', href: '/health', icon: 'bedtime' },
];

export default function PresenceHubPage() {
  const [data, setData] = useState<HubSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  async function loadData() {
    try {
      setError(null);
      setData((await fetchPresenceHubSnapshot()) as HubSnapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the Presence hub.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleQuickStart(minutes: number, type: 'solo' | 'beast') {
    try {
      setStarting(true);
      await doCreateSession({ planned_minutes: minutes, type });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start that session.');
    } finally {
      setStarting(false);
    }
  }

  if (loading) {
    return <PresenceCard style={{ minHeight: 260 }} />;
  }

  if (error && data == null) {
    return (
      <PresenceEmptyState
        icon="warning"
        title="Hub unavailable"
        body={error}
      />
    );
  }

  return (
    <div className="pr-main-stack">
      <PresenceCard
        padding={28}
        style={{
          background: 'linear-gradient(135deg, rgba(34,211,238,0.16), rgba(19,19,24,0.94) 58%)',
        }}
      >
        <PresenceSectionHeading
          title="Discover Hub"
          subtitle="Quick starts, progressive unlocks, challenge teasers, education snippets, and cross-module bridges that turn digital wellness into a broader practice."
        />
        <div className="pr-grid-2" style={{ marginTop: 20, alignItems: 'center' }}>
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ color: TOKENS.textTertiary, fontSize: 11, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
              Discovery progress
            </div>
            <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.04em' }}>
              {data?.daysTracked ?? 0} days tracked
            </div>
            <div style={{ color: TOKENS.textSecondary, fontSize: 15, lineHeight: 1.8 }}>
              Every visit to the hub moves the Discoverer badge forward and unlocks richer analytics as your local history grows.
            </div>
          </div>
          <div
            style={{
              marginLeft: 'auto',
              width: 180,
              aspectRatio: '1 / 1',
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              border: `1.5px solid ${TOKENS.borderStrong}`,
              background: 'rgba(34,211,238,0.08)',
              textAlign: 'center',
            }}
          >
            <div>
              <div style={{ color: TOKENS.accentLight, fontSize: 46, fontWeight: 800, lineHeight: 1 }}>{data?.hubVisitCount ?? 0}</div>
              <div style={{ color: TOKENS.textTertiary, fontSize: 12, marginTop: 8 }}>hub visits</div>
            </div>
          </div>
        </div>
      </PresenceCard>

      <PresenceCard>
        <PresenceSectionHeading title="Quick Start" subtitle="Preset sessions for when you need a reset without thinking too hard about setup." />
        <div className="pr-grid-4" style={{ marginTop: 18 }}>
          {QUICK_STARTS.map((tile) => (
            <button
              key={tile.title}
              type="button"
              onClick={() => void handleQuickStart(tile.minutes, tile.type)}
              style={{
                padding: 18,
                borderRadius: 24,
                border: `1.5px solid ${TOKENS.borderStrong}`,
                background: 'rgba(255,255,255,0.04)',
                textAlign: 'left',
                cursor: 'pointer',
                display: 'grid',
                gap: 16,
              }}
              disabled={starting}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <MaterialSymbol name={tile.icon} size={22} color={tile.type === 'beast' ? TOKENS.beast : TOKENS.accentLight} />
                <span style={{ color: TOKENS.textTertiary, fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                  {tile.minutes}m
                </span>
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{tile.title}</div>
                <div style={{ color: TOKENS.textSecondary, fontSize: 13, lineHeight: 1.6, marginTop: 8 }}>{tile.subtitle}</div>
              </div>
            </button>
          ))}
        </div>
      </PresenceCard>

      <div className="pr-grid-2">
        <PresenceCard>
          <PresenceSectionHeading title="Progressive Unlocks" subtitle="As more local history accumulates, Presence can surface stronger pattern detection." />
          <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
            {data?.unlocks.map((unlock) => (
              <div key={unlock.title} style={{ padding: 18, borderRadius: 24, border: `1.5px solid ${unlock.unlocked ? TOKENS.borderStrong : TOKENS.border}`, background: unlock.unlocked ? 'rgba(34,211,238,0.08)' : 'rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
                <div>
                  <div style={{ color: TOKENS.textTertiary, fontSize: 11, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}>{unlock.label}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginTop: 6 }}>{unlock.title}</div>
                </div>
                <div style={{ color: unlock.unlocked ? TOKENS.success : TOKENS.textTertiary, fontSize: 12, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                  {unlock.unlocked ? 'Unlocked' : 'Locked'}
                </div>
              </div>
            ))}
          </div>
        </PresenceCard>

        <PresenceCard>
          <PresenceSectionHeading title="Challenges" subtitle="A preview of the themed challenge system planned for future Presence phases." />
          <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
            {['7-Day Detox', 'No Social Sunday', 'Weekend Warrior'].map((challenge) => (
              <div key={challenge} style={{ padding: 18, borderRadius: 24, background: 'rgba(255,255,255,0.04)', border: `1.5px solid ${TOKENS.border}` }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{challenge}</div>
                <div style={{ color: TOKENS.textSecondary, fontSize: 13, lineHeight: 1.6, marginTop: 8 }}>
                  A themed challenge track will live here once social-less local challenge persistence is added.
                </div>
              </div>
            ))}
          </div>
        </PresenceCard>
      </div>

      <div className="pr-grid-2">
        <PresenceCard>
          <PresenceSectionHeading title="Education Library" subtitle="Short prompts that explain why each boundary pattern works." />
          <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
            {EDUCATION_CARDS.map((card) => (
              <div key={card.title} style={{ padding: 18, borderRadius: 24, background: 'rgba(255,255,255,0.04)', border: `1.5px solid ${TOKENS.border}`, display: 'flex', gap: 14 }}>
                <div style={{ width: 42, height: 42, borderRadius: 14, background: 'rgba(34,211,238,0.1)', display: 'grid', placeItems: 'center' }}>
                  <MaterialSymbol name={card.icon} size={20} color={TOKENS.accentLight} />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{card.title}</div>
                  <div style={{ color: TOKENS.textSecondary, fontSize: 13, lineHeight: 1.6, marginTop: 8 }}>{card.subtitle}</div>
                </div>
              </div>
            ))}
          </div>
        </PresenceCard>

        <PresenceCard>
          <PresenceSectionHeading title="Cross-Module Bridges" subtitle="Use related modules to make Presence habits easier to sustain." />
          <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
            {BRIDGES.map((bridge) => (
              <Link
                key={bridge.title}
                href={bridge.href}
                style={{
                  padding: 18,
                  borderRadius: 24,
                  background: 'rgba(255,255,255,0.04)',
                  border: `1.5px solid ${TOKENS.border}`,
                  textDecoration: 'none',
                  display: 'flex',
                  gap: 14,
                }}
              >
                <div style={{ width: 42, height: 42, borderRadius: 14, background: 'rgba(168,85,247,0.12)', display: 'grid', placeItems: 'center' }}>
                  <MaterialSymbol name={bridge.icon} size={20} color={TOKENS.group} />
                </div>
                <div>
                  <div style={{ color: TOKENS.text, fontSize: 15, fontWeight: 700 }}>{bridge.title}</div>
                  <div style={{ color: TOKENS.textSecondary, fontSize: 13, lineHeight: 1.6, marginTop: 8 }}>{bridge.subtitle}</div>
                </div>
              </Link>
            ))}
          </div>
        </PresenceCard>
      </div>

      <PresenceCard>
        <PresenceSectionHeading title="Suggested Next Stops" subtitle="The routes most likely to compound after opening the hub." />
        <div className="pr-chip-row" style={{ marginTop: 18 }}>
          <Link href="/presence/insights" style={{ ...gradientButtonStyle, textDecoration: 'none' }}>
            Open Insights
          </Link>
          <Link href="/presence/badges" style={{ ...ghostButtonStyle, textDecoration: 'none' }}>
            View Badges
          </Link>
          <Link href="/presence/report" style={{ ...ghostButtonStyle, textDecoration: 'none' }}>
            Open Report
          </Link>
        </div>
      </PresenceCard>
    </div>
  );
}
