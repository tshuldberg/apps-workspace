import crypto from 'node:crypto';
import { expect, test } from '@playwright/test';
import { BILLING_EVENT_TYPES, BILLING_SKUS } from '@mylife/billing-config';
import { issueActorIdentityToken } from '../lib/actor-identity';

// Must match webServer.env in playwright.config.ts so minted tokens verify
// against the server. Production strict mode rejects tokenless userId calls.
process.env.MYLIFE_ENTITLEMENT_SECRET ??= 'mylife-e2e-entitlement-secret';

function createSignatureHeader(
  payload: string,
  secret: string,
  timestamp = Math.floor(Date.now() / 1000),
) {
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

test.describe('API auth and data pipelines', () => {
  test('entitlement issuance/webhook/sync pipeline enforces auth and returns expected data', async ({ request }) => {
    const issueWithoutKey = await request.post('/api/entitlements/issue', {
      data: {
        appId: 'mylife',
        mode: 'hosted',
        hostedActive: true,
        selfHostLicense: false,
      },
    });
    expect(issueWithoutKey.status()).toBe(401);

    const issueWithKey = await request.post('/api/entitlements/issue', {
      headers: {
        'x-entitlement-issuer-key': 'mylife-e2e-issuer-key',
      },
      data: {
        appId: 'mylife',
        mode: 'hosted',
        hostedActive: true,
        selfHostLicense: false,
        features: ['books', 'sharing'],
      },
    });
    expect(issueWithKey.status()).toBe(200);
    const issuedBody = await issueWithKey.json();
    expect(typeof issuedBody.token).toBe('string');
    expect(issuedBody.entitlements.hostedActive).toBe(true);

    const syncWithoutKey = await request.get('/api/entitlements/sync');
    expect(syncWithoutKey.status()).toBe(401);

    const syncBeforeWebhook = await request.get('/api/entitlements/sync', {
      headers: {
        'x-entitlement-sync-key': 'mylife-e2e-sync-key',
      },
    });
    expect(syncBeforeWebhook.status()).toBe(404);

    const webhookWithoutKey = await request.post('/api/webhooks/billing', {
      data: {
        eventId: `e2e-missing-key-${Date.now()}`,
        eventType: BILLING_EVENT_TYPES.purchaseCreated,
        sku: BILLING_SKUS.hostedMonthly,
      },
    });
    expect(webhookWithoutKey.status()).toBe(401);

    const webhookPayload = {
      eventId: `e2e-webhook-${Date.now()}`,
      eventType: BILLING_EVENT_TYPES.purchaseCreated,
      sku: BILLING_SKUS.hostedMonthly,
      appId: 'mylife',
      features: ['books', 'sharing'],
    };
    const webhookRawBody = JSON.stringify(webhookPayload);

    const webhookWithKey = await request.post('/api/webhooks/billing', {
      headers: {
        'content-type': 'application/json',
        'stripe-signature': createSignatureHeader(
          webhookRawBody,
          'mylife-e2e-webhook-secret',
          Math.floor(Date.now() / 1000),
        ),
      },
      data: webhookRawBody,
    });
    expect(webhookWithKey.status()).toBe(200);
    const webhookBody = await webhookWithKey.json();
    expect(webhookBody.ok).toBe(true);

    const syncAfterWebhook = await request.get('/api/entitlements/sync', {
      headers: {
        'x-entitlement-sync-key': 'mylife-e2e-sync-key',
      },
    });
    expect(syncAfterWebhook.status()).toBe(200);
    const syncedBody = await syncAfterWebhook.json();
    expect(syncedBody.entitlements.hostedActive).toBe(true);
    expect(syncedBody.entitlements.features).toContain('books');
  });

  test('social share and friend invite endpoints require identity and persist relationships', async ({ request }) => {
    const aliceToken = issueActorIdentityToken('api-alice');
    const bobToken = issueActorIdentityToken('api-bob');
    if (!aliceToken || !bobToken) throw new Error('failed to mint actor identity tokens');
    const aliceHeaders = { 'x-actor-identity-token': aliceToken };
    const bobHeaders = { 'x-actor-identity-token': bobToken };
    const missingIdentityShare = await request.post('/api/share/events', {
      data: {
        objectType: 'generic',
        objectId: 'api-e2e-book',
        visibility: 'friends',
      },
    });
    expect(missingIdentityShare.status()).toBe(400);

    const invalidIdentityShare = await request.post('/api/share/events', {
      data: {
        actorToken: 'invalid.token.value',
        actorUserId: 'api-alice',
        objectType: 'generic',
        objectId: 'api-e2e-book',
        visibility: 'friends',
      },
    });
    expect(invalidIdentityShare.status()).toBe(401);

    const createShare = await request.post('/api/share/events', {
      headers: aliceHeaders,
      data: {
        actorUserId: 'api-alice',
        objectType: 'generic',
        objectId: 'api-e2e-book',
        visibility: 'friends',
        payload: { note: 'E2E API share test' },
      },
    });
    expect(createShare.status()).toBe(201);
    const createdShareBody = await createShare.json();
    expect(createdShareBody.item.actorUserId).toBe('api-alice');

    const listShare = await request.get('/api/share/events?viewerUserId=api-alice&objectId=api-e2e-book', { headers: aliceHeaders });
    expect(listShare.status()).toBe(200);
    const listShareBody = await listShare.json();
    expect(listShareBody.items.length).toBeGreaterThan(0);

    const createInvite = await request.post('/api/friends/invites', {
      headers: aliceHeaders,
      data: {
        fromUserId: 'api-alice',
        toUserId: 'api-bob',
        message: 'hello from api test',
      },
    });
    expect(createInvite.status()).toBe(201);
    const inviteBody = await createInvite.json();
    const inviteId = inviteBody.invite.id as string;
    expect(inviteBody.invite.status).toBe('pending');

    const incomingBeforeAccept = await request.get('/api/friends/invites?userId=api-bob&direction=incoming', { headers: bobHeaders });
    expect(incomingBeforeAccept.status()).toBe(200);
    const incomingBody = await incomingBeforeAccept.json();
    expect(incomingBody.incoming.some((invite: { id: string }) => invite.id === inviteId)).toBe(true);

    const acceptInvite = await request.post(`/api/friends/invites/${inviteId}/accept`, {
      headers: bobHeaders,
      data: {
        actorUserId: 'api-bob',
      },
    });
    expect(acceptInvite.status()).toBe(200);

    const aliceFriends = await request.get('/api/friends?userId=api-alice', { headers: aliceHeaders });
    expect(aliceFriends.status()).toBe(200);
    const aliceFriendsBody = await aliceFriends.json();
    expect(
      aliceFriendsBody.friends.some(
        (friend: { friendUserId: string; status: string }) =>
          friend.friendUserId === 'api-bob' && friend.status === 'accepted',
      ),
    ).toBe(true);
  });
});
