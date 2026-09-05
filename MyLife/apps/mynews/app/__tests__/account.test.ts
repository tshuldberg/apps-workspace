import { describe, expect, it } from 'vitest';
import type { AccountDeletionView } from '@mylife/mynews';
import {
  buildDeletionScreenModel,
  exportFileName,
  exportSizeLabel,
  graceRemainingLabel,
} from '../(root)/lib/account';

const NOW = Date.parse('2026-07-30T12:00:00.000Z');
const GRACE_DAYS = 7;

function request(overrides: Partial<AccountDeletionView> = {}): AccountDeletionView {
  return {
    requestId: 'r1',
    status: 'grace',
    requestedAt: '2026-07-30T12:00:00.000Z',
    graceEndsAt: '2026-08-06T12:00:00.000Z',
    graceDays: GRACE_DAYS,
    cancellable: true,
    cancelledAt: null,
    completedAt: null,
    failureDetail: null,
    authUserDeletionState: 'pending',
    processorCleanupState: 'pending',
    ...overrides,
  };
}

describe('graceRemainingLabel', () => {
  it('rounds up so it never promises less time than the user has', () => {
    // 6 days and 1 hour left reads as 7 days, never 6.
    expect(graceRemainingLabel('2026-08-05T13:00:00.000Z', NOW)).toBe(
      '7 days left to change your mind',
    );
    expect(graceRemainingLabel('2026-07-31T12:00:00.000Z', NOW)).toBe(
      '24 hours left to change your mind',
    );
    expect(graceRemainingLabel('2026-07-30T12:30:00.000Z', NOW)).toBe(
      '30 minutes left to change your mind',
    );
    expect(graceRemainingLabel('2026-07-30T12:00:10.000Z', NOW)).toBe(
      '1 minutes left to change your mind',
    );
  });

  it('returns null once the window has elapsed or the date is unusable', () => {
    expect(graceRemainingLabel('2026-07-30T12:00:00.000Z', NOW)).toBeNull();
    expect(graceRemainingLabel('2026-07-29T12:00:00.000Z', NOW)).toBeNull();
    expect(graceRemainingLabel('not-a-date', NOW)).toBeNull();
  });
});

describe('buildDeletionScreenModel', () => {
  it('offers the confirm form when no request exists and names the grace window', () => {
    const model = buildDeletionScreenModel(null, NOW, GRACE_DAYS);
    expect(model.showConfirmForm).toBe(true);
    expect(model.showCancel).toBe(false);
    expect(model.detail).toContain(`${GRACE_DAYS}-day grace period`);
    expect(model.steps).toEqual([]);
  });

  it('offers cancel and a countdown during the grace window, never the confirm form', () => {
    const model = buildDeletionScreenModel(request(), NOW, GRACE_DAYS);
    expect(model.showCancel).toBe(true);
    expect(model.showConfirmForm).toBe(false);
    expect(model.countdown).toBe('7 days left to change your mind');
    expect(model.detail).toContain('still here');
  });

  it('withdraws cancel once processing starts', () => {
    const model = buildDeletionScreenModel(request({ status: 'processing' }), NOW, GRACE_DAYS);
    expect(model.showCancel).toBe(false);
    expect(model.showConfirmForm).toBe(false);
    expect(model.detail).toContain('no longer be cancelled');
  });

  it('re-offers the confirm form after a cancellation and states nothing was removed', () => {
    const model = buildDeletionScreenModel(
      request({ status: 'cancelled', cancellable: false, cancelledAt: '2026-07-31T00:00:00.000Z' }),
      NOW,
      GRACE_DAYS,
    );
    expect(model.showConfirmForm).toBe(true);
    expect(model.detail).toContain('Nothing was removed');
    expect(model.steps).toEqual([]);
  });

  it('surfaces the retained-record truth on completion', () => {
    const model = buildDeletionScreenModel(
      request({ status: 'completed', completedAt: '2026-08-06T12:05:00.000Z' }),
      NOW,
      GRACE_DAYS,
    );
    expect(model.detail).toContain('anonymized profile');
    expect(model.showConfirmForm).toBe(false);
    expect(model.showCancel).toBe(false);
  });

  it('says a failed pass will be retried and keeps the steps visible', () => {
    const model = buildDeletionScreenModel(
      request({ status: 'failed', authUserDeletionState: 'failed' }),
      NOW,
      GRACE_DAYS,
    );
    expect(model.detail).toContain('another attempt');
    expect(model.steps.map((s) => s.state)).toEqual(['failed', 'pending']);
  });

  it('renders unconfigured side effects verbatim instead of implying success', () => {
    const model = buildDeletionScreenModel(
      request({
        status: 'completed',
        authUserDeletionState: 'skipped-unconfigured',
        processorCleanupState: 'skipped-unconfigured',
      }),
      NOW,
      GRACE_DAYS,
    );
    expect(model.steps.map((s) => s.state)).toEqual([
      'skipped-unconfigured',
      'skipped-unconfigured',
    ]);
    expect(model.steps.some((s) => s.state === 'done')).toBe(false);
  });
});

describe('export labels', () => {
  it('formats sizes without ever claiming an empty export has bytes', () => {
    expect(exportSizeLabel(0)).toBe('0 KB');
    expect(exportSizeLabel(-5)).toBe('0 KB');
    expect(exportSizeLabel(512)).toBe('512 B');
    expect(exportSizeLabel(2048)).toBe('2 KB');
    expect(exportSizeLabel(3 * 1024 * 1024)).toBe('3.0 MB');
  });

  it('names the file by the day it was built', () => {
    expect(exportFileName('2026-07-30T12:00:00.000Z')).toBe('mynews-export-2026-07-30.json');
  });
});
