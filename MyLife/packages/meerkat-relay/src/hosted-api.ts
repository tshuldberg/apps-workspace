import http from 'node:http';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import nacl from 'tweetnacl';
import {
  BILLING_SKUS,
  MEERKAT_APP_UNLOCK_PRODUCT,
  MEERKAT_HOSTED_MONTHLY_PRODUCT,
} from '@mylife/billing-config';
import { deriveMeerkatAppUnlock } from '@mylife/entitlements';
import {
  APP_UNLOCK_BINDING_WINDOW_MS,
  MEERKAT_HOSTED_FEATURES,
  appUnlockBindingMessage,
  issueMeerkatAppUnlockToken,
  issueMeerkatHostedEntitlement,
} from '@mylife/entitlements/server';
import { verifyRevenueCatAppUserId } from '@mylife/sync';
import { storageCapMbForTier, type MeerkatSubjectUsage } from './hosted-node';
import {
  failClosedStoreReceiptValidator,
  type MeerkatPurchaseRail,
  type MeerkatStoreRail,
  type MeerkatStoreReceiptValidator,
} from './hosted-receipt-validator';
import { applyHttpCors } from './http-cors';
import type { HostedRequestLimiter } from './hosted-rate-limiter';

/**
 * Source of a subject's REAL server-space usage (Plan 22 S0.2). A deployed hosted
 * service wires `HostedNodeService` here (it satisfies this shape). Returning null
 * means the subject has no provisioned tenant, so the meter shows "Not connected",
 * never a fabricated "0 of N".
 */
export interface MeerkatUsageSource {
  usageForSubject(subjectId: string): MeerkatSubjectUsage | null | Promise<MeerkatSubjectUsage | null>;
}

export type MeerkatHostedSubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'unpaid'
  | 'paused';

export interface MeerkatHostedSubject {
  subjectId: string;
  email?: string;
}

export interface MeerkatHostedSubscription {
  subjectId: string;
  status: MeerkatHostedSubscriptionStatus;
  customerId?: string;
  subscriptionId?: string;
  currentPeriodEnd?: string;
  updatedAt: string;
  lastProviderEventId?: string;
  lastProviderEventAt?: string;
}

export interface MeerkatHostedCheckoutInput {
  subject: MeerkatHostedSubject;
  sku: typeof BILLING_SKUS.meerkatHostedMonthly;
  price: number;
  successUrl: string;
  cancelUrl: string;
}

export interface MeerkatHostedPortalInput {
  subject: MeerkatHostedSubject;
  returnUrl: string;
}

export interface MeerkatHostedBillingEvent {
  eventId: string;
  occurredAt: string;
  subjectId: string;
  status: MeerkatHostedSubscriptionStatus;
  customerId?: string;
  subscriptionId?: string;
  currentPeriodEnd?: string;
}

export interface ParseHostedWebhookInput {
  payload: string;
  signature: string | null;
  webhookSecret: string;
}

/**
 * A webhook can carry either a subscription change (hosted plan) or a one-time
 * app-unlock purchase. A subscription event may OMIT `kind` (back-compat default),
 * so an existing subscription-only client keeps working unchanged.
 */
export type MeerkatBillingWebhookEvent =
  | ({ kind?: 'subscription' } & MeerkatHostedBillingEvent)
  | { kind: 'app_purchase'; event: MeerkatAppPurchaseEvent }
  | { kind: 'ignored'; eventId: string };

export interface MeerkatAppPurchaseEvent {
  eventId: string;
  occurredAt: string;
  subjectId: string;
  /** The product the billing client VALIDATED this event as. The billing client is
   *  the product-identity boundary; the API persists this, it does not stamp a
   *  constant, so a different product's payment can never become an app unlock. */
  productId: string;
  rail: MeerkatPurchaseRail;
  /** ISO purchase date. */
  purchaseDate: string;
  /** false on a refund/chargeback/dispute so the gate re-locks honestly. */
  isActive: boolean;
}

export interface MeerkatHostedBillingClient {
  createCheckoutSession(input: MeerkatHostedCheckoutInput): Promise<{ url: string }>;
  createPortalSession(input: MeerkatHostedPortalInput): Promise<{ url: string }>;
  parseWebhook(input: ParseHostedWebhookInput): Promise<MeerkatBillingWebhookEvent>;
}

export interface MeerkatHostedBillingStore {
  getSubscription(subjectId: string): Promise<MeerkatHostedSubscription | null>;
  upsertSubscription(subscription: MeerkatHostedSubscription): Promise<void>;
  applySubscriptionEvent(subscription: MeerkatHostedSubscription): Promise<ProviderEventApplyResult>;
}

