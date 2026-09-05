/**
 * Plan 51 P1 + P5: HTTP surface for the verification-account service. Kept separate
 * from the pure DI'd core (account-service.ts) so the core stays socket-free and
 * testable, mirroring persona-service-http.ts.
 *
 * Routes (all JSON except the raw-body webhooks):
 *   POST /account/sign-in            { provider, providerToken }        -> { token, expiresAtMs }
 *   GET  /account/status             (Bearer session)                   -> account status
 *   POST /account/age-signal         { signal, source } (Bearer)        -> { ok }
 *   POST /account/credential/issue   { blindedMessage, epoch } (Bearer) -> { blindSignature, epoch, publicKey }
 *   POST /account/credential/recover { blindedMessage, epoch } (Bearer) -> exact prior signature only
 *   POST /account/credential/renew   { expiringCredential, blindedMessage } (Bearer) -> { blindSignature, ... }
 *   POST /account/delete             { provider, providerToken, credential? } -> { deletionScope, revokedSerial }
 *   POST /account/webhooks/apple     (raw JWS body)                     -> { ok }
 *   POST /account/webhooks/google    (raw RTDN body + bearer)           -> { ok }
 *   POST /account/webhooks/stripe    (raw body + Stripe-Signature)      -> { ok }
 *   GET  /healthz                                                       -> { ok }
 *
 * Fail-closed + honesty: every route validates its body, no route fabricates a
 * verified/entitled/signed state, and an unconfigured capability answers 503
 * not_configured. All logging is deep-redacted via redactForLog. Nothing logs a
 * token, provider subject, credential, or serial.
 */

import http from 'node:http';
import { z } from 'zod';
import { redactForLog } from './log-redaction';
import { applyHttpCors } from './http-cors';
import type { AccountService, WebhookResult } from './account-service';
import type {
  AppleNotificationVerification,
  GoogleRtdnVerification,
  StripeWebhookVerification,
} from './account-service';
import type { AccountAgeSource } from './account-store';
import type { HealthEndpoints } from './service-health';

const MAX_BODY_BYTES = 128 * 1024;

const ProviderSchema = z.enum(['apple', 'google']);
const SignInSchema = z.object({ provider: ProviderSchema, providerToken: z.string().min(1).max(8192) });
const AgeSignalSchema = z.object({
  signal: z.enum(['adult', 'minor']),
  source: z.enum(['apple_store', 'google_store', 'in_app_gate']),
});
const IssueSchema = z.object({
  blindedMessage: z.string().min(1).max(4096),
  epoch: z.number().int().min(0).max(100000),
});
const RenewSchema = z.object({
  expiringCredential: z.string().min(1).max(8192),
  blindedMessage: z.string().min(1).max(4096),
});
const DeleteSchema = z.object({
  provider: ProviderSchema,
  providerToken: z.string().min(1).max(8192),
  credential: z.string().min(1).max(8192).optional(),
});

/**
 * The webhook resolve seams: an operator-supplied verifier maps a verified rail
 * event to a RailEntitlementEvent. The bin wires the real App Store Server API /
 * Play / Stripe resolvers; absent a resolver a rail answers not_configured.
 */
export interface AccountServiceHttpResolvers {
  resolveApple?: (signedPayload: string, rootCa: string) => AppleNotificationVerification | null;
  resolveGoogleRtdn?: (rawBody: string) => GoogleRtdnVerification | null;
  resolveStripe?: (rawBody: string) => StripeWebhookVerification | null;
}

export interface StartAccountServiceOptions {
  service: AccountService;
  resolvers?: AccountServiceHttpResolvers;
  corsAllowedOrigins?: readonly string[];
  port?: number;
  host?: string;
  log?: (event: string, detail?: Record<string, unknown>) => void;
  healthEndpoints?: HealthEndpoints;
}

export interface AccountServiceServer {
  readonly url: string;
  readonly port: number;
  close(): Promise<void>;
}

function readBody(req: http.IncomingMessage): Promise<string | null> {
  return new Promise((resolve) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        resolve(null);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', () => resolve(null));
  });
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(json) });
  res.end(json);
}

