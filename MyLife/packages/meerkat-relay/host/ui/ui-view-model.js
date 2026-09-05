// Host dashboard view-model -- BROWSER TWIN of ../ui-view-model.ts (Plan 20).
//
// Plain-JS ES module served at /ui-view-model.js and imported by dashboard.js in
// the browser. Its behavior is drift-guarded against the typed source of truth
// (host/ui-view-model.ts) in __tests__/ui-view-model.test.ts, which runs both over
// the same input matrix and asserts identical output. Keep the two in lockstep.
//
// Honesty rules (encoded, not just documented):
//   - cardView NEVER surfaces the card/QR unless /api/card returned
//     available === true; anything else returns { show:false, reason } with NO
//     card/qr bytes.
//   - connectivityLabel derives its line from real service state only; never a
//     peer count, online dot, or "connected to {friend}".
//   - lifecycleBanner is the constant reachable-only-while-open reminder.
// No DOM, no crypto.

const NO_ANSWER = 'Waiting for the control panel…';
const WITHHELD =
  'The connection card is withheld until your server is verified reachable from off this computer.';

function isRecord(value) {
  return !!value && typeof value === 'object';
}

function asSteps(value) {
  if (!Array.isArray(value)) return undefined;
  const steps = value
    .filter(isRecord)
    .filter((s) => typeof s.title === 'string' && typeof s.detail === 'string')
    .map((s) => ({ title: String(s.title), detail: String(s.detail) }));
  return steps.length > 0 ? steps : undefined;
}

export function cardView(apiCard) {
  if (!isRecord(apiCard)) {
    return { show: false, reason: NO_ANSWER };
  }

  if (apiCard.available !== true) {
    const hidden = {
      show: false,
      reason:
        typeof apiCard.reason === 'string' && apiCard.reason.length > 0 ? apiCard.reason : WITHHELD,
    };
    if (typeof apiCard.state === 'string') hidden.state = apiCard.state;
    if (typeof apiCard.candidateUrl === 'string') hidden.candidateUrl = apiCard.candidateUrl;
    const steps = asSteps(apiCard.steps);
    if (steps) hidden.steps = steps;
    return hidden;
  }

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

  const shownQr = { svg: qr.svg };
  if (typeof qr.version === 'number') shownQr.version = qr.version;
  if (typeof qr.size === 'number') shownQr.size = qr.size;

  return {
    show: true,
    card,
    qr: shownQr,
    scope: typeof apiCard.scope === 'string' ? apiCard.scope : 'unknown',
  };
}

function extractServices(status) {
  if (!isRecord(status) || !Array.isArray(status.services)) return [];
  return status.services.filter(isRecord).map((s) => ({
    name: typeof s.name === 'string' ? s.name : '',
    state: typeof s.state === 'string' ? s.state : 'unknown',
  }));
}

function describeLive(names) {
  if (names.includes('communityNode')) return 'Your community server is running.';
  if (names.includes('relay')) return 'Your connection server is running.';
  if (names.includes('seeder')) return 'Your seeder is running.';
  return 'Your server is running.';
}

export function connectivityLabel(status) {
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

export const LIFECYCLE_BANNER =
  'This server is reachable only while this app is open and this computer is awake.';

export function lifecycleBanner() {
  return LIFECYCLE_BANNER;
}
