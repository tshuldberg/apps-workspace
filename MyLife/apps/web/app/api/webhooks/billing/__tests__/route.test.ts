import crypto from 'node:crypto';
import { POST } from '../route';
import {
  deriveEntitlementFromBillingEvent,
  issueSignedEntitlement,
  parseBillingWebhookPayload,
} from '@/lib/billing/entitlement-issuer';
import { getPreference, setPreference } from '@mylife/db';
import { BILLING_EVENT_TYPES, BILLING_SKUS } from '@mylife/billing-config';
import { getAdapter } from '@/lib/db';
import { getStoredEntitlement, saveEntitlement } from '@/lib/entitlements';
import {
  runSelfHostAccessProvisioning,
  runSelfHostAccessRevocation,
} from '@/lib/access/provisioning';

vi.mock('@mylife/db', () => ({
  getPreference: vi.fn(),
  revokeHubEntitlement: vi.fn(),
  setPreference: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  getAdapter: vi.fn(),
}));

vi.mock('@/lib/entitlements', () => ({
  getStoredEntitlement: vi.fn(),
  saveEntitlement: vi.fn(),
}));

vi.mock('@/lib/access/provisioning', () => ({
  runSelfHostAccessProvisioning: vi.fn(),
  runSelfHostAccessRevocation: vi.fn(),
}));

vi.mock('@/lib/billing/entitlement-issuer', () => ({
  parseBillingWebhookPayload: vi.fn(),
  deriveEntitlementFromBillingEvent: vi.fn(),
  issueSignedEntitlement: vi.fn(),
}));

const ORIGINAL_ENV = { ...process.env };

function createSignatureHeader(
  payload: string,
  secret: string,
  timestamp = Math.floor(Date.now() / 1000),
): string {
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

function requestWithBody(rawBody: string, opts?: { signatureHeader?: string }) {
  return {
    text: vi.fn().mockResolvedValue(rawBody),
    headers: new Headers(
      opts?.signatureHeader ? { 'stripe-signature': opts.signatureHeader } : undefined,
    ),
    nextUrl: new URL('http://localhost/api/webhooks/billing'),
  } as any;
}

describe('POST /api/webhooks/billing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
    process.env.MYLIFE_ENTITLEMENT_SECRET = 'signing-secret';

    vi.mocked(getAdapter).mockReturnValue({ id: 'db-adapter' } as any);
    vi.mocked(getPreference).mockReturnValue(null);
    vi.mocked(getStoredEntitlement).mockReturnValue(null);
    vi.mocked(saveEntitlement).mockResolvedValue({ ok: true } as any);
    vi.mocked(runSelfHostAccessProvisioning).mockResolvedValue(null as any);
    vi.mocked(runSelfHostAccessRevocation).mockResolvedValue(null as any);
    vi.mocked(parseBillingWebhookPayload).mockReturnValue({
      ok: true,
      data: {
        eventId: 'evt_123',
        eventType: BILLING_EVENT_TYPES.purchaseCreated,
        sku: BILLING_SKUS.hostedMonthly,
        appId: 'mylife',
        features: ['books'],
      },
    } as any);
    vi.mocked(deriveEntitlementFromBillingEvent).mockReturnValue({
      appId: 'mylife',
      mode: 'hosted',
      hostedActive: true,
      selfHostLicense: false,
      features: ['books'],
      issuedAt: '2026-03-09T00:00:00.000Z',
      expiresAt: null,
    } as any);
    vi.mocked(issueSignedEntitlement).mockResolvedValue({
      token: 'signed-token',
      entitlements: {
        appId: 'mylife',
        mode: 'hosted',
        hostedActive: true,
        selfHostLicense: false,
        features: ['books'],
      },
    } as any);
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('returns 500 when required secrets are missing', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;

    const response = await POST(requestWithBody('{}'));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Required secrets not configured.',
    });
  });

  it('returns 401 for missing or invalid signatures', async () => {
    const response = await POST(requestWithBody('{}'));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid webhook signature.',
    });
  });

  it('returns 400 for invalid JSON after signature verification', async () => {
    const rawBody = '{not-json';
    const response = await POST(requestWithBody(rawBody, {
      signatureHeader: createSignatureHeader(rawBody, 'whsec_test_secret'),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid JSON body.',
    });
  });

  it('returns 400 when the parsed payload is invalid', async () => {
    vi.mocked(parseBillingWebhookPayload).mockReturnValue({
      ok: false,
      error: 'eventId is required.',
    } as any);
    const rawBody = JSON.stringify({ eventType: 'purchase.created' });

    const response = await POST(requestWithBody(rawBody, {
      signatureHeader: createSignatureHeader(rawBody, 'whsec_test_secret'),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'eventId is required.',
    });
  });

  it('processes a valid signed webhook request', async () => {
    const rawBody = JSON.stringify({
      eventId: 'evt_123',
      eventType: 'purchase.created',
      sku: 'mylife_hosted_monthly_v1',
      appId: 'mylife',
      features: ['books'],
    });

    const response = await POST(requestWithBody(rawBody, {
      signatureHeader: createSignatureHeader(rawBody, 'whsec_test_secret'),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      idempotent: false,
      eventId: 'evt_123',
      entitlements: {
        appId: 'mylife',
        mode: 'hosted',
        hostedActive: true,
      },
    });

    expect(saveEntitlement).toHaveBeenCalledWith('signed-token', expect.any(Object));
    expect(setPreference).toHaveBeenCalledWith(
      { id: 'db-adapter' },
      'billing_event:evt_123',
      expect.any(String),
    );
  });
});
