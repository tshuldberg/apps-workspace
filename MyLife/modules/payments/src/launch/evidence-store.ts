import type {
  PaymentsLaunchHiddenStateAcknowledgement,
  PaymentsLaunchLegalReviewApproval,
  PaymentsLaunchPilotApproval,
  PaymentsLaunchReleaseEvidenceCapture,
  PaymentsLaunchReleaseOwnerSignoff,
  PaymentsLaunchSandboxProviderProfile,
  PaymentsLaunchTargetReleaseState,
} from './readiness';
import type { PaymentsAuditLogger } from '../ops/types';

export type PaymentsLaunchEvidenceKind =
  | 'legal_review'
  | 'pilot_approval'
  | 'release_owner_signoff'
  | 'hidden_state_acknowledgement';

export type PaymentsLaunchEvidencePayload =
  | PaymentsLaunchLegalReviewApproval
  | PaymentsLaunchPilotApproval
  | PaymentsLaunchReleaseOwnerSignoff
  | PaymentsLaunchHiddenStateAcknowledgement;

export type PaymentsLaunchEvidenceCaptureStatus =
  | 'captured'
  | 'idempotent_replay'
  | 'rejected';

export type PaymentsLaunchEvidenceCaptureErrorCode =
  | 'missing_required_field'
  | 'evidence_id_conflict'
  | 'idempotency_key_conflict'
  | 'operator_not_authorized'
  | 'payload_kind_mismatch'
  | 'payload_reference_mismatch'
  | 'reviewer_separation_required'
  | 'target_release_state_hidden'
  | 'hidden_state_not_acknowledged';

export type PaymentsLaunchEvidenceOperatorRole =
  | 'payments_ops'
  | 'payments_ops_lead'
  | 'legal_reviewer'
  | 'pilot_owner'
  | 'release_owner'
  | 'compliance_reviewer';

export interface PaymentsLaunchEvidenceOperatorIdentity {
  actorId: string;
  displayName?: string | null;
  email?: string | null;
  roles: PaymentsLaunchEvidenceOperatorRole[];
}

export type PaymentsLaunchEvidenceCaptureRejectionReasonId =
  | 'automated_evidence_timestamp_missing'
  | 'dual_control_reviewer_missing'
  | 'evidence_id_missing'
  | 'idempotency_key_missing'
  | 'operator_identity_missing'
  | 'operator_role_missing'
  | 'provider_profile_missing'
  | 'release_owner_separation_missing'
  | 'release_ticket_missing'
  | 'reviewer_role_missing'
  | 'reviewer_separation_missing'
  | 'target_release_state_hidden'
  | 'target_release_state_missing';

export interface PaymentsLaunchEvidenceCaptureRejectionReason {
  id: PaymentsLaunchEvidenceCaptureRejectionReasonId;
  label: string;
  evidence: string;
}

export interface BuildPaymentsLaunchEvidenceCaptureEligibilityInput {
  kind: PaymentsLaunchEvidenceKind;
  evidenceId?: string | null;
  idempotencyKey?: string | null;
  operatorIdentity?: PaymentsLaunchEvidenceOperatorIdentity | null;
  reviewerIdentity?: PaymentsLaunchEvidenceOperatorIdentity | null;
  providerProfile?: PaymentsLaunchSandboxProviderProfile | null;
  automatedEvidenceGeneratedAt?: string | Date | null;
  releaseTicketId?: string | null;
  targetReleaseState?: PaymentsLaunchTargetReleaseState | null;
  existingRecords?: PaymentsLaunchCapturedEvidenceRecord[];
}

export interface PaymentsLaunchEvidenceCaptureEligibility {
  kind: PaymentsLaunchEvidenceKind;
  kindLabel: string;
  eligible: boolean;
  statusLabel: 'Eligible' | 'Blocked';
  operatorLabel: string;
  reviewerLabel: string;
  requiredRoleLabels: string[];
  providerProfileLabel: string;
  automatedEvidenceLabel: string;
  releaseTicketLabel: string;
  targetReleaseStateLabel: string;
  idempotencyKeyLabel: string;
  rejectionReasons: PaymentsLaunchEvidenceCaptureRejectionReason[];
}

export interface PaymentsLaunchEvidenceImmutableReference {
  providerProfile: PaymentsLaunchSandboxProviderProfile;
  automatedEvidenceGeneratedAt: string;
  releaseTicketId: string;
  targetReleaseState: PaymentsLaunchTargetReleaseState;
}