export type ProviderEventApplyResult = 'applied' | 'duplicate' | 'stale';

// ---------------------------------------------------------------------------
// One-time app unlock (Plan 22 Part 1 web rail + cross-rail Link, F1/TC-10)
// ---------------------------------------------------------------------------

export interface MeerkatAppCheckoutInput {
  subject: MeerkatHostedSubject;
  productId: typeof MEERKAT_APP_UNLOCK_PRODUCT.id;
  price: number;
  successUrl: string;
  cancelUrl: string;
}

/** A validated one-time app-unlock purchase, keyed by subject + product. */
export interface MeerkatAppPurchase {
  subjectId: string;
  productId: string;
  rail: MeerkatPurchaseRail;
  purchaseDate: string;
  isActive: boolean;
  lastProviderEventId?: string;
  lastProviderEventAt?: string;
}

/** A single-use, expiring cross-rail link code bound to one purchase. */
export interface MeerkatAppLink {
  code: string;
  subjectId: string;
  createdAt: string;
  expiresAt: string;
  consumedAt: string | null;
}

export class AppUnlockPersonaInUseError extends Error {
  readonly code = 'app_unlock_persona_in_use';

  constructor() {
    super('The app-unlock persona is already bound to another purchase.');
    this.name = 'AppUnlockPersonaInUseError';
  }
}

export interface MeerkatAppBillingStore {
  getAppPurchase(subjectId: string): Promise<MeerkatAppPurchase | null>;
  upsertAppPurchase(purchase: MeerkatAppPurchase): Promise<void>;
  applyAppPurchaseEvent(purchase: MeerkatAppPurchase): Promise<ProviderEventApplyResult>;
  createLink(link: MeerkatAppLink): Promise<void>;
  /**
   * Atomically consume `code` iff it is unconsumed, unexpired, and maps to an
   * ACTIVE purchase; returns the bound subject or null (fail-closed). Exactly one
   * concurrent redeem may win.
   */
  redeemLink(code: string, nowMs: number): Promise<{ subjectId: string } | null>;
  /**
   * Persona binding for the app-unlock PROOF gate (Plan 39 P6): ONE purchase is
   * bound to ONE persona hash, first-bind-wins and durable, so a single $4.99
   * purchase can never fan proofs out to many personas. `bindAppUnlockPersona`
   * must be atomic (a concurrent double-bind resolves to exactly one winner) and
   * returns the hash NOW IN FORCE (the new one when previously unbound, the
   * prior one otherwise).
   */
  getAppUnlockPersona(subjectId: string): Promise<string | null>;
  bindAppUnlockPersona(subjectId: string, personaHash: string): Promise<string>;
  /** Reverse lookup for proof re-mints: the subject bound to this persona hash. */
  getSubjectByAppUnlockPersona(personaHash: string): Promise<string | null>;
  /**
   * GDPR support (Plan 39 P13 / AC-5): RELEASE a subject's sticky persona binding so the SAME
   * $4.99 purchase can rebind to a fresh persona after the old one is deleted (NC-P5: no new
   * SKU, the purchase is unchanged; only the persona link is cleared). Clears both the
   * subject->persona and persona->subject indexes. Idempotent: an already-unbound subject
   * returns released=false. Resolves the recorded Track B founder flag (a deleted persona
   * would otherwise strand the purchase, its binding pointing at a persona that no longer exists).
   */
  releaseAppUnlockPersona(subjectId: string): Promise<{ released: boolean; personaHash: string | null }>;
}

export interface MeerkatAppBillingClient {
  createAppCheckoutSession(input: MeerkatAppCheckoutInput): Promise<{ url: string }>;
}

/**
 * Wires the one-time app-unlock rail (web Stripe checkout + account restore +
 * optional cross-rail Link). Omitted from the API options => the app-unlock routes
 * are simply absent (the mobile StoreKit/Play rail needs no server), never faked.
 */
export interface MeerkatAppUnlockConfig {
  billing: MeerkatAppBillingClient;
  store: MeerkatAppBillingStore;
  /** Server-side StoreKit/Play receipt validation for cross-rail linking.
   *  Default: fail-closed (linking a store receipt is unavailable). */
  receiptValidator?: MeerkatStoreReceiptValidator;
  /** Link-code TTL. Default 15 minutes. */
  linkTtlMs?: number;
  /** Random single-use link codes. Default: crypto.randomUUID. */
  generateLinkCode?: () => string;
}

