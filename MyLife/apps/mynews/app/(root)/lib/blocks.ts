// App-side helpers for the block / mute surface. The pure filtering and set
// building live in @mylife/mynews (data/blocks); this file only maps the port
// results to honest UI copy. No fabricated state: a block is a real, reversible,
// account-scoped revocation of visibility.

import type { BlockMode, BlockView } from '@mylife/mynews';

export interface BlockedRow {
  profileId: string;
  handle: string;
  displayName: string;
  mode: BlockMode;
  modeLabel: string;
  createdAt: string;
}

export function blockModeLabel(mode: BlockMode): string {
  return mode === 'mute' ? 'Muted' : 'Blocked';
}

/** Pure view-model for a "Blocked accounts" row. */
export function toBlockedRow(block: BlockView): BlockedRow {
  return {
    profileId: block.blockedProfileId,
    handle: block.blockedHandle,
    displayName: block.blockedDisplayName,
    mode: block.mode,
    modeLabel: blockModeLabel(block.mode),
    createdAt: block.createdAt,
  };
}

export interface BlockActionMessage {
  message: string;
  action?: 'sign-in';
}

/** Honest, human copy per typed setBlock/removeBlock error. No em dashes. */
export function blockErrorMessage(error: string): BlockActionMessage {
  switch (error) {
    case 'not-signed-in':
      return { message: 'Sign in to block or mute accounts. Your block list is tied to your account.', action: 'sign-in' };
    case 'no-profile':
      return { message: 'Finish setting up your profile before blocking accounts.' };
    case 'cannot-block-self':
      return { message: 'You cannot block your own account.' };
    default:
      return { message: `Could not update your block list: ${error}` };
  }
}
