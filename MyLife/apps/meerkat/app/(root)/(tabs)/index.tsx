// Plan 32 Phase 1: the content-first Feed.
//
// A FlatList of content cards (design decision 1): avatar + author + one muted
// context line with an `i`, inline first-image media, body, and an engagement row
// ([replies] [heart] [share on public only]). The transparency that used to live
// on every card (kind pill, audience badge, reason sentence, action pill) moved
// one tap deep into the why-sheet; the source toggles + excluded list moved into
// the filter sheet. The deterministic local ranking (feed-core) is untouched
// (NC-5); every count comes from a verified feed field (NC-1).

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Heart,
  Info,
  MessageCircle,
  Share2,
  SlidersHorizontal,
} from 'lucide-react-native';
import { listCommunities, type StoredCommunity } from '@mylife/sync';
import { useMeerkatDatabase } from '../providers/DatabaseProvider';
import { getSetting, setSetting } from '../data/db';
import { useIdentity } from '../providers/IdentityProvider';
import { useSync } from '../providers/SyncProvider';
import { useChatActions } from '../providers/ChatProvider';
import { resolveReactionTap } from '../components/chat/chat-kit-core';
import { Button } from '../components/kit';
import { FeedAvatar } from '../components/feed/FeedAvatar';
import { avatarImageUri } from '../components/Avatar';
import { FeedMediaImage } from '../components/feed/FeedMediaImage';
import { LinkPreviewCard } from '../components/LinkPreviewCard';
import { WhySheet } from '../components/feed/WhySheet';
import { FeedFilterSheet } from '../components/feed/FeedFilterSheet';
import { type MkColors, MK_RADIUS, shortHex } from '../theme/tokens';
import { useAppThemeColors, useMkStyles } from '../providers/AppThemeProvider';
import {
  evaluateLocalFeed,
  FEED_CONTROLS_SETTING_KEY,
  parseFeedControls,
  serializeFeedControls,
  type FeedControlKey,
  type FeedControls,
  type FeedItem,
} from '../data/feed-core';
import {
  FEED_REEVAL_MIN_INTERVAL_MS,
  HEART_EMOJI,
  buildPublicShareMessage,
  createKeyedMemo,
  decideFeedThrottle,
  findPostRootEventId,
  nextRenderWindow,
  toFeedCardView,
} from '../data/feed-view-core';
import { buildCommunityPeerNameMap, resolveCommunityAvatarImage } from '../data/community-core';
import {
  probePublicDirectory,
  type ProbePublicDirectoryResult,
} from '../data/public-directory-client';

const RENDER_WINDOW = 20;

