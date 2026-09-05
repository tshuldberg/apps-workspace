/**
 * Host dashboard view-model (Plan 20, Phase 6.2 / 6.4).
 *
 * The dashboard's honesty is encoded in `host/ui-view-model.ts`; this proves it:
 *   - `cardView` WITHHOLDS the card on every non-`available:true` body
 *     (`relay-down`, `unexposed`, `unverified`) and NEVER leaks card/qr bytes,
 *     and only surfaces the card once the server says `available:true`.
 *   - `connectivityLabel` never emits a fabricated peer count or "connected to X",
 *     and a stopped/errored service flips the view offline (which, together with
 *     the server withholding the card, withdraws the card from the dashboard).
 *   - The browser twin served at `/ui-view-model.js` is drift-guarded against this
 *     typed source of truth over a shared input matrix.
 */

import { describe, it, expect } from 'vitest';

import {
  cardView,
  connectivityLabel,
  lifecycleBanner,
  LIFECYCLE_BANNER,
} from '../ui-view-model';
// The plain-JS browser twin (served verbatim); typed via ui/ui-view-model.d.ts.
import * as twin from '../ui/ui-view-model.js';

// ---- cardView: withholds unless available===true ----------------------------

describe('cardView', () => {
  it('withholds when the relay is down (available:false, state relay-down)', () => {
    const view = cardView({
      available: false,
      state: 'relay-down',
      reason: 'The relay is not live yet.',
      lifecycle: LIFECYCLE_BANNER,
    });
    expect(view.show).toBe(false);
    expect(view).not.toHaveProperty('card');
    expect(view).not.toHaveProperty('qr');
    if (!view.show) {
      expect(view.state).toBe('relay-down');
      expect(view.reason).toMatch(/not live/i);
    }
  });

  it('withholds an UNVERIFIED public exposure -- surfaces the candidate URL but NO card/qr', () => {
    const view = cardView({
      available: false,
      state: 'unverified',
      reason: 'The public address is not yet verified reachable from off-host.',
      candidateUrl: 'wss://abc.trycloudflare.com',
      steps: [{ title: 'Add a DNS record', detail: 'point your domain at this host' }],
      lifecycle: LIFECYCLE_BANNER,
    });
    expect(view.show).toBe(false);
    expect(view).not.toHaveProperty('card');
    expect(view).not.toHaveProperty('qr');
    if (!view.show) {
      expect(view.state).toBe('unverified');
      // A candidate URL may be shown (labeled unverified) but it is NOT a card.
      expect(view.candidateUrl).toBe('wss://abc.trycloudflare.com');
      expect(view.steps).toHaveLength(1);
    }
  });

  it('withholds on an unexposed service', () => {
    const view = cardView({ available: false, state: 'unexposed', reason: 'No exposure yet.' });
    expect(view.show).toBe(false);
    expect(view).not.toHaveProperty('card');
  });

  it('withholds a malformed available body that omits the card (never fabricates one)', () => {
    const view = cardView({ available: true, scope: 'public' });
    expect(view.show).toBe(false);
    if (!view.show) expect(view.state).toBe('malformed');
    expect(view).not.toHaveProperty('card');
  });

  it('SHOWS the card + QR only when available===true with a real card + qr svg', () => {
    const view = cardView({
      available: true,
      scope: 'public',
      card: 'MKSERVER1:eyJ2IjoxfQ',
      qr: { svg: '<svg>…</svg>', version: 3, size: 29 },
      lifecycle: LIFECYCLE_BANNER,
    });
    expect(view.show).toBe(true);
    if (view.show) {
      expect(view.card).toBe('MKSERVER1:eyJ2IjoxfQ');
      expect(view.qr.svg).toContain('<svg');
      expect(view.scope).toBe('public');
    }
  });

  it('never shows a card for a null / non-object body', () => {
    for (const bad of [null, undefined, 'nope', 42, []]) {
      const view = cardView(bad);
      expect(view.show).toBe(false);
      expect(view).not.toHaveProperty('card');
    }
  });
});

// ---- connectivityLabel: no peer count, ever ---------------------------------

const liveStatus = {
  services: [
    { name: 'relay', state: 'live', port: 8787, connections: 42 },
    { name: 'communityNode', state: 'live', port: 8788, connections: null },
  ],
};