export interface PaymentsLaunchCapturedEvidenceRecord {
  evidenceId: string;
  idempotencyKey: string;
  kind: PaymentsLaunchEvidenceKind;
  capturedAt: string;
  capturedBy: string;
  operatorIdentity: PaymentsLaunchEvidenceOperatorIdentity;
  reviewerIdentity: PaymentsLaunchEvidenceOperatorIdentity | null;
  immutableReference: PaymentsLaunchEvidenceImmutableReference;
  payload: PaymentsLaunchEvidencePayload;
  payloadFingerprint: string;
  auditEntryId: string | null;
}

export interface CapturePaymentsLaunchEvidenceInput {
  evidenceId: string;
  idempotencyKey: string;
  kind: PaymentsLaunchEvidenceKind;
  capturedAt: string | Date;
  operatorIdentity: PaymentsLaunchEvidenceOperatorIdentity;
  reviewerIdentity?: PaymentsLaunchEvidenceOperatorIdentity | null;
  providerProfile: PaymentsLaunchSandboxProviderProfile;
  automatedEvidenceGeneratedAt: string | Date;
  releaseTicketId: string;
  targetReleaseState: PaymentsLaunchTargetReleaseState;
  payload: PaymentsLaunchEvidencePayload;
}

export interface PaymentsLaunchEvidenceCaptureResult {
  status: PaymentsLaunchEvidenceCaptureStatus;
  record: PaymentsLaunchCapturedEvidenceRecord | null;
  errorCode: PaymentsLaunchEvidenceCaptureErrorCode | null;
  message: string;
}

export interface PaymentsLaunchEvidenceStoreListFilter {
  providerProfile?: PaymentsLaunchSandboxProviderProfile;
  automatedEvidenceGeneratedAt?: string | Date;
  releaseTicketId?: string;
  targetReleaseState?: PaymentsLaunchTargetReleaseState;
}

export interface PaymentsLaunchEvidenceStore {
  capture(
    input: CapturePaymentsLaunchEvidenceInput,
  ): Promise<PaymentsLaunchEvidenceCaptureResult>;
  get(evidenceId: string): PaymentsLaunchCapturedEvidenceRecord | null;
  list(
    filter?: PaymentsLaunchEvidenceStoreListFilter,
  ): PaymentsLaunchCapturedEvidenceRecord[];
}

interface NormalizedCaptureCommand {
  evidenceId: string;
  idempotencyKey: string;
  kind: PaymentsLaunchEvidenceKind;
  capturedAt: string;
  capturedBy: string;
  operatorIdentity: PaymentsLaunchEvidenceOperatorIdentity;
  reviewerIdentity: PaymentsLaunchEvidenceOperatorIdentity | null;
  immutableReference: PaymentsLaunchEvidenceImmutableReference;
  payload: PaymentsLaunchEvidencePayload;
  fingerprint: string;
}

