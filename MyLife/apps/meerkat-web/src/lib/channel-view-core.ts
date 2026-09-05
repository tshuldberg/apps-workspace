// Plan 30 Phase 4: the WEB twin of apps/meerkat/app/(root)/data/channel-view-core.ts.
//
// Pure mapping between the channel read models and the shared chat kit. The web
// view wires the provider + effects; every branch worth testing lives here so
// vitest can cover it without a React harness. No side effects, no provider
// imports. The web has no local pending/failed send queue (attachAndSend resolves
// to a recorded event before the list re-reads), so this maps a raw resolved
// ChannelMessageEvent straight to a ChatKitMessage, unlike the mobile twin which
// also folds in optimistic local sends.

import type { ChannelMessageEvent } from '@mylife/sync';
import { isEventAfterReadBoundary, type ReadBoundary } from './meerkat-data';
import type { ChatKitMessage, ChatKitReplyContext } from './chat-kit-core';

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
 * The id of the newest VISIBLE signed event across chat AND posts (caller-hidden
 * events excluded; reactions are already absent from the channel stream). This
 * gates the read-cursor advance so a posts-only channel (e.g. an announcements
 * channel with zero chat messages) still clears its unread cursor -- a chat-only
 * newest-id would be null there and never advance.
 */
export function newestVisibleEventId(
  events: readonly ChannelMessageEvent[],
  isHidden: (event: ChannelMessageEvent) => boolean,
): string | null {
  let newest: ChannelMessageEvent | null = null;
  for (const event of events) {
    if (isHidden(event)) continue;
    // The stream is sorted ascending, so the last non-hidden event is the newest.
    newest = event;
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
 * Map one resolved ChannelMessageEvent to the normalized ChatKitMessage the kit
 * renders. A sent event is "edited" when it supersedes a prior message and is not
 * a deletion. Reply context is resolved from the visible chat events.
 */
export function mapEventToKit(
  event: ChannelMessageEvent,
  deps: ChannelChatViewDeps,
): ChatKitMessage {
  return {
    id: event.id,
    authorId: event.authorDeviceId,
    wall: event.hlc.wall,
    isMine: event.authorDeviceId === deps.selfDeviceId,
    body: event.body,
    status: 'sent',
    edited: !!event.supersedes && !event.supersedes.deleted,
    errorText: null,
    replyTo: buildReplyContext(event.parentId, deps.eventsById, deps.resolveReplyName),
    authorNameColorToken: deps.resolveNameColor?.(event.authorDeviceId) ?? null,
    authorBubbleShape: deps.resolveBubbleShape?.(event.authorDeviceId) ?? null,
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
