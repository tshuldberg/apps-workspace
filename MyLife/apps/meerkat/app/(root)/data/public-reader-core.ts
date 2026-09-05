// Public Reader state + copy core (Plan 19, Meerkat Public Social Layer -- P5b).
//
// Pure, Node-testable helpers behind the read-only public reader stack. They own
// the verbatim section 7.2 copy, the 5-state selection from a real
// fetchPublicSnapshot result, the verified-event grouping (posts / replies /
// messages), and the local public-report persistence (a signed cm_public_reports
// row + honest copy). No network IO here: the screen runs fetchPublicSnapshot
// (the P4 client, which verifies fail-closed) and feeds the result in.

import type { DatabaseAdapter } from '@mylife/db';
import {
  bytesToHex,
  createPublicAbuseReport,
  extractSigningPrivateKeyHex,
  sha512Hex,
  signMessage,
  type ChannelMessageEvent,
  type DeviceIdentity,
  type FetchPublicSnapshotResult,
  type Hlc,
} from '@mylife/sync';
import {
  deriveChannelPostTitle,
  isChannelPostEvent,
  isChannelPostRootEvent,
} from './community-core';

const encoder = new TextEncoder();

// Verbatim section 7.2 + section 9 copy. Exported so the screens and the tests
// read the same strings (the screens must render these exact words).
export const READER_COPY = {
  banner:
    'You are reading public content. Anyone can read this. It is signed by its authors so it cannot be forged, but it is not private.',
  join: 'Reading is free. Create an identity and join to post or reply.',
  joinAction: 'Join to participate',
  audienceLabel: 'Public',
  loading: 'Fetching public content from a serving host…',
  empty: 'This public space has no posts yet',
  errorTitle: 'Could not load this public content',
  errorBody:
    'No serving host returned verified content. The publisher may have unpublished it, or no host is online.',
  reportAction: 'Report',
  // Section 9 report honesty. When a signed report reaches >=1 serving host's abuse
  // intake (a real HTTP 200), the notice says so; otherwise it stays saved-local.
  // We never claim publisher delivery: the sealed mailbox-to-owner path needs the
  // owner's X25519 DH key, which the PublicationDescriptor does not carry (the
  // documented P4 limit), so it is honestly unavailable and never faked.
  reportSentToHost: 'Sent to the host.',
  reportSavedLocal: 'Saved on this device. It will be sent when a connection server is available.',
} as const;

/** "Loading older history… {n} more pieces" -- the Partial footer (verbatim 7.2). */
export function loadingOlderLabel(morePieces: number): string {
  return `Loading older history… ${morePieces} more ${morePieces === 1 ? 'piece' : 'pieces'}`;
}

/** "{k} items skipped (failed verification)" -- shown only when k > 0 (never faked). */
export function skippedItemsLabel(skipped: number): string {
  return `${skipped} ${skipped === 1 ? 'item' : 'items'} skipped (failed verification)`;
}

export type ReaderState =
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'error'; detail: string }
  | { kind: 'success' }
  | { kind: 'partial'; morePieces: number; skipped: number };

export interface SelectReaderStateInput {
  /** A snapshot fetch is currently in flight. */
  inFlight: boolean;
  /** Count of verified items already displayed (a refresh re-pulls these). */
  shownItems: number;
  /** The most recent resolved fetch result, or null before the first one resolves. */
  result: FetchPublicSnapshotResult | null;
  /** Verify-failed pieces from the pull (0 with the atomic fail-closed P4 client). */
  skipped?: number;
}

/**
 * Select the Reader render state from the real fetch machine. Honest mapping:
 *  - in flight + nothing shown        -> Loading
 *  - in flight + items already shown   -> Partial (a refresh is re-pulling them)
 *  - resolved, fetch failed/killed/404 -> Error
 *  - resolved, verified but zero events-> Empty
 *  - resolved, verified events present -> Success
 */