function hasText(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function toIso(value: string | Date | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = value instanceof Date ? value : new Date(value);
  const time = parsed.getTime();
  if (Number.isNaN(time)) {
    return null;
  }

  return parsed.toISOString();
}

function uniqueSortedRoles(
  roles: PaymentsLaunchEvidenceOperatorRole[],
): PaymentsLaunchEvidenceOperatorRole[] {
  return [...new Set(roles)].sort();
}

function normalizeOperatorIdentity(
  identity: PaymentsLaunchEvidenceOperatorIdentity | null | undefined,
): PaymentsLaunchEvidenceOperatorIdentity | null {
  if (!identity || !hasText(identity.actorId)) {
    return null;
  }

  return {
    actorId: identity.actorId.trim(),
    displayName: hasText(identity.displayName)
      ? identity.displayName.trim()
      : null,
    email: hasText(identity.email) ? identity.email.trim() : null,
    roles: uniqueSortedRoles(identity.roles ?? []),
  };
}

function operatorLabel(
  identity: PaymentsLaunchEvidenceOperatorIdentity | null | undefined,
): string {
  const normalized = normalizeOperatorIdentity(identity);

  return normalized?.displayName ?? normalized?.email ?? normalized?.actorId ?? 'Missing';
}

function roleLabel(role: PaymentsLaunchEvidenceOperatorRole): string {
  if (role === 'payments_ops') {
    return 'Payments ops';
  }
  if (role === 'payments_ops_lead') {
    return 'Payments ops lead';
  }
  if (role === 'legal_reviewer') {
    return 'Legal reviewer';
  }
  if (role === 'pilot_owner') {
    return 'Pilot owner';
  }
  if (role === 'release_owner') {
    return 'Release owner';
  }
  return 'Compliance reviewer';
}

function launchEvidenceKindLabel(kind: PaymentsLaunchEvidenceKind): string {
  if (kind === 'legal_review') {
    return 'Legal review';
  }
  if (kind === 'pilot_approval') {
    return 'Pilot approval';
  }
  if (kind === 'release_owner_signoff') {
    return 'Release-owner signoff';
  }
  return 'Hidden-state acknowledgement';
}

function requiredRolesForKind(
  kind: PaymentsLaunchEvidenceKind,
): PaymentsLaunchEvidenceOperatorRole[] {
  if (kind === 'legal_review') {
    return ['legal_reviewer', 'compliance_reviewer'];
  }
  if (kind === 'pilot_approval') {
    return ['pilot_owner', 'payments_ops_lead'];
  }
  if (kind === 'release_owner_signoff') {
    return ['release_owner'];
  }
  return ['release_owner', 'payments_ops_lead'];
}

function hasAnyRole(
  identity: PaymentsLaunchEvidenceOperatorIdentity | null,
  roles: PaymentsLaunchEvidenceOperatorRole[],
): boolean {
  return Boolean(
    identity && roles.some((role) => identity.roles.includes(role)),
  );
}

function addRejectionReason(
  reasons: PaymentsLaunchEvidenceCaptureRejectionReason[],
  reason: PaymentsLaunchEvidenceCaptureRejectionReason,
): void {
  if (reasons.some((entry) => entry.id === reason.id)) {
    return;
  }

  reasons.push(reason);
}

function sameImmutableReference(
  record: PaymentsLaunchCapturedEvidenceRecord,
  reference: Partial<PaymentsLaunchEvidenceImmutableReference>,
): boolean {
  if (
    reference.providerProfile &&
    record.immutableReference.providerProfile !== reference.providerProfile
  ) {
    return false;
  }
  if (
    reference.automatedEvidenceGeneratedAt &&
    record.immutableReference.automatedEvidenceGeneratedAt !==
      reference.automatedEvidenceGeneratedAt
  ) {
    return false;
  }
  if (
    reference.releaseTicketId &&
    record.immutableReference.releaseTicketId !== reference.releaseTicketId
  ) {
    return false;
  }
  if (
    reference.targetReleaseState &&
    record.immutableReference.targetReleaseState !== reference.targetReleaseState
  ) {
    return false;
  }

  return true;
}

function errorCodeForEligibility(
  reasons: PaymentsLaunchEvidenceCaptureRejectionReason[],
): PaymentsLaunchEvidenceCaptureErrorCode {
  if (reasons.some((reason) => reason.id === 'target_release_state_hidden')) {
    return 'target_release_state_hidden';
  }
  if (
    reasons.some((reason) =>
      reason.id === 'operator_role_missing' ||
      reason.id === 'reviewer_role_missing'
    )
  ) {
    return 'operator_not_authorized';
  }
  if (
    reasons.some((reason) =>
      reason.id === 'dual_control_reviewer_missing' ||
      reason.id === 'release_owner_separation_missing' ||
      reason.id === 'reviewer_separation_missing'
    )
  ) {
    return 'reviewer_separation_required';
  }

  return 'missing_required_field';
}

function normalizeApprovalReference<TPayload extends PaymentsLaunchEvidencePayload>(
  payload: TPayload,
): TPayload {
  return {
    ...payload,
    approvedAt: toIso(payload.approvedAt) ?? payload.approvedAt,
    automatedEvidenceGeneratedAt:
      toIso(payload.automatedEvidenceGeneratedAt) ??
      payload.automatedEvidenceGeneratedAt,
  };
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }

  const objectValue = value as Record<string, unknown>;
  const keys = Object.keys(objectValue)
    .filter((key) => objectValue[key] !== undefined)
    .sort();

  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(objectValue[key])}`)
    .join(',')}}`;
}