function headerValue(req: http.IncomingMessage, name: string): string | null {
  const raw = req.headers[name.toLowerCase()];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readBearer(req: http.IncomingMessage): string | null {
  const raw = headerValue(req, 'authorization');
  if (!raw) return null;
  const [scheme, ...rest] = raw.split(' ');
  if (scheme?.toLowerCase() !== 'bearer') return null;
  const token = rest.join(' ').trim();
  return token.length > 0 ? token : null;
}

/** Map a webhook verdict to an honest status (503 not_configured, 400 invalid). */
function webhookStatus(result: WebhookResult): number {
  if (result.ok) return 200;
  return result.reason === 'not_configured' ? 503 : 400;
}

export function startAccountService(options: StartAccountServiceOptions): Promise<AccountServiceServer> {
  const { service } = options;
  const host = options.host ?? '0.0.0.0';
  const log = (event: string, detail?: Record<string, unknown>) =>
    options.log?.(event, detail ? (redactForLog(detail) as Record<string, unknown>) : undefined);
  const resolvers = options.resolvers ?? {};

  const server = http.createServer((req, res) => {
    void handle(req, res).catch(() => {
      if (res.headersSent) return;
      sendJson(res, 500, { ok: false, reason: 'internal_error' });
    });
  });

  async function handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const method = req.method ?? 'GET';
    const pathname = (req.url ?? '/').split('?')[0];

    if (options.healthEndpoints && options.healthEndpoints.handle(req, res)) return;

    if (!applyHttpCors(req, res, {
      allowedOrigins: options.corsAllowedOrigins,
      methods: ['GET', 'POST', 'OPTIONS'],
      headers: ['Authorization', 'Content-Type', 'Stripe-Signature'],
    })) {
      sendJson(res, 403, { ok: false, reason: 'origin_not_allowed' });
      return;
    }

    if (method === 'OPTIONS') {
      res.writeHead(204, { 'Content-Length': '0' });
      res.end();
      return;
    }

    if (method === 'GET' && pathname === '/healthz') {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (method === 'GET' && pathname === '/account/status') {
      const token = readBearer(req);
      const status = token ? await service.getStatus(token) : null;
      if (!status) { sendJson(res, 401, { ok: false, reason: 'unauthenticated' }); return; }
      sendJson(res, 200, { ok: true, ...status });
      return;
    }

    // Public epoch-key discovery (unauthenticated by design: the key is public, the
    // same value verifier surfaces read). A missing/malformed epoch param defaults to
    // the current epoch; an out-of-window epoch is invalid_epoch (no key oracle).
    if (method === 'GET' && pathname === '/account/credential/epoch-key') {
      const rawEpoch = new URL(req.url ?? '/', 'http://localhost').searchParams.get('epoch');
      const requestedEpoch = rawEpoch !== null && /^\d{1,6}$/.test(rawEpoch) ? Number(rawEpoch) : undefined;
      const result = await service.getEpochKey(requestedEpoch);
      if (!result.ok) {
        const status = result.reason === 'not_configured' ? 503 : 400;
        sendJson(res, status, { ok: false, reason: result.reason });
        return;
      }
      sendJson(res, 200, { ok: true, epoch: result.epoch, publicKey: result.publicKeySpkiDerBase64 });
      return;
    }

    if (method !== 'POST') {
      sendJson(res, 405, { ok: false, reason: 'method_not_allowed' });
      return;
    }

    const raw = await readBody(req);
    if (raw === null) {
      sendJson(res, 413, { ok: false, reason: 'body_too_large' });
      return;
    }

    // The webhooks consume the RAW body (signature is over exact bytes); they parse
    // internally, so they must run before the JSON.parse the other routes use.
    if (pathname === '/account/webhooks/apple') {
      const result = await service.appleServerNotification({
        rawBody: raw,
        resolve: resolvers.resolveApple ?? (() => null),
      });
      if (!result.ok) log('webhook_apple_reject', { reason: result.reason });
      sendJson(res, webhookStatus(result), result.ok ? { ok: true, recorded: result.recorded } : { ok: false, reason: result.reason });
      return;
    }
    if (pathname === '/account/webhooks/google') {
      const result = await service.googleRtdn({
        rawBody: raw,
        bearerAudience: readBearer(req),
        resolve: resolvers.resolveGoogleRtdn ?? (() => null),
      });
      if (!result.ok) log('webhook_google_reject', { reason: result.reason });
      sendJson(res, webhookStatus(result), result.ok ? { ok: true, recorded: result.recorded } : { ok: false, reason: result.reason });
      return;
    }
    if (pathname === '/account/webhooks/stripe') {
      const result = await service.stripeWebhook({
        rawBody: raw,
        signatureHeader: headerValue(req, 'stripe-signature'),
        resolve: resolvers.resolveStripe ?? (() => null),
      });
      if (!result.ok) log('webhook_stripe_reject', { reason: result.reason });
      sendJson(res, webhookStatus(result), result.ok ? { ok: true, recorded: result.recorded } : { ok: false, reason: result.reason });
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      sendJson(res, 400, { ok: false, reason: 'bad_json' });
      return;
    }

    if (pathname === '/account/sign-in') {
      const body = SignInSchema.safeParse(parsed);
      if (!body.success) { sendJson(res, 400, { ok: false, reason: 'bad_request' }); return; }
      const result = await service.signIn({ provider: body.data.provider, providerToken: body.data.providerToken });
      if (!result.ok) {
        log('sign_in_reject', { reason: result.reason });
        const status = result.reason === 'not_configured' || result.reason === 'session_not_configured'
          ? 503
          : result.reason === 'account_deleted'
            ? 403
            : 401;
        sendJson(res, status, { ok: false, reason: result.reason });
        return;
      }
      log('sign_in', {});
      sendJson(res, 200, { ok: true, token: result.token, expiresAtMs: result.expiresAtMs, accountId: result.accountId });
      return;
    }

    if (pathname === '/account/age-signal') {
      const token = readBearer(req);
      if (!token) { sendJson(res, 401, { ok: false, reason: 'unauthenticated' }); return; }
      const body = AgeSignalSchema.safeParse(parsed);
      if (!body.success) { sendJson(res, 400, { ok: false, reason: 'bad_request' }); return; }
      const result = await service.recordStoreAgeSignal({
        token,
        signal: body.data.signal,
        source: body.data.source as AccountAgeSource,
      });
      if (!result.ok) { sendJson(res, result.reason === 'not_configured' ? 503 : 401, { ok: false, reason: result.reason }); return; }
      sendJson(res, 200, { ok: true });
      return;
    }

    if (pathname === '/account/credential/issue' || pathname === '/account/credential/recover') {
      const recovering = pathname === '/account/credential/recover';
      const token = readBearer(req);
      if (!token) { sendJson(res, 401, { ok: false, reason: 'unauthenticated' }); return; }
      const body = (recovering ? IssueSchema.strict() : IssueSchema).safeParse(parsed);
      if (!body.success) { sendJson(res, 400, { ok: false, reason: 'bad_request' }); return; }
      const input = {
        token,
        blindedMessageBase64: body.data.blindedMessage,
        epoch: body.data.epoch,
      };
      const result = recovering ? await service.recoverCredential(input) : await service.issueCredential(input);
      if (!result.ok) {
        log(recovering ? 'recover_reject' : 'issue_reject', { reason: result.reason });
        const status = result.reason === 'not_configured' ? 503 : result.reason === 'unauthenticated' ? 401 : result.reason === 'refused' ? 403 : 400;
        sendJson(res, status, { ok: false, reason: result.reason });
        return;
      }
      log(recovering ? 'recover' : 'issue', { epoch: result.epoch });
      sendJson(res, 200, {
        ok: true,
        blindSignature: result.blindSignatureBase64,
        epoch: result.epoch,
        publicKey: result.publicKeySpkiDerBase64,
      });
      return;
    }

    if (pathname === '/account/credential/renew') {
      const token = readBearer(req);
      if (!token) { sendJson(res, 401, { ok: false, reason: 'unauthenticated' }); return; }
      const body = RenewSchema.safeParse(parsed);
      if (!body.success) { sendJson(res, 400, { ok: false, reason: 'bad_request' }); return; }
      const result = await service.renewCredential({
        token,
        expiringCredentialBearer: body.data.expiringCredential,
        blindedMessageBase64: body.data.blindedMessage,
      });
      if (!result.ok) {
        log('renew_reject', { reason: result.reason });
        const status = result.reason === 'not_configured' ? 503 : result.reason === 'unauthenticated' ? 401 : result.reason === 'refused' ? 403 : 400;
        sendJson(res, status, { ok: false, reason: result.reason });
        return;
      }
      log('renew', { epoch: result.epoch });
      sendJson(res, 200, {
        ok: true,
        blindSignature: result.blindSignatureBase64,
        epoch: result.epoch,
        publicKey: result.publicKeySpkiDerBase64,
      });
      return;
    }

    if (pathname === '/account/delete') {
      const body = DeleteSchema.safeParse(parsed);
      if (!body.success) { sendJson(res, 400, { ok: false, reason: 'bad_request' }); return; }
      const result = await service.deleteAccount({
        provider: body.data.provider,
        providerToken: body.data.providerToken,
        ...(body.data.credential ? { clientCredentialBearer: body.data.credential } : {}),
      });
      if (!result.ok) {
        log('delete_reject', { reason: result.reason });
        sendJson(res, result.reason === 'unauthenticated' ? 401 : 404, { ok: false, reason: result.reason });
        return;
      }
      log('delete', { revokedSerial: result.revokedSerial });
      sendJson(res, 200, { ok: true, deletionScope: result.deletionScope, revokedSerial: result.revokedSerial });
      return;
    }

    sendJson(res, 404, { ok: false, reason: 'not_found' });
  }

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port ?? 0, host, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : (options.port ?? 0);
      const wsHost = host === '0.0.0.0' ? '127.0.0.1' : host;
      log('listening', { host, port });
      resolve({
        url: `http://${wsHost}:${port}`,
        port,
        close: () => new Promise<void>((r) => { server.close(() => r()); }),
      });
    });
  });
}
