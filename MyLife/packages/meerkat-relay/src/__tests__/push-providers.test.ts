/**
 * Provider adapter tests against LOCAL fake servers (Plan 42 P4).
 *
 * Each adapter is exercised end to end against a real local server that speaks the
 * provider's shape: APNs over node:http2 (asserting the ES256 provider-token JWT header
 * and the /3/device path), FCM over http (asserting the OAuth mint then the v1 send with
 * the bearer), and Web Push over http (asserting the VAPID headers and that the posted
 * body DECRYPTS with the subscription's keys). No network, no real credentials.
 */

import {
  createDecipheriv,
  createHash,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  verify as verifyOneShot,
} from 'node:crypto';
import http from 'node:http';
import http2 from 'node:http2';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ApnsProviderAdapter,
  FcmProviderAdapter,
  WebPushProviderAdapter,
} from '../push-providers';

const cleanups: Array<() => Promise<void> | void> = [];
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()?.();
});

function p256Pem(): { privatePem: string; publicPem: string; publicRaw: Buffer } {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const spki = publicKey.export({ format: 'der', type: 'spki' }) as Buffer;
  return {
    privatePem: privateKey.export({ format: 'pem', type: 'pkcs8' }) as string,
    publicPem: publicKey.export({ format: 'pem', type: 'spki' }) as string,
    publicRaw: Buffer.from(spki.subarray(spki.length - 65)),
  };
}

function decodeJwt(token: string): { header: Record<string, unknown>; claims: Record<string, unknown>; signingInput: string; signature: Buffer } {
  const [header, claims, signature] = token.split('.');
  return {
    header: JSON.parse(Buffer.from(header!, 'base64url').toString('utf8')),
    claims: JSON.parse(Buffer.from(claims!, 'base64url').toString('utf8')),
    signingInput: `${header}.${claims}`,
    signature: Buffer.from(signature!, 'base64url'),
  };
}