function fingerprint(value: unknown): string {
  const source = stableStringify(value);
  let hash = 0x811c9dc5;

  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return `fnv1a_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function buildPaymentsLaunchEvidenceCaptureEligibility(
  input: BuildPaymentsLaunchEvidenceCaptureEligibilityInput,
): PaymentsLaunchEvidenceCaptureEligibility {
  const operatorIdentity = normalizeOperatorIdentity(input.operatorIdentity);
  const reviewerIdentity = normalizeOperatorIdentity(input.reviewerIdentity);
  const requiredRoles = requiredRolesForKind(input.kind);
  const automatedEvidenceGeneratedAt = toIso(
    input.automatedEvidenceGeneratedAt,
  );
  const releaseTicketId = hasText(input.releaseTicketId)
    ? input.releaseTicketId.trim()
    : null;
  const targetReleaseState = input.targetReleaseState ?? null;
  const reasons: PaymentsLaunchEvidenceCaptureRejectionReason[] = [];

  if (!hasText(input.evidenceId)) {
    addRejectionReason(reasons, {
      id: 'evidence_id_missing',
      label: 'Evidence id required',
      evidence:
        'Capture requires an immutable evidence id before the record can be stored.',
    });
  }

  if (!hasText(input.idempotencyKey)) {
    addRejectionReason(reasons, {
      id: 'idempotency_key_missing',
      label: 'Idempotency key required',
      evidence:
        'Capture requires a replay key so reconnects return the original immutable record.',
    });
  }

  if (!operatorIdentity) {
    addRejectionReason(reasons, {
      id: 'operator_identity_missing',
      label: 'Operator identity required',
      evidence:
        'Capture requires a structured operator actor id and role set.',
    });
  } else if (!hasAnyRole(operatorIdentity, requiredRoles)) {
    addRejectionReason(reasons, {
      id: 'operator_role_missing',
      label: 'Operator role not authorized',
      evidence: `${operatorLabel(operatorIdentity)} needs one of: ${requiredRoles.map(roleLabel).join(', ')}.`,
    });
  }

  if (!input.providerProfile) {
    addRejectionReason(reasons, {
      id: 'provider_profile_missing',
      label: 'Provider profile required',
      evidence:
        'Capture must name the current sandbox provider profile.',
    });
  }

  if (!automatedEvidenceGeneratedAt) {
    addRejectionReason(reasons, {
      id: 'automated_evidence_timestamp_missing',
      label: 'Automated evidence timestamp required',
      evidence:
        'Capture must reference the exact automated evidence timestamp from the launch packet.',
    });
  }

  if (!releaseTicketId) {
    addRejectionReason(reasons, {
      id: 'release_ticket_missing',
      label: 'Release ticket required',
      evidence:
        'Capture must bind approval evidence to a release ticket.',
    });
  }

  if (!targetReleaseState) {
    addRejectionReason(reasons, {
      id: 'target_release_state_missing',
      label: 'Target release state required',
      evidence:
        'Capture must declare the requested visible release state.',
    });
  } else if (targetReleaseState === 'hidden') {
    addRejectionReason(reasons, {
      id: 'target_release_state_hidden',
      label: 'Target release state cannot be hidden',
      evidence:
        'Captured release evidence must target a visible state while the registry flip remains separate.',
    });
  }

  if (
    input.kind === 'release_owner_signoff' &&
    operatorIdentity &&
    input.providerProfile &&
    automatedEvidenceGeneratedAt &&
    releaseTicketId &&
    targetReleaseState &&
    targetReleaseState !== 'hidden'
  ) {
    const providerProfile = input.providerProfile;
    const suppliedBySameActor = (input.existingRecords ?? []).filter(
      (record) =>
        (record.kind === 'legal_review' ||
          record.kind === 'pilot_approval') &&
        record.operatorIdentity.actorId === operatorIdentity.actorId &&
        sameImmutableReference(record, {
          providerProfile,
          automatedEvidenceGeneratedAt,
          releaseTicketId,
          targetReleaseState,
        }),
    );

    if (suppliedBySameActor.length > 0) {
      if (!reviewerIdentity) {
        addRejectionReason(reasons, {
          id: 'dual_control_reviewer_missing',
          label: 'Dual-control reviewer required',
          evidence:
            'Release-owner evidence needs a separate reviewer when the same actor captured legal or pilot evidence.',
        });
      } else if (reviewerIdentity.actorId === operatorIdentity.actorId) {
        addRejectionReason(reasons, {
          id: 'reviewer_separation_missing',
          label: 'Reviewer must be separate',
          evidence:
            'Dual-control reviewer identity must be a different actor than the release owner.',
        });
      } else if (
        !hasAnyRole(reviewerIdentity, [
          'payments_ops_lead',
          'compliance_reviewer',
        ])
      ) {
        addRejectionReason(reasons, {
          id: 'reviewer_role_missing',
          label: 'Reviewer role not authorized',
          evidence:
            'Dual-control reviewer must be a payments ops lead or compliance reviewer.',
        });
      }
    }
  }

  return {
    kind: input.kind,
    kindLabel: launchEvidenceKindLabel(input.kind),
    eligible: reasons.length === 0,
    statusLabel: reasons.length === 0 ? 'Eligible' : 'Blocked',
    operatorLabel: operatorLabel(operatorIdentity),
    reviewerLabel: operatorLabel(reviewerIdentity),
    requiredRoleLabels: requiredRoles.map(roleLabel),
    providerProfileLabel: input.providerProfile ?? 'Missing',
    automatedEvidenceLabel: automatedEvidenceGeneratedAt ?? 'Missing',
    releaseTicketLabel: releaseTicketId ?? 'Missing',
    targetReleaseStateLabel: targetReleaseState ?? 'Missing',
    idempotencyKeyLabel: hasText(input.idempotencyKey)
      ? input.idempotencyKey.trim()
      : 'Missing',
    rejectionReasons: reasons,
  };
}

function isPayloadKindMatch(
  kind: PaymentsLaunchEvidenceKind,
  payload: PaymentsLaunchEvidencePayload,
): boolean {
  if (kind === 'legal_review') {
    return 'copySetVersion' in payload || 'counselMatterId' in payload;
  }
  if (kind === 'pilot_approval') {
    return 'cohortId' in payload || 'monitoringPlanId' in payload;
  }
  if (kind === 'release_owner_signoff') {
    return (
      ('releaseTicketId' in payload || 'targetReleaseState' in payload) &&
      !('paymentsFeatureHiddenAcknowledged' in payload)
    );
  }
  return 'paymentsFeatureHiddenAcknowledged' in payload;
}

function validateCommand(
  input: CapturePaymentsLaunchEvidenceInput,
  existingRecords: PaymentsLaunchCapturedEvidenceRecord[],
): { command: NormalizedCaptureCommand | null; error: PaymentsLaunchEvidenceCaptureResult | null } {
  const capturedAt = toIso(input.capturedAt);
  const automatedEvidenceGeneratedAt = toIso(input.automatedEvidenceGeneratedAt);
  const operatorIdentity = normalizeOperatorIdentity(input.operatorIdentity);
  const reviewerIdentity = normalizeOperatorIdentity(input.reviewerIdentity);
  const payload = normalizeApprovalReference(input.payload);
  const payloadAutomatedEvidenceGeneratedAt = toIso(
    payload.automatedEvidenceGeneratedAt,
  );

  if (
    !hasText(input.evidenceId) ||
    !hasText(input.idempotencyKey) ||
    !operatorIdentity ||
    !capturedAt ||
    !automatedEvidenceGeneratedAt ||
    !hasText(input.releaseTicketId)
  ) {
    return {
      command: null,
      error: {
        status: 'rejected',
        record: null,
        errorCode: 'missing_required_field',
        message:
          'Evidence capture requires evidence id, idempotency key, actor, timestamps, and release ticket.',
      },
    };
  }

  const immutableReference = {
    providerProfile: input.providerProfile,
    automatedEvidenceGeneratedAt,
    releaseTicketId: input.releaseTicketId,
    targetReleaseState: input.targetReleaseState,
  };
  const normalizedCommand = {
    evidenceId: input.evidenceId.trim(),
    idempotencyKey: input.idempotencyKey.trim(),
    kind: input.kind,
    capturedAt,
    capturedBy: operatorLabel(operatorIdentity),
    operatorIdentity,
    reviewerIdentity,
    immutableReference,
    payload,
    fingerprint: fingerprint({
      kind: input.kind,
      immutableReference,
      payload,
    }),
  };

  if (!isPayloadKindMatch(input.kind, payload)) {
    return {
      command: normalizedCommand,
      error: {
        status: 'rejected',
        record: null,
        errorCode: 'payload_kind_mismatch',
        message: 'Evidence payload does not match the requested evidence kind.',
      },
    };
  }

  if (input.targetReleaseState === 'hidden') {
    return {
      command: normalizedCommand,
      error: {
        status: 'rejected',
        record: null,
        errorCode: 'target_release_state_hidden',
        message: 'Captured release evidence must target a visible release state.',
      },
    };
  }

  if (
    payload.providerProfile !== input.providerProfile ||
    payloadAutomatedEvidenceGeneratedAt !== automatedEvidenceGeneratedAt
  ) {
    return {
      command: normalizedCommand,
      error: {
        status: 'rejected',
        record: null,
        errorCode: 'payload_reference_mismatch',
        message:
          'Evidence payload must reference the same provider profile and automated evidence timestamp as the capture command.',
      },
    };
  }

  if (
    (input.kind === 'release_owner_signoff' ||
      input.kind === 'hidden_state_acknowledgement') &&
    ((payload as PaymentsLaunchReleaseOwnerSignoff).releaseTicketId !==
      input.releaseTicketId ||
      (payload as PaymentsLaunchReleaseOwnerSignoff).targetReleaseState !==
        input.targetReleaseState)
  ) {
    return {
      command: normalizedCommand,
      error: {
        status: 'rejected',
        record: null,
        errorCode: 'payload_reference_mismatch',
        message:
          'Release-owner and hidden-state evidence must reference the same release ticket and target state as the capture command.',
      },
    };
  }

  if (
    input.kind === 'hidden_state_acknowledgement' &&
    (payload as PaymentsLaunchHiddenStateAcknowledgement)
      .paymentsFeatureHiddenAcknowledged !== true
  ) {
    return {
      command: normalizedCommand,
      error: {
        status: 'rejected',
        record: null,
        errorCode: 'hidden_state_not_acknowledged',
        message:
          'Hidden-state evidence must explicitly acknowledge that payments remains hidden until a separate registry change.',
      },
    };
  }

  const eligibility = buildPaymentsLaunchEvidenceCaptureEligibility({
    kind: input.kind,
    evidenceId: normalizedCommand.evidenceId,
    idempotencyKey: normalizedCommand.idempotencyKey,
    operatorIdentity,
    reviewerIdentity,
    providerProfile: input.providerProfile,
    automatedEvidenceGeneratedAt,
    releaseTicketId: input.releaseTicketId,
    targetReleaseState: input.targetReleaseState,
    existingRecords,
  });

  if (!eligibility.eligible) {
    return {
      command: normalizedCommand,
      error: {
        status: 'rejected',
        record: null,
        errorCode: errorCodeForEligibility(eligibility.rejectionReasons),
        message: eligibility.rejectionReasons
          .map((reason) => reason.evidence)
          .join(' '),
      },
    };
  }

  return {
    command: normalizedCommand,
    error: null,
  };
}

function sameImmutableRecord(
  record: PaymentsLaunchCapturedEvidenceRecord,
  command: NormalizedCaptureCommand,
): boolean {
  return (
    record.evidenceId === command.evidenceId &&
    record.idempotencyKey === command.idempotencyKey &&
    record.kind === command.kind &&
    record.payloadFingerprint === command.fingerprint &&
    record.capturedBy === command.capturedBy &&
    stableStringify(record.operatorIdentity) ===
      stableStringify(command.operatorIdentity) &&
    stableStringify(record.reviewerIdentity) ===
      stableStringify(command.reviewerIdentity) &&
    record.immutableReference.providerProfile ===
      command.immutableReference.providerProfile &&
    record.immutableReference.automatedEvidenceGeneratedAt ===
      command.immutableReference.automatedEvidenceGeneratedAt &&
    record.immutableReference.releaseTicketId ===
      command.immutableReference.releaseTicketId &&
    record.immutableReference.targetReleaseState ===
      command.immutableReference.targetReleaseState
  );
}

function cloneRecord(
  record: PaymentsLaunchCapturedEvidenceRecord,
): PaymentsLaunchCapturedEvidenceRecord {
  return {
    ...record,
    operatorIdentity: { ...record.operatorIdentity, roles: [...record.operatorIdentity.roles] },
    reviewerIdentity: record.reviewerIdentity
      ? { ...record.reviewerIdentity, roles: [...record.reviewerIdentity.roles] }
      : null,
    immutableReference: { ...record.immutableReference },
    payload: { ...record.payload },
  };
}

function compareRecords(
  left: PaymentsLaunchCapturedEvidenceRecord,
  right: PaymentsLaunchCapturedEvidenceRecord,
): number {
  const leftMs = new Date(left.capturedAt).getTime();
  const rightMs = new Date(right.capturedAt).getTime();

  if (leftMs !== rightMs) {
    return leftMs - rightMs;
  }

  return left.evidenceId.localeCompare(right.evidenceId);
}

async function writeAudit(
  auditLogger: PaymentsAuditLogger | null,
  command: NormalizedCaptureCommand | null,
  action: 'launch_evidence.captured' | 'launch_evidence.replayed' | 'launch_evidence.rejected',
  level: 'info' | 'warning',
  message: string,
  errorCode: PaymentsLaunchEvidenceCaptureErrorCode | null,
): Promise<string | null> {
  if (!auditLogger || !command) {
    return null;
  }

  const entry = await auditLogger.log({
    level,
    action,
    subjectType: 'launch_evidence',
    commandIdempotencyKey: command.idempotencyKey,
    message,
    metadata: {
      evidenceId: command.evidenceId,
      evidenceKind: command.kind,
      payloadFingerprint: command.fingerprint,
      providerProfile: command.immutableReference.providerProfile,
      automatedEvidenceGeneratedAt:
        command.immutableReference.automatedEvidenceGeneratedAt,
      releaseTicketId: command.immutableReference.releaseTicketId,
      targetReleaseState: command.immutableReference.targetReleaseState,
      capturedBy: command.capturedBy,
      capturedAt: command.capturedAt,
      operatorActorId: command.operatorIdentity.actorId,
      operatorRoles: command.operatorIdentity.roles,
      reviewerActorId: command.reviewerIdentity?.actorId ?? null,
      reviewerRoles: command.reviewerIdentity?.roles ?? [],
      errorCode,
    },
  });

  return entry.id;
}

export function createInMemoryPaymentsLaunchEvidenceStore(input: {
  auditLogger?: PaymentsAuditLogger | null;
} = {}): PaymentsLaunchEvidenceStore {
  const auditLogger = input.auditLogger ?? null;
  const recordsByEvidenceId = new Map<string, PaymentsLaunchCapturedEvidenceRecord>();
  const evidenceIdByIdempotencyKey = new Map<string, string>();

  return {
    async capture(
      captureInput: CapturePaymentsLaunchEvidenceInput,
    ): Promise<PaymentsLaunchEvidenceCaptureResult> {
      const existingRecords = Array.from(recordsByEvidenceId.values());
      const { command, error } = validateCommand(captureInput, existingRecords);

      if (error) {
        if (command) {
          await writeAudit(
            auditLogger,
            command,
            'launch_evidence.rejected',
            'warning',
            error.message,
            error.errorCode,
          );
        }
        return error;
      }
      if (!command) {
        return {
          status: 'rejected',
          record: null,
          errorCode: 'missing_required_field',
          message: 'Evidence capture command could not be normalized.',
        };
      }

      const existingEvidenceId = evidenceIdByIdempotencyKey.get(
        command.idempotencyKey,
      );
      if (existingEvidenceId) {
        const existingRecord = recordsByEvidenceId.get(existingEvidenceId);
        if (existingRecord && sameImmutableRecord(existingRecord, command)) {
          await writeAudit(
            auditLogger,
            command,
            'launch_evidence.replayed',
            'info',
            'Release evidence capture replayed idempotently.',
            null,
          );
          return {
            status: 'idempotent_replay',
            record: cloneRecord(existingRecord),
            errorCode: null,
            message: 'Release evidence capture replayed idempotently.',
          };
        }

        await writeAudit(
          auditLogger,
          command,
          'launch_evidence.rejected',
          'warning',
          'Release evidence capture rejected because the idempotency key references different evidence.',
          'idempotency_key_conflict',
        );
        return {
          status: 'rejected',
          record: null,
          errorCode: 'idempotency_key_conflict',
          message:
            'The idempotency key already references different immutable evidence.',
        };
      }

      const existingRecord = recordsByEvidenceId.get(command.evidenceId);
      if (existingRecord) {
        if (sameImmutableRecord(existingRecord, command)) {
          evidenceIdByIdempotencyKey.set(
            command.idempotencyKey,
            command.evidenceId,
          );
          await writeAudit(
            auditLogger,
            command,
            'launch_evidence.replayed',
            'info',
            'Release evidence capture replayed by immutable evidence id.',
            null,
          );
          return {
            status: 'idempotent_replay',
            record: cloneRecord(existingRecord),
            errorCode: null,
            message: 'Release evidence capture replayed by immutable evidence id.',
          };
        }

        await writeAudit(
          auditLogger,
          command,
          'launch_evidence.rejected',
          'warning',
          'Release evidence capture rejected because the evidence id is immutable.',
          'evidence_id_conflict',
        );
        return {
          status: 'rejected',
          record: null,
          errorCode: 'evidence_id_conflict',
          message:
            'The evidence id already exists and cannot be mutated by a later capture.',
        };
      }

      const record: PaymentsLaunchCapturedEvidenceRecord = {
        evidenceId: command.evidenceId,
        idempotencyKey: command.idempotencyKey,
        kind: command.kind,
        capturedAt: command.capturedAt,
        capturedBy: command.capturedBy,
        operatorIdentity: {
          ...command.operatorIdentity,
          roles: [...command.operatorIdentity.roles],
        },
        reviewerIdentity: command.reviewerIdentity
          ? {
              ...command.reviewerIdentity,
              roles: [...command.reviewerIdentity.roles],
            }
          : null,
        immutableReference: { ...command.immutableReference },
        payload: { ...command.payload },
        payloadFingerprint: command.fingerprint,
        auditEntryId: null,
      };
      const auditEntryId = await writeAudit(
        auditLogger,
        command,
        'launch_evidence.captured',
        'info',
        'Release evidence captured immutably.',
        null,
      );
      record.auditEntryId = auditEntryId;
      recordsByEvidenceId.set(command.evidenceId, record);
      evidenceIdByIdempotencyKey.set(command.idempotencyKey, command.evidenceId);

      return {
        status: 'captured',
        record: cloneRecord(record),
        errorCode: null,
        message: 'Release evidence captured immutably.',
      };
    },
    get(evidenceId: string): PaymentsLaunchCapturedEvidenceRecord | null {
      const record = recordsByEvidenceId.get(evidenceId);

      return record ? cloneRecord(record) : null;
    },
    list(
      filter: PaymentsLaunchEvidenceStoreListFilter = {},
    ): PaymentsLaunchCapturedEvidenceRecord[] {
      const automatedEvidenceGeneratedAt =
        filter.automatedEvidenceGeneratedAt !== undefined
          ? toIso(filter.automatedEvidenceGeneratedAt)
          : null;

      return Array.from(recordsByEvidenceId.values())
        .filter((record) => {
          if (
            filter.providerProfile &&
            record.immutableReference.providerProfile !== filter.providerProfile
          ) {
            return false;
          }
          if (
            automatedEvidenceGeneratedAt &&
            record.immutableReference.automatedEvidenceGeneratedAt !==
              automatedEvidenceGeneratedAt
          ) {
            return false;
          }
          if (
            filter.releaseTicketId &&
            record.immutableReference.releaseTicketId !== filter.releaseTicketId
          ) {
            return false;
          }
          if (
            filter.targetReleaseState &&
            record.immutableReference.targetReleaseState !==
              filter.targetReleaseState
          ) {
            return false;
          }
          return true;
        })
        .sort(compareRecords)
        .map(cloneRecord);
    },
  };
}

export function buildPaymentsLaunchReleaseEvidenceCaptureFromRecords(
  records: PaymentsLaunchCapturedEvidenceRecord[],
): PaymentsLaunchReleaseEvidenceCapture {
  const sortedRecords = [...records].sort(compareRecords);
  const capture: PaymentsLaunchReleaseEvidenceCapture = {};

  for (const record of sortedRecords) {
    if (record.kind === 'legal_review' && capture.legalReview === undefined) {
      capture.legalReview = record.payload as PaymentsLaunchLegalReviewApproval;
    } else if (
      record.kind === 'pilot_approval' &&
      capture.pilotApproval === undefined
    ) {
      capture.pilotApproval = record.payload as PaymentsLaunchPilotApproval;
    } else if (
      record.kind === 'release_owner_signoff' &&
      capture.releaseOwnerSignoff === undefined
    ) {
      capture.releaseOwnerSignoff =
        record.payload as PaymentsLaunchReleaseOwnerSignoff;
    } else if (
      record.kind === 'hidden_state_acknowledgement' &&
      capture.hiddenStateAcknowledgement === undefined
    ) {
      capture.hiddenStateAcknowledgement =
        record.payload as PaymentsLaunchHiddenStateAcknowledgement;
    }
  }

  return capture;
}
