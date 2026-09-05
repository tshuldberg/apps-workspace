import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpNcmecFilingClient } from '../ncmec-filing-http-client';
import type { NcmecReportRecord } from '../ncmec-queue';

const servers: Server[] = [];
const record = {
  id: 'a'.repeat(64),
  source: 'submit_scan',
  publicationId: 'publication-1',
  postId: 'post-1',
  reason: 'abuse_hash_match',
  matchedBlobHashes: ['b'.repeat(64)],
  detectedAt: '2026-07-15T12:00:00.000Z',
  status: 'queued',
} satisfies NcmecReportRecord;

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

async function endpoint(status: number, body: object, observed: Array<Record<string, string>>) {
  const server = createServer((req, res) => {
    observed.push({
      authorization: String(req.headers.authorization ?? ''),
      idempotencyKey: String(req.headers['idempotency-key'] ?? ''),
      method: String(req.method),
    });
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

describe('HttpNcmecFilingClient', () => {
  it('requires HTTPS unless a trusted private-network override is explicit', () => {
    expect(() => new HttpNcmecFilingClient({ endpoint: 'http://gateway.test', apiToken: 'token' }))
      .toThrow('must use HTTPS');
  });

  it('requires a provider reference before confirming filed and uses the evidence idempotency key', async () => {
    const observed: Array<Record<string, string>> = [];
    const client = new HttpNcmecFilingClient({
      endpoint: await endpoint(200, { providerRef: 'ct-real-123' }, observed),
      apiToken: 'mounted-secret',
      allowInsecureHttp: true,
    });
    await expect(client.file(record)).resolves.toEqual({ ok: true, providerRef: 'ct-real-123' });
    expect(observed).toEqual([{
      authorization: 'Bearer mounted-secret',
      idempotencyKey: record.id,
      method: 'POST',
    }]);
  });

  it('fails closed on a success response without a real provider reference', async () => {
    const client = new HttpNcmecFilingClient({
      endpoint: await endpoint(200, {}, []), apiToken: 'token', allowInsecureHttp: true,
    });
    await expect(client.file(record)).resolves.toEqual({
      ok: false, classification: 'transient', reason: 'invalid_confirmation',
    });
  });

  it('classifies validation rejection as permanent and provider outage as transient', async () => {
    const permanent = new HttpNcmecFilingClient({
      endpoint: await endpoint(422, { error: 'evidence_invalid' }, []), apiToken: 'token', allowInsecureHttp: true,
    });
    const transient = new HttpNcmecFilingClient({
      endpoint: await endpoint(503, { error: 'provider_down' }, []), apiToken: 'token', allowInsecureHttp: true,
    });
    await expect(permanent.file(record)).resolves.toEqual({
      ok: false, classification: 'permanent', reason: 'evidence_invalid',
    });
    await expect(transient.file(record)).resolves.toEqual({
      ok: false, classification: 'transient', reason: 'provider_down',
    });
  });

  it('normalizes an untrusted provider error before it reaches the durable queue', async () => {
    const client = new HttpNcmecFilingClient({
      endpoint: await endpoint(422, { error: 'invalid evidence with whitespace and operator text' }, []),
      apiToken: 'token',
      allowInsecureHttp: true,
    });
    await expect(client.file(record)).resolves.toEqual({
      ok: false, classification: 'permanent', reason: 'provider_rejected',
    });
  });

  it('proves readiness with an authenticated GET and rejects an unhealthy gateway', async () => {
    const observed: Array<Record<string, string>> = [];
    const ready = new HttpNcmecFilingClient({
      endpoint: await endpoint(200, { ok: true }, observed), apiToken: 'readiness-token',
      allowInsecureHttp: true,
    });
    await expect(ready.verifyReady()).resolves.toBeUndefined();
    expect(observed).toEqual([{
      authorization: 'Bearer readiness-token', idempotencyKey: '', method: 'GET',
    }]);

    const unavailable = new HttpNcmecFilingClient({
      endpoint: await endpoint(503, { error: 'provider_down' }, []), apiToken: 'token',
      allowInsecureHttp: true,
    });
    await expect(unavailable.verifyReady()).rejects.toThrow('ncmec_gateway_unavailable');
  });

  it('classifies a network exception as transient and lets readiness fail closed', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('ECONNRESET'); }) as unknown as typeof fetch;
    const client = new HttpNcmecFilingClient({
      endpoint: 'https://gateway.example', apiToken: 'token', fetchImpl,
    });
    await expect(client.file(record)).resolves.toEqual({
      ok: false, classification: 'transient', reason: 'gateway_unavailable',
    });
    await expect(client.verifyReady()).rejects.toThrow('ECONNRESET');
  });

  it.each([
    ['malformed JSON', new Response('{', { status: 200, headers: { 'Content-Type': 'application/json' } })],
    ['oversized streamed body', new Response('x'.repeat(64 * 1024 + 1), { status: 200 })],
    ['oversized declared body', new Response('{"providerRef":"ct-hidden"}', {
      status: 200, headers: { 'Content-Length': String(64 * 1024 + 1) },
    })],
  ])('fails closed on a %s confirmation', async (_label, response) => {
    const client = new HttpNcmecFilingClient({
      endpoint: 'https://gateway.example', apiToken: 'token',
      fetchImpl: vi.fn(async () => response.clone()) as unknown as typeof fetch,
    });
    await expect(client.file(record)).resolves.toEqual({
      ok: false, classification: 'transient', reason: 'invalid_confirmation',
    });
  });

  it('cancels an oversized response stream before reading later chunks', async () => {
    const cancel = vi.fn();
    let pulls = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        controller.enqueue(new Uint8Array(40 * 1024));
      },
      cancel,
    });
    const client = new HttpNcmecFilingClient({
      endpoint: 'https://gateway.example', apiToken: 'token',
      fetchImpl: vi.fn(async () => new Response(stream, { status: 200 })) as unknown as typeof fetch,
    });

    await expect(client.file(record)).resolves.toEqual({
      ok: false, classification: 'transient', reason: 'invalid_confirmation',
    });
    expect(cancel).toHaveBeenCalledWith('ncmec_response_too_large');
    expect(pulls).toBeLessThanOrEqual(3);
  });

  it('classifies a response-body transport failure as transient', async () => {
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) { controller.error(new Error('stream_reset')); },
    });
    const client = new HttpNcmecFilingClient({
      endpoint: 'https://gateway.example', apiToken: 'token',
      fetchImpl: vi.fn(async () => new Response(stream, { status: 200 })) as unknown as typeof fetch,
    });
    await expect(client.file(record)).resolves.toEqual({
      ok: false, classification: 'transient', reason: 'gateway_unavailable',
    });
  });

  it.each([
    [{ endpoint: 'https://gateway.example', apiToken: 'bad\nvalue' }, 'API token is invalid'],
    [{ endpoint: 'https://gateway.example', apiToken: 'token', timeoutMs: 0 }, 'timeout is invalid'],
  ])('rejects invalid client configuration', (options, message) => {
    expect(() => new HttpNcmecFilingClient(options)).toThrow(message);
  });
});
