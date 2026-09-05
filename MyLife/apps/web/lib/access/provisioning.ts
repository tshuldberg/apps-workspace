import type { DatabaseAdapter } from '@mylife/db';
import { BILLING_EVENT_TYPES, BILLING_SKUS, type BillingEventType } from '@mylife/billing-config';
import { grantGitHubSelfHostAccess, revokeGitHubSelfHostAccess } from './github';
import { issueSignedBundleDownloadUrl } from './bundle';
import {
  markAccessJobCompleted,
  scheduleAccessJobRetry,
  type AccessJob,
} from './jobs';

export interface ProvisioningInput {
  eventId: string;
  eventType: BillingEventType;
  sku: string;
  appId: string;
  customerEmail?: string;
  githubUsername?: string;
  customerId?: string;
  bundleId?: string;
  requestBaseUrl?: string;
}

export interface SelfHostAccessProvisioningResult {
  github: {
    status: 'granted' | 'invited' | 'queued' | 'skipped' | 'disabled' | 'failed';
    detail?: string;
    job?: AccessJob;
  };
  bundle: {
    status: 'issued' | 'skipped' | 'failed';
    url?: string;
    expiresAt?: string;
    reason?: string;
  };
}

function isActivationEvent(eventType: BillingEventType): boolean {
  return eventType === BILLING_EVENT_TYPES.purchaseCreated
    || eventType === BILLING_EVENT_TYPES.purchaseRenewed;
}

function isRevocationEvent(eventType: BillingEventType): boolean {
  return eventType === BILLING_EVENT_TYPES.purchaseRefunded
    || eventType === BILLING_EVENT_TYPES.purchaseDisputed;
}

function resolvePurchaserRef(input: ProvisioningInput): string | undefined {
  return input.customerEmail ?? input.customerId;
}

export async function runSelfHostAccessProvisioning(
  db: DatabaseAdapter,
  input: ProvisioningInput,
): Promise<SelfHostAccessProvisioningResult | null> {
  if (input.sku !== BILLING_SKUS.selfHostLifetime) {
    return null;
  }

  if (!isActivationEvent(input.eventType)) {
    return null;
  }

  const bundleResult = issueSignedBundleDownloadUrl({
    bundleId: input.bundleId ?? process.env.MYLIFE_SELF_HOST_BUNDLE_ID ?? 'self-host-v1',
    eventId: input.eventId,
    purchaserRef: resolvePurchaserRef(input),
    requestBaseUrl: input.requestBaseUrl,
    expiresInSeconds: Number(process.env.MYLIFE_BUNDLE_LINK_TTL_SECONDS ?? 60 * 60 * 24 * 14),
  });

  const bundle = bundleResult.ok
    ? {
        status: 'issued' as const,
        url: bundleResult.url,
        expiresAt: bundleResult.expiresAt,
      }
    : {
        status: 'failed' as const,
        reason: bundleResult.reason,
      };

  const githubResponse = await grantGitHubSelfHostAccess({
    githubUsername: input.githubUsername,
    email: input.customerEmail,
  }).catch((error: unknown) => ({
    ok: false as const,
    status: 'failed' as const,
    detail: error instanceof Error ? error.message : 'Unknown GitHub automation exception.',
  }));

  if (githubResponse.ok) {
    markAccessJobCompleted(db, input.eventId);

    return {
      github: {
        status: githubResponse.status === 'invited' ? 'invited' : 'granted',
        detail: githubResponse.detail,
      },
      bundle,
    };
  }

  if (githubResponse.status === 'disabled') {
    return {
      github: {
        status: 'disabled',
        detail: githubResponse.detail,
      },
      bundle,
    };
  }

  if (!input.githubUsername && !input.customerEmail) {
    return {
      github: {
        status: 'skipped',
        detail: 'No GitHub username or customer email supplied in billing event.',
      },
      bundle,
    };
  }

  const job = scheduleAccessJobRetry(
    db,
    input.eventId,
    githubResponse.detail ?? 'Unknown GitHub automation failure.',
    {
      sku: input.sku,
      appId: input.appId,
      customerEmail: input.customerEmail,
      githubUsername: input.githubUsername,
    },
  );

  return {
    github: {
      status: 'queued',
      detail: githubResponse.detail,
      job,
    },
    bundle,
  };
}

export async function runSelfHostAccessRevocation(
  db: DatabaseAdapter,
  input: ProvisioningInput,
): Promise<{ status: 'revoked' | 'skipped' | 'failed'; detail?: string } | null> {
  if (input.sku !== BILLING_SKUS.selfHostLifetime) {
    return null;
  }

  if (!isRevocationEvent(input.eventType)) {
    return null;
  }

  if (!input.githubUsername) {
    return {
      status: 'skipped',
      detail: 'No githubUsername was provided; skipping GitHub team removal.',
    };
  }

  const revoked = await revokeGitHubSelfHostAccess({
    githubUsername: input.githubUsername,
  }).catch((error: unknown) => ({
    ok: false as const,
    status: 'failed' as const,
    detail: error instanceof Error ? error.message : 'Unknown GitHub revoke exception.',
  }));

  if (!revoked.ok) {
    const job = scheduleAccessJobRetry(
      db,
      input.eventId,
      revoked.detail ?? 'Unknown GitHub revoke failure.',
      {
        sku: input.sku,
        appId: input.appId,
        customerEmail: input.customerEmail,
        githubUsername: input.githubUsername,
      },
    );

    return {
      status: job.status === 'alert' ? 'failed' : 'skipped',
      detail: revoked.detail,
    };
  }

  return {
    status: 'revoked',
    detail: revoked.detail,
  };
}
