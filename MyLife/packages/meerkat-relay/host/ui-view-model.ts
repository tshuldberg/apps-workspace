/**
 * Host dashboard view-model (Plan 20, Phase 6.2 / 6.4). PURE, no DOM.
 *
 * This module owns the HONEST render decisions the desktop-companion dashboard
 * makes over the control-panel's `/api/status` + `/api/card` JSON. It is imported
 * BOTH by a vitest test (this file, typed) and by the browser `dashboard.js` at
 * runtime (via the plain-JS twin served at `/ui-view-model.js`, whose behavior is
 * drift-guarded against this file in `__tests__/ui-view-model.test.ts`).
 *
 * The honesty rules are encoded here, not just documented:
 *   - `cardView` NEVER surfaces the connection card / QR unless `/api/card`
 *     returned `available === true` (the server only does that when the relay is
 *     live AND the public exposure is verified reachable off-host, or a
 *     same-network LAN rung). Anything else returns `{ show:false, reason }` and
 *     carries NO card/qr bytes.
 *   - `connectivityLabel` derives its line from real service state only; it NEVER
 *     emits a peer count, an online dot, or a "connected to {friend}" claim. The
 *     real `/healthz` connection number is deliberately NOT rendered as a peer
 *     count.
 *   - `lifecycleBanner` is the constant, always-present reminder that a desktop
 *     host is reachable only while the app is open and the computer is awake.
 *
 * This file owns NO cryptography and touches no DOM, so it stays trivially
 * testable and safe to serve verbatim to the browser twin.
 */

/** The `qr` payload the server includes only when a card is available. */
export interface CardQr {
  svg: string;
  version?: number;
  size?: number;
}

/** Card withheld: the dashboard shows the reason and NEVER any card/qr bytes. */
export interface CardHidden {
  show: false;
  reason: string;
  /** The server's honest state tag ('relay-down' | 'unexposed' | 'unverified' | ...). */
  state?: string;
  /** For an unverified public exposure the candidate URL may be shown (labeled unverified). */
  candidateUrl?: string;
  /** BYO-domain setup steps, when the server included them. */
  steps?: { title: string; detail: string }[];
}

/** Card available: the ONLY shape that ever carries the card + QR. */
export interface CardShown {
  show: true;
  card: string;
  qr: CardQr;
  scope: string;
}

export type CardView = CardHidden | CardShown;

/** Generic reason shown when the panel has not answered yet. */
const NO_ANSWER = 'Waiting for the control panel…';
/** Reason shown when a card is withheld and the server gave no explicit reason. */
const WITHHELD =
  'The connection card is withheld until your server is verified reachable from off this computer.';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function asSteps(value: unknown): { title: string; detail: string }[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const steps = value
    .filter(isRecord)
    .filter((s) => typeof s.title === 'string' && typeof s.detail === 'string')
    .map((s) => ({ title: String(s.title), detail: String(s.detail) }));
  return steps.length > 0 ? steps : undefined;
}

/**
 * Decide what the dashboard renders for a `GET /api/card` body. Fail-closed:
 * anything other than an explicit `available === true` with a real card string +
 * QR svg withholds the card entirely (never a fabricated / stale card).
 */
export function cardView(apiCard: unknown): CardView {
  if (!isRecord(apiCard)) {
    return { show: false, reason: NO_ANSWER };
  }

  if (apiCard.available !== true) {
    const hidden: CardHidden = {
      show: false,
      reason:
        typeof apiCard.reason === 'string' && apiCard.reason.length > 0
          ? apiCard.reason
          : WITHHELD,
    };
    if (typeof apiCard.state === 'string') hidden.state = apiCard.state;
    if (typeof apiCard.candidateUrl === 'string') hidden.candidateUrl = apiCard.candidateUrl;
    const steps = asSteps(apiCard.steps);
    if (steps) hidden.steps = steps;
    return hidden;
  }

  // available === true, but still require a REAL card string + QR svg before we
  // ever claim `show:true` (defensive: never render a card the server omitted).
  const card = apiCard.card;
  const qr = apiCard.qr;
  if (typeof card !== 'string' || card.length === 0) {
    return {
      show: false,
      state: 'malformed',
      reason: 'The server reported ready but did not include a connection card.',
    };
  }
  if (!isRecord(qr) || typeof qr.svg !== 'string' || qr.svg.length === 0) {
    return {
      show: false,
      state: 'malformed',
      reason: 'The server reported ready but did not include a QR image.',
    };
  }

  const shownQr: CardQr = { svg: qr.svg };
  if (typeof qr.version === 'number') shownQr.version = qr.version;
  if (typeof qr.size === 'number') shownQr.size = qr.size;

  return {
    show: true,
    card,
    qr: shownQr,
    scope: typeof apiCard.scope === 'string' ? apiCard.scope : 'unknown',
  };
}

/** The honest connectivity line + whether the server is actually online. */
export interface ConnectivityView {
  online: boolean;
  label: string;
}

interface LiteService {
  name: string;
  state: string;
}

function extractServices(status: unknown): LiteService[] {
  if (!isRecord(status) || !Array.isArray(status.services)) return [];
  return status.services.filter(isRecord).map((s) => ({
    name: typeof s.name === 'string' ? s.name : '',
    state: typeof s.state === 'string' ? s.state : 'unknown',
  }));
}

/** Name the live services in plain language, with NO counts and NO peer claims. */
function describeLive(names: string[]): string {
  if (names.includes('communityNode')) return 'Your community server is running.';
  if (names.includes('relay')) return 'Your connection server is running.';
  if (names.includes('seeder')) return 'Your seeder is running.';
  return 'Your server is running.';
}

/**
 * Derive the honest status line from `/api/status` ONLY. Uses service state
 * (starting / live / stopped / error) and never the `/healthz` connection number,
 * so it can never emit a fabricated peer count or a "connected to X" claim.
 */
export function connectivityLabel(status: unknown): ConnectivityView {
  const services = extractServices(status);
  if (services.length === 0) {
    return { online: false, label: 'Not running yet. Press Start to bring your server online.' };
  }
  const states = services.map((s) => s.state);
  if (states.includes('error')) {
    return { online: false, label: 'A service stopped unexpectedly. Your server is offline.' };
  }
  const live = services.filter((s) => s.state === 'live');
  if (live.length === 0) {
    if (states.includes('starting')) {
      return { online: false, label: 'Starting your server…' };
    }
    return { online: false, label: 'Your server is stopped.' };
  }
  return { online: true, label: describeLive(live.map((s) => s.name)) };
}

/**
 * The constant, always-present lifecycle reminder. A desktop host is not an
 * always-on node; it is reachable only while this app is open and awake.
 */
export const LIFECYCLE_BANNER =
  'This server is reachable only while this app is open and this computer is awake.';

export function lifecycleBanner(): string {
  return LIFECYCLE_BANNER;
}