describe('ApnsProviderAdapter over a local http2 server', () => {
  it('sends a background push with an ES256 provider-token JWT and reports acceptance', async () => {
    const { privatePem, publicPem } = p256Pem();
    const received: { path?: string; authorization?: string; topic?: string; pushType?: string } = {};

    const server = http2.createServer();
    server.on('stream', (stream, headers) => {
      received.path = headers[':path'] as string;
      received.authorization = headers.authorization as string;
      received.topic = headers['apns-topic'] as string;
      received.pushType = headers['apns-push-type'] as string;
      stream.respond({ ':status': 200, 'apns-id': 'apns-ref-0001' });
      stream.end();
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as AddressInfo).port;
    cleanups.push(() => new Promise<void>((resolve) => server.close(() => resolve())));

    const adapter = new ApnsProviderAdapter({
      keyId: 'KEYID1234',
      teamId: 'TEAMID5678',
      topic: 'app.meerkat',
      signingKeyPem: privatePem,
      baseUrl: `http://127.0.0.1:${port}`,
      connect: (authority) => http2.connect(authority),
    });
    cleanups.push(() => adapter.close());

    const outcome = await adapter.send({
      token: 'a'.repeat(64),
      payload: new Uint8Array([1, 2, 3, 4]),
      urgency: 'high',
      timeoutMs: 5_000,
    });

    expect(outcome).toEqual({ kind: 'accepted', providerReference: 'apns-ref-0001' });
    expect(received.path).toBe(`/3/device/${'a'.repeat(64)}`);
    expect(received.topic).toBe('app.meerkat');
    expect(received.pushType).toBe('background');
    // The JWT header is ES256 with our kid, iss is the team id, and it verifies
    // against the signing key's public half.
    const jwt = decodeJwt((received.authorization ?? '').replace(/^bearer /u, ''));
    expect(jwt.header).toMatchObject({ alg: 'ES256', kid: 'KEYID1234' });
    expect(jwt.claims).toMatchObject({ iss: 'TEAMID5678' });
    const verified = verifyOneShot(
      'sha256',
      Buffer.from(jwt.signingInput),
      { key: createPublicKey(publicPem), dsaEncoding: 'ieee-p1363' },
      jwt.signature,
    );
    expect(verified).toBe(true);
  });

  it('maps a 410 Unregistered to a token_unregistered rejection', async () => {
    const { privatePem } = p256Pem();
    const server = http2.createServer();
    server.on('stream', (stream) => {
      const body = JSON.stringify({ reason: 'Unregistered' });
      stream.respond({ ':status': 410, 'content-type': 'application/json' });
      stream.end(body);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as AddressInfo).port;
    cleanups.push(() => new Promise<void>((resolve) => server.close(() => resolve())));

    const adapter = new ApnsProviderAdapter({
      keyId: 'KEYID1234', teamId: 'TEAMID5678', topic: 'app.meerkat',
      signingKeyPem: privatePem, baseUrl: `http://127.0.0.1:${port}`,
    });
    cleanups.push(() => adapter.close());
    const outcome = await adapter.send({
      token: 'b'.repeat(64), payload: new Uint8Array([9]), urgency: 'normal', timeoutMs: 5_000,
    });
    expect(outcome).toEqual({ kind: 'rejected', reasonClass: 'token_unregistered' });
  });
});

describe('FcmProviderAdapter over a local http server', () => {
  function serviceAccount(): { projectId: string; clientEmail: string; privateKeyPem: string; publicPem: string } {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    return {
      projectId: 'meerkat-test',
      clientEmail: 'push@meerkat-test.iam.gserviceaccount.com',
      privateKeyPem: privateKey.export({ format: 'pem', type: 'pkcs8' }) as string,
      publicPem: publicKey.export({ format: 'pem', type: 'spki' }) as string,
    };
  }

  it('mints an RS256 OAuth token then sends a data message with the bearer', async () => {
    const account = serviceAccount();
    const seen: { assertion?: string; sendAuth?: string; sendBody?: unknown } = {};

    const server = http.createServer((req, res) => {
      let raw = '';
      req.on('data', (c) => { raw += c; });
      req.on('end', () => {
        if (req.url === '/token') {
          seen.assertion = new URLSearchParams(raw).get('assertion') ?? undefined;
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ access_token: 'ya29.fake', expires_in: 3600 }));
          return;
        }
        seen.sendAuth = req.headers.authorization;
        seen.sendBody = JSON.parse(raw);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ name: 'projects/meerkat-test/messages/0:123' }));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as AddressInfo).port;
    cleanups.push(() => new Promise<void>((resolve) => server.close(() => resolve())));

    const adapter = new FcmProviderAdapter({
      serviceAccount: { ...account, tokenUri: `http://127.0.0.1:${port}/token` },
      baseUrl: `http://127.0.0.1:${port}`,
    });
    cleanups.push(() => adapter.close());

    const outcome = await adapter.send({
      token: 'x'.repeat(64), payload: new Uint8Array([5, 6, 7]), urgency: 'high', timeoutMs: 5_000,
    });
    expect(outcome).toEqual({ kind: 'accepted', providerReference: 'projects/meerkat-test/messages/0:123' });
    expect(seen.sendAuth).toBe('Bearer ya29.fake');
    // The OAuth assertion is an RS256 JWT that verifies against the service-account key.
    const jwt = decodeJwt(seen.assertion ?? '');
    expect(jwt.header).toMatchObject({ alg: 'RS256' });
    const verified = verifyOneShot('RSA-SHA256', Buffer.from(jwt.signingInput), createPublicKey(account.publicPem), jwt.signature);
    expect(verified).toBe(true);
    // The wake payload rides opaque in a data field, base64url of the bytes.
    const data = (seen.sendBody as { message?: { data?: { w?: string } } }).message?.data;
    expect(data?.w).toBe(Buffer.from([5, 6, 7]).toString('base64url'));
  });

  it('caches the OAuth token across sends (one mint, two sends)', async () => {
    const account = serviceAccount();
    let mints = 0;
    let sends = 0;
    const server = http.createServer((req, res) => {
      req.on('data', () => { /* drain */ });
      req.on('end', () => {
        if (req.url === '/token') {
          mints += 1;
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ access_token: 'ya29.fake', expires_in: 3600 }));
          return;
        }
        sends += 1;
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ name: 'n' }));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as AddressInfo).port;
    cleanups.push(() => new Promise<void>((resolve) => server.close(() => resolve())));

    const adapter = new FcmProviderAdapter({
      serviceAccount: { ...account, tokenUri: `http://127.0.0.1:${port}/token` },
      baseUrl: `http://127.0.0.1:${port}`,
    });
    cleanups.push(() => adapter.close());
    await adapter.send({ token: 'x'.repeat(64), payload: new Uint8Array([1]), urgency: 'normal', timeoutMs: 5_000 });
    await adapter.send({ token: 'x'.repeat(64), payload: new Uint8Array([2]), urgency: 'normal', timeoutMs: 5_000 });
    expect(mints).toBe(1);
    expect(sends).toBe(2);
  });
});