export interface MeerkatHostedApiOptions {
  entitlementSecret: string;
  webhookSecret: string;
  billing: MeerkatHostedBillingClient;
  store: MeerkatHostedBillingStore;
  authorize(req: http.IncomingMessage): Promise<MeerkatHostedSubject | null> | MeerkatHostedSubject | null;
  /** Structured server-side diagnostics. Never returned to the client. */
  log?: (event: string, detail: Record<string, unknown>) => void;
  requestLimiter?: Pick<HostedRequestLimiter, 'check'>;
  /** Real per-subject server-space usage source (Plan 22 S0.2). Omitted => the usage
   * endpoint always reports "Not connected" (no fabricated meter). */
  usage?: MeerkatUsageSource;
  /** One-time app-unlock rail (Plan 22 Part 1 web + cross-rail Link). Omitted =>
   * the app-unlock routes are absent (mobile StoreKit/Play needs no server). */
  appUnlock?: MeerkatAppUnlockConfig;
  /**
   * Shared HMAC secret for minting app-unlock PROOF tokens (Plan 39 P6): the
   * community node verifies public-submit entitlement proofs against this same
   * secret. Omitted => the mint route answers 501 fail-closed (never an unsigned
   * or self-certified proof).
   */
  appUnlockTokenSecret?: string;
  /** Default: 15 minutes. Tokens are intentionally short lived. */
  entitlementTtlMs?: number;
  now?: () => number;
  /** Exact browser origins allowed to call this API cross-origin. */
  corsAllowedOrigins?: readonly string[];
}

export type MeerkatHostedApiHandler = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
) => void;

const DEFAULT_ENTITLEMENT_TTL_MS = 15 * 60 * 1000;
const MAX_JSON_BODY_BYTES = 128 * 1024;

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function routePath(req: http.IncomingMessage): string {
  const host = req.headers.host ?? 'localhost';
  return new URL(req.url ?? '/', `http://${host}`).pathname;
}

function firstHeader(req: http.IncomingMessage, name: string): string | null {
  const value = req.headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0] ?? null;
  return typeof value === 'string' ? value : null;
}