export default function FeedScreen() {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const db = useMeerkatDatabase();
  const { identity } = useIdentity();
  const { runForegroundDrain } = useSync();
  const { state: chatState, sendReaction, removeReaction } = useChatActions();

  const [communities, setCommunities] = useState<StoredCommunity[]>(() => listCommunities(db));
  // Composition Phase 0: source toggles persist across launches (fail-safe parse).
  const [controls, setControls] = useState<FeedControls>(
    () => parseFeedControls(getSetting(db, FEED_CONTROLS_SETTING_KEY)),
  );
  // null => the public directory probe has not resolved yet (loading state).
  const [publicSource, setPublicSource] = useState<ProbePublicDirectoryResult | null>(null);
  const [whyItem, setWhyItem] = useState<FeedItem | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Deferred cross-modal action (open the other sheet / navigate) queued while a
  // visible RN Modal dismisses. Navigating or presenting while a modal is mid-
  // dismissal is the freeze class from the unlock-screen session: the action is
  // queued here and flushed only after the native dismissal completes.
  const [pendingAction, setPendingAction] = useState<'open-filters' | 'open-status' | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [renderLimit, setRenderLimit] = useState(RENDER_WINDOW);
  // A brief, honest notice when a heart toggle did not persist (e.g. an un-heart
  // that lost a tombstone race). Comes from the real send result, never a guess.
  const [heartNotice, setHeartNotice] = useState<string | null>(null);

  // Debounced feed revision (Plan 32 T5.1). A heart toggle bumps chatState.revision;
  // rather than re-run the WHOLE evaluateLocalFeed synchronously on every tap, the
  // feed reads this coalesced revision so a burst of taps re-evaluates once. Counts
  // stay real (from rows), applied at most once per FEED_REEVAL_MIN_INTERVAL_MS.
  const [feedRevision, setFeedRevision] = useState(chatState.revision);
  const lastReevalAtRef = useRef(0);

  const refresh = useCallback(() => {
    setCommunities(listCommunities(db));
  }, [db]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await probePublicDirectory(db);
      if (!cancelled) setPublicSource(result);
    })();
    return () => { cancelled = true; };
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const peerNamesByCommunity = useMemo(() => {
    const maps = new Map<string, Map<string, string>>();
    for (const community of communities) {
      maps.set(community.communityId, buildCommunityPeerNameMap(db, community.communityId));
    }
    return maps;
  }, [communities, db]);

  const resolveFeedAuthorName = useCallback(
    (item: FeedItem): string => {
      const names = peerNamesByCommunity.get(item.communityId);
      if (item.authorDeviceId === identity.publicKey) {
        const communityName = names?.get(item.authorDeviceId);
        return communityName ? `You as ${communityName}` : 'You';
      }
      return names?.get(item.authorDeviceId) ?? shortHex(item.authorDeviceId);
    },
    [identity.publicKey, peerNamesByCommunity],
  );

  // Coalesce chat-revision bumps behind a short throttle so a heart burst does
  // not re-run evaluateLocalFeed once per tap (Plan 32 T5.1). A spaced single tap
  // still applies on the leading edge; the feed always converges to the latest
  // revision, so counts remain real, just at most once per interval.
  useEffect(() => {
    const decision = decideFeedThrottle({
      appliedRevision: feedRevision,
      latestRevision: chatState.revision,
      lastAppliedAt: lastReevalAtRef.current,
      now: Date.now(),
      minIntervalMs: FEED_REEVAL_MIN_INTERVAL_MS,
    });
    if (decision.action === 'noop') return;
    if (decision.action === 'apply') {
      lastReevalAtRef.current = Date.now();
      setFeedRevision(chatState.revision);
      return;
    }
    const timer = setTimeout(() => {
      lastReevalAtRef.current = Date.now();
      setFeedRevision(chatState.revision);
    }, decision.delayMs);
    return () => clearTimeout(timer);
  }, [chatState.revision, feedRevision]);

  // feedRevision is the debounced dep so a heart toggle (which bumps the raw
  // revision) re-evaluates the feed once the throttle applies; the count/fill then
  // reflect the real recorded row.
  const feed = useMemo(
    () => {
      void feedRevision;
      return evaluateLocalFeed({
        db,
        communities,
        selfDeviceId: identity.publicKey,
        controls,
        publicSource: publicSource ?? undefined,
      });
    },
    [communities, controls, db, identity.publicKey, publicSource, feedRevision],
  );
  const nowMs = useMemo(() => {
    void feed;
    return Date.now();
  }, [feed]);

  // AC-6: the author's SIGNED community avatar as a data URI, or null (image ->
  // initial -> `?` precedence lives in FeedAvatar). Only a signature-verified v2
  // profile yields an image; a public item (no community) resolves to null. The
  // memo is recreated per feed evaluation, so ANY reason the feed re-evals (a heart
  // toggle, a drained profile, or a focus refresh that re-lists communities after
  // the user edits their own avatar) re-resolves avatars, while scrolling within a
  // single evaluation reuses the cached data URI and never re-decodes base64.
  const avatarMemo = useMemo(() => {
    void feed;
    return createKeyedMemo<string | null>();
  }, [feed]);
  const resolveFeedAvatarUri = useCallback(
    (item: FeedItem): string | null =>
      avatarMemo.get(
        `${item.communityId}:${item.authorDeviceId}`,
        feedRevision,
        () => avatarImageUri(resolveCommunityAvatarImage(db, item.communityId, item.authorDeviceId)),
      ),
    [avatarMemo, db, feedRevision],
  );

  // Keep the render window sane when the underlying list shrinks (toggles/refresh).
  useEffect(() => {
    setRenderLimit(RENDER_WINDOW);
  }, [controls, communities]);

  const toggleControl = useCallback((key: FeedControlKey) => {
    setControls((current) => {
      const next = { ...current, [key]: !current[key] };
      // Persist best-effort: a settings write failure never breaks the toggle.
      try {
        setSetting(db, FEED_CONTROLS_SETTING_KEY, serializeFeedControls(next));
      } catch {
        // The in-memory toggle still applies this session.
      }
      return next;
    });
  }, [db]);

  const openItem = useCallback((item: FeedItem) => {
    if (item.kind === 'public' && item.public) {
      router.push({
        pathname: '/public/[publicationId]',
        params: { publicationId: item.public.publication_id },
      });
      return;
    }
    if (item.kind === 'file') {
      router.push({
        pathname: '/files/[communityId]',
        params: { communityId: item.communityId },
      });
      return;
    }
    if (item.postId) {
      router.push({
        pathname: '/post/[communityId]/[channelId]/[postId]',
        params: { communityId: item.communityId, channelId: item.channelId, postId: item.postId },
      });
      return;
    }
    router.push({
      pathname: '/channel/[communityId]/[channelId]',
      params: { communityId: item.communityId, channelId: item.channelId },
    });
  }, [router]);

  const toggleHeart = useCallback((item: FeedItem) => {
    if (!item.postId || (item.kind !== 'post' && item.kind !== 'reply')) return;
    const action = resolveReactionTap(item.reactions ?? null, HEART_EMOJI);
    const result = action.action === 'remove'
      ? removeReaction(item.communityId, item.channelId, action.myEventId)
      : (() => {
          const rootEventId = findPostRootEventId(db, item.communityId, item.channelId, item.postId!);
          if (!rootEventId) return { ok: false as const, error: 'This post is no longer available.' };
          return sendReaction(item.communityId, item.channelId, { eventId: rootEventId, postId: item.postId }, HEART_EMOJI);
        })();
    setHeartNotice(result.ok ? null : 'That like did not go through. Try again.');
  }, [db, sendReaction, removeReaction]);

  // Auto-dismiss the heart notice so a transient failure never sticks.
  useEffect(() => {
    if (!heartNotice) return;
    const timer = setTimeout(() => setHeartNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [heartNotice]);

  const shareItem = useCallback((item: FeedItem) => {
    if (item.kind !== 'public') return;
    const message = buildPublicShareMessage(item);
    if (!message) return;
    void Share.share({ message }).catch(() => undefined);
  }, []);

  const onRefresh = useCallback(() => {
    void (async () => {
      setRefreshing(true);
      try {
        // Real work: drain any parked mailbox items (dormant + fast with no relay),
        // re-probe the public directory, then re-list communities so the local
        // feed re-evaluates. No relay resolvable = this completes quickly having
        // done only the local re-evaluate.
        await runForegroundDrain().catch(() => undefined);
        const probe = await probePublicDirectory(db);
        setPublicSource(probe);
        refresh();
      } finally {
        setRefreshing(false);
      }
    })();
  }, [db, refresh, runForegroundDrain]);

  const openFilters = useCallback(() => setFiltersOpen(true), []);
  const flushPendingAction = useCallback(() => {
    if (!pendingAction) return;
    setPendingAction(null);
    if (pendingAction === 'open-filters') setFiltersOpen(true);
    else router.push('/about-status');
  }, [pendingAction, router]);
  // Modal onDismiss fires on iOS only; Android dismissal is synchronous enough
  // that flushing right after the hide commit is safe.
  useEffect(() => {
    if (Platform.OS === 'ios') return;
    if (whyItem === null && !filtersOpen) flushPendingAction();
  }, [whyItem, filtersOpen, flushPendingAction]);
  const openStatus = useCallback(() => {
    setFiltersOpen(false);
    setPendingAction('open-status');
  }, []);
  const openWhyFromCard = useCallback((item: FeedItem) => setWhyItem(item), []);

  const probing = publicSource === null;
  const directoryUnreachable = !!publicSource?.configured && publicSource.respondedAt === null;

  const visibleItems = useMemo(() => feed.items.slice(0, renderLimit), [feed.items, renderLimit]);

  const renderItem = useCallback(
    ({ item }: { item: FeedItem }) => (
      <FeedCard
        item={item}
        authorName={resolveFeedAuthorName(item)}
        avatarUri={resolveFeedAvatarUri(item)}
        nowMs={nowMs}
        onOpen={openItem}
        onToggleHeart={toggleHeart}
        onShare={shareItem}
        onOpenWhy={openWhyFromCard}
      />
    ),
    [resolveFeedAuthorName, resolveFeedAvatarUri, nowMs, openItem, toggleHeart, shareItem, openWhyFromCard],
  );

  const growWindow = useCallback(() => {
    setRenderLimit((current) => nextRenderWindow(current, feed.items.length, RENDER_WINDOW));
  }, [feed.items.length]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Feed</Text>
        <View style={styles.headerActions}>
          {probing ? <ActivityIndicator size="small" color={c.textSecondary} /> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Feed filters"
            onPress={openFilters}
            style={({ pressed }) => [styles.filterBtn, pressed && styles.pressed]}
          >
            <SlidersHorizontal size={20} color={c.text} strokeWidth={2} />
          </Pressable>
        </View>
      </View>

      {directoryUnreachable ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            Couldn't reach the public directory. Pull to try again; your local updates are shown.
          </Text>
        </View>
      ) : null}

      {heartNotice ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          onPress={() => setHeartNotice(null)}
          style={styles.banner}
        >
          <Text style={styles.bannerText}>{heartNotice}</Text>
        </Pressable>
      ) : null}

      <FlatList
        data={visibleItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 96 },
          feed.items.length === 0 && styles.listContentEmpty,
        ]}
        showsVerticalScrollIndicator={false}
        onEndReachedThreshold={0.6}
        onEndReached={growWindow}
        refreshing={refreshing}
        onRefresh={onRefresh}
        progressViewOffset={8}
        ListEmptyComponent={
          <FeedEmpty
            hasCommunities={communities.length > 0}
            onOpenCommunities={() => router.push('/communities')}
            onOpenStatus={() => router.push('/about-status')}
          />
        }
      />

      <WhySheet
        item={whyItem}
        controls={feed.controls}
        onClose={() => setWhyItem(null)}
        onOpenFilters={() => {
          // Presenting the filter sheet while this sheet's Modal is dismissing
          // can drop the presentation (or strand a touch-eating window) on iOS;
          // queue it and flush after the dismissal completes.
          setWhyItem(null);
          setPendingAction('open-filters');
        }}
        onDismissed={flushPendingAction}
      />
      <FeedFilterSheet
        visible={filtersOpen}
        controls={feed.controls}
        publicSourcesAvailable={feed.publicSourcesAvailable}
        excludedSources={feed.excludedSources}
        onToggle={toggleControl}
        onClose={() => setFiltersOpen(false)}
        onOpenStatus={openStatus}
        onDismissed={flushPendingAction}
      />
    </View>
  );
}

