import { describe, it, expect } from 'vitest';
import { verifyHmacSignature, isValidWebhook, registerNormalizer, normalizeEvent } from '../src/webhook-gateway';
import { createHmac } from 'crypto';
import type { WebhookEvent, NormalizedEvent } from '../src/types';

describe('webhook-gateway', () => {
  const secret = 'test-secret-key';
  const payload = '{"event":"booking.created"}';

  describe('verifyHmacSignature', () => {
    it('returns true for valid signature', () => {
      const signature = createHmac('sha256', secret).update(payload).digest('hex');
      expect(verifyHmacSignature(payload, signature, secret)).toBe(true);
    });

    it('returns true for sha256= prefixed signature', () => {
      const hash = createHmac('sha256', secret).update(payload).digest('hex');
      const signature = `sha256=${hash}`;
      expect(verifyHmacSignature(payload, signature, secret)).toBe(true);
    });

    it('returns false for invalid signature', () => {
      expect(verifyHmacSignature(payload, 'invalid-sig', secret)).toBe(false);
    });

    it('returns false for wrong secret', () => {
      const signature = createHmac('sha256', 'wrong-secret').update(payload).digest('hex');
      expect(verifyHmacSignature(payload, signature, secret)).toBe(false);
    });
  });

  describe('isValidWebhook', () => {
    it('validates square webhooks', () => {
      const signature = createHmac('sha256', secret).update(payload).digest('hex');
      expect(isValidWebhook(payload, signature, secret, 'square')).toBe(true);
    });

    it('validates toast webhooks', () => {
      const signature = createHmac('sha256', secret).update(payload).digest('hex');
      expect(isValidWebhook(payload, signature, secret, 'toast')).toBe(true);
    });

    it('returns false for omnivore (no handler)', () => {
      const signature = createHmac('sha256', secret).update(payload).digest('hex');
      expect(isValidWebhook(payload, signature, secret, 'omnivore')).toBe(false);
    });
  });

  describe('normalizeEvent', () => {
    it('returns null for unregistered provider', () => {
      const event: WebhookEvent = {
        id: 'e1',
        provider: 'toast',
        eventType: 'booking.created',
        payload: {},
        signature: 'sig',
        receivedAt: new Date().toISOString(),
      };
      expect(normalizeEvent(event)).toBeNull();
    });

    it('uses registered normalizer for provider', () => {
      registerNormalizer('square', (event): NormalizedEvent => ({
        type: 'reservation.created',
        externalId: 'ext-1',
        provider: event.provider,
        data: event.payload,
        timestamp: event.receivedAt,
      }));

      const event: WebhookEvent = {
        id: 'e2',
        provider: 'square',
        eventType: 'booking.created',
        payload: { bookingId: 'b1' },
        signature: 'sig',
        receivedAt: '2024-01-01T00:00:00Z',
      };

      const result = normalizeEvent(event);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('reservation.created');
      expect(result!.externalId).toBe('ext-1');
      expect(result!.provider).toBe('square');
    });
  });
});
