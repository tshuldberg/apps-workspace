import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const LAYOUT_PATH = path.resolve(process.cwd(), 'app', '(root)', '(tabs)', '_layout.tsx');

describe('BestChef operation queue sweepers', () => {
  it('mounts the pending report sweep beside the existing queue sweeps', () => {
    const source = readFileSync(LAYOUT_PATH, 'utf8');

    for (const hook of [
      'usePendingProofSweep();',
      'usePendingSaveSweep();',
      'useMediaUploadSweep();',
      'usePendingSubmissionSweep();',
      'usePendingReportSweep();',
    ]) {
      expect(source, hook).toContain(hook);
    }
  });

  it('retries pending reports when cloud access is ready and on app foreground', () => {
    const source = readFileSync(LAYOUT_PATH, 'utf8');

    expect(source).toContain('const ready = cloud.isReady && !!cloud.supabase;');
    expect(source).toContain('retryPendingReports(supabase, db)');
    expect(source).toContain("AppState.addEventListener('change', (state) => {");
    expect(source).toContain("if (state === 'active') sweep();");
    expect(source).toContain('.catch(() => undefined)');
    expect(source).not.toContain('sweepingRef');
  });
});
