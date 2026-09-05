// Background-trigger coalescer (Plan 42 P5, AC-42.8).
//
// Scheduled events, push wakes, and foreground-resume triggers can all arrive at
// once. Running the mailbox drain (runBackgroundSyncOnce) concurrently would
// apply the same events twice and emit duplicate notifications. This pure,
// injectable coalescer collapses concurrent triggers into ONE drain, with at
// most ONE bounded follow-up drain when new triggers arrived WHILE a drain was
// already running.
//
// Contract (proved by background-coalescer.test.ts):
//  - N concurrent triggers while idle -> exactly 1 drain runs.
//  - Triggers that arrive during an in-flight drain -> exactly 1 follow-up drain
//    (not N). Triggers during the follow-up coalesce into one more, and so on,
//    but never more than one drain is in flight and never one-per-trigger.
//  - A trigger that arrives after everything settles starts a fresh single drain.
//  - The drain function is the ONLY thing that touches the mailbox; the coalescer
//    holds no sync state of its own beyond the run/pending flags.
//
// This is deliberately dependency-free (no timers, no expo): the caller injects
// the real runBackgroundSyncOnce. That keeps it unit-testable with a fake drain
// and keeps the honesty guarantee that a drain result is whatever the engine
// really did.

export interface BackgroundDrainRun<R> {
  /** Resolves when the (possibly coalesced) drain this trigger belongs to finishes. */
  readonly done: Promise<R>;
  /** True when THIS trigger actually started a drain; false when it coalesced into a running/pending one. */
  readonly started: boolean;
}

/**
 * A coalescing runner around a single async drain. Construct once (module scope)
 * and call `trigger()` from every source (scheduled task, push wake, foreground
 * resume). Concurrent triggers share one in-flight drain; triggers during a
 * drain schedule exactly one follow-up.
 */
export class BackgroundTriggerCoalescer<R> {
  private readonly run: () => Promise<R>;
  /** The in-flight drain promise, or null when idle. */
  private active: Promise<R> | null = null;
  /** Set when a trigger arrives during an in-flight drain: a follow-up is owed. */
  private followUpPending = false;
  /** Resolvers waiting for the currently-owed follow-up drain's result. */
  private followUpWaiters: ((result: Promise<R>) => void)[] = [];

  constructor(run: () => Promise<R>) {
    this.run = run;
  }

  /** True while a drain is executing. Test/diagnostics aid. */
  get isRunning(): boolean {
    return this.active !== null;
  }

  /**
   * Request a drain. If none is running, starts one (started:true). If one is
   * running, marks a single follow-up owed and returns a promise for it
   * (started:false); many concurrent triggers during a run share that one
   * follow-up.
   */
  trigger(): BackgroundDrainRun<R> {
    if (this.active === null) {
      const done = this.startRun();
      return { done, started: true };
    }
    // A drain is in flight: coalesce into a single owed follow-up.
    this.followUpPending = true;
    const done = new Promise<R>((resolve) => {
      // Resolve with the follow-up's result promise once it starts.
      this.followUpWaiters.push((resultPromise) => resolve(resultPromise));
    }).then((resultPromise) => resultPromise);
    return { done, started: false };
  }

  private startRun(): Promise<R> {
    const promise = (async () => {
      try {
        return await this.run();
      } finally {
        // Drain settled: clear active, then drain the owed follow-up (if any) as
        // exactly one more run, handing its result to everyone who waited.
        this.active = null;
        if (this.followUpPending) {
          this.followUpPending = false;
          const waiters = this.followUpWaiters;
          this.followUpWaiters = [];
          const followUp = this.startRun();
          for (const w of waiters) w(followUp);
        }
      }
    })();
    this.active = promise;
    return promise;
  }
}
