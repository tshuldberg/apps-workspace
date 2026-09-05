import { describe, expect, it } from 'vitest';
import {
  REQUEST_AGAIN_ENABLED,
  REQUEST_AGAIN_LABEL,
  REMOVED_META_LABEL,
  deriveAttachmentCardMode,
  deriveRequestAgainAvailability,
  deriveRequestAgainView,
  freedBytesLabel,
  presentMetaLabel,
  requestQueueFailureMessage,
  summarizeRemoveResult,
} from '../(root)/data/attachment-card-state';
import type { RemoveBlobResult } from '../(root)/data/blob-store-core';

describe('deriveAttachmentCardMode', () => {
  it('maps null -> checking, true -> present, false -> removed', () => {
    expect(deriveAttachmentCardMode(null)).toBe('checking');
    expect(deriveAttachmentCardMode(true)).toBe('present');
    expect(deriveAttachmentCardMode(false)).toBe('removed');
  });
});

describe('Request again (Phase 3 LIVE, protocol-backed, honest gating)', () => {
  it('the control is now enabled (protocol shipped)', () => {
    expect(REQUEST_AGAIN_ENABLED).toBe(true);
    expect(REQUEST_AGAIN_LABEL).toBe('Request again');
  });

  it('availability is honest: only interactive for a paired author with a connection server', () => {
    expect(deriveRequestAgainAvailability({
      isOwnMessage: false, authorPaired: true, relayConfigured: true,
    })).toEqual({ canRequest: true, disabledReason: null });

    expect(deriveRequestAgainAvailability({
      isOwnMessage: true, authorPaired: true, relayConfigured: true,
    }).canRequest).toBe(false);

    const notPaired = deriveRequestAgainAvailability({
      isOwnMessage: false, authorPaired: false, relayConfigured: true,
    });
    expect(notPaired.canRequest).toBe(false);
    expect(notPaired.disabledReason).toContain('paired member');

    const noRelay = deriveRequestAgainAvailability({
      isOwnMessage: false, authorPaired: true, relayConfigured: false,
    });
    expect(noRelay.canRequest).toBe(false);
    expect(noRelay.disabledReason?.toLowerCase()).toContain('connection server');
  });

  it('the status view never claims delivery or restoration the row does not assert', () => {
    expect(deriveRequestAgainView('none').message).toBeNull();
    expect(deriveRequestAgainView('requesting').busy).toBe(true);

    const waiting = deriveRequestAgainView('requested');
    expect(waiting.tone).toBe('info');
    expect(waiting.message?.toLowerCase()).toContain('waiting for the owner');
    // Honesty: "waiting" must NOT claim it was received or restored.
    expect(waiting.message?.toLowerCase()).not.toContain('restored');

    const restored = deriveRequestAgainView('restored');
    expect(restored.tone).toBe('success');
    expect(restored.message?.toLowerCase()).toContain('restored');

    const declined = deriveRequestAgainView('declined', 'Owner no longer has this file.');
    expect(declined.tone).toBe('error');
    expect(declined.message).toBe('Owner no longer has this file.');

    const failed = deriveRequestAgainView('failed');
    expect(failed.tone).toBe('error');
    expect(failed.message?.toLowerCase()).toContain('try again');
  });

  it('queue-failure reasons map to honest copy (never a false success)', () => {
    expect(requestQueueFailureMessage('not_paired').toLowerCase()).toContain('paired');
    expect(requestQueueFailureMessage('no_relay').toLowerCase()).toContain('connection server');
    expect(requestQueueFailureMessage('park_failed').toLowerCase()).toContain('connection server');
    expect(requestQueueFailureMessage('self_author').toLowerCase()).toContain('shared this file');
  });
});

describe('meta + freed-space labels use the SIGNED size', () => {
  it('present line reads "<size> · on this device"', () => {
    expect(presentMetaLabel(900 * 1024)).toBe('900 KB · on this device');
  });

  it('freed-space line uses formatBytes of the signed size, not on-disk bytes', () => {
    // 2202010 bytes -> ~2.1 MB.
    expect(freedBytesLabel(2202010)).toBe('Removed from this device to free 2.1 MB');
  });
});

describe('summarizeRemoveResult (honest feedback per outcome)', () => {
  it('reports freed space ONLY for a freed result', () => {
    const freed: RemoveBlobResult = { freed: true, remainingRefs: 0 };
    const fb = summarizeRemoveResult(freed, 2202010);
    expect(fb.removed).toBe(true);
    expect(fb.tone).toBe('success');
    expect(fb.message).toBe('Removed from this device to free 2.1 MB');
  });

  it('treats an already-absent blob as removed without claiming new space freed', () => {
    const fb = summarizeRemoveResult({ freed: false, reason: 'not-present' }, 2202010);
    expect(fb.removed).toBe(true);
    expect(fb.tone).toBe('info');
    expect(fb.message).toBe(REMOVED_META_LABEL);
    // Must NOT claim a freed figure when nothing fresh was deleted.
    expect(fb.message).not.toMatch(/to free/);
  });

  it('keeps the card present when the blob is still referenced elsewhere', () => {
    const fb = summarizeRemoveResult(
      { freed: false, reason: 'still-referenced', remainingRefs: 1 },
      2202010,
    );
    expect(fb.removed).toBe(false);
    expect(fb.message.toLowerCase()).toContain('kept on this device');
  });

  it('surfaces a real error (never a false success) on verify-failed', () => {
    const fb = summarizeRemoveResult({ freed: false, reason: 'verify-failed' }, 2202010);
    expect(fb.removed).toBe(false);
    expect(fb.tone).toBe('error');
    expect(fb.message.toLowerCase()).toContain('could not confirm');
    expect(fb.message).not.toMatch(/freed|to free/i);
  });

  it('surfaces the underlying error message on error', () => {
    const fb = summarizeRemoveResult({ freed: false, reason: 'error', message: 'disk full' }, 100);
    expect(fb.removed).toBe(false);
    expect(fb.tone).toBe('error');
    expect(fb.message).toContain('disk full');
  });
});
