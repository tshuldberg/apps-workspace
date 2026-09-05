// Module-scope task definition test (Plan 42 NC-42.7).
//
// Proves the NC-42.7 invariant: importing the task-definition module DEFINES the
// tasks at import time WITHOUT requiring React or calling a registration
// function. A headless OS launch (scheduled fetch / terminated-state push) boots
// the JS bundle and looks the task up by name before any view mounts; the
// definition must already exist. This test imports the module in the Node/vitest
// env (where expo-task-manager is absent) and asserts:
//   - importing it does not throw (no React / native dependency at import time);
//   - defineBackgroundTasks is idempotent;
//   - the task-name constants are stable;
//   - the coalescer drain runner is exposed for every trigger source.
//
// The full "task actually defined on expo-task-manager" proof needs a dev build;
// here we prove the code path is import-safe and reachable with no React mount.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  BACKGROUND_NOTIFICATION_TASK,
  defineBackgroundTasks,
  runCoalescedBackgroundDrain,
  backgroundDrainCoalescer,
} from '../background-task-definitions';
import { BACKGROUND_SYNC_TASK } from '../background-sync';

describe('background task definitions (NC-42.7)', () => {
  it('imports without React or a registration call (module-scope safe)', () => {
    // If the import at the top of this file had required React or thrown on a
    // missing native module, this test file would not have loaded at all. Reaching
    // here proves the definitions module is import-safe.
    expect(typeof runCoalescedBackgroundDrain).toBe('function');
    expect(backgroundDrainCoalescer).toBeDefined();
  });

  it('exposes stable task-name constants', () => {
    expect(BACKGROUND_SYNC_TASK).toBe('meerkat-background-sync');
    expect(BACKGROUND_NOTIFICATION_TASK).toBe('meerkat-background-notification');
  });

  it('defineBackgroundTasks is idempotent (safe on hot reload)', () => {
    expect(() => {
      defineBackgroundTasks();
      defineBackgroundTasks();
    }).not.toThrow();
  });
});

describe('NC-42.7 source lock: defineTask is only at module scope, never in a function', () => {
  const registrationSource = readFileSync(
    resolve(__dirname, '..', 'background-task-registration.ts'),
    'utf8',
  );
  const definitionsSource = readFileSync(
    resolve(__dirname, '..', 'background-task-definitions.ts'),
    'utf8',
  );

  it('the registration file no longer calls defineTask (moved to module scope)', () => {
    expect(registrationSource).not.toContain('defineTask');
  });

  it('the definitions file defines tasks and calls defineBackgroundTasks at module top level', () => {
    expect(definitionsSource).toContain('taskManager.defineTask');
    // The module-scope invocation: a bare `defineBackgroundTasks();` statement
    // (not indented inside a function body) must exist.
    expect(definitionsSource).toMatch(/\ndefineBackgroundTasks\(\);/);
  });

  it('the app entry imports the definitions module before expo-router (boot order)', () => {
    const entry = readFileSync(resolve(__dirname, '..', '..', '..', '..', 'index.js'), 'utf8');
    const defIndex = entry.indexOf('background-task-definitions');
    const routerIndex = entry.indexOf('expo-router/entry');
    expect(defIndex).toBeGreaterThanOrEqual(0);
    expect(routerIndex).toBeGreaterThanOrEqual(0);
    expect(defIndex).toBeLessThan(routerIndex);
  });
});
