// Maps typed publish failures to plain, honest reader-facing copy. Never claims
// success; every branch names what actually went wrong so the composer can show
// it inline. Unknown codes fall through to the server detail when present.

import type { PublishErrorCode } from '@mylife/mynews';

const MESSAGES: Record<PublishErrorCode, string> = {
  validation: 'Add a headline and some body text before publishing.',
  'no-profile': 'You need a public profile to publish. Register a handle to continue.',
  'bad-signature': 'The server could not verify your signature. Please try again.',
  'rev-conflict': 'This article already has a newer revision on the server.',
  'author-mismatch': 'This device is not the registered author of that article.',
  'not-newsroom-member': 'This needs an owner or coauthor role in the target newsroom.',
  'screen-hold': 'This publish is held for review and is not live yet.',
  suspended: 'Your account is suspended and cannot publish right now.',
  'terms-not-accepted': 'Please accept the current Terms and Community Guidelines to publish.',
  'not-signed-in': 'Sign in to publish.',
  // Key custody (plan 48 WP6). Naming the real cause matters here: the signature
  // was valid, so "could not verify your signature" would be false and would send
  // the author looking in the wrong place. Nothing was published.
  'key-revoked':
    'This device signing key was rotated or revoked, so it can no longer publish. Nothing was published. Open Keys and Recovery to set up a signing key on this device.',
  'key-unavailable':
    'The server could not check your signing key, so nothing was published. Try again shortly.',
  network: 'Could not reach the MyNews server. Check your connection and try again.',
  unknown: 'Publishing failed.',
};

export function publishErrorMessage(code: PublishErrorCode, detail?: string): string {
  const base = MESSAGES[code] ?? MESSAGES.unknown;
  if (code === 'unknown' && detail) {
    return `${base} ${detail}`;
  }
  return base;
}

/**
 * Screen-routable follow-up for a publish failure, mirroring desk-errors'
 * action pattern: no-profile routes to registration, a dead signing key routes to
 * Keys and Recovery, everything else has none.
 */
export function publishErrorAction(code: PublishErrorCode): 'register' | 'keys' | undefined {
  if (code === 'no-profile') return 'register';
  if (code === 'key-revoked') return 'keys';
  return undefined;
}
