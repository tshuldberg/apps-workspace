// Web Push registration lifecycle (Plan 42 P6 / WP-42D). Proves the subscription
// -> gateway-registration mapping, the rotation handler, sign-out revocation, and
// graceful degradation (unsupported / unconfigured / denied permission) WITHOUT a
// real browser: PushGatewayClient, the DatabaseAdapter, and the browser push
// globals are all injected fakes. It asserts the registration carries only the
// random subscription (no identity, NC-42.3) and never claims active state it
// lacks (NC-42.5).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Fakes ------------------------------------------------------------------

interface RegisterCall {
  binding: { registrationId: string; registrationSecret: string };
  provider: string;
  providerToken: string;
}

const gatewayState = vi.hoisted(() => ({
  registerCalls: [] as RegisterCall[],
  rotateCalls: [] as { providerToken: string }[],
  unregisterCalls: [] as { registrationId: string }[],
  registerOk: true,
  rotateOk: true,
  bindingSeq: 0,
  capSeq: 0,
}));

class FakePushGatewayClient {
  constructor(public options: { serverUrl: string }) {}
  createBinding() {
    gatewayState.bindingSeq += 1;
    return {
      registrationId: `reg-${gatewayState.bindingSeq}`,
      registrationSecret: `sec-${gatewayState.bindingSeq}`,
    };
  }
  generateCapability() {
    gatewayState.capSeq += 1;
    return `cap-${gatewayState.capSeq}`;
  }
  async register(input: RegisterCall) {
    gatewayState.registerCalls.push(input);
    return gatewayState.registerOk ? { ok: true, value: undefined } : { ok: false, error: 'server_error' };
  }
  async rotateToken(input: { binding: unknown; providerToken: string }) {
    gatewayState.rotateCalls.push({ providerToken: input.providerToken });
    return gatewayState.rotateOk ? { ok: true, value: undefined } : { ok: false, error: 'not_found' };
  }
  async unregister(binding: { registrationId: string }) {
    gatewayState.unregisterCalls.push({ registrationId: binding.registrationId });
    return { ok: true, value: undefined };
  }
}

// Partial mock: keep the real @mylife/sync (meerkat-data imports sync sync-rule
// constants) and override ONLY the push client with our recording fake.
vi.mock('@mylife/sync', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mylife/sync')>();
  return { ...actual, PushGatewayClient: FakePushGatewayClient };
});

// A tiny DatabaseAdapter stand-in backed by a Map, matching the getSetting /
// setSetting queries in meerkat-data (SELECT value / INSERT OR REPLACE).
function makeFakeDb() {
  const settings = new Map<string, string>();
  return {
    settings,
    query(sql: string, params: unknown[]) {
      if (sql.includes('SELECT value FROM mk_settings')) {
        const key = params[0] as string;
        return settings.has(key) ? [{ value: settings.get(key) }] : [];
      }
      return [];
    },
    execute(sql: string, params: unknown[]) {
      if (sql.includes('INSERT OR REPLACE INTO mk_settings')) {
        settings.set(params[0] as string, params[1] as string);
      }
    },
  } as unknown as import('@mylife/db').DatabaseAdapter;
}

// --- Browser global fakes ---------------------------------------------------

const VALID_VAPID = (() => {
  const raw = new Uint8Array(65);
  raw[0] = 0x04;
  for (let i = 1; i < 65; i += 1) raw[i] = i;
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let out = '';
  for (let i = 0; i < raw.length; i += 3) {
    const chunk = (raw[i]! << 16) | ((raw[i + 1] ?? 0) << 8) | (raw[i + 2] ?? 0);
    const rem = raw.length - i;
    out += A[(chunk >> 18) & 63]! + A[(chunk >> 12) & 63]!;
    if (rem > 1) out += A[(chunk >> 6) & 63]!;
    if (rem > 2) out += A[chunk & 63]!;
  }
  return out;
})();

const SUBSCRIPTION_JSON = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
  keys: { p256dh: 'BPublicKey', auth: 'AuthKey' },
};

function installBrowserGlobals(opts: {
  supported?: boolean;
  permission?: 'default' | 'granted' | 'denied';
  existingSubscription?: boolean;
  subscribeThrows?: boolean;
}) {
  const supported = opts.supported ?? true;
  const g = globalThis as Record<string, unknown>;
  const subscription = {
    toJSON: () => SUBSCRIPTION_JSON,
    unsubscribe: vi.fn(async () => true),
  };
  const pushManager = {
    getSubscription: vi.fn(async () => (opts.existingSubscription ? subscription : null)),
    subscribe: vi.fn(async () => {
      if (opts.subscribeThrows) throw new Error('subscribe failed');
      return subscription;
    }),
  };
  const registration = { pushManager };
  if (supported) {
    g.navigator = {
      serviceWorker: {
        register: vi.fn(async () => registration),
        ready: Promise.resolve(registration),
      },
    };
    g.PushManager = class {};
    g.Notification = {
      permission: opts.permission ?? 'default',
      requestPermission: vi.fn(async () => opts.permission ?? 'granted'),
    };
  } else {
    delete g.navigator;
    delete g.PushManager;
    delete g.Notification;
  }
  return { subscription, pushManager, registration };
}

// The config is passed explicitly so the test never depends on Vite's static
// import.meta.env inlining (which would resolve to '' under Node).
const CONFIG = { gatewayUrl: 'https://push.example', vapidPublicKey: VALID_VAPID };
const UNCONFIGURED = { gatewayUrl: '', vapidPublicKey: '' };

let mod: typeof import('../web-push-registration');

