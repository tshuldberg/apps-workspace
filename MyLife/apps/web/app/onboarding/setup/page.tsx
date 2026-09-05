'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  MODULE_METADATA,
  FREE_MODULES,
  HEALTH_DATA_MODULE_IDS,
  HEALTH_DATA_TYPES,
} from '@mylife/module-registry';
import type { ModuleId } from '@mylife/module-registry';
import type { OnboardingState, OnboardingStep } from '@mylife/onboarding';
import {
  getOnboardingStateAction,
  onboardingNextAction,
  onboardingSkipAction,
  onboardingBackAction,
  onboardingSetPrefsAction,
  onboardingSetModulesAction,
  recordHealthConsentAction,
} from '../../actions';

// ── Tokens (Cool Obsidian) ──────────────────────────────────────────

const GLASS = 'rgba(255,255,255,0.04)';
const GLASS_BORDER = 'rgba(255,255,255,0.06)';
const TEXT = '#F0F0F5';
const TEXT_SEC = 'rgba(240,240,245,0.65)';
const ACCENT = '#3B82F6';
const SUCCESS = '#30D158';

// ── Content categories ──────────────────────────────────────────────

const CONTENT_CATEGORIES = [
  { key: 'fitness', icon: '💪', label: 'Fitness & Health' },
  { key: 'finance', icon: '💰', label: 'Money & Budgeting' },
  { key: 'reading', icon: '📚', label: 'Books & Reading' },
  { key: 'cooking', icon: '🍳', label: 'Cooking & Nutrition' },
  { key: 'mindfulness', icon: '🧘', label: 'Mindfulness & Mood' },
  { key: 'productivity', icon: '📝', label: 'Notes & Productivity' },
  { key: 'outdoors', icon: '🏄', label: 'Outdoors & Adventure' },
  { key: 'social', icon: '👥', label: 'Social & Events' },
] as const;

const ALL_MODULES = Object.values(MODULE_METADATA);
const VISIBLE_STEPS: OnboardingStep[] = [
  'WELCOME', 'CONTENT_PREFS', 'MODULE_SELECTION', 'HEALTH_CONSENT',
  'IMPORT', 'AI_PREFS', 'BIO_VERIFY', 'DASHBOARD_REVEAL',
];

// ── Styles ──────────────────────────────────────────────────────────

