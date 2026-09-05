// Plan 30 Phase 3: the pure cadence engine behind the focused-screen live loop.
//
// The channel screen polls the SAME honest `runForegroundDrain` the manual
// Refresh button used to; there is no push, no fabricated status. All the timing
// logic lives here as pure functions + a scheduler with injected now/random/timer
// seams, so the node-only mobile vitest can prove the cadence and the worst-case
// latency bound without a React renderer. The React glue (focus + AppState +
// relay gate) is the thin `useChannelLiveLoop` hook.

export const HOT_CADENCE_MS = 5_000;
export const STEADY_CADENCE_MS = 10_000;
/** How long after a focus / send / applied>0 the loop stays on the 5s cadence. */
export const HOT_WINDOW_MS = 60_000;
/** Symmetric +-20% jitter so many focused clients do not thunder the relay in lockstep. */
export const JITTER_RATIO = 0.2;

/** The provable worst-case gap between two steady ticks (before drain time): 12s < AC-5's 15s bound. */
export const WORST_CASE_STEADY_DELAY_MS = Math.round(STEADY_CADENCE_MS * (1 + JITTER_RATIO));

export interface CadenceInput {
  now: number;
  /** Absolute ms; the loop is "hot" (5s cadence) while now < hotUntil. null = cold. */
  hotUntil: number | null;
  /** Jitter source in [0,1) (Math.random() at the seam); clamped defensively. */
  jitter: number;
  /** True right after focus, before the first tick, so the loop fires immediately. */
  firstTickPending: boolean;
}

/**
 * The delay before the NEXT tick: 0 while a first tick is pending (immediate on
 * focus), 5s inside the hot window, 10s in steady state, each scaled by symmetric
 * +-20% jitter. Pure and deterministic given its inputs.
 */
export function nextDelayMs(input: CadenceInput): number {
  if (input.firstTickPending) return 0;
  const hot = input.hotUntil !== null && input.now < input.hotUntil;
  const base = hot ? HOT_CADENCE_MS : STEADY_CADENCE_MS;
  const jitter = Math.min(1, Math.max(0, input.jitter));
  const factor = (1 - JITTER_RATIO) + 2 * JITTER_RATIO * jitter; // [0.8, 1.2)
  return Math.round(base * factor);
}

export interface LiveLoopTickResult {
  /** True when the drain applied ANYTHING the open channel must reflect: new
   *  messages, a file grant, or a member removal (roster-driven UI). The hook
   *  folds the ForegroundDrainResult counts into this one honest flag. */
  applied: boolean;
}

type TimerHandle = ReturnType<typeof setTimeout>;

export interface LiveLoopEngineOptions {
  /** One drain round; resolves with what it applied. Never throws in practice (caught here). */
  tick: () => Promise<LiveLoopTickResult>;
  /** Runs after a tick that applied new messages/grants (refresh the open channel). */
  onApplied?: (result: LiveLoopTickResult) => void;
  now?: () => number;
  random?: () => number;
  setTimer?: (fn: () => void, ms: number) => TimerHandle;
  clearTimer?: (handle: TimerHandle) => void;
}

export interface LiveLoopEngine {
  /** Enter the hot window and fire an immediate tick, then self-schedule. */
  start(): void;
  /** Halt scheduling; an in-flight tick finishes but never reschedules. */
  stop(): void;
  /** A send (or other hot trigger) re-enters the 5s hot window without forcing a tick. */
  noteHot(): void;
  isRunning(): boolean;
}

/**
 * A self-scheduling, single-flight drain loop. It schedules tick N+1 only after
 * tick N settles, so two drains never overlap; a failed tick is swallowed and the
 * loop continues. `start` fires immediately (immediate-on-focus); an applied>0
 * tick re-enters the hot window so a burst of activity keeps the 5s cadence.
 */
export function createLiveLoopEngine(options: LiveLoopEngineOptions): LiveLoopEngine {
  const now = options.now ?? (() => Date.now());
  const random = options.random ?? Math.random;
  const setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = options.clearTimer ?? ((handle) => clearTimeout(handle));

  let running = false;
  let inFlight = false;
  let firstTickPending = false;
  let hotUntil: number | null = null;
  let handle: TimerHandle | null = null;

  function clearPending(): void {
    if (handle !== null) {
      clearTimer(handle);
      handle = null;
    }
  }

  function schedule(): void {
    if (!running) return;
    clearPending();
    const delay = nextDelayMs({ now: now(), hotUntil, jitter: random(), firstTickPending });
    handle = setTimer(runTick, delay);
  }

  function runTick(): void {
    handle = null;
    firstTickPending = false;
    if (!running) return;
    if (inFlight) {
      // Single-flight guard: never two drains at once (belt + suspenders; the
      // schedule-after-settle design already prevents overlap).
      schedule();
      return;
    }
    inFlight = true;
    void options.tick()
      .then((result) => {
        // A drain that settles after stop() (blur/unmount) must NOT re-enter the
        // hot window or call onApplied (which would refresh a torn-down screen).
        if (!running) return;
        if (result.applied) {
          hotUntil = now() + HOT_WINDOW_MS;
          options.onApplied?.(result);
        }
      })
      .catch(() => {
        // Best-effort: a failed drain never breaks the loop.
      })
      .finally(() => {
        inFlight = false;
        if (running) schedule();
      });
  }

  return {
    start(): void {
      if (running) return;
      running = true;
      firstTickPending = true;
      hotUntil = now() + HOT_WINDOW_MS;
      schedule();
    },
    stop(): void {
      running = false;
      firstTickPending = false;
      clearPending();
    },
    noteHot(): void {
      if (!running) return;
      hotUntil = now() + HOT_WINDOW_MS;
    },
    isRunning(): boolean {
      return running;
    },
  };
}
