// PublicReaderView (Plan 19 P6, web): the DEDICATED read-only public reader.
// Mirrors the mobile PublicReader (apps/meerkat/app/(root)/components/PublicReader.tsx).
//
// IMPORTANT: this does NOT reuse ChannelView/PostThreadView. Those render LIVE
// community data via m.listChannelMessages(), which is the WRONG source for
// public content. This reader pulls the VERIFIED public snapshot through the P4
// helper fetchPublicSnapshot (browser-native global fetch), binding
// expectedAuthor = descriptor.ownerDeviceId and expectedContentId =
// descriptor.contentId so a host cannot forge or swap content (TC-2/TC-3). All
// display fields come from the signature-verified descriptor, never host-asserted.
// Verbatim section 7.2 + section 9 copy across all 5 states.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createAudienceRule,
  fetchPublicSnapshot,
  publicSnapshotKeyFromHex,
  redeemPublicJoinGrant,
  verifyPublicJoinGrant,
  type ChannelMessageEvent,
  type FetchPublicSnapshotResult,
  type SignedPublicationDescriptor,
} from '@mylife/sync';
import { useMeerkat } from '../../lib/MeerkatProvider';
import {
  getDirectoryCacheEntry,
  pagePublicReader,
  setPublicFeedCursor,
  type VerifiedPublicEntry,
} from '../../lib/public-directory-client';
import { requestPublicJoin } from '../../lib/public-join-client';
import {
  clearStoredHumanityToken,
  getStoredHumanityToken,
  humanityGateState,
} from '../../lib/humanity-core';
import { VerifySheet } from './VerifySheet';
import { PUBLIC_CATEGORY_LABELS } from '../../lib/discover-core';
import {
  READER_COPY,
  PUBLIC_REPORT_REASONS,
  groupPublicSnapshot,
  loadingOlderLabel,
  persistPublicReport,
  selectReaderState,
  skippedItemsLabel,
  type PublicChannelGroup,
  type PublicReportReason,
  type PublicReportTargetKind,
} from '../../lib/public-reader-core';
import { AudienceBadge } from '../audience/AudienceRule';
import { shortHex } from '../format';
import { Button } from '../shell/Button';
import { HonestNotice } from '../shell/HonestNotice';

const publicRule = createAudienceRule({ type: 'public' });

function parseHostUrls(json: string): string[] {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((u): u is string => typeof u === 'string' && u.trim().length > 0);
  } catch {
    return [];
  }
}

interface ReportTarget {
  targetKind: PublicReportTargetKind;
  targetId: string;
}