const css = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 16px',
  } as React.CSSProperties,
  container: {
    maxWidth: 560,
    width: '100%',
  } as React.CSSProperties,
  stepRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 32,
  } as React.CSSProperties,
  dot: (active: boolean): React.CSSProperties => ({
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: active ? ACCENT : GLASS,
    transition: 'background-color 200ms',
  }),
  heroEmoji: {
    fontSize: 48,
    textAlign: 'center' as const,
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: 800,
    color: TEXT,
    textAlign: 'center' as const,
    marginBottom: 8,
  },
  heroSub: {
    fontSize: 16,
    color: TEXT_SEC,
    textAlign: 'center' as const,
    lineHeight: '26px',
    marginBottom: 24,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 700,
    color: TEXT,
    marginBottom: 8,
  } as React.CSSProperties,
  stepSub: {
    fontSize: 15,
    color: TEXT_SEC,
    lineHeight: '22px',
    marginBottom: 24,
  } as React.CSSProperties,
  card: {
    background: GLASS,
    border: `1px solid ${GLASS_BORDER}`,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  } as React.CSSProperties,
  featureRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 0',
  } as React.CSSProperties,
  featureIcon: { fontSize: 20, width: 28 } as React.CSSProperties,
  featureText: { fontSize: 15, color: TEXT, lineHeight: '22px' } as React.CSSProperties,
  btnGroup: { marginTop: 24, display: 'flex', flexDirection: 'column' as const, gap: 12 },
  btnRow: { display: 'flex', justifyContent: 'center', gap: 16 } as React.CSSProperties,
  primaryBtn: {
    background: ACCENT,
    color: '#FFF',
    border: 'none',
    borderRadius: 12,
    padding: '14px 24px',
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
    width: '100%',
    transition: 'opacity 200ms',
  } as React.CSSProperties,
  secondaryBtn: {
    background: 'rgba(255,255,255,0.08)',
    color: TEXT_SEC,
    border: 'none',
    borderRadius: 12,
    padding: '10px 20px',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
  } as React.CSSProperties,
  chipGrid: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 10,
    marginBottom: 16,
  } as React.CSSProperties,
  chip: (sel: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: sel ? 'rgba(59,130,246,0.15)' : GLASS,
    border: `1px solid ${sel ? ACCENT : GLASS_BORDER}`,
    borderRadius: 20,
    padding: '8px 14px',
    cursor: 'pointer',
    color: sel ? TEXT : TEXT_SEC,
    fontSize: 14,
    fontWeight: 500,
  }),
  moduleGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
    gap: 10,
    marginBottom: 16,
  } as React.CSSProperties,
  moduleCard: (sel: boolean): React.CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    background: sel ? 'rgba(59,130,246,0.12)' : GLASS,
    border: `1px solid ${sel ? ACCENT : GLASS_BORDER}`,
    borderRadius: 12,
    padding: '12px 4px',
    cursor: 'pointer',
    transition: 'border-color 150ms',
  }),
  moduleIcon: { fontSize: 24, marginBottom: 4 } as React.CSSProperties,
  moduleName: (sel: boolean): React.CSSProperties => ({
    fontSize: 10,
    color: sel ? TEXT : TEXT_SEC,
    fontWeight: 600,
    textAlign: 'center',
  }),
  freeBadge: {
    fontSize: 8,
    color: SUCCESS,
    fontWeight: 700,
    letterSpacing: 0.5,
    marginTop: 2,
  } as React.CSSProperties,
  toggleRow: (active: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: GLASS,
    border: `1px solid ${active ? ACCENT : GLASS_BORDER}`,
    borderRadius: 12,
    padding: 16,
    cursor: 'pointer',
    marginBottom: 16,
  }),
  toggleTrack: (on: boolean): React.CSSProperties => ({
    width: 44,
    height: 24,
    borderRadius: 12,
    background: on ? ACCENT : 'rgba(255,255,255,0.08)',
    display: 'flex',
    alignItems: 'center',
    padding: 2,
    transition: 'background 200ms',
  }),
  toggleThumb: (on: boolean): React.CSSProperties => ({
    width: 20,
    height: 20,
    borderRadius: 10,
    background: TEXT,
    marginLeft: on ? 'auto' : 0,
    transition: 'margin-left 200ms',
  }),
  quickActions: {
    display: 'flex',
    gap: 12,
    marginBottom: 16,
  } as React.CSSProperties,
  quickAction: {
    background: GLASS,
    border: `1px solid ${GLASS_BORDER}`,
    borderRadius: 8,
    padding: '6px 12px',
    cursor: 'pointer',
    color: ACCENT,
    fontSize: 13,
    fontWeight: 600,
  } as React.CSSProperties,
  revealName: {
    fontSize: 16,
    color: TEXT,
    fontWeight: 500,
    padding: '6px 0',
  } as React.CSSProperties,
  revealMore: {
    fontSize: 14,
    color: TEXT_SEC,
    fontStyle: 'italic' as const,
    paddingTop: 4,
  } as React.CSSProperties,
  linkBtn: {
    background: 'none',
    border: 'none',
    color: ACCENT,
    fontSize: 14,
    cursor: 'pointer',
    padding: '8px 0',
  } as React.CSSProperties,
};

// ── Feature row helper ──────────────────────────────────────────────

