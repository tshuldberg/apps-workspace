'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEnabledModules } from '@mylife/module-registry/hooks';
import type { ModuleDefinition, ModuleSummary, ActivityItem } from '@mylife/module-registry';
import { MODULE_ICON_MAP } from '@/lib/module-icons';
import { isWebSupportedModuleId } from '@/lib/modules';
import { UpdatePrompt } from '@/components/UpdatePrompt';
import { fetchDashboardSummaries, fetchActivityFeed, isOnboardingCompleteAction } from '../actions';

/* ── constants ──────────────────────────────────────── */

const GLASS = 'rgba(255,255,255,0.04)';
const GLASS_BORDER = 'rgba(255,255,255,0.10)';
const SURFACE_EL = '#1A1A24';
const BORDER = 'rgba(255,255,255,0.06)';
const TEXT = '#F0F0F5';
const TEXT_SEC = 'rgba(240,240,245,0.65)';
const TEXT_TER = 'rgba(240,240,245,0.35)';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/* ── quick actions ───────────────────────────────────── */

const QUICK_ACTIONS: Array<{ label: string; href: string; icon: string }> = [
  { label: 'Log workout', href: '/workouts', icon: '💪' },
  { label: 'Add book', href: '/books/search', icon: '📚' },
  { label: 'Track budget', href: '/budget', icon: '💰' },
  { label: 'Plan event', href: '/rsvp', icon: '💌' },
  { label: 'Check surf', href: '/surf', icon: '🏄' },
  { label: 'Browse recipes', href: '/recipes', icon: '🍳' },
];

/* ── page ───────────────────────────────────────────── */

