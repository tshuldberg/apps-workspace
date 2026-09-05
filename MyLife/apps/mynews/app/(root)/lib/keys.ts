/**
 * View-model helpers for the Keys and Recovery screen (plan 48 WP6). Pure, so
 * the copy the user reads about their own signing custody is unit-testable
 * rather than only reachable by driving the UI.
 *
 * The one rule these all follow: never describe a capability the deployment does
 * not have. No-kit recovery in particular is unavailable on every current build
 * (no notification provider ships), so the copy says that plainly instead of
 * offering a button that always refuses.
 */

import type {
  CustodyErrorCode,
  CustodyKeyView,
  CustodyStatusView,
} from '@mylife/mynews';

/** One row in the device list. */
export interface KeyRow {
  id: string;
  pubkey: string;
  label: string;
  detail: string;
  active: boolean;
  /** This is the key THIS device holds. */
  isThisDevice: boolean;
  /** Revoking is offered only for someone else's still-active device key. */
  canRevoke: boolean;
}

function addedViaLabel(addedVia: CustodyKeyView['addedVia']): string {
  switch (addedVia) {
    case 'initial':
      return 'first key on this account';
    case 'rotation':
      return 'replaced an earlier key';
    case 'device_approval':
      return 'approved by your primary key';
    case 'recovery':
      return 'restored via account recovery';
    case 'backup_restore':
      return 'restored from your encrypted backup';
  }
}

export function toKeyRows(
  status: CustodyStatusView,
  thisDevicePubkey: string | null,
): KeyRow[] {
  return status.keys.map((key) => {
    const isThisDevice = thisDevicePubkey !== null && key.pubkey === thisDevicePubkey;
    return {
      id: key.id,
      pubkey: key.pubkey,
      label:
        key.kind === 'primary'
          ? isThisDevice
            ? 'Primary key (this device)'
            : 'Primary key'
          : isThisDevice
            ? 'Device key (this device)'
            : 'Device key',
      detail:
        key.status === 'active'
          ? addedViaLabel(key.addedVia)
          : `retired, ${addedViaLabel(key.addedVia)}`,
      active: key.status === 'active',
      isThisDevice,
      // The primary is replaced by a rotation, never bare-revoked: a bare revoke
      // would leave the account with no key and no way back. Revoking the key
      // this device holds from this device is also pointless, so neither is
      // offered here.
      canRevoke: key.status === 'active' && key.kind === 'device' && !isThisDevice,
    };
  });
}

/** Headline state for the Keys card and the screen banner. */
export type CustodyPosture =
  | 'no-key'
  | 'healthy'
  | 'no-kit'
  | 'signing-blocked'
  | 'recovery-pending'
  | 'recovery-frozen';

export function custodyPosture(
  status: CustodyStatusView,
  thisDevicePubkey: string | null,
): CustodyPosture {
  if (status.recovery?.status === 'pending') return 'recovery-pending';
  if (status.recoveryFrozen) return 'recovery-frozen';
  if (status.headPubkey === '') return 'no-key';
  const thisDeviceActive =
    thisDevicePubkey !== null &&
    status.keys.some((k) => k.pubkey === thisDevicePubkey && k.status === 'active');
  if (!thisDeviceActive) return 'signing-blocked';
  if (status.escrow.length === 0) return 'no-kit';
  return 'healthy';
}

export interface PostureCopy {
  title: string;
  body: string;
  tone: 'ok' | 'warn' | 'bad';
}

export function postureCopy(posture: CustodyPosture): PostureCopy {
  switch (posture) {
    case 'no-key':
      return {
        title: 'No signing key yet',
        body: 'Register a public profile to create the key that signs your work.',
        tone: 'warn',
      };
    case 'healthy':
      return {
        title: 'Signing key active',
        body:
          'This device can publish and review. Your recovery kit is stored encrypted, and only your recovery code can open it.',
        tone: 'ok',
      };
    case 'no-kit':
      return {
        title: 'No recovery kit yet',
        body:
          'This device can publish, but if you lose it you would not be able to publish new revisions of your own work. Create a recovery kit to fix that.',
        tone: 'warn',
      };
    case 'signing-blocked':
      return {
        title: 'This device cannot sign',
        body:
          'Your account has an active signing key, but it is not this device. Import your recovery kit here, or approve this device from the one that still holds the key.',
        tone: 'bad',
      };
    case 'recovery-pending':
      return {
        title: 'Account recovery in progress',
        body:
          'Someone opened a recovery on this account. If that was not you, cancel it: use the link in the notice, or cancel from a device that still holds an active key.',
        tone: 'bad',
      };
    case 'recovery-frozen':
      return {
        title: 'Recovery without a kit is frozen',
        body:
          'Two recovery attempts on this account were cancelled in the last 90 days, so that path is closed for now. Your recovery kit still works, and so does any device that still holds an active key.',
        tone: 'warn',
      };
  }
}

