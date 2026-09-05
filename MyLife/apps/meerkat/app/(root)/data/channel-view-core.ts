// Plan 30 Phase 2: pure mapping between the channel read models and the shared
// chat kit. The screen wires providers + effects; every branch worth testing
// lives here so the node-only mobile vitest can cover it without a React harness.
// No side effects, no provider imports.

import type { ChannelMessageEvent } from '@mylife/sync';
import type { ChannelChatItem } from '../providers/ChatProvider';
import { isEventAfterReadBoundary, type ReadBoundary } from './community-core';
import type { ChatKitMessage, ChatKitReplyContext } from '../components/chat/chat-kit-core';

/**
 * The id of the first message NEWER than the last-read boundary and NOT authored
 * by this device -- the anchor for the "New messages" divider. Returns null when
 * there is no read boundary yet (a first visit shows no divider) or nothing is
 * unread. Uses the canonical (wall, counter, authorDeviceId) boundary compare, so
 * a distinct remote event at the exact boundary (wall, counter) still anchors the
 * divider (m3). `events` must be sorted ascending (listChannelMessages order).
 */
export function firstUnreadEventId(
  events: readonly ChannelMessageEvent[],
  boundary: ReadBoundary | null,
  selfDeviceId: string,
): string | null {
  if (!boundary) return null;
  for (const event of events) {
    if (event.authorDeviceId === selfDeviceId) continue;
    if (isEventAfterReadBoundary(event.hlc.wall, event.hlc.counter, event.authorDeviceId, boundary)) {
      return event.id;
    }
  }
  return null;
}

const REPLY_SNIPPET_MAX = 120;

/** A one-line, whitespace-collapsed preview of a reply target's body. */
export function replySnippet(event: ChannelMessageEvent): string {
  const body = event.body.replace(/\s+/gu, ' ').trim();
  if (body.length > 0) {
    return body.length > REPLY_SNIPPET_MAX ? `${body.slice(0, REPLY_SNIPPET_MAX - 1)}…` : body;
  }
  if (event.attachments && event.attachments.length > 0) return 'Attachment';
  return 'Message';
}

/**
 * The reply-context snippet for a message, resolved from the visible chat events.
 * Returns null when there is no parentId, or the target is not locally present
 * (deleted, unimported, or a reaction). Reactions are already excluded from the
 * stream, so eventsById never holds one.
 */
export function buildReplyContext(
  parentId: string | undefined,
  eventsById: Map<string, ChannelMessageEvent>,
  resolveName: (deviceId: string) => string,
): ChatKitReplyContext | null {
  if (!parentId) return null;
  const target = eventsById.get(parentId);
  if (!target) return null;
  return {
    targetId: target.id,
    authorName: resolveName(target.authorDeviceId),
    snippet: replySnippet(target),
  };
}

/**
 * The id of the newest VISIBLE signed event across chat AND posts (local pending
 * sends and caller-hidden events excluded; reactions are already absent from the
 * channel stream). This gates the read-cursor advance so a posts-only channel
 * (e.g. an announcements channel with zero chat messages) still clears its unread
 * cursor -- a chat-only newest-id would be null there and never advance.
 */
export function newestVisibleEventId(
  items: readonly ChannelChatItem[],
  isHidden: (event: ChannelMessageEvent) => boolean,
): string | null {
  let newest: ChannelMessageEvent | null = null;
  for (const item of items) {
    if (item.kind !== 'event') continue;
    if (isHidden(item.event)) continue;
    // The stream is sorted ascending, so the last non-hidden event is the newest.
    newest = item.event;
  }
  return newest?.id ?? null;
}

export interface ChannelChatViewDeps {
  selfDeviceId: string;
  /** The visible chat events keyed by id, for reply-context resolution. */
  eventsById: Map<string, ChannelMessageEvent>;
  /** Friendly author label for a reply quote (may return "You" for self). */
  resolveReplyName: (deviceId: string) => string;
  /** Verified v3 name-color token for an author, or null (feature 6). */
  resolveNameColor?: (deviceId: string) => string | null;
  /** Role bubble-shape token for an author, or null (feature 4). */
  resolveBubbleShape?: (deviceId: string) => string | null;
}

/**
 * Map one ChannelChatItem (a sent event or a local pending/failed send) to the
 * normalized ChatKitMessage the kit renders. A sent event is "edited" when it
 * supersedes a prior message and is not a deletion; a local send carries its
 * honest failure copy. Reply context is resolved only for sent events.
 */
export function mapChatItemToKit(
  item: ChannelChatItem,
  deps: ChannelChatViewDeps,
): ChatKitMessage {
  if (item.kind === 'event') {
    const e = item.event;
    return {
      id: e.id,
      authorId: e.authorDeviceId,
      wall: e.hlc.wall,
      isMine: e.authorDeviceId === deps.selfDeviceId,
      body: e.body,
      status: 'sent',
      edited: !!e.supersedes && !e.supersedes.deleted,
      errorText: null,
      replyTo: buildReplyContext(e.parentId, deps.eventsById, deps.resolveReplyName),
      authorNameColorToken: deps.resolveNameColor?.(e.authorDeviceId) ?? null,
      authorBubbleShape: deps.resolveBubbleShape?.(e.authorDeviceId) ?? null,
    };
  }
  const m = item.message;
  return {
    id: m.clientId,
    authorId: deps.selfDeviceId,
    wall: m.createdAt,
    isMine: true,
    body: m.body,
    status: item.status,
    edited: false,
    errorText: item.status === 'failed' ? (m.error ?? null) : null,
    replyTo: null,
  };
}

/**
 * The distinct display names a signed message addresses, in mention order. These
 * feed the render-pass highlight (display sugar only): a name is highlighted, an
 * identity is never claimed. Dedupes by resolved name so a name that maps two
 * device ids highlights once.
 */
export function mentionDisplayNames(
  event: ChannelMessageEvent,
  resolveName: (deviceId: string) => string,
): string[] {
  if (!event.mentions || event.mentions.length === 0) return [];
  const names: string[] = [];
  const seen = new Set<string>();
  for (const deviceId of event.mentions) {
    const name = resolveName(deviceId);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
}
