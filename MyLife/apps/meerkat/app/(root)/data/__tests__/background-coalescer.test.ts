// Coalescer unit tests (Plan 42 AC-42.8).
//
// Prove that concurrent triggers (scheduled + push + foreground resume) collapse
// to ONE drain plus at most ONE bounded follow-up, and never one drain per
// trigger. Uses a controllable fake drain (a deferred promise) so we can hold a
// drain in flight while more triggers arrive.

import { describe, it, expect } from 'vitest';
import { BackgroundTriggerCoalescer } from '../background-coalescer';

/** A drain we can resolve on demand, counting how many times it started. */
function controllableDrain() {
  let runs = 0;
  let resolveCurrent: ((value: number) => void) | null = null;
  const run = (): Promise<number> => {
    runs += 1;
    const myRun = runs;
    return new Promise<number>((resolve) => {
      resolveCurrent = (value) => resolve(value ?? myRun);
    });
  };
  return {
    run,
    get runs() {
      return runs;
    },
    /** Resolve the in-flight drain. */
    finish(value = 0): void {
      const r = resolveCurrent;
      resolveCurrent = null;
      r?.(value);
    },
  };
}

describe('BackgroundTriggerCoalescer', () => {
  it('N concurrent triggers while idle -> exactly ONE drain', async () => {
    const drain = controllableDrain();
    const c = new BackgroundTriggerCoalescer(drain.run);

    const a = c.trigger();
    const b = c.trigger();
    const d = c.trigger();

    // Only the first started a run; the rest coalesced into the in-flight one.
    expect(a.started).toBe(true);
    expect(b.started).toBe(false);
    expect(d.started).toBe(false);
    expect(drain.runs).toBe(1);

    drain.finish();
    // A follow-up is owed because b and d arrived during the run.
    // Resolve it too, then everyone settles.
    await a.done;
    // One follow-up now runs.
    expect(drain.runs).toBe(2);
    drain.finish();
    await Promise.all([b.done, d.done]);

    // No third drain: the follow-up covered all triggers that arrived mid-run.
    expect(drain.runs).toBe(2);
  });

  it('triggers during an in-flight drain schedule exactly ONE follow-up (not one each)', async () => {
    const drain = controllableDrain();
    const c = new BackgroundTriggerCoalescer(drain.run);

    const first = c.trigger();
    expect(drain.runs).toBe(1);

    // Five triggers arrive while the first drain is in flight.
    const during = [c.trigger(), c.trigger(), c.trigger(), c.trigger(), c.trigger()];
    expect(during.every((t) => !t.started)).toBe(true);
    expect(drain.runs).toBe(1); // still only the first is running

    drain.finish();
    await first.done;
    // Exactly one follow-up drain runs for all five.
    expect(drain.runs).toBe(2);

    drain.finish();
    await Promise.all(during.map((t) => t.done));
    expect(drain.runs).toBe(2);
  });

  it('a trigger after everything settles starts a fresh single drain', async () => {
    const drain = controllableDrain();
    const c = new BackgroundTriggerCoalescer(drain.run);

    const first = c.trigger();
    drain.finish();
    await first.done;
    expect(drain.runs).toBe(1);
    expect(c.isRunning).toBe(false);

    const later = c.trigger();
    expect(later.started).toBe(true);
    expect(drain.runs).toBe(2);
    drain.finish();
    await later.done;
    expect(drain.runs).toBe(2);
  });

  it('follow-up chains: triggers during the follow-up coalesce into one more', async () => {
    const drain = controllableDrain();
    const c = new BackgroundTriggerCoalescer(drain.run);

    const first = c.trigger(); // run 1
    c.trigger(); // owes follow-up (run 2)
    drain.finish(); // finish run 1
    await first.done;
    expect(drain.runs).toBe(2); // run 2 in flight

    // Triggers during run 2 owe exactly one more (run 3).
    const duringFollowUp = [c.trigger(), c.trigger()];
    drain.finish(); // finish run 2 -> run 3 starts
    // Let the microtask queue flush so run 3 actually starts.
    await Promise.resolve();
    expect(drain.runs).toBe(3);

    drain.finish(); // finish run 3
    await Promise.all(duringFollowUp.map((t) => t.done));
    expect(c.isRunning).toBe(false);
    // No run 4: the two triggers during run 2 shared the single run 3.
    expect(drain.runs).toBe(3);
  });
});