beforeEach(async () => {
  vi.resetModules();
  gatewayState.registerCalls = [];
  gatewayState.rotateCalls = [];
  gatewayState.unregisterCalls = [];
  gatewayState.registerOk = true;
  gatewayState.rotateOk = true;
  gatewayState.bindingSeq = 0;
  gatewayState.capSeq = 0;
  mod = await import('../web-push-registration');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('enableWebPush graceful degradation (NC-42.5)', () => {
  it('unsupported browser => { ok:false, unsupported } and no registration', async () => {
    installBrowserGlobals({ supported: false });
    const db = makeFakeDb();
    const result = await mod.enableWebPush(db, CONFIG);
    expect(result).toEqual({ ok: false, reason: 'unsupported' });
    expect(gatewayState.registerCalls).toHaveLength(0);
    expect(mod.hasStoredRegistration(db)).toBe(false);
  });

  it('unconfigured build => { ok:false, not_configured }', async () => {
    installBrowserGlobals({});
    const result = await mod.enableWebPush(makeFakeDb(), UNCONFIGURED);
    expect(result).toEqual({ ok: false, reason: 'not_configured' });
  });

  it('denied permission => { ok:false, permission_denied } and never registers', async () => {
    installBrowserGlobals({ permission: 'denied' });
    const db = makeFakeDb();
    const result = await mod.enableWebPush(db, CONFIG);
    expect(result).toEqual({ ok: false, reason: 'permission_denied' });
    expect(gatewayState.registerCalls).toHaveLength(0);
    expect(mod.hasStoredRegistration(db)).toBe(false);
  });

  it('a subscribe failure => { ok:false, subscribe_failed }', async () => {
    installBrowserGlobals({ permission: 'granted', subscribeThrows: true });
    const result = await mod.enableWebPush(makeFakeDb(), CONFIG);
    expect(result).toEqual({ ok: false, reason: 'subscribe_failed' });
  });
});

describe('enableWebPush success path (subscription -> registration)', () => {
  it('registers the webpush provider token carrying ONLY the subscription (NC-42.3)', async () => {
    installBrowserGlobals({ permission: 'granted' });
    const db = makeFakeDb();
    const result = await mod.enableWebPush(db, CONFIG);
    expect(result).toEqual({ ok: true });
    expect(gatewayState.registerCalls).toHaveLength(1);
    const call = gatewayState.registerCalls[0]!;
    expect(call.provider).toBe('webpush');
    const token = JSON.parse(call.providerToken);
    expect(token).toEqual(SUBSCRIPTION_JSON);
    // No identity/community/message leaked into the registration payload.
    expect(call.providerToken).not.toMatch(/identity|community|message|pubkey/i);
    // The binding is persisted so rotation/revoke can reuse it, and status reads active.
    expect(mod.hasStoredRegistration(db)).toBe(true);
  });

  it('reuses an existing browser subscription instead of double-subscribing', async () => {
    const g = installBrowserGlobals({ permission: 'granted', existingSubscription: true });
    await mod.enableWebPush(makeFakeDb(), CONFIG);
    expect(g.pushManager.subscribe).not.toHaveBeenCalled();
    expect(gatewayState.registerCalls).toHaveLength(1);
  });

  it('a gateway rejection => { ok:false, register_failed } and stores no binding', async () => {
    gatewayState.registerOk = false;
    installBrowserGlobals({ permission: 'granted' });
    const db = makeFakeDb();
    const result = await mod.enableWebPush(db, CONFIG);
    expect(result).toEqual({ ok: false, reason: 'register_failed' });
    expect(mod.hasStoredRegistration(db)).toBe(false);
  });
});

describe('rotation (pushsubscriptionchange, AC-42.9 web analog)', () => {
  it('rotates onto the same binding when one is stored', async () => {
    installBrowserGlobals({ permission: 'granted', existingSubscription: true });
    const db = makeFakeDb();
    await mod.enableWebPush(db, CONFIG); // establishes a binding
    gatewayState.registerCalls = [];
    const result = await mod.rotateWebPushSubscription(db, CONFIG);
    expect(result).toEqual({ ok: true });
    expect(gatewayState.rotateCalls).toHaveLength(1);
    // A rotate reuses the registration; it does NOT create a brand-new one.
    expect(gatewayState.registerCalls).toHaveLength(0);
  });

  it('falls back to a fresh registration when the stored one is gone server-side', async () => {
    installBrowserGlobals({ permission: 'granted', existingSubscription: true });
    const db = makeFakeDb();
    await mod.enableWebPush(db, CONFIG);
    gatewayState.registerCalls = [];
    gatewayState.rotateOk = false; // server 404 on the old registration
    const result = await mod.rotateWebPushSubscription(db, CONFIG);
    expect(result).toEqual({ ok: true });
    expect(gatewayState.registerCalls).toHaveLength(1); // re-registered fresh
  });

  it('with no live subscription => { ok:false, bad_subscription }', async () => {
    installBrowserGlobals({ permission: 'granted', existingSubscription: false });
    const result = await mod.rotateWebPushSubscription(makeFakeDb(), CONFIG);
    expect(result).toEqual({ ok: false, reason: 'bad_subscription' });
  });
});

describe('disableWebPush (sign-out / delete)', () => {
  it('unsubscribes the browser, revokes the gateway registration, and clears the binding', async () => {
    const g = installBrowserGlobals({ permission: 'granted', existingSubscription: true });
    const db = makeFakeDb();
    await mod.enableWebPush(db, CONFIG);
    expect(mod.hasStoredRegistration(db)).toBe(true);
    await mod.disableWebPush(db, CONFIG);
    expect(g.subscription.unsubscribe).toHaveBeenCalled();
    expect(gatewayState.unregisterCalls).toHaveLength(1);
    expect(mod.hasStoredRegistration(db)).toBe(false);
  });
});
