/**
 * Onboarding state machine for the MyLife first-run experience.
 *
 * States flow linearly: WELCOME -> CONTENT_PREFS -> MODULE_SELECTION ->
 * HEALTH_CONSENT -> IMPORT -> AI_PREFS -> BIO_VERIFY -> DASHBOARD_REVEAL -> COMPLETE
 *
 * All steps after WELCOME are skippable. If the user force-quits, the
 * current step is persisted and can be resumed on next launch.
 *
 * Default when skipped: 7 free modules enabled, no import, no AI, no bio verify.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const ONBOARDING_STEPS = [
  'WELCOME',
  'CONTENT_PREFS',
  'MODULE_SELECTION',
  'HEALTH_CONSENT',
  'IMPORT',
  'AI_PREFS',
  'BIO_VERIFY',
  'DASHBOARD_REVEAL',
  'COMPLETE',
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** Steps the user can skip (all except WELCOME). */
const SKIPPABLE_STEPS = new Set<OnboardingStep>([
  'CONTENT_PREFS',
  'MODULE_SELECTION',
  'HEALTH_CONSENT',
  'IMPORT',
  'AI_PREFS',
  'BIO_VERIFY',
  'DASHBOARD_REVEAL',
]);

/** Steps the user can navigate back from (cannot go back from WELCOME or COMPLETE). */
const BACK_ALLOWED_FROM = new Set<OnboardingStep>([
  'CONTENT_PREFS',
  'MODULE_SELECTION',
  'HEALTH_CONSENT',
  'IMPORT',
  'AI_PREFS',
  'BIO_VERIFY',
  'DASHBOARD_REVEAL',
]);

/** The 7 free modules that are enabled by default when onboarding is skipped. */
export const DEFAULT_FREE_MODULES = [
  'fast',
  'forums',
  'journal',
  'market',
  'mood',
  'notes',
  'voice',
] as const;

export interface OnboardingState {
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
  contentPrefs: Record<string, unknown>;
  selectedModules: string[];
  completedAt: string | null;
}

/**
 * Persistence interface. Decouples the state machine from SQLite
 * so it can run in-memory for tests and with real DB in production.
 */
export interface OnboardingStore {
  load(): OnboardingState | null;
  save(state: OnboardingState): void;
}

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

function defaultState(): OnboardingState {
  return {
    currentStep: 'WELCOME',
    completedSteps: [],
    contentPrefs: {},
    selectedModules: [...DEFAULT_FREE_MODULES],
    completedAt: null,
  };
}

function stepIndex(step: OnboardingStep): number {
  return ONBOARDING_STEPS.indexOf(step);
}

function nextStep(step: OnboardingStep): OnboardingStep {
  const idx = stepIndex(step);
  if (idx >= ONBOARDING_STEPS.length - 1) return step;
  return ONBOARDING_STEPS[idx + 1]!;
}

function prevStep(step: OnboardingStep): OnboardingStep {
  const idx = stepIndex(step);
  if (idx <= 0) return step;
  return ONBOARDING_STEPS[idx - 1]!;
}

export class OnboardingMachine {
  private state: OnboardingState;
  private store: OnboardingStore;

  constructor(store: OnboardingStore) {
    this.store = store;
    this.state = store.load() ?? defaultState();
  }

  /** Current snapshot of onboarding state. */
  getState(): Readonly<OnboardingState> {
    return { ...this.state };
  }

  /** Whether onboarding has been completed. */
  isComplete(): boolean {
    return this.state.currentStep === 'COMPLETE';
  }

  /**
   * Advance to the next step, marking the current step as completed.
   * No-op if already at COMPLETE.
   */
  next(): OnboardingState {
    if (this.state.currentStep === 'COMPLETE') return this.getState();

    const current = this.state.currentStep;
    if (!this.state.completedSteps.includes(current)) {
      this.state.completedSteps.push(current);
    }

    const next = nextStep(current);
    this.state.currentStep = next;

    if (next === 'COMPLETE') {
      this.state.completedAt = new Date().toISOString();
    }

    this.store.save(this.state);
    return this.getState();
  }

