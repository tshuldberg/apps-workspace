import type {
  SyncEncryptionMode,
  SyncSecurityPreference,
  SyncSecuritySubjectType,
} from '../types';

export interface SyncSecurityOffer {
  subjectType: SyncSecuritySubjectType;
  subjectId: string;
  encryptionMode: SyncEncryptionMode;
  canEncrypt: boolean;
  disappearingMessagesEnabled: boolean;
  disappearAfterSeconds: number | null;
}

export interface SyncSecurityAgreement {
  canProceed: boolean;
  encryptionConfirmed: boolean;
  encryptionRequired: boolean;
  disappearingMessagesConfirmed: boolean;
  disappearAfterSeconds: number | null;
  reason: string | null;
}

/**
 * The security contract a session runs under when its caller passes none.
 *
 * Required encryption is the default for EVERY session: a session that cannot
 * key its payload channel fails closed instead of proceeding in plaintext.
 * Callers that genuinely want a plaintext channel (tests, controlled
 * migrations) must say so explicitly with encryptionMode 'off' on BOTH sides.
 */
export function defaultRequiredSecurityPreference(): SyncSecurityPreference {
  return {
    // 'direct' so both sides derive the payload key from the sorted pair id:
    // a defaulted side and an explicitly-'direct' side reach the same key.
    subjectType: 'direct',
    subjectId: 'session-default',
    encryptionMode: 'required',
    disappearingMessagesEnabled: false,
    disappearAfterSeconds: null,
    updatedAt: new Date().toISOString(),
  };
}

export function createSecurityOffer(
  preference: SyncSecurityPreference,
  options: { canEncrypt?: boolean } = {},
): SyncSecurityOffer {
  return {
    subjectType: preference.subjectType,
    subjectId: preference.subjectId,
    encryptionMode: preference.encryptionMode,
    canEncrypt: options.canEncrypt ?? true,
    disappearingMessagesEnabled: preference.disappearingMessagesEnabled,
    disappearAfterSeconds: preference.disappearAfterSeconds,
  };
}

function allowsEncryption(mode: SyncEncryptionMode): boolean {
  return mode !== 'off';
}

function requiresEncryption(mode: SyncEncryptionMode): boolean {
  return mode !== 'off';
}

function normalizeDisappearAfterSeconds(value: number | null): number | null {
  if (typeof value !== 'number') return null;
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.floor(value);
}

/**
 * Resolve the security contract for a workspace or direct connection.
 *
 * Encryption and disappearing messages are only marked confirmed when both
 * sides opted into compatible settings. Any side that has encryption enabled
 * requires an encrypted payload channel; plaintext fallback is only allowed
 * when both sides explicitly set encryption to off.
 */
export function negotiateSecurityAgreement(
  local: SyncSecurityOffer,
  remote: SyncSecurityOffer,
): SyncSecurityAgreement {
  const localAllowsEncryption = allowsEncryption(local.encryptionMode);
  const remoteAllowsEncryption = allowsEncryption(remote.encryptionMode);
  const localCanEncrypt = local.canEncrypt === true;
  const remoteCanEncrypt = remote.canEncrypt === true;
  const encryptionConfirmed =
    localAllowsEncryption
    && remoteAllowsEncryption
    && localCanEncrypt
    && remoteCanEncrypt;
  const encryptionRequired =
    requiresEncryption(local.encryptionMode) || requiresEncryption(remote.encryptionMode);

  if (encryptionRequired && !encryptionConfirmed) {
    return {
      canProceed: false,
      encryptionConfirmed: false,
      encryptionRequired,
      disappearingMessagesConfirmed: false,
      disappearAfterSeconds: null,
      reason: 'encryption_required_by_one_side',
    };
  }

  const localTtl = normalizeDisappearAfterSeconds(local.disappearAfterSeconds);
  const remoteTtl = normalizeDisappearAfterSeconds(remote.disappearAfterSeconds);
  const disappearingMessagesConfirmed =
    local.disappearingMessagesEnabled
    && remote.disappearingMessagesEnabled
    && localTtl !== null
    && remoteTtl !== null;

  return {
    canProceed: true,
    encryptionConfirmed,
    encryptionRequired,
    disappearingMessagesConfirmed,
    disappearAfterSeconds: disappearingMessagesConfirmed
      ? Math.min(localTtl, remoteTtl)
      : null,
    reason: null,
  };
}