const FeedCard = React.memo(function FeedCard({
  item,
  authorName,
  avatarUri,
  nowMs,
  onOpen,
  onToggleHeart,
  onShare,
  onOpenWhy,
}: {
  item: FeedItem;
  authorName: string;
  avatarUri: string | null;
  nowMs: number;
  onOpen: (item: FeedItem) => void;
  onToggleHeart: (item: FeedItem) => void;
  onShare: (item: FeedItem) => void;
  onOpenWhy: (item: FeedItem) => void;
}) {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const view = useMemo(() => toFeedCardView(item, { authorName, nowMs }), [item, authorName, nowMs]);
  const { engagement } = view;

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <FeedAvatar initial={view.initial} imageUri={avatarUri} />
        <View style={styles.cardHeadText}>
          <Text style={styles.author} numberOfLines={1}>{view.authorName}</Text>
          <View style={styles.contextRow}>
            <Text style={styles.context} numberOfLines={1}>
              {view.community}
              {view.channel ? ` · #${view.channel}` : ''} · {view.time}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Why am I seeing this?"
              hitSlop={8}
              onPress={() => onOpenWhy(item)}
              style={({ pressed }) => [styles.infoBtn, pressed && styles.pressed]}
            >
              <Info size={14} color={c.textTertiary} strokeWidth={2} />
            </Pressable>
          </View>
        </View>
      </View>

      {view.media ? (
        <FeedMediaImage
          media={view.media}
          onPress={() => onOpen(item)}
          accessibilityLabel={`Open ${view.title}`}
        />
      ) : null}

      {view.title && view.title !== view.community && view.kind !== 'mention' ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Open ${view.title}`} onPress={() => onOpen(item)}>
          <Text style={styles.cardTitle} numberOfLines={2}>{view.title}</Text>
        </Pressable>
      ) : null}
      {view.body ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Open ${view.title}`} onPress={() => onOpen(item)}>
          <Text style={styles.cardBody} numberOfLines={5}>{view.body}</Text>
        </Pressable>
      ) : null}

      {view.linkPreview ? (
        // Sender-generated preview rendered from the local verified blob only; a
        // missing/malformed blob renders nothing (no fallback = NC-2, no fetch).
        <LinkPreviewCard blobHash={view.linkPreview.blobHash} />
      ) : null}

      {engagement.hasAny ? (
        <View style={styles.engagement}>
          {engagement.showReplies ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${engagement.replyCount} replies, open thread`}
              onPress={() => onOpen(item)}
              style={({ pressed }) => [styles.engBtn, pressed && styles.pressed]}
            >
              <MessageCircle size={17} color={c.textSecondary} strokeWidth={2} />
              <Text style={styles.engText}>{engagement.replyCount}</Text>
            </Pressable>
          ) : null}
          {engagement.showHeart ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: engagement.heart.mine }}
              accessibilityLabel={engagement.heart.mine ? 'Remove your like' : 'Like this post'}
              onPress={() => onToggleHeart(item)}
              style={({ pressed }) => [styles.engBtn, pressed && styles.pressed]}
            >
              <Heart
                size={17}
                color={engagement.heart.mine ? c.danger : c.textSecondary}
                fill={engagement.heart.mine ? c.danger : 'transparent'}
                strokeWidth={2}
              />
              {engagement.heart.count > 0 ? (
                <Text style={[styles.engText, engagement.heart.mine && styles.engTextActive]}>
                  {engagement.heart.count}
                </Text>
              ) : null}
            </Pressable>
          ) : null}
          {engagement.showShare ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Share this public item"
              onPress={() => onShare(item)}
              style={({ pressed }) => [styles.engBtn, pressed && styles.pressed]}
            >
              <Share2 size={17} color={c.textSecondary} strokeWidth={2} />
              <Text style={styles.engText}>Share</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
});

function FeedEmpty({
  hasCommunities,
  onOpenCommunities,
  onOpenStatus,
}: {
  hasCommunities: boolean;
  onOpenCommunities: () => void;
  onOpenStatus: () => void;
}) {
  const styles = useMkStyles(makeStyles);
  if (!hasCommunities) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Start your feed</Text>
        <Text style={styles.emptyText}>
          Join a community with an invite, or create your own. Posts, replies, and files from your
          communities show up here.
        </Text>
        <View style={styles.emptyActions}>
          <Button title="Join with an invite" onPress={onOpenCommunities} />
          <Button title="Create a community" variant="secondary" onPress={onOpenCommunities} />
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Open connection status" onPress={onOpenStatus}>
          <Text style={styles.emptyLink}>
            New updates arrive once a connection server is configured. See connection status.
          </Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>Quiet right now</Text>
      <Text style={styles.emptyText}>
        Nothing new from your sources yet. Pull down to refresh, or open a community to post.
      </Text>
    </View>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  title: { color: c.text, fontSize: 30, fontWeight: '800' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  filterBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceHigh,
  },
  banner: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: MK_RADIUS.md,
    backgroundColor: c.warningSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.warning,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  bannerText: { color: c.warning, fontSize: 12.5, lineHeight: 18 },
  listContent: { paddingHorizontal: 16, gap: 12 },
  listContentEmpty: { flexGrow: 1, justifyContent: 'center' },
  card: {
    borderRadius: MK_RADIUS.lg,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: c.surface,
    padding: 14,
    gap: 10,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  cardHeadText: { flex: 1, minWidth: 0, gap: 2 },
  author: { color: c.text, fontSize: 15, fontWeight: '800' },
  contextRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  context: { flexShrink: 1, color: c.textTertiary, fontSize: 12.5 },
  infoBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { color: c.text, fontSize: 16.5, fontWeight: '800', lineHeight: 22 },
  cardBody: { color: c.textSecondary, fontSize: 14.5, lineHeight: 21 },
  engagement: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    marginTop: 2,
  },
  engBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingRight: 4,
  },
  engText: { color: c.textSecondary, fontSize: 13.5, fontWeight: '700' },
  engTextActive: { color: c.danger },
  empty: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 8,
    paddingVertical: 24,
  },
  emptyTitle: { color: c.text, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  emptyText: { color: c.textSecondary, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  emptyActions: { alignSelf: 'stretch', gap: 10, marginTop: 4 },
  emptyLink: { color: c.accent, fontSize: 13, fontWeight: '700', textAlign: 'center', lineHeight: 19 },
  pressed: { opacity: 0.6 },
});
