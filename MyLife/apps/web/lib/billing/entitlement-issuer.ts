import {
  BILLING_EVENT_TYPES,
  BILLING_SKUS,
  SKU_ENTITLEMENT_DEFAULTS,
  type BillingEventType,
  type BillingSku,
} from '@mylife/billing-config';
import {
  type Entitlements,
  type PlanMode,
  type UnsignedEntitlements,
} from '@mylife/entitlements';
import { createEntitlementSignature } from '@mylife/entitlements/server';

export interface IssueEntitlementInput {
  appId: string;
  mode: PlanMode;
  hostedActive: boolean;
  selfHostLicense: boolean;
  updatePackYear?: number;
  features?: string[];
  issuedAt?: string;
  expiresAt?: string;
}

export interface BillingWebhookPayload {
  eventId: string;
  eventType: BillingEventType;
  sku: BillingSku;
  appId: string;
  features?: string[];
  expiresAt?: string;
  issuedAt?: string;
  customerEmail?: string;
  githubUsername?: string;
  customerId?: string;
  bundleId?: string;
}

export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const MODE_VALUES = new Set<PlanMode>(['hosted', 'self_host', 'local_only']);
const SKU_VALUES = new Set<BillingSku>(Object.values(BILLING_SKUS));
const EVENT_TYPE_VALUES = new Set<BillingEventType>(Object.values(BILLING_EVENT_TYPES));