describe('WebPushProviderAdapter over a local endpoint', () => {
  it('posts VAPID headers and an aes128gcm body that decrypts with the subscription keys', async () => {
    const vapid = p256Pem();
    // The "client" (browser) subscription key pair whose private half our test holds.
    const client = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const clientSpki = client.publicKey.export({ format: 'der', type: 'spki' }) as Buffer;
    const clientPublicRaw = Buffer.from(clientSpki.subarray(clientSpki.length - 65));
    const authSecret = createHash('sha256').update('auth').digest().subarray(0, 16);

    const captured: { authorization?: string; contentEncoding?: string; body?: Buffer } = {};
    const server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(c as Buffer));
      req.on('end', () => {
        captured.authorization = req.headers.authorization as string;
        captured.contentEncoding = req.headers['content-encoding'] as string;
        captured.body = Buffer.concat(chunks);
        res.writeHead(201);
        res.end();
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as AddressInfo).port;
    cleanups.push(() => new Promise<void>((resolve) => server.close(() => resolve())));

    const subscription = JSON.stringify({
      endpoint: `http://127.0.0.1:${port}/push/subscription-abc`,
      keys: {
        p256dh: clientPublicRaw.toString('base64url'),
        auth: authSecret.toString('base64url'),
      },
    });

    const adapter = new WebPushProviderAdapter({
      subject: 'mailto:ops@meerkat.test',
      publicKey: vapid.publicRaw.toString('base64url'),
      privateKeyPem: vapid.privatePem,
    });
    cleanups.push(() => adapter.close());

    const plaintext = new TextEncoder().encode('wake');
    const outcome = await adapter.send({ token: subscription, payload: plaintext, urgency: 'high', timeoutMs: 5_000 });
    expect(outcome).toEqual({ kind: 'accepted' });
    expect(captured.contentEncoding).toBe('aes128gcm');
    expect(captured.authorization).toMatch(/^vapid t=.+, k=.+$/u);

    // Decrypt the aes128gcm body with the client's private key, proving a real browser
    // could read it. Parse the header: salt(16) | recordSize(4) | keyIdLen(1) | serverPub.
    const body = captured.body!;
    const salt = body.subarray(0, 16);
    const keyIdLen = body.readUInt8(20);
    const serverPublicRaw = body.subarray(21, 21 + keyIdLen);
    const ciphertext = body.subarray(21 + keyIdLen);

    const serverPublicKey = createPublicKey({
      key: Buffer.concat([
        Buffer.from('3059301306072a8648ce3d020106082a8648ce3d030107034200', 'hex'),
        serverPublicRaw,
      ]),
      format: 'der',
      type: 'spki',
    });
    const sharedSecret = diffieHellman({ privateKey: client.privateKey, publicKey: serverPublicKey });
    const keyInfo = Buffer.concat([
      Buffer.from('WebPush: info\0', 'utf8'),
      clientPublicRaw,
      serverPublicRaw,
    ]);
    const ikm = Buffer.from(hkdfSync('sha256', sharedSecret, authSecret, keyInfo, 32));
    const cek = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0', 'utf8'), 16));
    const nonce = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0', 'utf8'), 12));
    const tag = ciphertext.subarray(ciphertext.length - 16);
    const sealed = ciphertext.subarray(0, ciphertext.length - 16);
    const decipher = createDecipheriv('aes-128-gcm', cek, nonce);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(sealed), decipher.final()]);
    // The record is the plaintext followed by the 0x02 last-record delimiter.
    expect(decrypted.subarray(0, decrypted.length - 1).toString('utf8')).toBe('wake');
    expect(decrypted[decrypted.length - 1]).toBe(0x02);

    // The VAPID JWT verifies against the configured public key.
    const vapidToken = /vapid t=([^,]+),/u.exec(captured.authorization ?? '')?.[1] ?? '';
    const jwt = decodeJwt(vapidToken);
    expect(jwt.header).toMatchObject({ alg: 'ES256' });
    const vapidPublicKey = createPublicKey({
      key: Buffer.concat([
        Buffer.from('3059301306072a8648ce3d020106082a8648ce3d030107034200', 'hex'),
        vapid.publicRaw,
      ]),
      format: 'der',
      type: 'spki',
    });
    expect(verifyOneShot('sha256', Buffer.from(jwt.signingInput), { key: vapidPublicKey, dsaEncoding: 'ieee-p1363' }, jwt.signature)).toBe(true);
  });

  it('maps a 410 to token_unregistered', async () => {
    const vapid = p256Pem();
    const client = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const clientSpki = client.publicKey.export({ format: 'der', type: 'spki' }) as Buffer;
    const server = http.createServer((_req, res) => { res.writeHead(410); res.end(); });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as AddressInfo).port;
    cleanups.push(() => new Promise<void>((resolve) => server.close(() => resolve())));

    const adapter = new WebPushProviderAdapter({
      subject: 'mailto:ops@meerkat.test',
      publicKey: vapid.publicRaw.toString('base64url'),
      privateKeyPem: vapid.privatePem,
    });
    cleanups.push(() => adapter.close());
    const subscription = JSON.stringify({
      endpoint: `http://127.0.0.1:${port}/x`,
      keys: {
        p256dh: Buffer.from(clientSpki.subarray(clientSpki.length - 65)).toString('base64url'),
        auth: createHash('sha256').update('a').digest().subarray(0, 16).toString('base64url'),
      },
    });
    const outcome = await adapter.send({ token: subscription, payload: new Uint8Array([1]), urgency: 'normal', timeoutMs: 5_000 });
    expect(outcome).toEqual({ kind: 'rejected', reasonClass: 'token_unregistered' });
  });
});