export function selectReaderState(input: SelectReaderStateInput): ReaderState {
  const skipped = input.skipped ?? 0;
  if (input.inFlight) {
    if (input.shownItems > 0) {
      return { kind: 'partial', morePieces: input.shownItems, skipped };
    }
    return { kind: 'loading' };
  }
  const result = input.result;
  if (!result) return { kind: 'loading' };
  if (!result.ok) return { kind: 'error', detail: READER_COPY.errorBody };
  if (result.events.length === 0) return { kind: 'empty' };
  return { kind: 'success' };
}

export interface PublicPostThread {
  postId: string;
  channelId: string;
  root: ChannelMessageEvent;
  title: string | null;
  replies: ChannelMessageEvent[];
  lastActivity: Hlc;
}

export interface PublicChannelGroup {
  channelId: string;
  posts: PublicPostThread[];
  /** Non-post (plain) channel messages, oldest-first. */
  messages: ChannelMessageEvent[];
}

function compareHlc(a: Hlc, b: Hlc): number {
  if (a.wall !== b.wall) return a.wall < b.wall ? -1 : 1;
  return a.counter - b.counter;
}

/**
 * Group a channel's VERIFIED events into post threads + plain messages, read-only.
 * Posts are roots (parentId === postId); replies share the postId; everything else
 * is a plain channel message. Order is signed-HLC ascending (deterministic).
 */
export function groupChannelEvents(
  channelId: string,
  events: readonly ChannelMessageEvent[],
): PublicChannelGroup {
  const ordered = [...events].sort((a, b) => compareHlc(a.hlc, b.hlc));
  const roots = new Map<string, ChannelMessageEvent>();
  const related = new Map<string, ChannelMessageEvent[]>();
  const messages: ChannelMessageEvent[] = [];

  for (const event of ordered) {
    if (isChannelPostEvent(event)) {
      const list = related.get(event.postId) ?? [];
      list.push(event);
      related.set(event.postId, list);
      if (isChannelPostRootEvent(event)) roots.set(event.postId, event);
    } else {
      messages.push(event);
    }
  }

  const posts: PublicPostThread[] = [];
  for (const [postId, root] of roots) {
    const list = related.get(postId) ?? [root];
    const replies = list.filter((event) => !isChannelPostRootEvent(event));
    const lastActivity = list.reduce(
      (current, event) => (compareHlc(event.hlc, current) > 0 ? event.hlc : current),
      root.hlc,
    );
    posts.push({
      postId,
      channelId,
      root,
      title: deriveChannelPostTitle(root.body),
      replies,
      lastActivity,
    });
  }
  posts.sort((a, b) => -compareHlc(a.lastActivity, b.lastActivity));

  return { channelId, posts, messages };
}

/** Group a full fetch result's channels. Only verified events ever reach here. */
export function groupPublicSnapshot(
  channels: readonly { channelId: string; events: ChannelMessageEvent[] }[],
): PublicChannelGroup[] {
  return channels.map((channel) => groupChannelEvents(channel.channelId, channel.events));
}

export type PublicReportReason =
  | 'spam'
  | 'harassment'
  | 'illegal'
  | 'csam'
  | 'violence'
  | 'other';

export type PublicReportTargetKind = 'post' | 'reply' | 'file' | 'community';

export const PUBLIC_REPORT_REASONS: { code: PublicReportReason; label: string }[] = [
  { code: 'spam', label: 'Spam' },
  { code: 'harassment', label: 'Harassment' },
  { code: 'illegal', label: 'Illegal' },
  { code: 'csam', label: 'CSAM' },
  { code: 'violence', label: 'Violence' },
  { code: 'other', label: 'Other' },
];

export interface PersistPublicReportInput {
  publicationId: string;
  targetKind: PublicReportTargetKind;
  targetId: string;
  reason: PublicReportReason;
  reporter: DeviceIdentity;
  /**
   * The reachable serving hosts to deliver the signed report to (the directory
   * entry's host_urls). The report is POSTed to each host's open abuse intake; the
   * notice claims host delivery only when at least one returns HTTP 200.
   */
  hostUrls?: string[];
  now?: () => string;
}