export function PublicReaderView({
  publicationId,
  onBack,
}: {
  publicationId: string;
  onBack: () => void;
}): React.ReactElement {
  const m = useMeerkat();
  const db = m.db;

  const [entry] = useState<VerifiedPublicEntry | null>(() => getDirectoryCacheEntry(db, publicationId));
  const [result, setResult] = useState<FetchPublicSnapshotResult | null>(null);
  const [inFlight, setInFlight] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [reportNotice, setReportNotice] = useState<string | null>(null);
  const [joinNotice, setJoinNotice] = useState<string | null>(null);
  const loadSeq = useRef(0);
  // FF2 warm-tail paging: after the initial snapshot (trust anchor), a re-render pages
  // only the verified events after the device-local cursor and appends them.
  const loadedRef = useRef(false);
  const [tail, setTail] = useState<Record<string, ChannelMessageEvent[]>>({});
  const [loadingNewer, setLoadingNewer] = useState(false);

  const load = useCallback(() => {
    const seq = loadSeq.current + 1;
    loadSeq.current = seq;
    setInFlight(true);
    setReportNotice(null);
    void (async () => {
      try {
        if (!entry) {
          if (loadSeq.current === seq) {
            setResult({ ok: false, reason: 'not_found' });
            setInFlight(false);
          }
          return;
        }
        const hosts = parseHostUrls(entry.host_urls);
        // Can throw on a corrupt/legacy cache row (malformed hex); the outer catch
        // renders the honest error state instead of stranding the loading spinner.
        const publicKey = publicSnapshotKeyFromHex(entry.public_key_hex);
        let last: FetchPublicSnapshotResult = { ok: false, reason: 'manifest_failed' };
        for (const baseUrl of hosts) {
          try {
            last = await fetchPublicSnapshot({
              baseUrl,
              publicationId,
              publicKey,
              expectedContentId: entry.content_id,
              expectedAuthor: entry.owner_device_id,
            });
          } catch {
            last = { ok: false, reason: 'manifest_failed' };
          }
          if (last.ok) break;
        }
        if (loadSeq.current !== seq) return;
        setResult(last);
        // FF2: on a real successful pull, seed the per-channel warm-tail cursor to the
        // newest verified event so a subsequent focus pages only newer content.
        if (last.ok) {
          loadedRef.current = true;
          setTail({});
          for (const ch of last.channels) {
            const newest = ch.events[ch.events.length - 1];
            if (newest) setPublicFeedCursor(db, publicationId, ch.channelId, newest.hlc, entry.source_host);
          }
        }
        setInFlight(false);
      } catch {
        if (loadSeq.current !== seq) return;
        setResult({ ok: false, reason: 'manifest_failed' });
        setInFlight(false);
      }
    })();
  }, [db, entry, publicationId]);

  // FF2: page ONLY the verified warm tail after the cursor (per channel) and append it.
  const loadNewer = useCallback(async () => {
    if (!result || !result.ok || !entry || loadingNewer) return;
    setLoadingNewer(true);
    const hosts = parseHostUrls(entry.host_urls);
    const communityId = result.descriptor.descriptor.communityId;
    const added: Record<string, ChannelMessageEvent[]> = {};
    for (const ch of result.channels) {
      for (const baseUrl of hosts) {
        try {
          const page = await pagePublicReader(db, {
            baseUrl, publicationId, channelId: ch.channelId, expectedCommunityId: communityId,
          });
          if (page.ok) {
            if (page.events.length > 0) added[ch.channelId] = page.events;
            break;
          }
        } catch {
          // try the next host
        }
      }
    }
    if (Object.keys(added).length > 0) {
      setTail((prev) => {
        const next = { ...prev };
        for (const [cid, evs] of Object.entries(added)) next[cid] = [...(prev[cid] ?? []), ...evs];
        return next;
      });
    }
    setLoadingNewer(false);
  }, [db, result, entry, publicationId, loadingNewer]);

  useEffect(() => {
    // First mount: full snapshot (the trust anchor). Later: warm-tail page.
    if (!loadedRef.current) load();
    else void loadNewer();
  }, [load, loadNewer]);

  // Read-only verified groups. Display fields come from result.descriptor
  // (signature-verified), never host-asserted (TC-3 / section 5.2).
  const groups: PublicChannelGroup[] = useMemo(() => {
    if (!result || !result.ok) return [];
    // FF2: merge the appended warm-tail events into each channel before grouping.
    const merged = result.channels.map((ch) => ({
      channelId: ch.channelId,
      events: [...ch.events, ...(tail[ch.channelId] ?? [])],
    }));
    return groupPublicSnapshot(merged);
  }, [result, tail]);

  const shownItems = useMemo(
    () => groups.reduce((n, g) => n + g.messages.length + g.posts.reduce((s, p) => s + 1 + p.replies.length, 0), 0),
    [groups],
  );

  const state = useMemo(
    () => selectReaderState({ inFlight, shownItems, result }),
    [inFlight, shownItems, result],
  );

  const descriptor = result && result.ok ? result.descriptor.descriptor : null;
  const headerTitle = descriptor?.title ?? entry?.title ?? 'Public content';
  const categoryLabel = descriptor
    ? PUBLIC_CATEGORY_LABELS[descriptor.category] ?? descriptor.category
    : null;

  const fileReport = useCallback(
    (reason: PublicReportReason) => {
      if (!reportTarget) return;
      const target = reportTarget;
      const hostUrls = entry ? parseHostUrls(entry.host_urls) : [];
      setReportTarget(null);
      setReportNotice(null);
      void (async () => {
        try {
          // Web has a real global fetch (matches PublishSheet's default-deps pattern).
          // persistPublicReport signs with this device's key and writes the local
          // row; either can throw (key unavailable, storage failure).
          const outcome = await persistPublicReport(db, {
            publicationId,
            targetKind: target.targetKind,
            targetId: target.targetId,
            reason,
            reporter: m.identity,
            hostUrls,
          });
          setReportNotice(outcome.notice);
        } catch {
          setReportNotice('The report could not be saved on this device. Nothing was sent.');
        }
      })();
    },
    [db, entry, m.identity, publicationId, reportTarget],
  );

  // A request-policy join is a SHARED-network action gated by humanity (AM1). The
  // descriptor awaiting a token sits here while the VerifySheet is up.
  const [pendingJoin, setPendingJoin] = useState<SignedPublicationDescriptor | null>(null);

  // Two fast clicks must not seal + park the request twice (the humanity token is
  // single-use); the ref is taken synchronously before the first await.
  const joinInFlightRef = useRef(false);

  // Submit the request-policy join with the wallet's humanity token, then spend it
  // (single-use). Only reached when the gate is 'verified' (a real stored token).
  const submitJoinRequest = useCallback((descriptor: SignedPublicationDescriptor) => {
    if (joinInFlightRef.current) return;
    const token = getStoredHumanityToken(db);
    if (!token) return; // gate should have blocked; never send an empty token
    joinInFlightRef.current = true;
    void (async () => {
      try {
        // requestPublicJoin resolves the effective relay, which can throw.
        const outcome = await requestPublicJoin(db, m.identity, descriptor, token);
        clearStoredHumanityToken(db); // single-use: drop so the next join re-verifies
        void db.flush().catch(() => undefined);
        setJoinNotice(
          outcome.kind === 'sent'
            ? 'Request sent. The owner approves it over a connection server before you get community access. Reading stays free and anonymous.'
            : outcome.kind === 'saved'
              ? 'Saved on this device. It will be sent when a connection server is available.'
              : 'This community is not accepting join requests right now. Reading stays free and anonymous.',
        );
      } catch {
        setJoinNotice('The join request could not be sent right now. Try again when you are online.');
      } finally {
        joinInFlightRef.current = false;
      }
    })();
  }, [db, m.identity]);

  const onJoin = useCallback(() => {
    // Reading is anonymous; joining is an EXPLICIT action that uses this device's
    // identity. Dispatch by the owner-signed joinPolicy on the FRESHLY fetched
    // descriptor (the live trust anchor). Honest copy only (mirrors mobile).
    if (!result || !result.ok) {
      setJoinNotice('Open this content first, then join.');
      return;
    }
    const descriptor = result.descriptor;
    if (descriptor.descriptor.joinPolicy === 'open' && verifyPublicJoinGrant(descriptor)) {
      const r = redeemPublicJoinGrant(db, m.identity, descriptor);
      setJoinNotice(
        r.ok
          ? 'Saved on this device. You will get community access once a connection server delivers the key. Reading stays free and anonymous.'
          : 'This community is not accepting open joins right now.',
      );
    } else {
      // REQUEST (or no grant): gate on humanity (AM1). Verified -> submit with the
      // stored token; otherwise open the VerifySheet (which blocks honestly when
      // no service is configured). We NEVER park an empty-token request.
      if (humanityGateState(db) === 'verified') {
        submitJoinRequest(descriptor);
      } else {
        setPendingJoin(descriptor);
      }
    }
  }, [db, m.identity, result, submitJoinRequest]);

  return (
    <div className="mk-main-scroll mk-reader">
      <header className="mk-reader-head">
        <button type="button" className="mk-btn is-ghost is-small" aria-label="Back" onClick={onBack}>
          ‹ Back
        </button>
        <div className="mk-reader-head-text">
          <h1 className="mk-reader-title">{headerTitle}</h1>
          <div className="mk-reader-head-meta">
            <AudienceBadge rule={publicRule} />
            {categoryLabel ? <span className="mk-reader-cat">{categoryLabel}</span> : null}
          </div>
        </div>
      </header>

      <HonestNotice>{READER_COPY.banner}</HonestNotice>

      {descriptor?.description ? <p className="mk-reader-desc">{descriptor.description}</p> : null}

      {loadingNewer ? <p className="mk-muted">Checking for newer posts…</p> : null}

      {state.kind === 'loading' ? (
        <div className="mk-reader-state">
          <p className="mk-reader-state-text">{READER_COPY.loading}</p>
        </div>
      ) : null}

      {state.kind === 'empty' ? (
        <div className="mk-reader-state">
          <p className="mk-reader-state-title">{READER_COPY.empty}</p>
        </div>
      ) : null}

      {state.kind === 'error' ? (
        <div className="mk-reader-state">
          <p className="mk-reader-state-title">{READER_COPY.errorTitle}</p>
          <p className="mk-reader-state-text">{state.detail}</p>
        </div>
      ) : null}

      {state.kind === 'success' || state.kind === 'partial'
        ? groups.map((group) => (
            <PublicChannelSection
              key={group.channelId}
              group={group}
              onReport={(target) => setReportTarget(target)}
            />
          ))
        : null}

      {state.kind === 'partial' ? (
        <div className="mk-reader-partial">
          <p className="mk-reader-partial-text">{loadingOlderLabel(state.morePieces)}</p>
          {state.skipped > 0 ? (
            <p className="mk-reader-skipped">{skippedItemsLabel(state.skipped)}</p>
          ) : null}
        </div>
      ) : null}

      <section className="mk-reader-join">
        <h2 className="mk-h2">Want to take part?</h2>
        <p className="mk-muted">{READER_COPY.join}</p>
        <Button variant="ghost" onClick={onJoin}>
          {READER_COPY.joinAction}
        </Button>
        {joinNotice ? <div className="mk-box is-info">{joinNotice}</div> : null}
      </section>

      {reportNotice ? <div className="mk-box is-info">{reportNotice}</div> : null}

      {reportTarget ? (
        <div className="mk-reader-report-backdrop" role="dialog" aria-modal="true" aria-label="Report public content">
          <div className="mk-reader-report-sheet">
            <h3 className="mk-reader-report-title">Report public content</h3>
            <p className="mk-muted">
              Reports are signed and saved on this device. Hiding is local until the owner unpublishes or a
              host removes it.
            </p>
            <div className="mk-reader-reason-grid">
              {PUBLIC_REPORT_REASONS.map((reason) => (
                <button
                  key={reason.code}
                  type="button"
                  className="mk-reader-reason"
                  aria-label={`Report reason ${reason.label}`}
                  onClick={() => fileReport(reason.code)}
                >
                  {reason.label}
                </button>
              ))}
            </div>
            <Button variant="ghost" small onClick={() => setReportTarget(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {pendingJoin !== null && (
        <VerifySheet
          onClose={() => setPendingJoin(null)}
          onVerified={() => { if (pendingJoin) submitJoinRequest(pendingJoin); setPendingJoin(null); }}
          purpose="join this community"
        />
      )}
    </div>
  );
}

function PublicChannelSection({
  group,
  onReport,
}: {
  group: PublicChannelGroup;
  onReport: (target: ReportTarget) => void;
}): React.ReactElement {
  return (
    <section className="mk-reader-section">
      <div className="mk-reader-channel">#{group.channelId}</div>

      {group.posts.map((post) => (
        <article key={post.postId} className="mk-reader-post">
          <div className="mk-reader-item-head">
            <span className="mk-reader-author">{shortHex(post.root.authorDeviceId)}</span>
            <ReportChip onPress={() => onReport({ targetKind: 'post', targetId: post.root.id })} />
          </div>
          {post.title ? <h3 className="mk-reader-post-title">{post.title}</h3> : null}
          <p className="mk-reader-body">{post.root.body}</p>
          {post.replies.map((reply) => (
            <div key={reply.id} className="mk-reader-reply">
              <div className="mk-reader-item-head">
                <span className="mk-reader-author">{shortHex(reply.authorDeviceId)}</span>
                <ReportChip onPress={() => onReport({ targetKind: 'reply', targetId: reply.id })} />
              </div>
              <p className="mk-reader-body">{reply.body}</p>
            </div>
          ))}
        </article>
      ))}

      {group.messages.map((message) => (
        <div key={message.id} className="mk-reader-message">
          <div className="mk-reader-item-head">
            <span className="mk-reader-author">{shortHex(message.authorDeviceId)}</span>
            <ReportChip onPress={() => onReport({ targetKind: 'reply', targetId: message.id })} />
          </div>
          <p className="mk-reader-body">{message.body}</p>
          <PublicAttachmentLinks event={message} />
        </div>
      ))}
    </section>
  );
}

function PublicAttachmentLinks({ event }: { event: ChannelMessageEvent }): React.ReactElement | null {
  if (!event.attachments || event.attachments.length === 0) return null;
  return (
    <div className="mk-reader-attachments">
      {event.attachments.map((att) => (
        <span key={att.id} className="mk-reader-attachment">
          {att.name} ({att.mimeType})
        </span>
      ))}
    </div>
  );
}

function ReportChip({ onPress }: { onPress: () => void }): React.ReactElement {
  return (
    <button type="button" className="mk-reader-report-chip" aria-label="Report" onClick={onPress}>
      {READER_COPY.reportAction}
    </button>
  );
}