async function readRawBody(req: http.IncomingMessage): Promise<string | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk as Buffer;
    size += buffer.length;
    if (size > MAX_JSON_BODY_BYTES) return null;
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function readJsonObject(req: http.IncomingMessage): Promise<Record<string, unknown> | null> {
  const raw = await readRawBody(req);
  if (raw === null) return null;
  try {
    const parsed = raw.length === 0 ? {} : JSON.parse(raw) as unknown;
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function requiredString(body: Record<string, unknown>, key: string): string | null {
  const value = body[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function activeSubscription(subscription: MeerkatHostedSubscription | null, nowMs: number): boolean {
  if (!subscription) return false;
  if (subscription.status !== 'active' && subscription.status !== 'trialing') return false;
  if (!subscription.currentPeriodEnd) return true;
  const endMs = Date.parse(subscription.currentPeriodEnd);
  return Number.isNaN(endMs) || endMs > nowMs;
}

interface AppUnlockGrant {
  v: 1;
  sourceSubjectId: string;
  recipientSubjectId: string;
  purchaseDate: string | null;
  issuedAt: string;
}

function issueAppUnlockGrant(grant: AppUnlockGrant, secret: string): string {
  const payload = Buffer.from(JSON.stringify(grant), 'utf8').toString('base64url');
  const mac = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${mac}`;
}

function verifyAppUnlockGrant(token: string, secret: string): AppUnlockGrant | null {
  const [payload, supplied, extra] = token.split('.');
  if (!payload || !supplied || extra) return null;
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<AppUnlockGrant>;
    return parsed.v === 1 && typeof parsed.sourceSubjectId === 'string'
      && typeof parsed.recipientSubjectId === 'string' && typeof parsed.issuedAt === 'string'
      && (parsed.purchaseDate === null || typeof parsed.purchaseDate === 'string')
      ? parsed as AppUnlockGrant
      : null;
  } catch {
    return null;
  }
}

function entitlementExpiresAt(
  subscription: MeerkatHostedSubscription,
  nowMs: number,
  ttlMs: number,
): string {
  const ttlEnd = nowMs + ttlMs;
  const periodEnd = subscription.currentPeriodEnd ? Date.parse(subscription.currentPeriodEnd) : Number.NaN;
  const expiresAt = Number.isNaN(periodEnd) ? ttlEnd : Math.min(ttlEnd, periodEnd);
  return new Date(expiresAt).toISOString();
}

async function requireSubject(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  authorize: MeerkatHostedApiOptions['authorize'],
): Promise<MeerkatHostedSubject | null> {
  const subject = await authorize(req);
  if (!subject) {
    sendJson(res, 401, { error: 'auth_required' });
    return null;
  }
  return subject;
}

async function handleCheckout(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  options: MeerkatHostedApiOptions,
): Promise<void> {
  const subject = await requireSubject(req, res, options.authorize);
  if (!subject) return;
  const body = await readJsonObject(req);
  if (!body) {
    sendJson(res, 400, { error: 'bad_body' });
    return;
  }
  const successUrl = requiredString(body, 'successUrl');
  const cancelUrl = requiredString(body, 'cancelUrl');
  if (!successUrl || !cancelUrl || !isHttpUrl(successUrl) || !isHttpUrl(cancelUrl)) {
    sendJson(res, 400, { error: 'bad_redirect_url' });
    return;
  }
  const session = await options.billing.createCheckoutSession({
    subject,
    sku: BILLING_SKUS.meerkatHostedMonthly,
    price: MEERKAT_HOSTED_MONTHLY_PRODUCT.price,
    successUrl,
    cancelUrl,
  });
  sendJson(res, 200, { url: session.url });
}

async function handlePortal(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  options: MeerkatHostedApiOptions,
): Promise<void> {
  const subject = await requireSubject(req, res, options.authorize);
  if (!subject) return;
  const body = await readJsonObject(req);
  if (!body) {
    sendJson(res, 400, { error: 'bad_body' });
    return;
  }
  const returnUrl = requiredString(body, 'returnUrl');
  if (!returnUrl || !isHttpUrl(returnUrl)) {
    sendJson(res, 400, { error: 'bad_return_url' });
    return;
  }
  const session = await options.billing.createPortalSession({ subject, returnUrl });
  sendJson(res, 200, { url: session.url });
}

async function handleEntitlements(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  options: MeerkatHostedApiOptions,
): Promise<void> {
  const subject = await requireSubject(req, res, options.authorize);
  if (!subject) return;
  const nowMs = options.now?.() ?? Date.now();
  const subscription = await options.store.getSubscription(subject.subjectId);
  if (!subscription || !activeSubscription(subscription, nowMs)) {
    sendJson(res, 402, {
      error: 'payment_required',
      sku: BILLING_SKUS.meerkatHostedMonthly,
      price: MEERKAT_HOSTED_MONTHLY_PRODUCT.price,
    });
    return;
  }
  const issued = await issueMeerkatHostedEntitlement({
    secret: options.entitlementSecret,
    subjectId: subject.subjectId,
    features: MEERKAT_HOSTED_FEATURES,
    issuedAt: new Date(nowMs).toISOString(),
    expiresAt: entitlementExpiresAt(
      subscription,
      nowMs,
      options.entitlementTtlMs ?? DEFAULT_ENTITLEMENT_TTL_MS,
    ),
  });
  sendJson(res, 200, {
    token: issued.token,
    entitlements: issued.entitlements,
  });
}

async function handleWebhook(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  options: MeerkatHostedApiOptions,
): Promise<void> {
  const payload = await readRawBody(req);
  if (payload === null) {
    sendJson(res, 400, { error: 'bad_body' });
    return;
  }
  const event = await options.billing.parseWebhook({
    payload,
    signature: firstHeader(req, 'stripe-signature'),
    webhookSecret: options.webhookSecret,
  });
  if (event.kind === 'app_purchase') {
    // A one-time app-unlock purchase/refund. Persist it so web account restore +
    // cross-rail link read a REAL row (never a fabricated unlock). A refund arrives
    // isActive:false and re-locks the gate on next validation.
    const app = event.event;
    // Persist the product the billing client VALIDATED (not a stamped constant), and
    // only for the Meerkat unlock SKU -- a client that emits another product is ignored.
    if (options.appUnlock && app.productId === MEERKAT_APP_UNLOCK_PRODUCT.id) {
      const applied = await options.appUnlock.store.applyAppPurchaseEvent({
        subjectId: app.subjectId,
        productId: app.productId,
        rail: app.rail,
        purchaseDate: app.purchaseDate,
        isActive: app.isActive,
        lastProviderEventId: app.eventId,
        lastProviderEventAt: app.occurredAt,
      });
      sendJson(res, 200, { ok: true, eventId: app.eventId, applied });
      return;
    }
    sendJson(res, 200, { ok: true, eventId: app.eventId });
    return;
  }
  if (event.kind === 'ignored') {
    // A signed Stripe event we do not act on (e.g. an unrelated type). Ack so Stripe
    // stops retrying; write nothing.
    sendJson(res, 200, { ok: true, eventId: event.eventId, ignored: true });
    return;
  }
  const applied = await options.store.applySubscriptionEvent({
    subjectId: event.subjectId,
    status: event.status,
    customerId: event.customerId,
    subscriptionId: event.subscriptionId,
    currentPeriodEnd: event.currentPeriodEnd,
    updatedAt: new Date(options.now?.() ?? Date.now()).toISOString(),
    lastProviderEventId: event.eventId,
    lastProviderEventAt: event.occurredAt,
  });
  sendJson(res, 200, { ok: true, eventId: event.eventId, applied });
}

/** Create a deployable HTTP handler for Meerkat hosted billing and entitlements. */
export function createMeerkatHostedApiHandler(
  options: MeerkatHostedApiOptions,
): MeerkatHostedApiHandler {
  return (req, res) => {
    void handleMeerkatHostedApiRequest(req, res, options).catch((error) => {
      if (!res.headersSent) {
        const errorId = randomUUID();
        options.log?.('request_error', {
          errorId,
          method: req.method ?? 'GET',
          path: routePath(req),
          message: error instanceof Error ? error.message : String(error),
        });
        sendJson(res, 500, {
          error: 'internal_error',
          errorId,
        });
      } else {
        res.end();
      }
    });
  };
}

/** Testable request dispatcher for the hosted API. */
export async function handleMeerkatHostedApiRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  options: MeerkatHostedApiOptions,
): Promise<void> {
  const method = req.method ?? 'GET';
  const path = routePath(req);

  if (!applyHttpCors(req, res, {
    allowedOrigins: options.corsAllowedOrigins,
    methods: ['GET', 'POST', 'OPTIONS'],
    headers: ['Authorization', 'Content-Type'],
  })) {
    sendJson(res, 403, { error: 'origin_not_allowed' });
    return;
  }
  if (method === 'OPTIONS') {
    res.writeHead(204, { 'Content-Length': '0' });
    res.end();
    return;
  }

  const rate = options.requestLimiter?.check(req, path);
  if (rate && !rate.allowed) {
    res.setHeader('Retry-After', String(rate.retryAfterSeconds));
    sendJson(res, 429, { error: 'rate_limited' });
    return;
  }

  if (path === '/api/billing/checkout') {
    if (method !== 'POST') { res.writeHead(405).end(); return; }
    await handleCheckout(req, res, options);
    return;
  }

  if (path === '/api/billing/portal') {
    if (method !== 'POST') { res.writeHead(405).end(); return; }
    await handlePortal(req, res, options);
    return;
  }

  if (path === '/api/billing/webhook') {
    if (method !== 'POST') { res.writeHead(405).end(); return; }
    await handleWebhook(req, res, options);
    return;
  }

  if (path === '/api/entitlements/meerkat') {
    if (method !== 'GET') { res.writeHead(405).end(); return; }
    await handleEntitlements(req, res, options);
    return;
  }

  if (path === '/api/usage/meerkat') {
    if (method !== 'GET') { res.writeHead(405).end(); return; }
    await handleUsage(req, res, options);
    return;
  }

  if (path === '/api/billing/app-checkout') {
    if (method !== 'POST') { res.writeHead(405).end(); return; }
    await handleAppCheckout(req, res, options);
    return;
  }

  if (path === '/api/entitlements/meerkat-app') {
    if (method !== 'GET') { res.writeHead(405).end(); return; }
    await handleAppEntitlement(req, res, options);
    return;
  }

  if (path === '/api/link/meerkat-app') {
    if (method !== 'POST') { res.writeHead(405).end(); return; }
    await handleAppLink(req, res, options);
    return;
  }

  if (path === '/api/entitlements/meerkat-app-token') {
    if (method !== 'POST') { res.writeHead(405).end(); return; }
    await handleAppUnlockToken(req, res, options);
    return;
  }

  res.writeHead(404).end();
}

/**
 * Plan 39 P6: mint a SHORT-LIVED, HMAC-signed, PERSONA-BOUND proof of the $4.99
 * one-time app unlock for the public submit route's server-side entitlement gate
 * (NC-P3). Design constraints, all fail-closed:
 *
 *  - NC-P2: this request carries the PERSONA only, never a device credential. It
 *    is deliberately NOT subject-bearer-authorized (the hosted bearer is
 *    device-signed): purchase linkage rides a SINGLE-USE cross-rail link code
 *    (`link`, minted by the purchaser via /api/link/meerkat-app in the billing
 *    context), so device identity and persona never co-appear in one request.
 *  - PROOF OF POSSESSION: `personaSig` is the persona's Ed25519 signature over
 *    appUnlockBindingMessage(personaPubkey, ts), ts within a 5-minute window.
 *    Without it, a purchaser could bind proofs to arbitrary PUBLIC persona keys.
 *  - ONE PURCHASE, ONE PERSONA: the first successful mint STICKY-BINDS the
 *    purchase to this persona hash (atomic first-bind-wins in the store); a mint
 *    for a different persona against the same purchase is 409. Re-mints (proof
 *    refresh) need only the persona proof: the bound subject is found by reverse
 *    lookup, no link code required.
 *  - The proof derives ONLY from a REAL active purchase row
 *    (deriveMeerkatAppUnlock); a refund kills re-mints. NC-P5: this proves the
 *    existing meerkat_app_unlock SKU, no new price.
 *
 * Signed with `appUnlockTokenSecret` (the secret the community node verifies
 * against); unconfigured secret = 501 fail-closed.
 */
async function handleAppUnlockToken(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  options: MeerkatHostedApiOptions,
): Promise<void> {
  const appUnlock = options.appUnlock;
  if (!appUnlock) { res.writeHead(404).end(); return; }
  if (!options.appUnlockTokenSecret) {
    sendJson(res, 501, { error: 'app_unlock_token_not_configured' });
    return;
  }
  const body = await readJsonObject(req);
  if (!body) { sendJson(res, 400, { error: 'bad_body' }); return; }
  const personaPubkey = requiredString(body, 'personaPubkey');
  const ts = requiredString(body, 'ts');
  const personaSig = requiredString(body, 'personaSig');
  if (!personaPubkey || !/^[0-9a-f]{64}$/i.test(personaPubkey) || !ts || !personaSig) {
    sendJson(res, 400, { error: 'missing_persona_proof' });
    return;
  }
  const nowMs = options.now?.() ?? Date.now();
  const tsMs = Date.parse(ts);
  if (!Number.isFinite(tsMs) || Math.abs(nowMs - tsMs) > APP_UNLOCK_BINDING_WINDOW_MS) {
    sendJson(res, 401, { error: 'stale_persona_proof' });
    return;
  }
  let signatureOk = false;
  try {
    signatureOk = nacl.sign.detached.verify(
      new TextEncoder().encode(appUnlockBindingMessage(personaPubkey, ts)),
      Buffer.from(personaSig, 'hex'),
      Buffer.from(personaPubkey, 'hex'),
    );
  } catch {
    signatureOk = false;
  }
  if (!signatureOk) {
    sendJson(res, 401, { error: 'bad_persona_proof' });
    return;
  }
  const personaHash = createHash('sha256').update(personaPubkey.toLowerCase(), 'utf8').digest('hex');

  // Resolve the purchase: a fresh single-use link code binds a NEW persona; a
  // re-mint finds the already-bound subject by reverse lookup. Neither path
  // carries a device credential.
  const linkCode = requiredString(body, 'link');
  let subjectId: string | null = null;
  if (linkCode) {
    const redeemed = await appUnlock.store.redeemLink(linkCode, nowMs);
    subjectId = redeemed?.subjectId ?? null;
  } else {
    subjectId = await appUnlock.store.getSubjectByAppUnlockPersona(personaHash);
  }
  if (!subjectId) {
    sendJson(res, 402, { error: 'no_active_purchase' });
    return;
  }
  const purchase = await appUnlock.store.getAppPurchase(subjectId);
  const state = deriveMeerkatAppUnlock(purchase ? [purchase] : []);
  if (!state.unlocked || !state.purchaseDate) {
    sendJson(res, 402, { error: 'no_active_purchase' });
    return;
  }
  // Sticky one-purchase-one-persona binding (atomic first-bind-wins).
  let boundHash: string;
  try {
    boundHash = await appUnlock.store.bindAppUnlockPersona(subjectId, personaHash);
  } catch (error) {
    if (error instanceof AppUnlockPersonaInUseError) {
      sendJson(res, 409, { error: 'persona_already_bound' });
      return;
    }
    throw error;
  }
  if (boundHash !== personaHash) {
    sendJson(res, 409, { error: 'purchase_already_bound' });
    return;
  }
  const issued = await issueMeerkatAppUnlockToken({
    secret: options.appUnlockTokenSecret,
    purchaseDate: state.purchaseDate,
    bindingHash: personaHash,
    nowMs,
  });
  sendJson(res, 200, { token: issued.token, expiresAt: issued.payload.expiresAt });
}

/**
 * Plan 22 S0.2: a subject's REAL server-space usage. Authorized -> the subject's
 * OWN tenant stats only (structural isolation in the usage source). No usage source
 * or no provisioned tenant => { connected: false } -- never a fabricated meter
 * (honesty contract NC-4). All numbers come from real SeederNodeStats rows.
 */
async function handleUsage(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  options: MeerkatHostedApiOptions,
): Promise<void> {
  const subject = await requireSubject(req, res, options.authorize);
  if (!subject) return;
  const usage = options.usage ? await options.usage.usageForSubject(subject.subjectId) : null;
  if (!usage) {
    sendJson(res, 200, { connected: false });
    return;
  }
  // S0.5 storage breakdown: overage is REAL stored bytes beyond the free tier, in
  // whole GB; on the free tier it is 0 (the ingest cap-rejects past the cap). All
  // numbers come from real SeederNodeStats -- never a fabricated estimate.
  const GB = 1024 * 1024 * 1024;
  const freeCapBytes = storageCapMbForTier('free') * 1024 * 1024;
  const overageGb = Math.ceil(Math.max(0, usage.storageBytes - freeCapBytes) / GB);
  sendJson(res, 200, {
    connected: true,
    tier: usage.tier,
    storage: {
      usedBytes: usage.storageBytes,
      capBytes: usage.storageCapBytes,
      overageGb,
      retentionTier: usage.retentionTier,
    },
    bytesServed: usage.bytesServed,
    peersServed: usage.peersServed,
  });
}

function queryParam(req: http.IncomingMessage, key: string): string | null {
  const host = req.headers.host ?? 'localhost';
  const value = new URL(req.url ?? '/', `http://${host}`).searchParams.get(key);
  return value && value.trim().length > 0 ? value.trim() : null;
}

/**
 * Plan 22 Part 1 web rail: one-time app-unlock Stripe Checkout. The price comes
 * from billing-config (never hardcoded); the app-unlock rail must be configured or
 * the route is absent (mobile StoreKit/Play needs no server, so this is honest, not
 * a stub).
 */
async function handleAppCheckout(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  options: MeerkatHostedApiOptions,
): Promise<void> {
  if (!options.appUnlock) { res.writeHead(404).end(); return; }
  const subject = await requireSubject(req, res, options.authorize);
  if (!subject) return;
  const body = await readJsonObject(req);
  if (!body) { sendJson(res, 400, { error: 'bad_body' }); return; }
  const successUrl = requiredString(body, 'successUrl');
  const cancelUrl = requiredString(body, 'cancelUrl');
  if (!successUrl || !cancelUrl || !isHttpUrl(successUrl) || !isHttpUrl(cancelUrl)) {
    sendJson(res, 400, { error: 'bad_redirect_url' });
    return;
  }
  const session = await options.appUnlock.billing.createAppCheckoutSession({
    subject,
    productId: MEERKAT_APP_UNLOCK_PRODUCT.id,
    price: MEERKAT_APP_UNLOCK_PRODUCT.price,
    successUrl,
    cancelUrl,
  });
  sendJson(res, 200, { url: session.url });
}

/**
 * Plan 22 Part 1: app-unlock state for a subject (web account restore) OR a
 * cross-rail Link redeem (`?link=<code>`). Both derive from a REAL purchase row;
 * a missing/refunded purchase, or a consumed/expired/forged code, returns
 * `{ unlocked: false }` fail-closed (never a fabricated unlock, NC-2).
 */
async function handleAppEntitlement(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  options: MeerkatHostedApiOptions,
): Promise<void> {
  const appUnlock = options.appUnlock;
  if (!appUnlock) { res.writeHead(404).end(); return; }
  const nowMs = options.now?.() ?? Date.now();

  const linkCode = queryParam(req, 'link');
  if (linkCode) {
    const recipient = await requireSubject(req, res, options.authorize);
    if (!recipient) return;
    const redeemed = await appUnlock.store.redeemLink(linkCode, nowMs);
    if (!redeemed) { sendJson(res, 200, { unlocked: false }); return; }
    const purchase = await appUnlock.store.getAppPurchase(redeemed.subjectId);
    const state = deriveMeerkatAppUnlock(purchase ? [purchase] : []);
    const grant = state.unlocked ? issueAppUnlockGrant({
      v: 1,
      sourceSubjectId: redeemed.subjectId,
      recipientSubjectId: recipient.subjectId,
      purchaseDate: state.purchaseDate,
      issuedAt: new Date(nowMs).toISOString(),
    }, options.entitlementSecret) : null;
    sendJson(res, 200, { unlocked: state.unlocked, purchaseDate: state.purchaseDate, grant });
    return;
  }

  const subject = await requireSubject(req, res, options.authorize);
  if (!subject) return;
  const grantToken = queryParam(req, 'grant');
  if (grantToken) {
    const grant = verifyAppUnlockGrant(grantToken, options.entitlementSecret);
    if (!grant || grant.recipientSubjectId !== subject.subjectId) {
      sendJson(res, 200, { unlocked: false, purchaseDate: null });
      return;
    }
    const source = await appUnlock.store.getAppPurchase(grant.sourceSubjectId);
    const state = deriveMeerkatAppUnlock(source ? [source] : []);
    sendJson(res, 200, { unlocked: state.unlocked, purchaseDate: state.purchaseDate, grant: grantToken });
    return;
  }
  const purchase = await appUnlock.store.getAppPurchase(subject.subjectId);
  const state = deriveMeerkatAppUnlock(purchase ? [purchase] : []);
  sendJson(res, 200, { unlocked: state.unlocked, purchaseDate: state.purchaseDate });
}

/**
 * Plan 22 F1 / TC-10: mint a one-time cross-rail Link code. The caller proves the
 * rail where they ALREADY unlocked:
 *   - `stripe`: their web purchase already exists as a REAL active row (webhook).
 *   - `storekit`/`play`: they send the store receipt, which the service validates
 *     SERVER-SIDE (fail-closed if no provider credentials) before writing the row.
 * The service never self-certifies a receipt and never mints a code for an
 * inactive/absent purchase.
 */
async function handleAppLink(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  options: MeerkatHostedApiOptions,
): Promise<void> {
  const appUnlock = options.appUnlock;
  if (!appUnlock) { res.writeHead(404).end(); return; }
  const subject = await requireSubject(req, res, options.authorize);
  if (!subject) return;
  const body = await readJsonObject(req);
  if (!body) { sendJson(res, 400, { error: 'bad_body' }); return; }
  const rail = requiredString(body, 'rail');
  if (rail !== 'stripe' && rail !== 'storekit' && rail !== 'play') {
    sendJson(res, 400, { error: 'bad_rail' });
    return;
  }
  const nowMs = options.now?.() ?? Date.now();

  if (rail === 'storekit' || rail === 'play') {
    const receipt = requiredString(body, 'receipt');
    if (!receipt) { sendJson(res, 400, { error: 'missing_receipt' }); return; }
    if (!verifyRevenueCatAppUserId(subject.subjectId, receipt)) {
      sendJson(res, 401, { error: 'receipt_subject_mismatch' });
      return;
    }
    const validator: MeerkatStoreReceiptValidator =
      appUnlock.receiptValidator ?? failClosedStoreReceiptValidator();
    const verdict = await validator.validate({
      rail: rail as MeerkatStoreRail,
      receipt,
      subjectId: subject.subjectId,
      productId: MEERKAT_APP_UNLOCK_PRODUCT.id,
    });
    if (!verdict.valid) {
      const status = verdict.reason === 'not_configured' ? 501 : 400;
      sendJson(res, status, { error: 'receipt_rejected', reason: verdict.reason });
      return;
    }
    await appUnlock.store.upsertAppPurchase({
      subjectId: subject.subjectId,
      productId: MEERKAT_APP_UNLOCK_PRODUCT.id,
      rail,
      purchaseDate: verdict.purchaseDate,
      isActive: true,
    });
  } else {
    // Stripe (web): the purchase must already exist as a real active row.
    const purchase = await appUnlock.store.getAppPurchase(subject.subjectId);
    if (!deriveMeerkatAppUnlock(purchase ? [purchase] : []).unlocked) {
      sendJson(res, 402, { error: 'no_active_purchase' });
      return;
    }
  }

  const ttlMs = appUnlock.linkTtlMs ?? DEFAULT_ENTITLEMENT_TTL_MS;
  const code = (appUnlock.generateLinkCode ?? (() => randomUUID()))();
  const expiresAt = new Date(nowMs + ttlMs).toISOString();
  await appUnlock.store.createLink({
    code,
    subjectId: subject.subjectId,
    createdAt: new Date(nowMs).toISOString(),
    expiresAt,
    consumedAt: null,
  });
  sendJson(res, 200, { code, expiresAt });
}