function FeatureRow({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={css.featureRow}>
      <span style={css.featureIcon}>{icon}</span>
      <span style={css.featureText}>{text}</span>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────

export default function OnboardingSetupPage() {
  const router = useRouter();
  const [state, setState] = useState<OnboardingState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOnboardingStateAction().then((s) => {
      if (s.currentStep === 'COMPLETE') {
        router.replace('/');
        return;
      }
      setState(s);
      setLoading(false);
    });
  }, [router]);

  const doNext = useCallback(async () => {
    const s = await onboardingNextAction();
    if (s.currentStep === 'COMPLETE') {
      router.replace('/');
    } else {
      setState(s);
    }
  }, [router]);

  const doSkip = useCallback(async () => {
    const s = await onboardingSkipAction();
    if (s.currentStep === 'COMPLETE') {
      router.replace('/');
    } else {
      setState(s);
    }
  }, [router]);

  const doBack = useCallback(async () => {
    setState(await onboardingBackAction());
  }, []);

  const doSetPrefs = useCallback(async (prefs: Record<string, unknown>) => {
    setState(await onboardingSetPrefsAction(prefs));
  }, []);

  const doSetModules = useCallback(async (ids: string[]) => {
    setState(await onboardingSetModulesAction(ids));
  }, []);

  const doHealthConsent = useCallback(async (selectedModules: string[]) => {
    const healthModules = selectedModules.filter((id) =>
      (HEALTH_DATA_MODULE_IDS as readonly string[]).includes(id),
    );
    for (const moduleId of healthModules) {
      const dataTypes = HEALTH_DATA_TYPES[moduleId] ?? [];
      await recordHealthConsentAction(moduleId, [...dataTypes]);
    }
    await doNext();
  }, [doNext]);

  // Auto-skip HEALTH_CONSENT if no health modules selected
  const hasHealthModules = state?.selectedModules.some((id) =>
    (HEALTH_DATA_MODULE_IDS as readonly string[]).includes(id),
  ) ?? false;

  useEffect(() => {
    if (state?.currentStep === 'HEALTH_CONSENT' && !hasHealthModules) {
      doSkip();
    }
  }, [state?.currentStep, hasHealthModules, doSkip]);

  if (loading || !state) {
    return (
      <div style={css.page}>
        <div style={{ color: TEXT_SEC }}>Loading...</div>
      </div>
    );
  }

  const stepIdx = VISIBLE_STEPS.indexOf(state.currentStep);

  return (
    <div style={css.page}>
      <div style={css.container}>
        {/* Step indicator */}
        <div style={css.stepRow}>
          {VISIBLE_STEPS.map((step, i) => (
            <div key={step} style={css.dot(i <= stepIdx)} />
          ))}
        </div>

        {/* Steps */}
        {state.currentStep === 'WELCOME' && (
          <WelcomeStep onNext={doNext} />
        )}
        {state.currentStep === 'CONTENT_PREFS' && (
          <ContentPrefsStep
            prefs={state.contentPrefs}
            onSetPrefs={doSetPrefs}
            onNext={doNext}
            onSkip={doSkip}
            onBack={doBack}
          />
        )}
        {state.currentStep === 'MODULE_SELECTION' && (
          <ModuleSelectionStep
            selectedModules={state.selectedModules}
            onSetModules={doSetModules}
            onNext={doNext}
            onSkip={doSkip}
            onBack={doBack}
          />
        )}
        {state.currentStep === 'HEALTH_CONSENT' && hasHealthModules && (
          <HealthConsentStep
            selectedModules={state.selectedModules}
            onConsent={() => doHealthConsent(state.selectedModules)}
            onSkip={doSkip}
            onBack={doBack}
          />
        )}
        {state.currentStep === 'IMPORT' && (
          <ImportStep onNext={doNext} onSkip={doSkip} onBack={doBack} />
        )}
        {state.currentStep === 'AI_PREFS' && (
          <AiPrefsStep
            prefs={state.contentPrefs}
            onSetPrefs={doSetPrefs}
            onNext={doNext}
            onSkip={doSkip}
            onBack={doBack}
          />
        )}
        {state.currentStep === 'BIO_VERIFY' && (
          <BioVerifyStep onNext={doNext} onSkip={doSkip} onBack={doBack} />
        )}
        {state.currentStep === 'DASHBOARD_REVEAL' && (
          <DashboardRevealStep
            selectedModules={state.selectedModules}
            onFinish={doNext}
            onBack={doBack}
          />
        )}
      </div>
    </div>
  );
}