describe('connectivityLabel', () => {
  it('never emits a fabricated peer count or a "connected to X" claim', () => {
    // The relay publishes a real /healthz connection count (42 here); it must NOT
    // leak into the label as a peer count.
    const view = connectivityLabel(liveStatus);
    expect(view.online).toBe(true);
    expect(view.label).not.toMatch(/\d/);
    expect(view.label).not.toMatch(/connected to/i);
    expect(view.label).not.toMatch(/\bpeers?\b/i);
    expect(view.label).not.toMatch(/42/);
  });

  it('reports offline + "not running" before any service exists', () => {
    const view = connectivityLabel({ services: [] });
    expect(view.online).toBe(false);
    expect(view.label).toMatch(/not running/i);
  });

  it('a stopped/errored service flips the view to offline', () => {
    const errored = connectivityLabel({
      services: [{ name: 'relay', state: 'error', port: null, connections: null }],
    });
    expect(errored.online).toBe(false);
    expect(errored.label).toMatch(/offline/i);

    const stopped = connectivityLabel({
      services: [{ name: 'relay', state: 'stopped', port: null, connections: null }],
    });
    expect(stopped.online).toBe(false);
    expect(stopped.label).toMatch(/stopped/i);
  });

  it('reports starting honestly (offline until live)', () => {
    const view = connectivityLabel({
      services: [{ name: 'relay', state: 'starting', port: null, connections: null }],
    });
    expect(view.online).toBe(false);
    expect(view.label).toMatch(/starting/i);
  });

  it('is offline for a null / malformed status body', () => {
    for (const bad of [null, undefined, {}, { services: 'nope' }]) {
      expect(connectivityLabel(bad).online).toBe(false);
    }
  });
});

// ---- offline flip WITHDRAWS the card ----------------------------------------

describe('a stopped/errored service withdraws the card', () => {
  it('an errored relay is offline AND its /api/card withholds the card', () => {
    const status = {
      services: [{ name: 'relay', state: 'error', port: null, connections: null }],
    };
    expect(connectivityLabel(status).online).toBe(false);
    // With the relay not live the server returns available:false; cardView hides it.
    const card = cardView({ available: false, state: 'relay-down', reason: 'The relay is not live yet.' });
    expect(card.show).toBe(false);
    expect(card).not.toHaveProperty('card');
  });
});

// ---- lifecycle banner constant ----------------------------------------------

describe('lifecycleBanner', () => {
  it('is the constant reachable-only-while-open reminder', () => {
    expect(lifecycleBanner()).toBe(
      'This server is reachable only while this app is open and this computer is awake.',
    );
    expect(lifecycleBanner()).toBe(LIFECYCLE_BANNER);
  });
});

// ---- drift guard: the served browser twin matches this source of truth ------

describe('browser twin drift guard (/ui-view-model.js === ui-view-model.ts)', () => {
  const cardBodies: unknown[] = [
    null,
    undefined,
    'nope',
    { available: false, state: 'relay-down', reason: 'down' },
    { available: false, state: 'unexposed' },
    { available: false, state: 'unverified', candidateUrl: 'wss://x', steps: [{ title: 'a', detail: 'b' }] },
    { available: true, scope: 'public' },
    { available: true, scope: 'public', card: 'MKSERVER1:x', qr: { svg: '<svg/>', version: 2, size: 25 } },
    { available: true, scope: 'same-network', card: 'MKSERVER1:y', qr: { svg: '<svg/>' } },
  ];
  const statusBodies: unknown[] = [
    null,
    { services: [] },
    { services: [{ name: 'relay', state: 'live', connections: 7 }] },
    { services: [{ name: 'communityNode', state: 'live' }, { name: 'relay', state: 'live' }] },
    { services: [{ name: 'relay', state: 'error' }] },
    { services: [{ name: 'relay', state: 'starting' }] },
    { services: [{ name: 'relay', state: 'stopped' }] },
  ];

  it('cardView agrees across the matrix', () => {
    for (const body of cardBodies) {
      expect(twin.cardView(body)).toEqual(cardView(body));
    }
  });

  it('connectivityLabel agrees across the matrix', () => {
    for (const body of statusBodies) {
      expect(twin.connectivityLabel(body)).toEqual(connectivityLabel(body));
    }
  });

  it('lifecycleBanner + constant agree', () => {
    expect(twin.lifecycleBanner()).toBe(lifecycleBanner());
    expect(twin.LIFECYCLE_BANNER).toBe(LIFECYCLE_BANNER);
  });
});