export interface PersistPublicReportResult {
  reportId: string;
  status: 'open';
  notice: string;
  /** Hosts whose abuse intake accepted the signed report (real HTTP 200). */
  delivered: number;
  /** Reachable hosts the report was attempted against. */
  attempted: number;
}

/** Injected seams for report delivery (real defaults; tests inject stubs). */
export interface PublicReportDeliveryDeps {
  createPublicAbuseReport: typeof createPublicAbuseReport;
  fetchFn: typeof fetch;
}

const DEFAULT_REPORT_DELIVERY_DEPS: PublicReportDeliveryDeps = {
  createPublicAbuseReport,
  fetchFn: (globalThis.fetch?.bind(globalThis) as typeof fetch),
};

function trimReportHost(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/** POST one signed UNSEALED report to a host abuse intake; true only on HTTP 200. */
async function deliverReportToHost(
  fetchFn: typeof fetch,
  host: string,
  publicationId: string,
  signed: ReturnType<typeof createPublicAbuseReport>,
): Promise<boolean> {
  const base = trimReportHost(host);
  if (!base || !/^https?:\/\//i.test(base)) return false;
  try {
    const res = await fetchFn(`${base}/public/${encodeURIComponent(publicationId)}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signed),
    });
    return res.status === 200;
  } catch {
    return false;
  }
}

/**
 * Persist a signed public-content report to the device-local cm_public_reports
 * table, then DELIVER it to the serving hosts' open abuse intake and return honest
 * copy. The local row is always written (signed with the reporter's own Ed25519 key
 * so it cannot be forged). The report is ALSO built as a signed UNSEALED
 * SignedPublicAbuseReport and POSTed to each reachable host
 * (`POST {host}/public/{publicationId}/report`); the notice says "Sent to the host."
 * only when at least one host returns HTTP 200, otherwise it stays saved-local
 * (section 9 honesty). The sealed mailbox-to-owner path stays honestly unavailable:
 * the PublicationDescriptor carries no owner DH key (the documented P4 limit), so we
 * never claim publisher delivery and never fabricate it.
 */
export async function persistPublicReport(
  db: DatabaseAdapter,
  input: PersistPublicReportInput,
  deps: Partial<PublicReportDeliveryDeps> = {},
): Promise<PersistPublicReportResult> {
  const d = { ...DEFAULT_REPORT_DELIVERY_DEPS, ...deps };
  const createdAt = (input.now ?? (() => new Date().toISOString()))();
  const canonical = JSON.stringify({
    v: 1,
    publicationId: input.publicationId,
    targetKind: input.targetKind,
    targetId: input.targetId,
    reason: input.reason,
    reporterDeviceId: input.reporter.publicKey,
    createdAt,
  });
  const signature = bytesToHex(
    signMessage(extractSigningPrivateKeyHex(input.reporter.privateKeyRef), encoder.encode(canonical)),
  );
  const reportId = `rep_${sha512Hex(encoder.encode(canonical)).slice(0, 32)}`;
  db.execute(
    `INSERT OR REPLACE INTO cm_public_reports (
      report_id, publication_id, target_kind, target_id, reason,
      reporter_device_id, signature_hex, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?)`,
    [
      reportId,
      input.publicationId,
      input.targetKind,
      input.targetId,
      input.reason,
      input.reporter.publicKey,
      signature,
      createdAt,
    ],
  );

  const hostUrls = (input.hostUrls ?? []).filter((u) => trimReportHost(u).length > 0);
  let delivered = 0;
  if (hostUrls.length > 0) {
    const signedReport = d.createPublicAbuseReport(input.reporter, {
      publicationId: input.publicationId,
      targetKind: input.targetKind,
      targetId: input.targetId,
      reason: input.reason,
      reportedAt: createdAt,
    });
    for (const host of hostUrls) {
      if (await deliverReportToHost(d.fetchFn, host, input.publicationId, signedReport)) delivered += 1;
    }
  }

  const notice = delivered > 0 ? READER_COPY.reportSentToHost : READER_COPY.reportSavedLocal;
  return { reportId, status: 'open', notice, delivered, attempted: hostUrls.length };
}