function isHostedBillingSku(sku: BillingSku): boolean {
  return SKU_ENTITLEMENT_DEFAULTS[sku].modeDefault === 'hosted';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isIsoDateString(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parsed = Date.parse(value);
  return !Number.isNaN(parsed);
}

function dedupeFeatures(features: string[]): string[] {
  return [...new Set(features)];
}

function parseFeatures(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return undefined;
  if (!value.every((item) => typeof item === 'string')) return undefined;
  return value;
}

function parseOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function parseIssueEntitlementInput(value: unknown): ParseResult<IssueEntitlementInput> {
  if (!isRecord(value)) {
    return { ok: false, error: 'Body must be an object.' };
  }

  const {
    appId,
    mode,
    hostedActive,
    selfHostLicense,
    updatePackYear,
    features,
    issuedAt,
    expiresAt,
  } = value;

  if (typeof appId !== 'string' || appId.length === 0) {
    return { ok: false, error: 'appId is required.' };
  }

  if (typeof mode !== 'string' || !MODE_VALUES.has(mode as PlanMode)) {
    return { ok: false, error: 'mode must be hosted, self_host, or local_only.' };
  }

  if (typeof hostedActive !== 'boolean') {
    return { ok: false, error: 'hostedActive must be boolean.' };
  }

  if (typeof selfHostLicense !== 'boolean') {
    return { ok: false, error: 'selfHostLicense must be boolean.' };
  }

  if (updatePackYear !== undefined) {
    if (
      typeof updatePackYear !== 'number'
      || !Number.isInteger(updatePackYear)
      || updatePackYear < 2000
      || updatePackYear > 9999
    ) {
      return { ok: false, error: 'updatePackYear must be a valid year.' };
    }
  }

  const parsedFeatures = parseFeatures(features);
  if (features !== undefined && !parsedFeatures) {
    return { ok: false, error: 'features must be an array of strings.' };
  }

  if (issuedAt !== undefined && !isIsoDateString(issuedAt)) {
    return { ok: false, error: 'issuedAt must be an ISO datetime string.' };
  }

  if (expiresAt !== undefined && !isIsoDateString(expiresAt)) {
    return { ok: false, error: 'expiresAt must be an ISO datetime string.' };
  }

  return {
    ok: true,
    data: {
      appId,
      mode: mode as PlanMode,
      hostedActive,
      selfHostLicense,
      updatePackYear: updatePackYear as number | undefined,
      features: parsedFeatures,
      issuedAt: issuedAt as string | undefined,
      expiresAt: expiresAt as string | undefined,
    },
  };
}

export function parseBillingWebhookPayload(value: unknown): ParseResult<BillingWebhookPayload> {
  if (!isRecord(value)) {
    return { ok: false, error: 'Body must be an object.' };
  }

  const {
    eventId,
    eventType,
    sku,
    appId,
    features,
    expiresAt,
    issuedAt,
    customerEmail,
    githubUsername,
    customerId,
    bundleId,
    metadata,
  } = value;

  if (typeof eventId !== 'string' || eventId.length === 0) {
    return { ok: false, error: 'eventId is required.' };
  }

  if (typeof eventType !== 'string' || !EVENT_TYPE_VALUES.has(eventType as BillingEventType)) {
    return { ok: false, error: 'eventType is invalid.' };
  }

  if (typeof sku !== 'string' || !SKU_VALUES.has(sku as BillingSku)) {
    return { ok: false, error: 'sku is invalid.' };
  }

  const parsedFeatures = parseFeatures(features);
  if (features !== undefined && !parsedFeatures) {
    return { ok: false, error: 'features must be an array of strings.' };
  }

  if (expiresAt !== undefined && !isIsoDateString(expiresAt)) {
    return { ok: false, error: 'expiresAt must be an ISO datetime string.' };
  }

  if (issuedAt !== undefined && !isIsoDateString(issuedAt)) {
    return { ok: false, error: 'issuedAt must be an ISO datetime string.' };
  }

  const resolvedAppId = typeof appId === 'string' && appId.length > 0 ? appId : 'mylife';
  const metadataRecord = isRecord(metadata) ? metadata : undefined;

  return {
    ok: true,
    data: {
      eventId,
      eventType: eventType as BillingEventType,
      sku: sku as BillingSku,
      appId: resolvedAppId,
      features: parsedFeatures,
      expiresAt: expiresAt as string | undefined,
      issuedAt: issuedAt as string | undefined,
      customerEmail:
        parseOptionalString(customerEmail)
        ?? parseOptionalString(metadataRecord?.customerEmail)
        ?? parseOptionalString(metadataRecord?.email),
      githubUsername:
        parseOptionalString(githubUsername)
        ?? parseOptionalString(metadataRecord?.githubUsername)
        ?? parseOptionalString(metadataRecord?.github),
      customerId:
        parseOptionalString(customerId)
        ?? parseOptionalString(metadataRecord?.customerId)
        ?? parseOptionalString(metadataRecord?.buyerId),
      bundleId:
        parseOptionalString(bundleId)
        ?? parseOptionalString(metadataRecord?.bundleId),
    },
  };
}

function resolveModeAfterFallback(
  mode: PlanMode,
  hostedActive: boolean,
  selfHostLicense: boolean,
): PlanMode {
  if (mode === 'hosted' && !hostedActive) {
    return selfHostLicense ? 'self_host' : 'local_only';
  }
  if (mode === 'self_host' && !selfHostLicense) {
    return hostedActive ? 'hosted' : 'local_only';
  }
  return mode;
}

export function deriveEntitlementFromBillingEvent(
  payload: BillingWebhookPayload,
  current: Entitlements | null,
): UnsignedEntitlements {
  const defaults = SKU_ENTITLEMENT_DEFAULTS[payload.sku];

  let mode: PlanMode = current?.mode ?? 'local_only';
  let hostedActive = current?.hostedActive ?? false;
  let selfHostLicense = current?.selfHostLicense ?? false;
  let updatePackYear = current?.updatePackYear;
  let expiresAt = current?.expiresAt;

  const features = dedupeFeatures([
    ...(current?.features ?? []),
    ...(defaults.featuresDefault ?? []),
    ...(payload.features ?? []),
  ]);

  const activates = payload.eventType === BILLING_EVENT_TYPES.purchaseCreated
    || payload.eventType === BILLING_EVENT_TYPES.purchaseRenewed;

  if (activates) {
    if (defaults.modeDefault !== 'unchanged') {
      mode = defaults.modeDefault;
    }

    if (isHostedBillingSku(payload.sku)) {
      hostedActive = true;
      if (payload.expiresAt) expiresAt = payload.expiresAt;
    }

    if (payload.sku === BILLING_SKUS.selfHostLifetime) {
      selfHostLicense = true;
    }

    if (defaults.updatePackYear) {
      updatePackYear = Math.max(updatePackYear ?? 0, defaults.updatePackYear);
    }
  } else {
    if (isHostedBillingSku(payload.sku)) {
      hostedActive = false;
      expiresAt = undefined;
    }

    if (payload.sku === BILLING_SKUS.selfHostLifetime) {
      selfHostLicense = false;
    }

    if (payload.sku === BILLING_SKUS.updatePack2026 && updatePackYear === 2026) {
      updatePackYear = undefined;
    }
  }

  mode = resolveModeAfterFallback(mode, hostedActive, selfHostLicense);

  return {
    appId: payload.appId,
    mode,
    hostedActive,
    selfHostLicense,
    updatePackYear,
    features,
    issuedAt: payload.issuedAt ?? new Date().toISOString(),
    expiresAt,
  };
}

export async function issueSignedEntitlement(
  input: IssueEntitlementInput,
  secret: string,
): Promise<{ token: string; entitlements: Entitlements }> {
  const unsignedPayload: UnsignedEntitlements = {
    appId: input.appId,
    mode: input.mode,
    hostedActive: input.hostedActive,
    selfHostLicense: input.selfHostLicense,
    updatePackYear: input.updatePackYear,
    features: dedupeFeatures(input.features ?? []),
    issuedAt: input.issuedAt ?? new Date().toISOString(),
    expiresAt: input.expiresAt,
  };

  const signature = await createEntitlementSignature(unsignedPayload, secret);
  const entitlements: Entitlements = {
    ...unsignedPayload,
    signature,
  };

  // Raw token payload is persisted locally and returned to clients.
  const token = JSON.stringify(entitlements);

  return {
    token,
    entitlements,
  };
}
