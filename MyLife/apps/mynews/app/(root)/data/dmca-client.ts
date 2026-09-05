import {
  DMCA_ATTESTATION_VERSION,
  DMCA_COUNTER_JURISDICTION_ATTESTATION_TEXT,
  DMCA_COUNTER_MISTAKE_ATTESTATION_TEXT,
  DMCA_COUNTER_SERVICE_ATTESTATION_TEXT,
  validateDmcaCounterNotice,
  type DmcaErrorCode,
} from '@mylife/mynews';
import type { MyNewsCloudConfig } from './launch-environment';

// In-app DMCA counter-notice client (Plan 48 WP2 G3). The poster is a
// signed-in user, so the submission rides the authenticated path of the
// mynews-dmca function: rate-limited per account server-side, no IP signal
// collected. Every element of 512(g)(3) is validated locally with the same
// zod schema the server twin enforces, so an incomplete form never leaves the
// device. Nothing is simulated: the typed envelope drives every state.

export interface DmcaCounterFormFields {
  counterNotifierName: string;
  counterNotifierAddress: string;
  counterNotifierPhone: string;
  counterNotifierEmail: string;
  removedMaterial: string;
  materialLocationBeforeRemoval: string;
  originalNoticeReference: string;
  goodFaithMistakeOrMisidentification: boolean;
  statementUnderPenaltyOfPerjury: boolean;
  consentToFederalJurisdiction: boolean;
  acceptanceOfServiceOfProcess: boolean;
  signature: string;
}

export type DmcaCounterSubmitResult =
  | {
      ok: true;
      referenceId: string;
      resolutionStatus: 'resolved' | 'needs-resolution';
      originalNoticeMatched: boolean;
    }
  | { ok: false; code: DmcaErrorCode; issue?: string };

/**
 * Builds the exact wire payload the mynews-dmca function expects, pinning the
 * current attestation texts and version. Returns a typed validation failure
 * (never throws) when a statutory element is missing.
 */
export function buildCounterNoticePayload(
  fields: DmcaCounterFormFields,
): { ok: true; payload: Record<string, unknown> } | { ok: false; issue: string } {
  const candidate = {
    kind: 'counter' as const,
    originalNoticeReference: fields.originalNoticeReference.trim(),
    counterNotifierName: fields.counterNotifierName.trim(),
    counterNotifierAddress: fields.counterNotifierAddress.trim(),
    counterNotifierPhone: fields.counterNotifierPhone.trim(),
    counterNotifierEmail: fields.counterNotifierEmail.trim(),
    removedMaterial: fields.removedMaterial.trim(),
    materialLocationBeforeRemoval: fields.materialLocationBeforeRemoval.trim(),
    goodFaithMistakeOrMisidentification: fields.goodFaithMistakeOrMisidentification,
    statementUnderPenaltyOfPerjury: fields.statementUnderPenaltyOfPerjury,
    mistakeAttestationText: DMCA_COUNTER_MISTAKE_ATTESTATION_TEXT,
    mistakeAttestationVersion: DMCA_ATTESTATION_VERSION,
    consentToFederalJurisdiction: fields.consentToFederalJurisdiction,
    jurisdictionAttestationText: DMCA_COUNTER_JURISDICTION_ATTESTATION_TEXT,
    jurisdictionAttestationVersion: DMCA_ATTESTATION_VERSION,
    acceptanceOfServiceOfProcess: fields.acceptanceOfServiceOfProcess,
    serviceAttestationText: DMCA_COUNTER_SERVICE_ATTESTATION_TEXT,
    serviceAttestationVersion: DMCA_ATTESTATION_VERSION,
    signature: fields.signature.trim(),
  };
  const validation = validateDmcaCounterNotice(candidate);
  if (!validation.ok) return { ok: false, issue: validation.issue };
  return { ok: true, payload: candidate };
}

function dmcaFunctionsUrl(config: MyNewsCloudConfig): string {
  return config.functionsUrl ?? `${config.baseUrl}/functions/v1`;
}

function codeForStatus(status: number): DmcaErrorCode {
  if (status === 400) return 'validation';
  if (status === 429) return 'rate-limited';
  if (status === 503) return 'temporarily-unavailable';
  return 'unknown';
}

export async function submitDmcaCounterNotice(
  config: MyNewsCloudConfig,
  accessToken: string,
  fields: DmcaCounterFormFields,
  send: typeof fetch = fetch,
): Promise<DmcaCounterSubmitResult> {
  const built = buildCounterNoticePayload(fields);
  if (!built.ok) return { ok: false, code: 'validation', issue: built.issue };

  let response: Response;
  try {
    response = await send(`${dmcaFunctionsUrl(config)}/mynews-dmca`, {
      method: 'POST',
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(built.payload),
    });
  } catch {
    return { ok: false, code: 'network' };
  }

  let parsed: {
    data?: {
      status?: string;
      referenceId?: string;
      resolutionStatus?: string;
      originalNoticeMatched?: boolean;
    };
  } | null = null;
  try {
    parsed = await response.json();
  } catch {
    parsed = null;
  }

  if (!response.ok) return { ok: false, code: codeForStatus(response.status) };

  const data = parsed?.data;
  if (
    data?.status !== 'queued' ||
    typeof data.referenceId !== 'string' ||
    data.referenceId.length === 0 ||
    (data.resolutionStatus !== 'resolved' && data.resolutionStatus !== 'needs-resolution')
  ) {
    // A 200 that cannot prove queueing is treated as failure, never success.
    return { ok: false, code: 'unknown' };
  }
  return {
    ok: true,
    referenceId: data.referenceId,
    resolutionStatus: data.resolutionStatus,
    originalNoticeMatched: data.originalNoticeMatched === true,
  };
}
