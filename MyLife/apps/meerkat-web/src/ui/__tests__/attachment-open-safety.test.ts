/**
 * Audit S1 regression: a received attachment's sender-signed mimeType must never
 * cause a scriptable document to open top-level on the app origin.
 *
 * `isInlineRenderSafeMimeType` is the single decision gate: the View path opens inline
 * ONLY when it returns true; every other type force-downloads (a download never
 * executes). These assertions lock the allowlist: scriptable types are excluded.
 */

import { describe, expect, it } from 'vitest';
import { isInlineRenderSafeMimeType } from '../format';

describe('audit S1: inline-render MIME allowlist for the View path', () => {
  it('never treats a scriptable type as inline-render-safe', () => {
    for (const scriptable of [
      'text/html',
      'text/html; charset=utf-8',
      'image/svg+xml',
      'image/svg+xml; charset=utf-8',
      'application/xhtml+xml',
      'application/xml',
      'text/xml',
      'application/javascript',
      'text/javascript',
      'text/html; foo=image/png', // a scriptable BASE type stays unsafe despite params
    ]) {
      expect(isInlineRenderSafeMimeType(scriptable)).toBe(false);
    }
  });

  it('treats a real image (except SVG), video, audio, and pdf as inline-render-safe', () => {
    for (const safe of [
      'image/png',
      'image/jpeg',
      'image/gif',
      'image/webp',
      'IMAGE/PNG', // case-insensitive
      'image/jpeg; charset=binary', // parameters are stripped before the check
      'video/mp4',
      'video/webm',
      'audio/mpeg',
      'audio/ogg',
      'application/pdf',
    ]) {
      expect(isInlineRenderSafeMimeType(safe)).toBe(true);
    }
  });

  it('fails closed on empty / unknown / octet-stream types', () => {
    for (const unknown of ['', '   ', 'application/octet-stream', 'application/zip', 'font/woff2']) {
      expect(isInlineRenderSafeMimeType(unknown)).toBe(false);
    }
  });
});
