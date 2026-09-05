import { describe, it, expect, beforeEach } from 'vitest';
import {
  OnboardingMachine,
  InMemoryOnboardingStore,
  SqliteOnboardingStore,
  ONBOARDING_STEPS,
  DEFAULT_FREE_MODULES,
  type OnboardingStep,
  type OnboardingState,
} from '../state-machine';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMachine(store?: InMemoryOnboardingStore) {
  const s = store ?? new InMemoryOnboardingStore();
  return { machine: new OnboardingMachine(s), store: s };
}

/** Advance the machine through N next() calls. */
function advanceTo(machine: OnboardingMachine, target: OnboardingStep): void {
  while (machine.getState().currentStep !== target) {
    const before = machine.getState().currentStep;
    machine.next();
    if (machine.getState().currentStep === before) {
      throw new Error(`Stuck at ${before}, cannot reach ${target}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Core state machine tests
// ---------------------------------------------------------------------------

describe('OnboardingMachine', () => {
  let machine: OnboardingMachine;
  let store: InMemoryOnboardingStore;

  beforeEach(() => {
    const ctx = createMachine();
    machine = ctx.machine;
    store = ctx.store;
  });

  // ─── Initial state ────────────────────────────────────────────────────

  describe('initial state', () => {
    it('starts at WELCOME', () => {
      expect(machine.getState().currentStep).toBe('WELCOME');
    });

    it('has empty completedSteps', () => {
      expect(machine.getState().completedSteps).toEqual([]);
    });

    it('defaults to 7 free modules', () => {
      expect(machine.getState().selectedModules).toEqual([...DEFAULT_FREE_MODULES]);
      expect(machine.getState().selectedModules).toHaveLength(7);
    });

    it('has empty contentPrefs', () => {
      expect(machine.getState().contentPrefs).toEqual({});
    });

    it('is not complete', () => {
      expect(machine.isComplete()).toBe(false);
    });

    it('has null completedAt', () => {
      expect(machine.getState().completedAt).toBeNull();
    });
  });

  // ─── next() transitions ───────────────────────────────────────────────

  describe('next()', () => {
    it('advances from WELCOME to CONTENT_PREFS', () => {
      machine.next();
      expect(machine.getState().currentStep).toBe('CONTENT_PREFS');
    });

    it('marks WELCOME as completed after next()', () => {
      machine.next();
      expect(machine.getState().completedSteps).toContain('WELCOME');
    });

    it('walks through all steps in order to COMPLETE', () => {
      const visited: OnboardingStep[] = [];
      while (!machine.isComplete()) {
        visited.push(machine.getState().currentStep);
        machine.next();
      }
      // Should have visited every step except COMPLETE
      expect(visited).toEqual(ONBOARDING_STEPS.slice(0, -1));
      expect(machine.getState().currentStep).toBe('COMPLETE');
    });

    it('sets completedAt when reaching COMPLETE', () => {
      while (!machine.isComplete()) machine.next();
      expect(machine.getState().completedAt).not.toBeNull();
    });

    it('is a no-op at COMPLETE', () => {
      while (!machine.isComplete()) machine.next();
      const state = machine.getState();
      machine.next();
      expect(machine.getState()).toEqual(state);
    });

    it('does not duplicate steps in completedSteps', () => {
      machine.next(); // WELCOME -> CONTENT_PREFS
      machine.back(); // CONTENT_PREFS -> WELCOME
      machine.next(); // WELCOME -> CONTENT_PREFS (WELCOME already completed)
      const count = machine.getState().completedSteps.filter(
        (s) => s === 'WELCOME',
      ).length;
      expect(count).toBe(1);
    });
  });

  // ─── skip() transitions ───────────────────────────────────────────────

  describe('skip()', () => {
    it('cannot skip WELCOME', () => {
      machine.skip();
      expect(machine.getState().currentStep).toBe('WELCOME');
    });

    it('can skip CONTENT_PREFS', () => {
      machine.next(); // -> CONTENT_PREFS
      machine.skip();
      expect(machine.getState().currentStep).toBe('MODULE_SELECTION');
    });

    it('does NOT add skipped step to completedSteps', () => {
      machine.next(); // -> CONTENT_PREFS
      machine.skip(); // skip CONTENT_PREFS -> MODULE_SELECTION
      expect(machine.getState().completedSteps).not.toContain('CONTENT_PREFS');
    });

    it('can skip all steps after WELCOME to reach COMPLETE', () => {
      machine.next(); // complete WELCOME -> CONTENT_PREFS
      while (!machine.isComplete()) {
        machine.skip();
      }
      expect(machine.isComplete()).toBe(true);
      // Only WELCOME should be in completedSteps
      expect(machine.getState().completedSteps).toEqual(['WELCOME']);
    });

    it('sets completedAt when skip leads to COMPLETE', () => {
      machine.next(); // -> CONTENT_PREFS
      advanceTo(machine, 'DASHBOARD_REVEAL');
      machine.skip(); // -> COMPLETE
      expect(machine.getState().completedAt).not.toBeNull();
    });

    it('is a no-op at COMPLETE', () => {
      while (!machine.isComplete()) machine.next();
      const state = machine.getState();
      machine.skip();
      expect(machine.getState().currentStep).toBe(state.currentStep);
    });
  });

  // ─── back() transitions ───────────────────────────────────────────────

  describe('back()', () => {
    it('is a no-op at WELCOME', () => {
      machine.back();
      expect(machine.getState().currentStep).toBe('WELCOME');
    });

    it('goes from CONTENT_PREFS back to WELCOME', () => {
      machine.next(); // -> CONTENT_PREFS
      machine.back();
      expect(machine.getState().currentStep).toBe('WELCOME');
    });

    it('goes from MODULE_SELECTION back to CONTENT_PREFS', () => {
      advanceTo(machine, 'MODULE_SELECTION');
      machine.back();
      expect(machine.getState().currentStep).toBe('CONTENT_PREFS');
    });

    it('is a no-op at COMPLETE', () => {
      while (!machine.isComplete()) machine.next();
      machine.back();
      expect(machine.getState().currentStep).toBe('COMPLETE');
    });

    it('navigates back through multiple steps', () => {
      advanceTo(machine, 'AI_PREFS');
      machine.back(); // -> IMPORT
      machine.back(); // -> HEALTH_CONSENT
      machine.back(); // -> MODULE_SELECTION
      expect(machine.getState().currentStep).toBe('MODULE_SELECTION');
    });
  });

  // ─── Data setters ─────────────────────────────────────────────────────

  describe('setContentPrefs()', () => {
    it('merges content preferences', () => {
      machine.setContentPrefs({ theme: 'dark' });
      machine.setContentPrefs({ language: 'en' });
      expect(machine.getState().contentPrefs).toEqual({
        theme: 'dark',
        language: 'en',
      });
    });

    it('overwrites existing keys', () => {
      machine.setContentPrefs({ theme: 'dark' });
      machine.setContentPrefs({ theme: 'light' });
      expect(machine.getState().contentPrefs).toEqual({ theme: 'light' });
    });
  });

  describe('setSelectedModules()', () => {
    it('replaces selected modules', () => {
      machine.setSelectedModules(['books', 'budget']);
      expect(machine.getState().selectedModules).toEqual(['books', 'budget']);
    });

    it('does not mutate when set to empty', () => {
      machine.setSelectedModules([]);
      expect(machine.getState().selectedModules).toEqual([]);
    });
  });

  // ─── reset() ──────────────────────────────────────────────────────────

  describe('reset()', () => {
    it('returns to default state', () => {
      advanceTo(machine, 'IMPORT');
      machine.setContentPrefs({ theme: 'dark' });
      machine.setSelectedModules(['books']);
      machine.reset();

      expect(machine.getState().currentStep).toBe('WELCOME');
      expect(machine.getState().completedSteps).toEqual([]);
      expect(machine.getState().contentPrefs).toEqual({});
      expect(machine.getState().selectedModules).toEqual([...DEFAULT_FREE_MODULES]);
      expect(machine.getState().completedAt).toBeNull();
    });
  });

  // ─── Persistence (force-quit resume) ──────────────────────────────────

  describe('force-quit resume', () => {
    it('resumes from saved step after re-creating machine', () => {
      advanceTo(machine, 'IMPORT');
      machine.setContentPrefs({ filter: 'safe' });

      // Simulate force-quit and relaunch with same store
      const machine2 = new OnboardingMachine(store);
      expect(machine2.getState().currentStep).toBe('IMPORT');
      expect(machine2.getState().contentPrefs).toEqual({ filter: 'safe' });
    });

    it('preserves completedSteps across restart', () => {
      advanceTo(machine, 'MODULE_SELECTION');
      const completed = machine.getState().completedSteps;

      const machine2 = new OnboardingMachine(store);
      expect(machine2.getState().completedSteps).toEqual(completed);
    });

    it('preserves selected modules across restart', () => {
      machine.setSelectedModules(['books', 'surf', 'budget']);
      advanceTo(machine, 'AI_PREFS');

      const machine2 = new OnboardingMachine(store);
      expect(machine2.getState().selectedModules).toEqual(['books', 'surf', 'budget']);
    });

    it('can continue from resume to COMPLETE', () => {
      advanceTo(machine, 'BIO_VERIFY');

      const machine2 = new OnboardingMachine(store);
      expect(machine2.getState().currentStep).toBe('BIO_VERIFY');
      machine2.next(); // -> DASHBOARD_REVEAL
      machine2.next(); // -> COMPLETE
      expect(machine2.isComplete()).toBe(true);
    });

    it('completed state survives restart', () => {
      while (!machine.isComplete()) machine.next();

      const machine2 = new OnboardingMachine(store);
      expect(machine2.isComplete()).toBe(true);
      expect(machine2.getState().completedAt).not.toBeNull();
    });
  });

  // ─── Defaults when all skipped ────────────────────────────────────────

  describe('defaults when all steps skipped', () => {
    it('keeps 7 free modules when MODULE_SELECTION is skipped', () => {
      machine.next(); // complete WELCOME
      // Skip everything
      while (!machine.isComplete()) machine.skip();
      expect(machine.getState().selectedModules).toEqual([...DEFAULT_FREE_MODULES]);
    });

    it('has empty contentPrefs when CONTENT_PREFS is skipped', () => {
      machine.next();
      while (!machine.isComplete()) machine.skip();
      expect(machine.getState().contentPrefs).toEqual({});
    });
  });

  // ─── Edge cases ───────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('getState returns a copy (not a reference)', () => {
      const s1 = machine.getState();
      machine.next();
      const s2 = machine.getState();
      expect(s1.currentStep).toBe('WELCOME');
      expect(s2.currentStep).toBe('CONTENT_PREFS');
    });

    it('skip then back is consistent', () => {
      machine.next(); // -> CONTENT_PREFS
      machine.next(); // -> MODULE_SELECTION (CONTENT_PREFS completed)
      machine.skip(); // skip MODULE_SELECTION -> IMPORT
      machine.back(); // -> MODULE_SELECTION
      expect(machine.getState().currentStep).toBe('MODULE_SELECTION');
    });
  });
});

// ---------------------------------------------------------------------------
// SqliteOnboardingStore tests
// ---------------------------------------------------------------------------

describe('SqliteOnboardingStore', () => {
  let db: {
    execute: (sql: string, params?: unknown[]) => void;
    query: <T>(sql: string, params?: unknown[]) => T[];
  };
  let store: SqliteOnboardingStore;

  beforeEach(() => {
    // Simple in-memory SQLite-like mock
    const rows = new Map<string, Record<string, unknown>>();

    db = {
      execute(sql: string, params?: unknown[]) {
        if (sql.includes('INSERT INTO hub_onboarding')) {
          const p = params ?? [];
          rows.set(p[0] as string, {
            id: p[0],
            current_step: p[1],
            completed_steps: p[2],
            content_prefs: p[3],
            selected_modules: p[4],
            completed_at: p[5],
          });
        }
      },
      query<T>(sql: string, params?: unknown[]): T[] {
        if (sql.includes('FROM hub_onboarding')) {
          const id = (params ?? [])[0] as string;
          const row = rows.get(id);
          return row ? [row as T] : [];
        }
        return [];
      },
    };

    store = new SqliteOnboardingStore(db);
  });

  it('load returns null when no row exists', () => {
    expect(store.load()).toBeNull();
  });

  it('save then load roundtrips state', () => {
    const state: OnboardingState = {
      currentStep: 'IMPORT',
      completedSteps: ['WELCOME', 'CONTENT_PREFS', 'MODULE_SELECTION'],
      contentPrefs: { theme: 'dark' },
      selectedModules: ['books', 'budget'],
      completedAt: null,
    };
    store.save(state);
    const loaded = store.load();
    expect(loaded).toEqual(state);
  });

  it('upserts on save (does not create duplicates)', () => {
    const state1: OnboardingState = {
      currentStep: 'WELCOME',
      completedSteps: [],
      contentPrefs: {},
      selectedModules: [],
      completedAt: null,
    };
    store.save(state1);

    const state2: OnboardingState = {
      ...state1,
      currentStep: 'CONTENT_PREFS',
      completedSteps: ['WELCOME'],
    };
    store.save(state2);
    expect(store.load()?.currentStep).toBe('CONTENT_PREFS');
  });

  it('works with OnboardingMachine', () => {
    const machine = new OnboardingMachine(store);
    machine.next(); // -> CONTENT_PREFS
    machine.setContentPrefs({ safe_mode: true });

    // Simulate restart
    const machine2 = new OnboardingMachine(store);
    expect(machine2.getState().currentStep).toBe('CONTENT_PREFS');
    expect(machine2.getState().contentPrefs).toEqual({ safe_mode: true });
  });
});
