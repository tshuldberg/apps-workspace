/**
 * Plan 53 P2: the in-person ceremony screen's pure view model.
 *
 * Every user-facing line of the ceremony lives here, mapped from the protocol's
 * CeremonyState, so the copy rules are unit-testable without rendering:
 *
 *  - "tap" never appears as a hardware mechanism. iPhones expose no
 *    app-controllable phone-to-phone NFC; the honest phrasing is phones NEAR
 *    each other.
 *  - The emoji comparison is never optional and never automatic. Confirm is
 *    enabled in exactly one phase, the one where the SAS is on screen. It IS
 *    the security control against an in-room relay attacker.
 *  - Terminal-without-commit copy always says nothing was saved (AC-2).
 *  - The nearby-takeover consequence (plan 53 amendment): the native module
 *    keeps one browser, so the ceremony pauses the nearby sync rung for its
 *    window. The screen states it rather than hiding it.
 */

import { CEREMONY_WINDOW_MS, type CeremonyState } from '@mylife/sync';

export type CeremonyMode = 'friend' | 'device';

/** Entry-point copy (Add friend + Sync screens). */
export const IN_PERSON_ENTRY_TITLE = 'Add in person';
export const IN_PERSON_PAIR_ENTRY_TITLE = 'Pair in person';
export const IN_PERSON_ENTRY_HINT =
  'Open this on both phones, hold them near each other, and confirm the same five emoji. Works with no internet and no connection server.';
export const IN_PERSON_PAIR_ENTRY_HINT =
  'Open the same screen on both of your devices, hold them near each other, and confirm the same five emoji. No code to copy.';

/** Expo Go / missing native module: honest copy, never a dead control (AC-6). */
export const IN_PERSON_NEEDS_DEV_BUILD_LINE =
  'Adding in person needs the full Meerkat app. This preview build does not include the nearby radio module, so this feature is unavailable here.';

/** The nearby-takeover consequence, stated instead of hidden (plan amendment). */
export const IN_PERSON_NEARBY_PAUSE_LINE =
  'While this screen is looking for the other phone, nearby device sync is paused. It resumes after the ceremony ends.';

export const IN_PERSON_NO_SERVER_LINE =
  'No internet or connection server is used. Identity moves only over the encrypted nearby link between the two phones.';

export function inPersonWindowLine(): string {
  return `The ceremony closes on its own after ${Math.round(CEREMONY_WINDOW_MS / 1000)} seconds.`;
}

/**
 * The SAS comparison instruction. The comparison is the MITM defense, so this
 * line must instruct, not suggest.
 */
export const IN_PERSON_SAS_INSTRUCTION =
  'Compare the five emoji with the other phone out loud. Confirm only if both phones show exactly the same five. If they differ, someone may be intercepting the connection: cancel.';

/**
 * The provider's applyTrustedBundle result for a device that is already paired.
 * Must match SyncProvider verbatim; a ceremony re-run after a lost final accept
 * (the two-generals recovery documented in the protocol) lands here and is a
 * benign outcome, not an error.
 */
export const ALREADY_PAIRED_LINE = 'Already paired with that device.';

export interface CeremonyScreenModel {
  headline: string;
  detail: string;
  /** Show a spinner: work is genuinely in flight. */
  busy: boolean;
  /** The five emoji, when the user should be comparing them. */
  sasEmoji: string[] | null;
  peerName: string | null;
  /** Enabled in exactly one phase: awaiting_confirm, with the SAS on screen. */
  confirmEnabled: boolean;
  cancelEnabled: boolean;
  retryEnabled: boolean;
  /** Show the no-server + nearby-pause + window context lines. */
  showContextLines: boolean;
  /**
   * Show the "Message [name]" action (P3): only a successfully written FRIEND
   * pairing earns it. Own-device pairing and every failure path never do.
   */
  showMessageButton: boolean;
  tone: 'normal' | 'success' | 'error';
}

export function ceremonyModeFromParam(value: string | string[] | undefined): CeremonyMode {
  return value === 'device' ? 'device' : 'friend';
}

const NOTHING_SAVED = 'Nothing was saved on either phone.';

