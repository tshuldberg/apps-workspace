// Plan 32 T4.1 (web twin of mobile (tabs)/index.tsx): the content-first Feed.
//
// A list of content cards (design decision 1): avatar + author + one muted context
// line with an info button, inline first-image media, body, and an engagement row
// ([replies] [heart] [share on public only]). The transparency that used to live
// on every card (kind pill, audience badge, reason sentence, action pill) and the
// hero + standing honesty paragraph moved one tap deep into the why-popover; the
// source toggles + excluded list moved into the filter panel. Web has no pull
// gesture, so a header Refresh button runs the SAME real drain + probe + re-list.
// The deterministic local ranking (feed-core) is untouched (NC-5); every count
// comes from a verified feed field (NC-1). No fetch happens on this surface.

import { getPublicKeyFingerprint } from '@mylife/sync';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMeerkat } from '../../lib/MeerkatProvider';
import {
  evaluateLocalFeed,
  FEED_CONTROLS_SETTING_KEY,
  parseFeedControls,
  serializeFeedControls,
  type FeedControlKey,
  type FeedControls,
  type FeedItem,
} from '../../lib/feed-core';
import { getSetting, setSetting } from '../../lib/meerkat-data';
import {
  probePublicDirectory,
  type ProbePublicDirectoryResult,
} from '../../lib/public-directory-client';
import { resolveReactionTap } from '../../lib/chat-kit-core';
import { shortHex } from '../format';
import { Button } from '../shell/Button';
import { useView } from '../navigation/useView';
import { Avatar } from '../kit/Avatar';
import { LinkPreviewCard } from '../channel/LinkPreviewCard';
import { FeedMediaImage } from './FeedMediaImage';
import { WhyPopover } from './WhyPopover';
import { FeedFilterPanel } from './FeedFilterPanel';
import {
  HEART_EMOJI,
  buildPublicShareMessage,
  findPostRootEventId,
  toFeedCardView,
} from './feed-view-core';

