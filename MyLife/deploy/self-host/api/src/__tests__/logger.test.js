/**
 * Property 17: Structured log format and request fields
 *
 * For any HTTP request processed by the self-host API, the resulting log entry
 * should be valid JSON containing timestamp, level, message, method, path,
 * statusCode, and responseTime fields, with PII fields (email, password,
 * authorization) redacted.
 *
 * Validates: Requirements 13.1, 13.3, 13.4
 */
import { Writable } from 'node:stream';
import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import http from 'node:http';
import { createLogger, createRequestLogger, REDACT_PATHS } from '../logger.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Collects pino JSON lines written to a writable stream. */
function createLogCollector() {
  const lines = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      const text = chunk.toString().trim();
      if (text) lines.push(text);
      callback();
    },
  });
  return { lines, stream };
}

/** Parse all collected lines as JSON. Throws if any line is not valid JSON. */
function parseLogLines(lines) {
  return lines.map((line, i) => {
    try {
      return JSON.parse(line);
    } catch {
      throw new Error(`Log line ${i} is not valid JSON: ${line}`);
    }
  });
}

/** Make an HTTP request to a server and return the response. */
function request(server, method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const options = {
      hostname: '127.0.0.1',
      port: addr.port,
      path,
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

/** Create a minimal Express app with the request logger and test routes. */
function createTestApp(loggerInstance) {
  const app = express();
  app.use(express.json());
  app.use(createRequestLogger(loggerInstance));

  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.post('/api/test', (req, res) => res.status(201).json({ received: true }));
  app.get('/api/error', (_req, res) => res.status(500).json({ error: 'fail' }));

  return app;
}

/** Start a server on a random port, return a cleanup function. */
function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Property 17: Structured log format and request fields', () => {
  let collector;
  let testLogger;
  let app;
  let server;

  beforeEach(async () => {
    collector = createLogCollector();
    testLogger = createLogger(collector.stream);
    app = createTestApp(testLogger);
    server = await listen(app);

    return () => {
      server.close();
    };
  });

  describe('13.1 -- JSON format with required fields', () => {
    it('every log line is valid JSON', async () => {
      testLogger.info('test message');
      testLogger.warn({ extra: 'data' }, 'warning message');
      testLogger.error({ err: new Error('boom') }, 'error message');

      // Flush pino async writes
      await new Promise((r) => setTimeout(r, 50));

      const entries = parseLogLines(collector.lines);
      expect(entries.length).toBeGreaterThanOrEqual(3);

      for (const entry of entries) {
        expect(entry).toHaveProperty('level');
        expect(entry).toHaveProperty('time');
        expect(entry).toHaveProperty('msg');
      }
    });

    it('timestamp is ISO 8601 format', async () => {
      testLogger.info('timestamp check');
      await new Promise((r) => setTimeout(r, 50));

      const entries = parseLogLines(collector.lines);
      for (const entry of entries) {
        // pino isoTime produces ISO 8601 strings
        expect(new Date(entry.time).toISOString()).toBe(entry.time);
      }
    });

    it('level is a string label, not a number', async () => {
      testLogger.info('info level');
      testLogger.warn('warn level');
      testLogger.error('error level');
      await new Promise((r) => setTimeout(r, 50));

      const entries = parseLogLines(collector.lines);
      const levels = entries.map((e) => e.level);
      expect(levels).toContain('info');
      expect(levels).toContain('warn');
      expect(levels).toContain('error');

      for (const entry of entries) {
        expect(typeof entry.level).toBe('string');
      }
    });
  });

  describe('13.3 -- Request logging with method, path, statusCode, responseTime', () => {
    it('GET request produces log with all required fields', async () => {
      await request(server, 'GET', '/health');
      await new Promise((r) => setTimeout(r, 50));

      const entries = parseLogLines(collector.lines);
      const reqLog = entries.find((e) => e.msg === 'request completed');
      expect(reqLog).toBeDefined();
      expect(reqLog.method).toBe('GET');
      expect(reqLog.path).toBe('/health');
      expect(reqLog.statusCode).toBe(200);
      expect(typeof reqLog.responseTime).toBe('number');
      expect(reqLog.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('POST request captures method and status correctly', async () => {
      await request(server, 'POST', '/api/test', { data: 'hello' });
      await new Promise((r) => setTimeout(r, 50));

      const entries = parseLogLines(collector.lines);
      const reqLog = entries.find((e) => e.msg === 'request completed');
      expect(reqLog).toBeDefined();
      expect(reqLog.method).toBe('POST');
      expect(reqLog.path).toBe('/api/test');
      expect(reqLog.statusCode).toBe(201);
    });

    it('error response logs the correct status code', async () => {
      await request(server, 'GET', '/api/error');
      await new Promise((r) => setTimeout(r, 50));

      const entries = parseLogLines(collector.lines);
      const reqLog = entries.find((e) => e.msg === 'request completed');
      expect(reqLog).toBeDefined();
      expect(reqLog.statusCode).toBe(500);
    });

    it('404 response for unknown route is logged', async () => {
      await request(server, 'GET', '/nonexistent');
      await new Promise((r) => setTimeout(r, 50));

      const entries = parseLogLines(collector.lines);
      const reqLog = entries.find((e) => e.msg === 'request completed');
      expect(reqLog).toBeDefined();
      expect(reqLog.statusCode).toBe(404);
      expect(reqLog.path).toBe('/nonexistent');
    });
  });

  describe('13.4 -- PII redaction', () => {
    it('redacts authorization header from log output', async () => {
      testLogger.info({
        req: { headers: { authorization: 'Bearer secret-token-123' } },
      }, 'auth test');
      await new Promise((r) => setTimeout(r, 50));

      const entries = parseLogLines(collector.lines);
      const entry = entries.find((e) => e.msg === 'auth test');
      expect(entry.req.headers.authorization).toBe('[Redacted]');
    });

    it('redacts cookie header from log output', async () => {
      testLogger.info({
        req: { headers: { cookie: 'session=abc123; token=xyz' } },
      }, 'cookie test');
      await new Promise((r) => setTimeout(r, 50));

      const entries = parseLogLines(collector.lines);
      const entry = entries.find((e) => e.msg === 'cookie test');
      expect(entry.req.headers.cookie).toBe('[Redacted]');
    });

    it('redacts password from body', async () => {
      testLogger.info({
        body: { password: 'hunter2', username: 'admin' },
      }, 'password test');
      await new Promise((r) => setTimeout(r, 50));

      const entries = parseLogLines(collector.lines);
      const entry = entries.find((e) => e.msg === 'password test');
      expect(entry.body.password).toBe('[Redacted]');
      expect(entry.body.username).toBe('admin');
    });

    it('redacts email from body', async () => {
      testLogger.info({
        body: { email: 'user@example.com', name: 'John' },
      }, 'email test');
      await new Promise((r) => setTimeout(r, 50));

      const entries = parseLogLines(collector.lines);
      const entry = entries.find((e) => e.msg === 'email test');
      expect(entry.body.email).toBe('[Redacted]');
      expect(entry.body.name).toBe('John');
    });

    it('redacts adminPassword from body', async () => {
      testLogger.info({
        body: { adminPassword: 'supersecret' },
      }, 'admin password test');
      await new Promise((r) => setTimeout(r, 50));

      const entries = parseLogLines(collector.lines);
      const entry = entries.find((e) => e.msg === 'admin password test');
      expect(entry.body.adminPassword).toBe('[Redacted]');
    });

    it('REDACT_PATHS covers all required PII fields', () => {
      const required = [
        'req.headers.authorization',
        'req.headers.cookie',
        'body.password',
        'body.email',
      ];

      for (const path of required) {
        expect(REDACT_PATHS).toContain(path);
      }
    });
  });

  describe('Combined property: any request produces valid structured log', () => {
    const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
    const PATHS = ['/health', '/api/test', '/api/error', '/unknown'];

    for (const method of HTTP_METHODS) {
      for (const path of PATHS) {
        it(`${method} ${path} produces valid JSON with all fields`, async () => {
          await request(server, method, path);
          await new Promise((r) => setTimeout(r, 50));

          const entries = parseLogLines(collector.lines);
          const reqLog = entries.find((e) => e.msg === 'request completed');
          expect(reqLog).toBeDefined();

          // Required fields per R13.1 and R13.3
          expect(typeof reqLog.time).toBe('string');
          expect(typeof reqLog.level).toBe('string');
          expect(typeof reqLog.msg).toBe('string');
          expect(typeof reqLog.method).toBe('string');
          expect(typeof reqLog.path).toBe('string');
          expect(typeof reqLog.statusCode).toBe('number');
          expect(typeof reqLog.responseTime).toBe('number');
          expect(reqLog.responseTime).toBeGreaterThanOrEqual(0);

          // Method matches what was sent
          expect(reqLog.method).toBe(method);
          expect(reqLog.path).toBe(path);
        });
      }
    }
  });
});
