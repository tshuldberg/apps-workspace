import { NextRequest, NextResponse } from 'next/server';
import { BILLING_EVENT_TYPES, BILLING_SKUS } from '@mylife/billing-config';
import { getPreference, revokeHubEntitlement, setPreference } from '@mylife/db';
import { getAdapter } from '@/lib/db';
import { getStoredEntitlement, saveEntitlement } from '@/lib/entitlements';
import {
  runSelfHostAccessProvisioning,
  runSelfHostAccessRevocation,
} from '@/lib/access/provisioning';
import {
  parseBillingWebhookPayload,
  deriveEntitlementFromBillingEvent,
  issueSignedEntitlement,
} from '@/lib/billing/entitlement-issuer';
import { verifyStripeWebhookSignature } from '@/lib/billing/webhook-signature';
import { requireEnvVar } from '@/lib/env-guard';

export const runtime = 'nodejs';

function idempotencyKey(eventId: string): string {
  return `billing_event:${eventId}`;
}

export async function POST(request: NextRequest) {
  let webhookSecret: string;
  let signingSecret: string;
  try {
    webhookSecret = requireEnvVar('STRIPE_WEBHOOK_SECRET');
    signingSecret = requireEnvVar('MYLIFE_ENTITLEMENT_SECRET');
  } catch {
    return NextResponse.json({ error: 'Required secrets not configured.' }, { status: 500 });
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const signatureCheck = verifyStripeWebhookSignature({
    payload: rawBody,
    signatureHeader: request.headers.get('stripe-signature'),
    secret: webhookSecret,
  });
  if (!signatureCheck.ok) {
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = parseBillingWebhookPayload(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const db = getAdapter();
  const eventKey = idempotencyKey(parsed.data.eventId);
  const alreadyProcessed = getPreference(db, eventKey);
  if (alreadyProcessed) {
    return NextResponse.json({
      ok: true,
      idempotent: true,
      eventId: parsed.data.eventId,
    });
  }

  const current = getStoredEntitlement();

  if (
    parsed.data.sku === BILLING_SKUS.selfHostLifetime
    && (
      parsed.data.eventType === BILLING_EVENT_TYPES.purchaseRefunded
      || parsed.data.eventType === BILLING_EVENT_TYPES.purchaseDisputed
    )
    && current?.signature
  ) {
    revokeHubEntitlement(
      db,
      current.signature,
      `billing:${parsed.data.eventType}`,
      parsed.data.eventId,
    );
  }

  const nextUnsigned = deriveEntitlementFromBillingEvent(parsed.data, current);

  const issued = await issueSignedEntitlement(
    {
      appId: nextUnsigned.appId,
      mode: nextUnsigned.mode,
      hostedActive: nextUnsigned.hostedActive,
      selfHostLicense: nextUnsigned.selfHostLicense,
      updatePackYear: nextUnsigned.updatePackYear,
      features: nextUnsigned.features,
      issuedAt: nextUnsigned.issuedAt,
      expiresAt: nextUnsigned.expiresAt,
    },
    signingSecret,
  );

  const saveResult = await saveEntitlement(issued.token, issued.entitlements);
  if (!saveResult.ok) {
    return NextResponse.json(
      { error: 'Failed to persist entitlement.', reason: saveResult.reason },
      { status: 500 },
    );
  }

  setPreference(db, eventKey, new Date().toISOString());

  const provisioning = await runSelfHostAccessProvisioning(db, {
    ...parsed.data,
    requestBaseUrl: request.nextUrl.origin,
  });

  const accessRevocation = await runSelfHostAccessRevocation(db, {
    ...parsed.data,
    requestBaseUrl: request.nextUrl.origin,
  });

  return NextResponse.json({
    ok: true,
    idempotent: false,
    eventId: parsed.data.eventId,
    entitlements: issued.entitlements,
    provisioning: provisioning ?? undefined,
    accessRevocation: accessRevocation ?? undefined,
  });
}
