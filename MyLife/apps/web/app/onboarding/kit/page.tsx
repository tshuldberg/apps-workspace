'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MODULE_METADATA } from '@mylife/module-registry';
import type { ModuleId } from '@mylife/module-registry';
import { completeOnboardingAction } from '@/app/actions';
import { isWebSupportedModuleId, isWebVisibleModuleId } from '@/lib/modules';

// ── Tokens (Cool Obsidian) ──────────────────────────────────────────

const BACKGROUND = '#131318';
const SURFACE = '#2A292F';
const TEXT = '#E4E1E9';
const TEXT_SECONDARY = '#D6C3B5';
const PRIMARY = '#FFB877';
const PRIMARY_CONTAINER = '#C9894D';
const BORDER = 'rgba(255,255,255,0.06)';

// Cluster → modules mapping. Each list contains only modules that are actually
// deliverable on web, meaning they pass both isWebSupportedModuleId (real web
// route) and isWebVisibleModuleId (GA, public-beta, or web visibility
// override) so completeOnboardingAction will truly enable them. Modules that
// are hidden or unsupported on web are intentionally omitted here, and the
// goal-screen copy (app/onboarding/goal/page.tsx) names only these modules so
// the promise and the result match. Keep this aligned with lib/modules.ts and
// the goal-screen descriptions when web visibility changes.
const CLUSTER_MODULES: Record<string, readonly ModuleId[]> = {
  body: ['health', 'workouts', 'nutrition', 'sleep', 'sports', 'cycle', 'meds', 'mood'],
  mind: ['mood', 'books'],
  home: ['garden'],
  money: ['budget'],
  social: ['rsvp'],
  outdoor: ['trails', 'stars', 'garden'],
  knowledge: ['books', 'classes', 'habits'],
};

const CLUSTER_LABELS: Record<string, string> = {
  body: 'Body',
  mind: 'Mind',
  home: 'Home',
  money: 'Money',
  social: 'Social',
  outdoor: 'Outdoor',
  knowledge: 'Knowledge',
};

// Fallback set when the user reaches this screen with no clusters selected
// (for example by opening /onboarding/kit directly). Filtered to the free-tier
// modules that are actually deliverable on web so the fallback cannot offer a
// module that completeOnboardingAction would silently drop.
const ALL_FREE_LITE: ModuleId[] = (
  ['fast', 'journal', 'mood', 'notes', 'voice'] as ModuleId[]
).filter((id) => isWebSupportedModuleId(id) && isWebVisibleModuleId(id));

// Defensive guard so this screen never lists a module that onboarding cannot
// actually enable, even if a cluster list drifts from web visibility.
function isWebDeliverable(id: ModuleId): boolean {
  return isWebSupportedModuleId(id) && isWebVisibleModuleId(id);
}

function parseClusters(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((c) => c.trim())
    .filter((c) => c.length > 0 && CLUSTER_MODULES[c] !== undefined);
}

function mergeModules(clusters: string[]): ModuleId[] {
  const seen = new Set<ModuleId>();
  const ordered: ModuleId[] = [];
  for (const cluster of clusters) {
    for (const moduleId of CLUSTER_MODULES[cluster] ?? []) {
      if (!seen.has(moduleId) && isWebDeliverable(moduleId)) {
        seen.add(moduleId);
        ordered.push(moduleId);
      }
    }
  }
  if (ordered.length === 0) {
    for (const moduleId of ALL_FREE_LITE) {
      if (!seen.has(moduleId)) {
        seen.add(moduleId);
        ordered.push(moduleId);
      }
    }
  }
  return ordered;
}

export default function KitOnboardingPage() {
  return (
    <Suspense fallback={<main style={styles.wrapper}><div style={styles.subtitle}>Loading…</div></main>}>
      <KitOnboardingContent />
    </Suspense>
  );
}

function KitOnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clusters = useMemo(
    () => parseClusters(searchParams.get('clusters')),
    [searchParams],
  );
  const modules = useMemo(() => mergeModules(clusters), [clusters]);
  const [enabled, setEnabled] = useState<Set<ModuleId>>(() => new Set(modules));
  const [submitting, setSubmitting] = useState(false);

  const toggle = useCallback((id: ModuleId) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleStart = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const enabledModuleIds = modules.filter((m) => enabled.has(m));
      const { redirectTo } = await completeOnboardingAction({
        clusters,
        enabledModuleIds,
      });
      router.push(redirectTo);
    } finally {
      setSubmitting(false);
    }
  }, [clusters, enabled, modules, router, submitting]);

  const clusterLabel = clusters.length > 0
    ? clusters.map((c) => CLUSTER_LABELS[c] ?? c).join(' + ')
    : 'Everything Lite';

  return (
    <main style={styles.wrapper}>
      <header style={styles.header}>
        <h1 style={styles.title}>Your starter kit</h1>
        <p style={styles.subtitle}>
          Based on what you picked ({clusterLabel}). Toggle off anything you don't want.
        </p>
      </header>

      <ul style={styles.list}>
        {modules.map((moduleId) => {
          const meta = MODULE_METADATA[moduleId];
          if (!meta) return null;
          const isOn = enabled.has(moduleId);
          return (
            <li key={moduleId} style={styles.row}>
              <span style={styles.rowIcon} aria-hidden>{meta.icon}</span>
              <div style={styles.rowBody}>
                <div style={styles.rowName}>{meta.name}</div>
                <div style={styles.rowTagline}>{meta.tagline}</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isOn}
                aria-label={`${isOn ? 'Disable' : 'Enable'} ${meta.name}`}
                onClick={() => toggle(moduleId)}
                style={{
                  ...styles.toggle,
                  background: isOn ? PRIMARY : SURFACE,
                  borderColor: isOn ? PRIMARY_CONTAINER : BORDER,
                }}
              >
                <span
                  style={{
                    ...styles.toggleKnob,
                    transform: isOn ? 'translateX(20px)' : 'translateX(0px)',
                    background: isOn ? BACKGROUND : TEXT_SECONDARY,
                  }}
                />
              </button>
            </li>
          );
        })}
      </ul>

      <div style={styles.footer}>
        <button
          type="button"
          onClick={() => void handleStart()}
          disabled={submitting}
          style={{
            ...styles.primaryButton,
            opacity: submitting ? 0.4 : 1,
            cursor: submitting ? 'not-allowed' : 'pointer',
          }}
        >
          Start
        </button>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    background: BACKGROUND,
    color: TEXT,
    minHeight: '100vh',
    maxWidth: 720,
    margin: '0 auto',
    padding: '48px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  title: {
    margin: 0,
    fontSize: 32,
    fontWeight: 700,
    lineHeight: '38px',
    color: TEXT,
  },
  subtitle: {
    margin: 0,
    color: TEXT_SECONDARY,
    fontSize: 16,
    lineHeight: '24px',
  },
  list: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  row: {
    display: 'flex',
    gap: 16,
    alignItems: 'center',
    background: SURFACE,
    border: `1px solid ${BORDER}`,
    borderRadius: 12,
    padding: 14,
  },
  rowIcon: {
    fontSize: 24,
    width: 32,
    textAlign: 'center',
    flexShrink: 0,
  },
  rowBody: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  rowName: {
    fontSize: 15,
    fontWeight: 600,
    color: TEXT,
  },
  rowTagline: {
    fontSize: 13,
    lineHeight: '18px',
    color: TEXT_SECONDARY,
  },
  toggle: {
    position: 'relative',
    width: 44,
    height: 24,
    borderRadius: 999,
    border: `1px solid ${BORDER}`,
    padding: 0,
    cursor: 'pointer',
    flexShrink: 0,
  },
  toggleKnob: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: 18,
    height: 18,
    borderRadius: 999,
    transition: 'transform 120ms ease, background 120ms ease',
  },
  footer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    paddingTop: 8,
  },
  primaryButton: {
    border: 'none',
    background: PRIMARY,
    color: BACKGROUND,
    borderRadius: 10,
    padding: '14px 24px',
    fontWeight: 700,
    fontSize: 16,
    boxShadow: `0 1px 0 ${PRIMARY_CONTAINER}`,
  },
};