  /**
   * Skip the current step, applying defaults for skipped data, and advance.
   * Only steps in SKIPPABLE_STEPS can be skipped. WELCOME cannot be skipped.
   * No-op if the step is not skippable or already at COMPLETE.
   */
  skip(): OnboardingState {
    if (this.state.currentStep === 'COMPLETE') return this.getState();
    if (!SKIPPABLE_STEPS.has(this.state.currentStep)) return this.getState();

    // The step is NOT added to completedSteps (it was skipped, not completed)
    const next = nextStep(this.state.currentStep);
    this.state.currentStep = next;

    if (next === 'COMPLETE') {
      this.state.completedAt = new Date().toISOString();
    }

    this.store.save(this.state);
    return this.getState();
  }

  /**
   * Go back to the previous step.
   * Only allowed from steps in BACK_ALLOWED_FROM.
   * No-op from WELCOME or COMPLETE.
   */
  back(): OnboardingState {
    if (!BACK_ALLOWED_FROM.has(this.state.currentStep)) return this.getState();

    this.state.currentStep = prevStep(this.state.currentStep);
    this.store.save(this.state);
    return this.getState();
  }

  /** Update content preferences (partial merge). */
  setContentPrefs(prefs: Record<string, unknown>): void {
    this.state.contentPrefs = { ...this.state.contentPrefs, ...prefs };
    this.store.save(this.state);
  }

  /** Set the selected module IDs (replaces the full list). */
  setSelectedModules(moduleIds: string[]): void {
    this.state.selectedModules = [...moduleIds];
    this.store.save(this.state);
  }

  /**
   * Reset to the beginning. Used for testing or if user wants to redo onboarding.
   */
  reset(): OnboardingState {
    this.state = defaultState();
    this.store.save(this.state);
    return this.getState();
  }
}

// ---------------------------------------------------------------------------
// In-memory store (for tests and ephemeral usage)
// ---------------------------------------------------------------------------

export class InMemoryOnboardingStore implements OnboardingStore {
  private data: OnboardingState | null = null;

  load(): OnboardingState | null {
    return this.data ? { ...this.data } : null;
  }

  save(state: OnboardingState): void {
    this.data = { ...state };
  }
}

// ---------------------------------------------------------------------------
// SQLite store
// ---------------------------------------------------------------------------

/** Minimal DB interface matching @mylife/db DatabaseAdapter. */
interface DbAdapter {
  execute(sql: string, params?: unknown[]): void;
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[];
}

interface OnboardingRow {
  id: string;
  current_step: string;
  completed_steps: string;
  content_prefs: string;
  selected_modules: string;
  completed_at: string | null;
}

export class SqliteOnboardingStore implements OnboardingStore {
  private db: DbAdapter;
  private id: string;

  constructor(db: DbAdapter, id = 'default') {
    this.db = db;
    this.id = id;
  }

  load(): OnboardingState | null {
    const rows = this.db.query<OnboardingRow>(
      `SELECT id, current_step, completed_steps, content_prefs, selected_modules, completed_at
       FROM hub_onboarding WHERE id = ?`,
      [this.id],
    );
    if (rows.length === 0) return null;
    const row = rows[0]!;
    return {
      currentStep: row.current_step as OnboardingStep,
      completedSteps: JSON.parse(row.completed_steps) as OnboardingStep[],
      contentPrefs: JSON.parse(row.content_prefs) as Record<string, unknown>,
      selectedModules: JSON.parse(row.selected_modules) as string[],
      completedAt: row.completed_at,
    };
  }

  save(state: OnboardingState): void {
    this.db.execute(
      `INSERT INTO hub_onboarding (id, current_step, completed_steps, content_prefs, selected_modules, completed_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         current_step = excluded.current_step,
         completed_steps = excluded.completed_steps,
         content_prefs = excluded.content_prefs,
         selected_modules = excluded.selected_modules,
         completed_at = excluded.completed_at,
         updated_at = datetime('now')`,
      [
        this.id,
        state.currentStep,
        JSON.stringify(state.completedSteps),
        JSON.stringify(state.contentPrefs),
        JSON.stringify(state.selectedModules),
        state.completedAt,
      ],
    );
  }
}