export function FeedView(): React.ReactElement {
  const m = useMeerkat();
  const { dispatch } = useView();
  const revision = m.revision;

  // Composition Phase 0: source toggles persist across launches (fail-safe parse).
  const [controls, setControls] = useState<FeedControls>(
    () => parseFeedControls(getSetting(m.db, FEED_CONTROLS_SETTING_KEY)),
  );
  // null => the public directory probe has not resolved yet (loading state).
  const [publicSource, setPublicSource] = useState<ProbePublicDirectoryResult | null>(null);
  const [whyItem, setWhyItem] = useState<FeedItem | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // A brief, honest notice from a REAL send/share result (never a guess).
  const [notice, setNotice] = useState<string | null>(null);

  const communities = useMemo(() => {
    void revision;
    return m.listCommunities();
  }, [m, revision]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await probePublicDirectory(m.db);
      if (!cancelled) setPublicSource(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [m.db]);

  const peerNamesByCommunity = useMemo(() => {
    void revision;
    const maps = new Map<string, Map<string, string>>();
    for (const community of communities) {
      maps.set(community.communityId, m.communityPeerNames(community.communityId));
    }
    return maps;
  }, [communities, m, revision]);

  // chatState/revision is a dep so a heart toggle (which bumps revision) re-evaluates
  // the feed and the count/fill reflect the real recorded row.
  const feed = useMemo(
    () => {
      void revision;
      return evaluateLocalFeed({
        db: m.db,
        communities,
        selfDeviceId: m.identity.publicKey,
        controls,
        publicSource: publicSource ?? undefined,
      });
    },
    [communities, controls, m.db, m.identity.publicKey, publicSource, revision],
  );
  const nowMs = useMemo(() => {
    void feed;
    return Date.now();
  }, [feed]);

  const resolveName = useCallback(
    (item: FeedItem): string => {
      const names = peerNamesByCommunity.get(item.communityId);
      if (item.authorDeviceId === m.identity.publicKey) {
        const communityName = names?.get(item.authorDeviceId);
        return communityName ? `You as ${communityName}` : 'You';
      }
      return names?.get(item.authorDeviceId) ?? shortHex(getPublicKeyFingerprint(item.authorDeviceId));
    },
    [m.identity.publicKey, peerNamesByCommunity],
  );

  const toggleControl = useCallback((key: FeedControlKey): void => {
    setControls((current) => {
      const next = { ...current, [key]: !current[key] };
      // Persist best-effort: a settings write failure never breaks the toggle.
      try {
        setSetting(m.db, FEED_CONTROLS_SETTING_KEY, serializeFeedControls(next));
      } catch {
        // The in-memory toggle still applies this session.
      }
      return next;
    });
  }, [m.db]);

  const openItem = useCallback((item: FeedItem): void => {
    if (item.kind === 'public') {
      // Web has no per-publication deep route; Discover is the public reader surface.
      dispatch({ type: 'OPEN_DISCOVER' });
      return;
    }
    if (item.kind === 'file') {
      dispatch({ type: 'OPEN_FILES', communityId: item.communityId });
      return;
    }
    if (item.postId) {
      dispatch({ type: 'OPEN_POST', communityId: item.communityId, channelId: item.channelId, postId: item.postId });
      return;
    }
    dispatch({ type: 'OPEN_CHANNEL', communityId: item.communityId, channelId: item.channelId });
  }, [dispatch]);

  const toggleHeart = useCallback((item: FeedItem): void => {
    if (!item.postId || (item.kind !== 'post' && item.kind !== 'reply')) return;
    // Same shared tap resolution as mobile (chat-kit-core), so the two surfaces
    // cannot drift on when a tap is an add vs a remove.
    const action = resolveReactionTap(item.reactions ?? null, HEART_EMOJI);
    const result = action.action === 'remove'
      ? m.removeReaction(item.communityId, item.channelId, action.myEventId)
      : (() => {
          const rootEventId = findPostRootEventId(m.db, item.communityId, item.channelId, item.postId!);
          if (!rootEventId) return { ok: false as const, error: 'This post is no longer available.' };
          return m.sendReaction(item.communityId, item.channelId, { eventId: rootEventId, postId: item.postId }, HEART_EMOJI);
        })();
    setNotice(result.ok ? null : 'That like did not go through. Try again.');
  }, [m]);

  const shareItem = useCallback((item: FeedItem): void => {
    if (item.kind !== 'public') return;
    const message = buildPublicShareMessage(item);
    if (!message) return;
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    if (nav?.share) {
      void nav.share({ text: message }).catch(() => undefined);
      return;
    }
    if (nav?.clipboard?.writeText) {
      void nav.clipboard.writeText(message).then(
        () => setNotice('Copied the public link to share.'),
        () => setNotice('Could not copy the share text.'),
      );
      return;
    }
    // No share sheet and no clipboard API: say so instead of a dead tap.
    setNotice('Sharing is not available in this browser.');
  }, []);

  const onRefresh = useCallback((): void => {
    void (async () => {
      setRefreshing(true);
      try {
        // Real work: drain any parked mailbox items (dormant + fast with no relay),
        // re-probe the public directory, then re-list communities so the local feed
        // re-evaluates. No relay resolvable = this completes quickly having done
        // only the local re-evaluate. Adds NO connected/live/peer claim.
        await m.runForegroundDrain().catch(() => undefined);
        const probe = await probePublicDirectory(m.db);
        setPublicSource(probe);
        m.refresh();
      } finally {
        setRefreshing(false);
      }
    })();
  }, [m]);

  // Auto-dismiss a transient notice so a one-off failure never sticks.
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const openStatus = useCallback((): void => {
    setFiltersOpen(false);
    dispatch({ type: 'OPEN_OVERLAY', overlay: { kind: 'settings' } });
  }, [dispatch]);

  const probing = publicSource === null;
  const directoryUnreachable = !!publicSource?.configured && publicSource.respondedAt === null;

  return (
    <div className="mk-main-scroll mk-feed-view">
      <div className="mk-feed-header">
        <h1 className="mk-h1">Feed</h1>
        <div className="mk-feed-header-actions">
          {probing ? <span className="mk-muted mk-feed-checking">Checking…</span> : null}
          <Button variant="ghost" small onClick={onRefresh} disabled={refreshing}>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
          <Button variant="ghost" small onClick={() => setFiltersOpen(true)} aria-label="Feed filters">
            Filters
          </Button>
        </div>
      </div>

      {directoryUnreachable ? (
        <div className="mk-box is-info" role="status">
          Couldn't reach the public directory. Refresh to try again; your local updates are shown.
        </div>
      ) : null}

      {notice ? (
        <button type="button" className="mk-box is-info mk-feed-notice" onClick={() => setNotice(null)}>
          {notice}
        </button>
      ) : null}

      {feed.items.length === 0 ? (
        <FeedEmpty
          hasCommunities={communities.length > 0}
          onJoin={() => dispatch({ type: 'OPEN_OVERLAY', overlay: { kind: 'join-community' } })}
          onCreate={() => dispatch({ type: 'OPEN_OVERLAY', overlay: { kind: 'create-community' } })}
          onOpenStatus={openStatus}
        />
      ) : (
        <div className="mk-feed-list">
          {feed.items.map((item) => (
            <FeedCard
              key={item.id}
              item={item}
              authorName={resolveName(item)}
              avatarImage={m.communityAvatarImage(item.communityId, item.authorDeviceId)}
              nowMs={nowMs}
              onOpen={openItem}
              onToggleHeart={toggleHeart}
              onShare={shareItem}
              onOpenWhy={setWhyItem}
            />
          ))}
        </div>
      )}

      <WhyPopover
        item={whyItem}
        controls={feed.controls}
        onClose={() => setWhyItem(null)}
        onOpenFilters={() => {
          setWhyItem(null);
          setFiltersOpen(true);
        }}
      />
      <FeedFilterPanel
        open={filtersOpen}
        controls={feed.controls}
        publicSourcesAvailable={feed.publicSourcesAvailable}
        excludedSources={feed.excludedSources}
        onToggle={toggleControl}
        onClose={() => setFiltersOpen(false)}
        onOpenStatus={openStatus}
      />
    </div>
  );
}

function FeedCard({
  item,
  authorName,
  avatarImage,
  nowMs,
  onOpen,
  onToggleHeart,
  onShare,
  onOpenWhy,
}: {
  item: FeedItem;
  authorName: string;
  avatarImage: string | null;
  nowMs: number;
  onOpen: (item: FeedItem) => void;
  onToggleHeart: (item: FeedItem) => void;
  onShare: (item: FeedItem) => void;
  onOpenWhy: (item: FeedItem) => void;
}): React.ReactElement {
  const view = toFeedCardView(item, { authorName, nowMs });
  const { engagement } = view;
  const showTitle = !!view.title && view.title !== view.community && view.kind !== 'mention';

  return (
    <div className="mk-feed-card">
      <div className="mk-feed-card-head">
        <Avatar imageBase64={avatarImage} initial={view.initial} size={40} />
        <div className="mk-feed-card-headtext">
          <span className="mk-feed-author">{view.authorName}</span>
          <span className="mk-feed-context">
            <span className="mk-feed-context-line">
              {view.community}
              {view.channel ? ` · #${view.channel}` : ''} · {view.time}
            </span>
            <button
              type="button"
              className="mk-feed-why"
              aria-label="Why am I seeing this?"
              onClick={() => onOpenWhy(item)}
            >
              ⓘ
            </button>
          </span>
        </div>
      </div>

      {view.media ? (
        <FeedMediaImage media={view.media} onOpen={() => onOpen(item)} alt={`Open ${view.title}`} />
      ) : null}

      {showTitle ? (
        <button type="button" className="mk-feed-title-btn" onClick={() => onOpen(item)}>
          <span className="mk-feed-title">{view.title}</span>
        </button>
      ) : null}
      {view.body ? (
        <button type="button" className="mk-feed-body-btn" onClick={() => onOpen(item)}>
          <span className="mk-feed-body">{view.body}</span>
        </button>
      ) : null}

      {view.linkPreview ? (
        // Sender-generated preview rendered from the local verified blob only; a
        // missing/malformed blob renders nothing (no fallback = NC-2, no fetch).
        <LinkPreviewCard blobHash={view.linkPreview.blobHash} />
      ) : null}

      {engagement.hasAny ? (
        <div className="mk-feed-engagement">
          {engagement.showReplies ? (
            <button
              type="button"
              className="mk-feed-eng"
              aria-label={`${engagement.replyCount} replies, open thread`}
              onClick={() => onOpen(item)}
            >
              <span aria-hidden>💬</span>
              <span className="mk-feed-eng-count">{engagement.replyCount}</span>
            </button>
          ) : null}
          {engagement.showHeart ? (
            <button
              type="button"
              className={`mk-feed-eng ${engagement.heart.mine ? 'is-active' : ''}`}
              aria-pressed={engagement.heart.mine}
              aria-label={engagement.heart.mine ? 'Remove your like' : 'Like this post'}
              onClick={() => onToggleHeart(item)}
            >
              <span aria-hidden>{engagement.heart.mine ? '❤️' : '🤍'}</span>
              {engagement.heart.count > 0 ? (
                <span className="mk-feed-eng-count">{engagement.heart.count}</span>
              ) : null}
            </button>
          ) : null}
          {engagement.showShare ? (
            <button
              type="button"
              className="mk-feed-eng"
              aria-label="Share this public item"
              onClick={() => onShare(item)}
            >
              <span aria-hidden>↗</span>
              <span className="mk-feed-eng-count">Share</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function FeedEmpty({
  hasCommunities,
  onJoin,
  onCreate,
  onOpenStatus,
}: {
  hasCommunities: boolean;
  onJoin: () => void;
  onCreate: () => void;
  onOpenStatus: () => void;
}): React.ReactElement {
  if (!hasCommunities) {
    return (
      <div className="mk-feed-empty">
        <h2 className="mk-feed-empty-title">Start your feed</h2>
        <p className="mk-feed-empty-text">
          Join a community with an invite, or create your own. Posts, replies, and files from your
          communities show up here.
        </p>
        <div className="mk-feed-empty-actions">
          <Button onClick={onJoin}>Join with an invite</Button>
          <Button variant="ghost" onClick={onCreate}>Create a community</Button>
        </div>
        <button type="button" className="mk-feed-empty-link" onClick={onOpenStatus}>
          New updates arrive once a connection server is configured. See connection status.
        </button>
      </div>
    );
  }
  return (
    <div className="mk-feed-empty">
      <h2 className="mk-feed-empty-title">Quiet right now</h2>
      <p className="mk-feed-empty-text">
        Nothing new from your sources yet. Refresh to check, or open a community to post.
      </p>
    </div>
  );
}