// ── Step components ─────────────────────────────────────────────────

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div>
      <div style={css.heroEmoji}>🔒</div>
      <div style={css.heroTitle}>Welcome to MyLife</div>
      <div style={css.heroSub}>
        Your private life hub. Everything stays on your device.
        No accounts, no tracking, no cloud by default.
      </div>
      <div style={css.card}>
        <FeatureRow icon="📱" text="All data stored locally on your device" />
        <FeatureRow icon="🚫" text="Zero analytics, zero telemetry" />
        <FeatureRow icon="✈️" text="Works completely offline" />
        <FeatureRow icon="🔓" text="Export everything, delete everything, anytime" />
      </div>
      <div style={css.btnGroup}>
        <button style={css.primaryBtn} onClick={onNext}>Get Started</button>
      </div>
    </div>
  );
}

function ContentPrefsStep({
  prefs,
  onSetPrefs,
  onNext,
  onSkip,
  onBack,
}: {
  prefs: Record<string, unknown>;
  onSetPrefs: (p: Record<string, unknown>) => void;
  onNext: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const selected = (prefs.categories as string[] | undefined) ?? [];
  const toggle = (key: string) => {
    const current = [...selected];
    const idx = current.indexOf(key);
    if (idx >= 0) current.splice(idx, 1);
    else current.push(key);
    onSetPrefs({ categories: current });
  };

  return (
    <div>
      <div style={css.stepTitle}>What matters to you?</div>
      <div style={css.stepSub}>
        Pick your interests so we can highlight the right modules.
      </div>
      <div style={css.chipGrid}>
        {CONTENT_CATEGORIES.map((cat) => (
          <div
            key={cat.key}
            style={css.chip(selected.includes(cat.key))}
            onClick={() => toggle(cat.key)}
          >
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
          </div>
        ))}
      </div>
      <div style={css.btnGroup}>
        <button style={css.primaryBtn} onClick={onNext}>Continue</button>
        <div style={css.btnRow}>
          <button style={css.secondaryBtn} onClick={onBack}>Back</button>
          <button style={css.secondaryBtn} onClick={onSkip}>Skip</button>
        </div>
      </div>
    </div>
  );
}

function ModuleSelectionStep({
  selectedModules,
  onSetModules,
  onNext,
  onSkip,
  onBack,
}: {
  selectedModules: string[];
  onSetModules: (ids: string[]) => void;
  onNext: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const toggle = (id: string) => {
    const current = [...selectedModules];
    const idx = current.indexOf(id);
    if (idx >= 0) current.splice(idx, 1);
    else current.push(id);
    onSetModules(current);
  };

  return (
    <div>
      <div style={css.stepTitle}>Choose your modules</div>
      <div style={css.stepSub}>
        {selectedModules.length} selected. Free modules are marked with a star.
      </div>
      <div style={css.quickActions}>
        <button
          style={css.quickAction}
          onClick={() => onSetModules(ALL_MODULES.map((m) => m.id))}
        >
          Select All
        </button>
        <button
          style={css.quickAction}
          onClick={() => onSetModules([...FREE_MODULES])}
        >
          Free Only
        </button>
      </div>
      <div style={css.moduleGrid}>
        {ALL_MODULES.map((mod) => {
          const sel = selectedModules.includes(mod.id);
          const free = (FREE_MODULES as readonly string[]).includes(mod.id);
          return (
            <div
              key={mod.id}
              style={css.moduleCard(sel)}
              onClick={() => toggle(mod.id)}
            >
              <span style={css.moduleIcon}>{mod.icon}</span>
              <span style={css.moduleName(sel)}>{mod.name}</span>
              {free && <span style={css.freeBadge}>FREE</span>}
            </div>
          );
        })}
      </div>
      <div style={css.btnGroup}>
        <button style={css.primaryBtn} onClick={onNext}>Continue</button>
        <div style={css.btnRow}>
          <button style={css.secondaryBtn} onClick={onBack}>Back</button>
          <button style={css.secondaryBtn} onClick={onSkip}>Skip</button>
        </div>
      </div>
    </div>
  );
}

function HealthConsentStep({
  selectedModules,
  onConsent,
  onSkip,
  onBack,
}: {
  selectedModules: string[];
  onConsent: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  const healthModules = selectedModules.filter((id) =>
    (HEALTH_DATA_MODULE_IDS as readonly string[]).includes(id),
  );

  return (
    <div>
      <div style={css.stepTitle}>Health Data Consent</div>
      <div style={css.stepSub}>
        {healthModules.length} of your selected modules collect consumer health
        data. Your explicit consent is required before any data collection begins.
      </div>
      <div style={css.card}>
        {healthModules.map((id) => {
          const meta = MODULE_METADATA[id as ModuleId];
          const types = HEALTH_DATA_TYPES[id] ?? [];
          return (
            <div key={id} style={{ padding: '8px 0', borderBottom: `1px solid ${GLASS_BORDER}` }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: TEXT, marginBottom: 4 }}>
                {meta?.icon ?? '?'} {meta?.name ?? id}
              </div>
              {types.map((t: string) => (
                <div key={t} style={{ fontSize: 13, color: TEXT_SEC, paddingLeft: 8, lineHeight: '20px' }}>
                  {'\u2022'} {t}
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <div style={{
        background: 'rgba(255,159,10,0.08)',
        border: '1px solid rgba(255,159,10,0.2)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
      }}>
        <div style={{ fontSize: 13, color: TEXT_SEC, lineHeight: '20px' }}>
          MyLife is not a medical device and does not provide medical advice.
          Health data is for personal tracking only. All data stays on your device.
          You can withdraw consent at any time in Settings.
        </div>
      </div>
      <div
        style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 24, cursor: 'pointer' }}
        onClick={() => setAcknowledged(!acknowledged)}
      >
        <div style={{
          width: 22,
          height: 22,
          borderRadius: 4,
          border: `1px solid ${acknowledged ? SUCCESS : GLASS_BORDER}`,
          background: acknowledged ? SUCCESS : GLASS,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: 2,
          color: '#0A0A0F',
          fontSize: 14,
          fontWeight: 700,
        }}>
          {acknowledged ? '\u2713' : ''}
        </div>
        <span style={{ fontSize: 13, color: TEXT_SEC, lineHeight: '20px' }}>
          I understand and consent to the collection of the health data described above.
        </span>
      </div>
      <div style={css.btnGroup}>
        <button
          style={{ ...css.primaryBtn, opacity: acknowledged ? 1 : 0.4 }}
          onClick={onConsent}
          disabled={!acknowledged}
        >
          I Consent
        </button>
        <div style={css.btnRow}>
          <button style={css.secondaryBtn} onClick={onBack}>Back</button>
          <button style={css.secondaryBtn} onClick={onSkip}>Skip</button>
        </div>
      </div>
    </div>
  );
}

function ImportStep({
  onNext,
  onSkip,
  onBack,
}: {
  onNext: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const router = useRouter();
  return (
    <div>
      <div style={css.stepTitle}>Import your data</div>
      <div style={css.stepSub}>
        Bring your data from other apps. You can always do this later in Settings.
      </div>
      <div style={css.card}>
        <FeatureRow icon="📚" text="Goodreads (books, shelves, reviews)" />
        <FeatureRow icon="💰" text="YNAB (budgets, transactions)" />
        <FeatureRow icon="📓" text="Day One (journal entries)" />
        <FeatureRow icon="🍎" text="MyFitnessPal (nutrition logs)" />
      </div>
      <div style={css.btnGroup}>
        <button
          style={css.primaryBtn}
          onClick={() => router.push('/settings/import')}
        >
          Open Import Wizard
        </button>
        <div style={css.btnRow}>
          <button style={css.secondaryBtn} onClick={onBack}>Back</button>
          <button style={css.secondaryBtn} onClick={onSkip}>Skip for now</button>
        </div>
        <button style={css.linkBtn} onClick={onNext}>
          Already imported? Continue
        </button>
      </div>
    </div>
  );
}

function AiPrefsStep({
  prefs,
  onSetPrefs,
  onNext,
  onSkip,
  onBack,
}: {
  prefs: Record<string, unknown>;
  onSetPrefs: (p: Record<string, unknown>) => void;
  onNext: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const aiEnabled = prefs.ai_enabled === true;
  return (
    <div>
      <div style={css.stepTitle}>AI Intelligence</div>
      <div style={css.stepSub}>
        MyLife can find patterns across your data. AI runs on your device by default.
        It only sees what you allow.
      </div>
      <div style={css.card}>
        <FeatureRow icon="🔒" text="On-device statistical analysis by default" />
        <FeatureRow icon="🧠" text="Cross-module insights (mood + exercise + sleep)" />
        <FeatureRow icon="👁️" text="You control which modules AI can access" />
      </div>
      <div
        style={css.toggleRow(aiEnabled)}
        onClick={() => onSetPrefs({ ai_enabled: !aiEnabled })}
      >
        <span style={{ color: TEXT, fontSize: 15, fontWeight: 500 }}>
          {aiEnabled ? 'AI insights enabled' : 'AI insights disabled'}
        </span>
        <div style={css.toggleTrack(aiEnabled)}>
          <div style={css.toggleThumb(aiEnabled)} />
        </div>
      </div>
      <div style={css.btnGroup}>
        <button style={css.primaryBtn} onClick={onNext}>Continue</button>
        <div style={css.btnRow}>
          <button style={css.secondaryBtn} onClick={onBack}>Back</button>
          <button style={css.secondaryBtn} onClick={onSkip}>Skip</button>
        </div>
      </div>
    </div>
  );
}

function BioVerifyStep({
  onNext,
  onSkip,
  onBack,
}: {
  onNext: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  return (
    <div>
      <div style={css.stepTitle}>Verify you're human</div>
      <div style={css.stepSub}>
        Social features (Forums, Market) require biometric verification.
        Your biometric data never leaves your device.
      </div>
      <div style={css.card}>
        <FeatureRow icon="🔐" text="Face ID or Touch ID (OS-level only)" />
        <FeatureRow icon="🚫" text="We never receive your biometric data" />
        <FeatureRow icon="📖" text="Read-only browsing works without verification" />
      </div>
      <div style={css.btnGroup}>
        <button style={css.primaryBtn} onClick={onNext}>Continue</button>
        <div style={css.btnRow}>
          <button style={css.secondaryBtn} onClick={onBack}>Back</button>
          <button style={css.secondaryBtn} onClick={onSkip}>Skip for now</button>
        </div>
      </div>
    </div>
  );
}

function DashboardRevealStep({
  selectedModules,
  onFinish,
  onBack,
}: {
  selectedModules: string[];
  onFinish: () => void;
  onBack: () => void;
}) {
  const names = selectedModules
    .map((id) => MODULE_METADATA[id as ModuleId]?.name)
    .filter(Boolean)
    .slice(0, 6);

  return (
    <div>
      <div style={css.heroEmoji}>✨</div>
      <div style={css.heroTitle}>You're all set</div>
      <div style={css.heroSub}>
        {selectedModules.length} modules ready. Your personalized dashboard awaits.
      </div>
      <div style={css.card}>
        {names.map((name) => (
          <div key={name} style={css.revealName}>{name}</div>
        ))}
        {selectedModules.length > 6 && (
          <div style={css.revealMore}>+{selectedModules.length - 6} more</div>
        )}
      </div>
      <div style={css.btnGroup}>
        <button style={css.primaryBtn} onClick={onFinish}>Open My Dashboard</button>
        <button style={css.secondaryBtn} onClick={onBack}>Back</button>
      </div>
    </div>
  );
}