function failureCopy(state: CeremonyState): { headline: string; detail: string } {
  switch (state.failure) {
    case 'peer_bundle_rejected':
      return {
        headline: 'Identity verification failed',
        detail: `The other phone sent an identity that failed signature verification. ${NOTHING_SAVED} Do not keep trying with a phone you do not recognize.`,
      };
    case 'peer_accept_rejected':
      return {
        headline: 'Confirmation verification failed',
        detail: `The other phone sent a confirmation that did not verify for this ceremony. ${NOTHING_SAVED}`,
      };
    case 'self_pairing':
      return {
        headline: 'This phone found itself',
        detail: `The ceremony discovered this phone's own broadcast. ${NOTHING_SAVED} Make sure the other phone has this screen open too.`,
      };
    case 'transport_lost':
    default:
      return {
        headline: 'The nearby link dropped',
        detail: `The connection was lost before both sides confirmed, or the nearby radio was busy. ${NOTHING_SAVED} Move the phones closer and try again.`,
      };
  }
}

/**
 * Map the protocol state to everything the screen renders.
 *
 * `commitError` is the pairing-write outcome once the ceremony commits:
 * undefined = the write has not been recorded yet, null = written, a string =
 * the provider refused (applyTrustedBundle's honest error).
 */
export function ceremonyScreenModel(
  state: CeremonyState,
  mode: CeremonyMode,
  commitError: string | null | undefined,
): CeremonyScreenModel {
  const peerName = state.peerBundle?.bundle.displayName ?? null;
  const base: CeremonyScreenModel = {
    headline: '',
    detail: '',
    busy: false,
    sasEmoji: null,
    peerName,
    confirmEnabled: false,
    cancelEnabled: false,
    retryEnabled: false,
    showContextLines: false,
    showMessageButton: false,
    tone: 'normal',
  };

  switch (state.phase) {
    case 'discovering':
      return {
        ...base,
        headline: 'Looking for the other phone',
        detail: 'Keep this screen open on both phones and hold them near each other. Only a one-time random id is broadcast while searching; nothing identifies you or this phone.',
        busy: true,
        cancelEnabled: true,
        showContextLines: true,
      };
    case 'connected':
      return {
        ...base,
        headline: 'Phone found',
        detail: 'Exchanging and verifying identities over the encrypted nearby link.',
        busy: true,
        cancelEnabled: true,
        showContextLines: true,
      };
    case 'awaiting_confirm':
      return {
        ...base,
        headline: `Confirm Adding ${peerName ?? 'this person'}`,
        detail: IN_PERSON_SAS_INSTRUCTION,
        sasEmoji: state.sas?.emoji ?? null,
        confirmEnabled: true,
        cancelEnabled: true,
        showContextLines: true,
      };
    case 'awaiting_peer':
      return {
        ...base,
        headline: `Waiting for ${peerName ?? 'the other phone'}`,
        detail: `Confirmed on this phone. Nothing is saved until ${peerName ?? 'the other phone'} confirms too.`,
        busy: true,
        sasEmoji: state.sas?.emoji ?? null,
        cancelEnabled: true,
        showContextLines: true,
      };
    case 'committed': {
      if (commitError === undefined) {
        return { ...base, headline: 'Saving the pairing', detail: 'Both phones agreed.', busy: true };
      }
      if (commitError === null) {
        return mode === 'device'
          ? {
            ...base,
            headline: `Paired with ${peerName ?? 'the other device'}`,
            detail: 'This pairing works exactly like a pasted pairing code: the device now appears under Pairing on the Sync screen, and the next session syncs as usual.',
            tone: 'success',
          }
          : {
            ...base,
            headline: `${peerName ?? 'Your friend'} is now your friend`,
            detail: 'Saved on both phones. They will appear in Messages, and your next session together syncs as usual.',
            showMessageButton: true,
            tone: 'success',
          };
      }
      if (commitError === ALREADY_PAIRED_LINE) {
        return {
          ...base,
          headline: 'Already connected',
          detail: `You were already paired with ${peerName ?? 'that device'}, so nothing needed to change. Both phones agreed just now.`,
          showMessageButton: mode === 'friend',
          tone: 'success',
        };
      }
      return {
        ...base,
        headline: 'Could not save the pairing',
        detail: commitError,
        retryEnabled: true,
        tone: 'error',
      };
    }
    case 'cancelled':
      return {
        ...base,
        headline: 'Ceremony cancelled',
        detail: NOTHING_SAVED,
        retryEnabled: true,
      };
    case 'expired':
      return {
        ...base,
        headline: 'No confirmation in time',
        detail: `The ${Math.round(CEREMONY_WINDOW_MS / 1000)} second window closed before both phones agreed. ${NOTHING_SAVED} Try again with both phones on this screen.`,
        retryEnabled: true,
      };
    case 'failed':
    default: {
      const copy = failureCopy(state);
      return { ...base, ...copy, retryEnabled: true, tone: 'error' };
    }
  }
}
