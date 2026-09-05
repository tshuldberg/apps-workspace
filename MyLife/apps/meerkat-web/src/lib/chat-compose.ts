// Plan 30 Phase 4: the WEB twin of apps/meerkat/app/(root)/data/chat-compose.ts.
//
// Pure, provider-agnostic builders for outgoing channel events. MeerkatProvider
// delegates event construction here so the v1/v2 selection and reaction shape are
// unit-testable without a React harness. No side effects: callers persist + record
// the returned event. Kept in lockstep with the mobile file (both build the same
// signed bytes from @mylife/sync).

import {
  createChannelMessage,
  createChannelMessageV2,
  isPackReactionToken,
  isSingleEmojiGrapheme,
  type ChannelMessageAttachment,
  type ChannelMessageEvent,
  type DeviceIdentity,
  type Hlc,
} from '@mylife/sync';

/** v2-only send options. Any present field forces the v2 builder. */
export interface SendMessageOpts {
  mentions?: string[];
  parentId?: string;
  postId?: string;
  branchId?: string;
}

export const REACTION_INVALID_EMOJI_ERROR = 'Pick a single emoji to react with.';

function nonEmpty(value: string | undefined): boolean {
  return typeof value === 'string' && value.length > 0;
}

/** True when opts carry any v2-only field, so the v2 builder must be used. */
export function sendOptsNeedV2(opts?: SendMessageOpts): boolean {
  if (!opts) return false;
  return (
    (Array.isArray(opts.mentions) && opts.mentions.length > 0)
    || nonEmpty(opts.parentId)
    || nonEmpty(opts.postId)
    || nonEmpty(opts.branchId)
  );
}

/**
 * Build the outgoing channel message. Without v2 opts this is byte-identical to
 * the pre-Plan-30 v1 builder (a hard regression guard covers it); with any v2
 * field it signs a v2 event carrying mentions/threading and intent 'message'.
 */
export function buildOutgoingChannelMessage(
  identity: DeviceIdentity,
  input: {
    communityId: string;
    channelId: string;
    body: string; // caller trims
    attachments: ChannelMessageAttachment[];
    hlc: Hlc;
    opts?: SendMessageOpts;
  },
): ChannelMessageEvent {
  const attachments = input.attachments.length > 0 ? input.attachments : undefined;
  if (!sendOptsNeedV2(input.opts)) {
    return createChannelMessage(identity, {
      communityId: input.communityId,
      channelId: input.channelId,
      body: input.body,
      attachments,
      hlc: input.hlc,
    });
  }
  const opts = input.opts!;
  const mentions = opts.mentions && opts.mentions.length > 0 ? opts.mentions : undefined;
  return createChannelMessageV2(identity, {
    communityId: input.communityId,
    channelId: input.channelId,
    body: input.body,
    attachments,
    hlc: input.hlc,
    postId: opts.postId,
    parentId: opts.parentId,
    branchId: opts.branchId,
    authorKind: 'human',
    mentions,
    intent: 'message',
  });
}

/**
 * Rebuild an edited channel message, preserving the ORIGINAL event's schema
 * version and every v2 field. Gating on `version === 2` (NOT `postId`) is the
 * fix for the reply-strip bug: a chat reply carries `parentId` but no `postId`,
 * so a `postId`-based gate would drop it to the v1 builder and delete
 * parentId/branchId/mentions/intent, de-linking the reply and dropping its
 * mention highlights cross-device. Reactions never reach this path (they edit
 * via removeReaction), so an empty-body v2 rebuild of a 'react' cannot occur here.
 */
export function buildEditedChannelMessage(
  identity: DeviceIdentity,
  input: {
    event: ChannelMessageEvent;
    body: string; // caller trims
    hlc: Hlc;
  },
): ChannelMessageEvent {
  const base = {
    communityId: input.event.communityId,
    channelId: input.event.channelId,
    body: input.body,
    attachments: input.event.attachments,
    hlc: input.hlc,
    supersedes: { id: input.event.id, deleted: false },
  };
  if (input.event.version === 2) {
    return createChannelMessageV2(identity, {
      ...base,
      postId: input.event.postId,
      parentId: input.event.parentId,
      branchId: input.event.branchId,
      authorKind: input.event.authorKind ?? 'human',
      mentions: input.event.mentions,
      intent: input.event.intent ?? 'message',
    });
  }
  return createChannelMessage(identity, base);
}

/**
 * Build a delete tombstone, preserving the ORIGINAL event's schema version + v2
 * fields (same version-gate fix as buildEditedChannelMessage): a v2 chat reply
 * or mention-bearing message must tombstone as v2 so the tombstone stays linked
 * and passes verification, never re-signed as v1 with the v2 fields stripped.
 */
export function buildDeletedChannelMessage(
  identity: DeviceIdentity,
  input: {
    event: ChannelMessageEvent;
    hlc: Hlc;
  },
): ChannelMessageEvent {
  const base = {
    communityId: input.event.communityId,
    channelId: input.event.channelId,
    body: '',
    hlc: input.hlc,
    supersedes: { id: input.event.id, deleted: true },
  };
  if (input.event.version === 2) {
    return createChannelMessageV2(identity, {
      ...base,
      postId: input.event.postId,
      parentId: input.event.parentId,
      branchId: input.event.branchId,
      authorKind: input.event.authorKind ?? 'human',
      mentions: input.event.mentions,
      intent: input.event.intent ?? 'message',
    });
  }
  return createChannelMessage(identity, base);
}

/** Build a signed reaction event (intent 'react', body = one emoji grapheme or a pack token). */
export function buildReactionEvent(
  identity: DeviceIdentity,
  input: {
    communityId: string;
    channelId: string;
    targetEventId: string;
    targetPostId?: string;
    emoji: string;
    hlc: Hlc;
  },
): ChannelMessageEvent {
  if (!isSingleEmojiGrapheme(input.emoji) && !isPackReactionToken(input.emoji)) {
    throw new Error(REACTION_INVALID_EMOJI_ERROR);
  }
  return createChannelMessageV2(identity, {
    communityId: input.communityId,
    channelId: input.channelId,
    body: input.emoji,
    hlc: input.hlc,
    parentId: input.targetEventId,
    postId: input.targetPostId,
    authorKind: 'human',
    intent: 'react',
  });
}

/** Build the un-react tombstone superseding this device's own prior reaction. */
export function buildUnreactionEvent(
  identity: DeviceIdentity,
  input: {
    communityId: string;
    channelId: string;
    parentId: string;
    postId?: string;
    reactionEventId: string;
    hlc: Hlc;
  },
): ChannelMessageEvent {
  return createChannelMessageV2(identity, {
    communityId: input.communityId,
    channelId: input.channelId,
    body: '',
    hlc: input.hlc,
    parentId: input.parentId,
    postId: input.postId,
    authorKind: 'human',
    intent: 'react',
    supersedes: { id: input.reactionEventId, deleted: true },
  });
}