export default function HubDashboard() {
  const router = useRouter();
  const allEnabled = useEnabledModules().filter((mod) => isWebSupportedModuleId(mod.id));
  const [summaries, setSummaries] = useState<Map<string, ModuleSummary>>(new Map());
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check onboarding status on mount -- redirect if not completed
  useEffect(() => {
    isOnboardingCompleteAction().then((complete) => {
      if (!complete) router.replace('/onboarding/setup');
    });
  }, [router]);

  const modulesWithSummary = useMemo(
    () => allEnabled.filter((m) => summaries.has(m.id)),
    [allEnabled, summaries],
  );
  const modulesWithoutSummary = useMemo(
    () => allEnabled.filter((m) => !summaries.has(m.id)),
    [allEnabled, summaries],
  );

  const loadDashboard = useCallback(async (signal?: AbortSignal) => {
    try {
      const [sumResult, feedResult] = await Promise.all([
        fetchDashboardSummaries(),
        fetchActivityFeed(7),
      ]);
      if (signal?.aborted) return;
      const map = new Map<string, ModuleSummary>();
      for (const item of sumResult) {
        map.set(item.moduleId, item.summary);
      }
      setSummaries(map);
      setActivity(feedResult);
      setError(null);
    } catch (err) {
      if (signal?.aborted) return;
      const message =
        err instanceof Error && err.message ? err.message : 'Failed to load dashboard data';
      setError(message);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    // 15s hard timeout so a slow server doesn't leave the user on a perpetual
    // skeleton. Surfaces as the error card with retry.
    const timeoutId = setTimeout(() => {
      controller.abort();
      setError('Dashboard timed out. Please try again.');
      setLoading(false);
    }, 15_000);
    void loadDashboard(controller.signal).finally(() => clearTimeout(timeoutId));
    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [loadDashboard]);

  /* ── empty (checked before loading -- no need to fetch if no modules) ── */

  if (allEnabled.length === 0) {
    return (
      <div style={s.centerCard}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✨</div>
        <h2 style={{ margin: 0, fontSize: 24, color: TEXT }}>Welcome to MyLife</h2>
        <p style={{ color: TEXT_SEC, margin: '8px 0 20px', maxWidth: 400, textAlign: 'center' }}>
          Your personal hub for books, budgets, workouts, recipes, and 25 more modules. Enable modules to build your dashboard.
        </p>
        <Link href="/discover" style={s.ctaBtn}>
          Discover Modules
        </Link>
      </div>
    );
  }

  /* ── loading ───────────────────────────────────── */

  if (loading) {
    return (
      <div>
        <div style={s.greetingRow}>
          <div className="mylife-skeleton" style={{ ...s.skeleton, width: 260, height: 36 }} />
          <div className="mylife-skeleton" style={{ ...s.skeleton, width: 120, height: 20 }} />
        </div>
        <div style={{ ...s.summaryGrid, marginTop: 24 }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="mylife-skeleton" style={{ ...s.skeleton, height: 140 }} />
          ))}
        </div>
      </div>
    );
  }

  /* ── error (only when we have modules but data fetch failed) ── */

  if (error) {
    return (
      <div style={s.centerCard}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
        <h2 style={{ margin: 0, color: TEXT }}>Something went wrong</h2>
        <p style={{ color: TEXT_SEC, margin: '8px 0 16px' }}>{error}</p>
        <button style={s.retryBtn} onClick={() => { setError(null); setLoading(true); void loadDashboard(); }}>
          Try Again
        </button>
      </div>
    );
  }

  /* ── dashboard ─────────────────────────────────── */

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Greeting */}
      <div style={s.greetingRow}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: TEXT }}>
            {greeting()}
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: TEXT_SEC }}>
            {allEnabled.length} module{allEnabled.length !== 1 ? 's' : ''} active
            {modulesWithSummary.length > 0 && (
              <> · {modulesWithSummary.reduce((sum, m) => sum + (summaries.get(m.id)?.totalItems ?? 0), 0)} total items</>
            )}
          </p>
        </div>
      </div>

      <UpdatePrompt />

      {/* Quick Actions */}
      <div style={s.quickRow}>
        {QUICK_ACTIONS.filter((a) => allEnabled.some((m) => a.href.startsWith(`/${m.id}`))).map((action) => (
          <Link key={action.href} href={action.href} style={s.quickAction}>
            <span style={{ fontSize: 18 }}>{action.icon}</span>
            <span style={{ fontSize: 12, color: TEXT_SEC, fontWeight: 600 }}>{action.label}</span>
          </Link>
        ))}
      </div>

      {/* Summary Cards (modules with crossModule data) */}
      {modulesWithSummary.length > 0 && (
        <section>
          <h2 style={s.sectionLabel}>Your Data</h2>
          <div style={s.summaryGrid}>
            {modulesWithSummary.map((mod) => {
              const summary = summaries.get(mod.id)!;
              return (
                <SummaryCard
                  key={mod.id}
                  module={mod}
                  summary={summary}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* Activity Feed */}
      {activity.length > 0 && (
        <section>
          <h2 style={s.sectionLabel}>Recent Activity</h2>
          <div style={s.feedCard}>
            {activity.slice(0, 10).map((item, i) => {
              const mod = allEnabled.find((m) => m.id === item.moduleId);
              return (
                <div key={`${item.timestamp}-${i}`} style={s.feedItem}>
                  <div style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: mod?.accentColor ?? TEXT_TER,
                    flexShrink: 0,
                    marginTop: 6,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: TEXT }}>{item.description}</div>
                    <div style={{ fontSize: 11, color: TEXT_TER, marginTop: 2 }}>
                      {mod?.name ?? item.moduleId} · {timeAgo(item.timestamp)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* All Modules Grid */}
      {modulesWithoutSummary.length > 0 && (
        <section>
          <h2 style={s.sectionLabel}>Modules</h2>
          <div style={s.moduleGrid}>
            {modulesWithoutSummary.map((mod) => (
              <ModuleTile key={mod.id} module={mod} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ── components ──────────────────────────────────────── */

function SummaryCard({ module, summary }: { module: ModuleDefinition; summary: ModuleSummary }) {
  const IconComponent = MODULE_ICON_MAP[module.id];
  const statEntries = Object.entries(summary.stats).slice(0, 3);

  return (
    <Link href={`/${module.id}`} style={s.summaryCard}>
      <div style={{ ...s.accentBar, backgroundColor: module.accentColor }} />
      <div style={s.summaryContent}>
        <div style={s.summaryHeader}>
          <span style={{
            ...s.iconBadge,
            backgroundColor: `${module.accentColor}1A`,
          }}>
            {IconComponent ? <IconComponent size={18} style={{ color: '#fff' }} /> : <span>{module.icon}</span>}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: TEXT }}>{module.name}</div>
            <div style={{ fontSize: 12, color: TEXT_SEC, marginTop: 1 }}>{summary.totalItems} items</div>
          </div>
        </div>
        {statEntries.length > 0 && (
          <div style={s.statsRow}>
            {statEntries.map(([key, value]) => (
              <div key={key} style={s.statItem}>
                <div style={{ fontSize: 16, fontWeight: 700, color: module.accentColor }}>
                  {typeof value === 'number' ? (Number.isInteger(value) ? value : value.toFixed(1)) : value}
                </div>
                <div style={{ fontSize: 10, color: TEXT_TER, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, marginTop: 2 }}>
                  {key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
                </div>
              </div>
            ))}
          </div>
        )}
        {summary.lastActivity && (
          <div style={{ fontSize: 11, color: TEXT_TER, marginTop: 8 }}>
            Last active {timeAgo(summary.lastActivity)}
          </div>
        )}
      </div>
    </Link>
  );
}

function ModuleTile({ module }: { module: ModuleDefinition }) {
  const IconComponent = MODULE_ICON_MAP[module.id];

  return (
    <Link href={`/${module.id}`} style={s.moduleTile}>
      <span style={{
        ...s.tileIcon,
        backgroundColor: `${module.accentColor}1A`,
      }}>
        {IconComponent ? <IconComponent size={20} style={{ color: '#fff' }} /> : <span style={{ fontSize: 20 }}>{module.icon}</span>}
      </span>
      <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{module.name}</div>
      <div style={{ fontSize: 11, color: TEXT_TER }}>{module.tagline}</div>
    </Link>
  );
}

/* ── styles ──────────────────────────────────────────── */

const s: Record<string, CSSProperties> = {
  /* greeting */
  greetingRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 16,
    flexWrap: 'wrap',
  },

  /* section label */
  sectionLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: TEXT_TER,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    margin: '0 0 12px 0',
  },

  /* quick actions */
  quickRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  quickAction: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 14px',
    borderRadius: 10,
    background: GLASS,
    border: `1px solid ${BORDER}`,
    textDecoration: 'none',
    color: TEXT,
    transition: 'border-color 0.15s',
  },

  /* summary cards */
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 14,
  },
  summaryCard: {
    display: 'flex',
    flexDirection: 'row',
    background: GLASS,
    border: `1px solid ${GLASS_BORDER}`,
    borderRadius: 16,
    overflow: 'hidden',
    textDecoration: 'none',
    color: 'inherit',
    transition: 'border-color 0.15s',
  },
  accentBar: {
    width: 4,
    flexShrink: 0,
  },
  summaryContent: {
    flex: 1,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  },
  summaryHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statsRow: {
    display: 'flex',
    gap: 16,
    marginTop: 12,
    paddingTop: 12,
    borderTop: `1px solid ${BORDER}`,
  },
  statItem: {
    flex: 1,
    minWidth: 0,
  },

  /* activity feed */
  feedCard: {
    background: GLASS,
    border: `1px solid ${GLASS_BORDER}`,
    borderRadius: 16,
    padding: '4px 16px',
  },
  feedItem: {
    display: 'flex',
    gap: 10,
    alignItems: 'flex-start',
    padding: '10px 0',
    borderBottom: `1px solid ${BORDER}`,
  },

  /* module grid */
  moduleGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: 10,
  },
  moduleTile: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    padding: '16px 12px',
    borderRadius: 14,
    background: GLASS,
    border: `1px solid ${BORDER}`,
    textDecoration: 'none',
    textAlign: 'center',
    color: 'inherit',
    transition: 'border-color 0.15s',
  },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* states */
  centerCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
    background: GLASS,
    border: `1px solid ${GLASS_BORDER}`,
    borderRadius: 16,
    minHeight: 300,
  },
  retryBtn: {
    background: '#3B82F6',
    border: 'none',
    borderRadius: 8,
    color: '#fff',
    fontWeight: 700,
    padding: '8px 16px',
    fontSize: 13,
    cursor: 'pointer',
  },
  ctaBtn: {
    display: 'inline-block',
    background: '#3B82F6',
    borderRadius: 8,
    color: '#fff',
    fontWeight: 700,
    padding: '10px 20px',
    fontSize: 14,
    textDecoration: 'none',
  },
  skeleton: {
    background: `linear-gradient(90deg, ${SURFACE_EL} 0%, ${GLASS} 50%, ${SURFACE_EL} 100%)`,
    backgroundSize: '200% 100%',
    borderRadius: 12,
    height: 60,
  },
};
