/**
 * Unit tests for the log-redaction helper (Plan 44 WP-4B).
 *
 * Both directions are asserted, because the FALSE-POSITIVE direction is the one
 * that quietly destroys log utility: a rule that scrubs content hashes would
 * "pass" a naive secrets-only test while blinding every operator. So for every
 * scrub rule there is a matching preservation assertion proving the ids, hashes,
 * public keys, and normal fields this codebase logs on purpose survive intact.
 */

import { describe, it, expect } from 'vitest';
import { redactForLog, redactErrorDetail, REDACTION_PLACEHOLDER } from '../log-redaction';

describe('redactForLog - key denylist (secrets scrubbed)', () => {
  it('redacts denylisted keys regardless of value shape', () => {
    const out = redactForLog({
      event: 'boot',
      sessionSecret: 'hmac-secret-value',
      MEERKAT_PERSONA_SESSION_SECRET: 'another-secret',
      password: 'hunter2',
      passphrase: 'correct horse battery staple',
      token: 'bearer-blob-value',
      authorization: 'Bearer abc',
      cookie: 'sid=deadbeef',
      apiKey: 'sk_live_1234567890',
      signingKey: 'ed25519-seed',
      seed: 'a1b2c3',
      hmacKey: 'shared-key',
      entitlementSecret: 'ent-secret',
      credential: 'cred',
      connectionString: 'postgres://u:p@h/db',
      dsn: 'postgres://u:p@h/db',
    });
    for (const key of [
      'sessionSecret',
      'MEERKAT_PERSONA_SESSION_SECRET',
      'password',
      'passphrase',
      'token',
      'authorization',
      'cookie',
      'apiKey',
      'signingKey',
      'seed',
      'hmacKey',
      'entitlementSecret',
      'credential',
      'connectionString',
      'dsn',
    ]) {
      expect((out as Record<string, unknown>)[key]).toBe(REDACTION_PLACEHOLDER);
    }
    expect(out.event).toBe('boot');
  });

  it('redacts an entire nested value under a denylisted key', () => {
    const out = redactForLog({ credentials: { user: 'x', pass: 'y' }, ok: true });
    expect(out.credentials).toBe(REDACTION_PLACEHOLDER);
    expect(out.ok).toBe(true);
  });

  it('matches denylist fragments through case and separators', () => {
    const out = redactForLog({
      'Webhook-Secret': 'whsec_x',
      SESSION_TOKEN: 'sess',
      apikey: 'k',
    });
    expect((out as Record<string, unknown>)['Webhook-Secret']).toBe(REDACTION_PLACEHOLDER);
    expect((out as Record<string, unknown>).SESSION_TOKEN).toBe(REDACTION_PLACEHOLDER);
    expect((out as Record<string, unknown>).apikey).toBe(REDACTION_PLACEHOLDER);
  });

  it('redacts Plan 51 account-layer sensitive keys (subject, relay email, serial, sealed key)', () => {
    const out = redactForLog({
      event: 'boot',
      providerSubject: 'apple-sub-001',
      provider_subject: 'google-sub-001',
      relayEmail: 'x@privaterelay.appleid.com',
      relay_email: 'y@gmail.com',
      idToken: 'eyJhbGciOi...',
      id_token: 'eyJhbGciOi...',
      epochKeySecret: 'seal-secret',
      sealedPrivateKey: 'v1:base64blob',
      serial: 'ab'.repeat(32),
    });
    for (const key of [
      'providerSubject', 'provider_subject', 'relayEmail', 'relay_email',
      'idToken', 'id_token', 'epochKeySecret', 'sealedPrivateKey', 'serial',
    ]) {
      expect((out as Record<string, unknown>)[key]).toBe(REDACTION_PLACEHOLDER);
    }
    expect(out.event).toBe('boot');
  });
});

describe('redactForLog - content preserved (no false positives)', () => {
  it('preserves public keys, ids, and content hashes named honestly', () => {
    const publicationId = 'p'.repeat(64);
    const contentId = 'c'.repeat(64);
    const rid = 'r'.repeat(48);
    const publicKey = 'ab12cd34'.repeat(8); // 64 hex, a real public key width
    const out = redactForLog({
      event: 'post_receipt_key',
      publicKey,
      publicationId,
      contentId,
      rid,
      postReceiptKey: publicKey,
      postNodeKey: publicKey,
      authority: publicKey,
      knownBad: 42,
      connections: 3,
    });
    expect(out.publicKey).toBe(publicKey);
    expect(out.publicationId).toBe(publicationId);
    expect(out.contentId).toBe(contentId);
    expect(out.rid).toBe(rid);
    expect(out.postReceiptKey).toBe(publicKey);
    expect(out.postNodeKey).toBe(publicKey);
    expect(out.authority).toBe(publicKey);
    expect(out.knownBad).toBe(42);
    expect(out.connections).toBe(3);
  });

  it('never scrubs a bare 64-hex string in a free-form field for being long or hex', () => {
    const hash = 'deadbeef'.repeat(8);
    const out = redactForLog({ event: 'announced', detail: `served ${hash}`, url: 'https://directory.example/browse' });
    expect(out.detail).toBe(`served ${hash}`);
    expect(out.url).toBe('https://directory.example/browse');
  });
});

