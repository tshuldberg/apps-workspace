import { describe, it, expect } from 'vitest';
import {
  detectConsentAction,
  transitionConsent,
  buildConsentRecord,
  handleInboundConsent,
  hasConsent,
} from '../src/consent';
import type { ConsentRecord } from '../src/types';

describe('consent', () => {
  describe('detectConsentAction', () => {
    it('detects STOP as opt_out', () => {
      expect(detectConsentAction('STOP')).toBe('opt_out');
    });

    it('detects stop (lowercase) as opt_out', () => {
      expect(detectConsentAction('stop')).toBe('opt_out');
    });

    it('detects UNSUBSCRIBE as opt_out', () => {
      expect(detectConsentAction('UNSUBSCRIBE')).toBe('opt_out');
    });

    it('detects CANCEL as opt_out', () => {
      expect(detectConsentAction('cancel')).toBe('opt_out');
    });

    it('detects END as opt_out', () => {
      expect(detectConsentAction('END')).toBe('opt_out');
    });

    it('detects QUIT as opt_out', () => {
      expect(detectConsentAction('QUIT')).toBe('opt_out');
    });

    it('detects START as opt_in', () => {
      expect(detectConsentAction('START')).toBe('opt_in');
    });

    it('detects YES as opt_in', () => {
      expect(detectConsentAction('YES')).toBe('opt_in');
    });

    it('detects UNSTOP as opt_in', () => {
      expect(detectConsentAction('UNSTOP')).toBe('opt_in');
    });

    it('detects SUBSCRIBE as opt_in', () => {
      expect(detectConsentAction('subscribe')).toBe('opt_in');
    });

    it('returns none for regular messages', () => {
      expect(detectConsentAction('Hello there')).toBe('none');
    });

    it('returns none for partial keyword matches', () => {
      expect(detectConsentAction('STOP IT')).toBe('none');
    });

    it('handles whitespace around keywords', () => {
      expect(detectConsentAction('  STOP  ')).toBe('opt_out');
    });
  });

  describe('transitionConsent', () => {
    it('transitions to opted_out on opt_out action', () => {
      expect(transitionConsent('opted_in', 'opt_out')).toBe('opted_out');
    });

    it('transitions to opted_in on opt_in action', () => {
      expect(transitionConsent('opted_out', 'opt_in')).toBe('opted_in');
    });

    it('transitions from never_asked to opted_in', () => {
      expect(transitionConsent('never_asked', 'opt_in')).toBe('opted_in');
    });

    it('transitions from pending to opted_out', () => {
      expect(transitionConsent('pending', 'opt_out')).toBe('opted_out');
    });

    it('keeps current status on none action', () => {
      expect(transitionConsent('opted_in', 'none')).toBe('opted_in');
      expect(transitionConsent('opted_out', 'none')).toBe('opted_out');
    });
  });

  describe('buildConsentRecord', () => {
    it('builds opt_out record with timestamp', () => {
      const record = buildConsentRecord('+15551234567', 'rest-1', 'opted_in', 'opt_out');
      expect(record.phone).toBe('+15551234567');
      expect(record.restaurantId).toBe('rest-1');
      expect(record.status).toBe('opted_out');
      expect(record.optedOutAt).toBeInstanceOf(Date);
      expect(record.optedInAt).toBeUndefined();
      expect(record.method).toBe('sms_keyword');
    });

    it('builds opt_in record with timestamp', () => {
      const record = buildConsentRecord('+15551234567', 'rest-1', 'opted_out', 'opt_in');
      expect(record.status).toBe('opted_in');
      expect(record.optedInAt).toBeInstanceOf(Date);
      expect(record.optedOutAt).toBeUndefined();
    });
  });

  describe('handleInboundConsent', () => {
    it('returns unsubscribe message for STOP', () => {
      const result = handleInboundConsent('STOP', '+15551234567', 'rest-1');
      expect(result).toContain('unsubscribed');
      expect(result).toContain('START');
    });

    it('returns re-subscribe message for START', () => {
      const result = handleInboundConsent('START', '+15551234567', 'rest-1');
      expect(result).toContain('re-subscribed');
      expect(result).toContain('STOP');
    });

    it('returns null for non-consent messages', () => {
      const result = handleInboundConsent('What time is my reservation?', '+15551234567', 'rest-1');
      expect(result).toBeNull();
    });
  });

  describe('hasConsent', () => {
    it('returns true for opted_in', () => {
      const record: ConsentRecord = {
        phone: '+15551234567',
        restaurantId: 'rest-1',
        status: 'opted_in',
        method: 'web_form',
      };
      expect(hasConsent(record)).toBe(true);
    });

    it('returns false for opted_out', () => {
      const record: ConsentRecord = {
        phone: '+15551234567',
        restaurantId: 'rest-1',
        status: 'opted_out',
        method: 'sms_keyword',
      };
      expect(hasConsent(record)).toBe(false);
    });

    it('returns false for null record', () => {
      expect(hasConsent(null)).toBe(false);
    });

    it('returns false for pending', () => {
      const record: ConsentRecord = {
        phone: '+15551234567',
        restaurantId: 'rest-1',
        status: 'pending',
        method: 'web_form',
      };
      expect(hasConsent(record)).toBe(false);
    });
  });
});