/**
 * Plain-language custody explanation, shown on the screen. Deliberately states
 * the LIMIT as well as the guarantee: a design that only advertises the upside
 * teaches users to trust it further than it goes.
 */
export const CUSTODY_EXPLANATION = [
  'Everything you publish is signed on your device with a key the MyNews server never holds. That is what makes your byline provable rather than just a claim, and it is why the server cannot forge a revision in your name.',
  'It also means the server cannot recover your key for you. A recovery kit is your own encrypted copy of that key. The server can store the encrypted file, but only the recovery code you keep can open it, so store the code somewhere you will still have it if this device is lost.',
  'Rotating a key never invalidates what it already signed. Old revisions stay verifiable against the key that signed them; a retired key simply cannot sign anything new.',
] as const;

/** Copy for the no-kit recovery path, whose availability depends on the server. */
export function noKitRecoveryCopy(status: CustodyStatusView): {
  available: boolean;
  body: string;
} {
  if (status.recoveryFrozen) {
    return {
      available: false,
      body:
        'Recovery without a kit is frozen on this account after two cancelled attempts in the last 90 days.',
    };
  }
  if (!status.notificationChannelConfirmed) {
    return {
      available: false,
      // The honest reason, not a vague "unavailable". This path requires
      // delivering a notice with a cancel link so a real owner can stop a
      // takeover, and there is nothing configured to deliver it.
      body:
        'Recovery without a kit is unavailable on this MyNews server: it needs a confirmed notification channel to send you a cancellable notice, and none is configured. Use your recovery kit, or a device that still holds an active key.',
    };
  }
  return {
    available: true,
    body:
      'Recovery without a kit opens a waiting period and notifies you, so you can cancel it if you did not start it. It is slower and public on purpose.',
  };
}

/** Honest, actionable copy for every custody failure code. */
export function custodyErrorMessage(code: CustodyErrorCode, detail?: string): string {
  switch (code) {
    case 'not-signed-in':
      return 'Sign in to manage your signing keys.';
    case 'no-profile':
      return 'Register a public profile before setting up signing keys.';
    case 'no-active-key':
      return 'This account has no signing key to change yet.';
    case 'bad-signature':
      return 'The key proof did not verify, so nothing was changed.';
    case 'bad-nonce':
      return 'That request expired. Try again.';
    case 'rate-limited':
      return 'Too many key requests just now. Wait a moment and try again.';
    case 'head-conflict':
      return 'Your signing key changed while this was in flight. Refresh and try again.';
    case 'pubkey-conflict':
      return 'That key is already in use on an account.';
    case 'same-key':
      return 'The new key has to be different from your current one.';
    case 'not-primary':
      return 'Only your primary key can approve another device.';
    case 'unknown-key':
      return 'That key is no longer on your account.';
    case 'not-your-key':
      return 'That key does not belong to your account.';
    case 'already-revoked':
      return 'That key was already revoked.';
    case 'use-rotation-for-primary':
      return 'To replace your primary key, rotate it: that revokes and replaces it in one step.';
    case 'revoke-precedence':
      return 'A newer device key cannot revoke an older one. Use your primary key.';
    case 'notification-channel-required':
      return 'Recovery without a kit is unavailable on this server. Use your recovery kit, or a device that still holds an active key.';
    case 'recovery-frozen':
      return 'Recovery without a kit is frozen on this account. Your recovery kit still works.';
    case 'already-pending':
      return 'A recovery is already open on this account.';
    case 'unknown-request':
      return 'That recovery request no longer exists.';
    case 'not-pending':
      return 'That recovery is no longer open.';
    case 'still-locked':
      return 'This recovery is still inside its waiting period.';
    case 'pubkey-not-precommitted':
      return 'This recovery was opened for a different key than the one on this device.';
    case 'bad-cancel-token':
      return 'That cancel link is not valid for this recovery.';
    case 'no-kit':
      return 'No recovery kit is stored for this account.';
    case 'reauth-required':
      return 'Sign in again, then retry this key action.';
    case 'validation':
      return detail ? `That request was not valid: ${detail}` : 'That request was not valid.';
    case 'network':
      return 'Could not reach the MyNews server, so nothing was changed. Try again.';
    case 'unknown':
      return detail ? `Something went wrong: ${detail}` : 'Something went wrong.';
  }
}