describe('redactForLog - string shape scrubs', () => {
  it('scrubs URL userinfo but keeps scheme, host, and path', () => {
    const out = redactForLog({
      detail: "connection to postgres://meerkat:s3cr3t@db.internal:5432/meerkat failed",
    });
    expect(out.detail).not.toContain('s3cr3t');
    expect(out.detail).not.toContain('meerkat:s3cr3t');
    expect(out.detail).toContain('postgres://');
    expect(out.detail).toContain('db.internal:5432/meerkat');
    expect(out.detail).toContain(`${REDACTION_PLACEHOLDER}@`);
  });

  it('scrubs presigned-url credential query params but keeps the base url', () => {
    const url =
      'https://bucket.s3.amazonaws.com/tenants/abc/blob?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20260710&X-Amz-Signature=1a2b3c4d5e6f7890abcdef&X-Amz-SignedHeaders=host';
    const out = redactForLog({ presignedUrl: 'kept-as-key-redacts', detail: url });
    // Under a denylisted-ish key would redact wholesale; here it is in a free field.
    expect(out.detail).toContain('https://bucket.s3.amazonaws.com/tenants/abc/blob');
    expect(out.detail).not.toContain('1a2b3c4d5e6f7890abcdef');
    expect(out.detail).not.toContain('AKIAIOSFODNN7EXAMPLE');
    expect(out.detail).toContain('X-Amz-Signature=' + REDACTION_PLACEHOLDER);
  });

  it('scrubs a Bearer blob introduced by the literal marker only', () => {
    const out = redactForLog({
      detail: 'auth failed for Bearer eyJhbGciOiJIUzI1NiJ9.payloadpayloadpayload.sigsigsig',
      note: 'Bearer token required', // short, no blob: must be untouched
    });
    expect(out.detail).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    expect(out.detail).toContain(`Bearer ${REDACTION_PLACEHOLDER}`);
    expect(out.note).toBe('Bearer token required');
  });

  it('scrubs across arrays and nested objects', () => {
    const out = redactForLog({
      hosts: ['postgres://u:pw@a/db', 'https://ok.example'],
      nested: { deep: { detail: 'postgres://role:pw2@b/db' } },
    });
    expect(JSON.stringify(out)).not.toContain('pw@');
    expect(JSON.stringify(out)).not.toContain('pw2@');
    expect(JSON.stringify(out)).toContain('https://ok.example');
  });

  it('stringifies and scrubs a nested Error', () => {
    const out = redactForLog({
      event: 'fatal',
      cause: new Error('pool at postgres://u:leaked@h/db is down'),
    });
    expect(JSON.stringify(out)).not.toContain('leaked');
  });

  it('is bounded against deep/large inputs without throwing', () => {
    let deep: Record<string, unknown> = { detail: 'postgres://u:pw@h/db' };
    for (let i = 0; i < 100; i++) deep = { child: deep };
    expect(() => redactForLog(deep)).not.toThrow();
    const wide: Record<string, unknown> = {};
    for (let i = 0; i < 10_000; i++) wide[`k${i}`] = 'v';
    expect(() => redactForLog(wide)).not.toThrow();
  });

  it('does not mutate its input', () => {
    const input = { secret: 'x', detail: 'postgres://u:pw@h/db' };
    const snapshot = JSON.stringify(input);
    redactForLog(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

describe('redactErrorDetail', () => {
  it('scrubs userinfo, query credentials, and bearer blobs in a raw error string', () => {
    const scrubbed = redactErrorDetail(
      'connect ECONNREFUSED postgres://meerkat:pw@127.0.0.1:5432/db; url https://b.s3/x?X-Amz-Signature=abcdef123456; Bearer eyJhbGciOiJIUzI1NiJ9.aaaaaaaaaaaaaaaaaaaa.bbb',
    );
    expect(scrubbed).not.toContain(':pw@');
    expect(scrubbed).not.toContain('abcdef123456');
    expect(scrubbed).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    expect(scrubbed).toContain('postgres://');
    expect(scrubbed).toContain('127.0.0.1:5432/db');
  });

  it('redacts credential-shaped env assignments only', () => {
    const scrubbed = redactErrorDetail(
      'bad config: MEERKAT_PERSONA_SESSION_SECRET=deadbeefdeadbeef PORT=8894 MEERKAT_STORE_BACKEND=file',
    );
    expect(scrubbed).not.toContain('deadbeefdeadbeef');
    expect(scrubbed).toContain(`MEERKAT_PERSONA_SESSION_SECRET=${REDACTION_PLACEHOLDER}`);
    expect(scrubbed).toContain('PORT=8894');
    expect(scrubbed).toContain('MEERKAT_STORE_BACKEND=file');
  });

  it('leaves a clean error message untouched', () => {
    const msg = 'PostgreSQL store is unavailable during TLS CA loading';
    expect(redactErrorDetail(msg)).toBe(msg);
  });
});
