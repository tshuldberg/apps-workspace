export type BestChefSeedContentProvenance =
  | 'demo'
  | 'editorial_seed'
  | 'partner_seed'
  | 'user_content';

export type BestChefSeedContentApprovalStatus =
  | 'draft'
  | 'approved'
  | 'rejected'
  | 'rolled_back';

export interface BestChefSeedContentApprovalEnv {
  EXPO_PUBLIC_BESTCHEF_SEED_CONTENT_APPROVAL_STATUS?: string;
  EXPO_PUBLIC_BESTCHEF_APPROVED_SEED_CONTENT_REVISION?: string;
  EXPO_PUBLIC_BESTCHEF_SEED_CONTENT_ROLLBACK_MARKER?: string;
}

export interface BestChefSeedContentApproval {
  status: BestChefSeedContentApprovalStatus;
  revision: string | null;
  rollbackMarker: string | null;
  approved: boolean;
}

export interface BestChefSeedContentRecord {
  provenance: BestChefSeedContentProvenance;
  approvalStatus: BestChefSeedContentApprovalStatus;
  approvalRevision?: string | null;
  editorialLabel?: string | null;
  rollbackMarker?: string | null;
  moderationStatus?: 'pending' | 'approved' | 'hidden' | 'rejected' | null;
}

export type BestChefSeedContentRenderAction = 'show' | 'label' | 'suppress';

export interface BestChefSeedContentRenderDecision {
  action: BestChefSeedContentRenderAction;
  label: string | null;
  reason:
    | 'internal_beta'
    | 'user_content'
    | 'approved_seed'
    | 'unapproved_seed'
    | 'rolled_back';
}

function normalizedText(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text ? text : null;
}

function normalizedStatus(value: string | null | undefined): BestChefSeedContentApprovalStatus {
  if (value === 'approved' || value === 'rejected' || value === 'rolled_back') {
    return value;
  }
  return 'draft';
}

function seedRecordApproved(record: BestChefSeedContentRecord): boolean {
  return (
    record.approvalStatus === 'approved'
    && normalizedText(record.approvalRevision) !== null
    && normalizedText(record.rollbackMarker) === null
    && record.moderationStatus === 'approved'
  );
}

export function getBestChefSeedContentApproval(
  env: BestChefSeedContentApprovalEnv,
): BestChefSeedContentApproval {
  const status = normalizedStatus(env.EXPO_PUBLIC_BESTCHEF_SEED_CONTENT_APPROVAL_STATUS);
  const revision = normalizedText(env.EXPO_PUBLIC_BESTCHEF_APPROVED_SEED_CONTENT_REVISION);
  const rollbackMarker = normalizedText(env.EXPO_PUBLIC_BESTCHEF_SEED_CONTENT_ROLLBACK_MARKER);

  return {
    status,
    revision,
    rollbackMarker,
    approved: status === 'approved' && revision !== null && rollbackMarker === null,
  };
}

export function hasApprovedBestChefSeedContent(
  env: BestChefSeedContentApprovalEnv,
): boolean {
  return getBestChefSeedContentApproval(env).approved;
}

export function getBestChefSeedContentRenderDecision(
  record: BestChefSeedContentRecord,
  options: { isPublicLaunch: boolean },
): BestChefSeedContentRenderDecision {
  if (!options.isPublicLaunch) {
    return { action: 'show', label: null, reason: 'internal_beta' };
  }

  if (record.provenance === 'user_content') {
    return { action: 'show', label: null, reason: 'user_content' };
  }

  if (normalizedText(record.rollbackMarker) !== null || record.approvalStatus === 'rolled_back') {
    return { action: 'suppress', label: null, reason: 'rolled_back' };
  }

  if (!seedRecordApproved(record)) {
    return { action: 'suppress', label: null, reason: 'unapproved_seed' };
  }

  return {
    action: 'label',
    label: normalizedText(record.editorialLabel) ?? 'Editorial seed',
    reason: 'approved_seed',
  };
}

export function normalizePublicMediaUrl(value: string | null | undefined): string | null {
  const text = normalizedText(value);
  if (!text) return null;

  try {
    const parsed = new URL(text);
    return parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}
