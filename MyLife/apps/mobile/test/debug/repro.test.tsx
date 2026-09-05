// Minimal repro probe for the six-file collection hang (errors_log
// 2026-04-19). Imports exactly one suspect module statically; if vitest
// hangs here, the import graph alone reproduces the deadlock without any
// screen render or test-library involvement. Driven via vitest.debug.config.ts.

import { describe, expect, it } from 'vitest';
import * as booksUi from '@mylife/books/ui';

describe('repro: @mylife/books/ui barrel', () => {
  it('loads the barrel', () => {
    expect(Object.keys(booksUi).length).toBeGreaterThan(0);
  });
});
