import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowLeft, ChevronRight } from 'lucide-react-native';
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
import { useMeerkatDatabase } from '../providers/DatabaseProvider';
import { useIdentity } from '../providers/IdentityProvider';
import { AudienceBadge } from './AudienceRule';
import { HonestNotice, SectionHeader } from './kit';
import { type MkColors, MK_RADIUS, shortHex } from '../theme/tokens';
import { useAppThemeColors, useMkStyles } from '../providers/AppThemeProvider';
import {
  getDirectoryCacheEntry,
  pagePublicReader,
  setPublicFeedCursor,
  type VerifiedPublicEntry,
} from '../data/public-directory-client';
import { requestPublicJoin } from '../data/public-join-client';
import { VerifySheet } from './VerifySheet';
import {
  clearStoredHumanityToken,
  getStoredHumanityToken,
  humanityGateState,
} from '../data/humanity-core';
import { PUBLIC_CATEGORY_LABELS } from '../data/discover-core';
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
} from '../data/public-reader-core';

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

export function PublicReader({
  publicationId,
  channelId,
  postId,
}: {
  publicationId: string;
  channelId?: string;
  postId?: string;
}) {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const db = useMeerkatDatabase();
  const { identity } = useIdentity();

  const [entry] = useState<VerifiedPublicEntry | null>(() => getDirectoryCacheEntry(db, publicationId));
  const [result, setResult] = useState<FetchPublicSnapshotResult | null>(null);
  const [inFlight, setInFlight] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [reportNotice, setReportNotice] = useState<string | null>(null);
  const loadSeq = useRef(0);
  // FF2 warm-tail paging: after the initial snapshot load (the trust anchor), a
  // re-focus pages ONLY the verified events after the device-local cursor and appends
  // them, instead of re-importing the whole snapshot every time.
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
              channelId,
            });
          } catch {
            last = { ok: false, reason: 'manifest_failed' };
          }
          if (last.ok) break;
        }
        if (loadSeq.current !== seq) return;
        setResult(last);
        // FF2: on a real successful pull, seed the per-channel warm-tail cursor to the
        // newest verified event so a subsequent focus pages only newer content. Honest:
        // never seeded on a failed/empty pull.
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
  }, [db, entry, publicationId, channelId]);

  // FF2: page ONLY the verified warm tail after the cursor (per loaded channel) and
  // append it. Never a full re-import; a host that returns nothing simply adds nothing.
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

  useFocusEffect(
    useCallback(() => {
      // First focus: full snapshot (the trust anchor). Subsequent focus: warm-tail page.
      if (!loadedRef.current) load();
      else void loadNewer();
    }, [load, loadNewer]),
  );

  // Read-only verified groups, filtered to the route's scope. Display fields come
  // from result.descriptor (signature-verified), never host-asserted (TC-3/section 5.2).
  const groups: PublicChannelGroup[] = useMemo(() => {
    if (!result || !result.ok) return [];
    // FF2: merge the appended warm-tail events into each channel before grouping.
    const merged = result.channels.map((ch) => ({
      channelId: ch.channelId,
      events: [...ch.events, ...(tail[ch.channelId] ?? [])],
    }));
    const all = groupPublicSnapshot(merged);
    if (channelId) return all.filter((g) => g.channelId === channelId);
    return all;
  }, [result, tail, channelId]);

  const shownItems = useMemo(
    () => groups.reduce((n, g) => n + g.messages.length + g.posts.reduce((m, p) => m + 1 + p.replies.length, 0), 0),
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

  const openPost = useCallback(
    (targetChannelId: string, targetPostId: string) => {
      router.push({
        pathname: '/public/post/[publicationId]/[channelId]/[postId]',
        params: { publicationId, channelId: targetChannelId, postId: targetPostId },
      });
    },
    [router, publicationId],
  );

  const openChannel = useCallback(
    (targetChannelId: string) => {
      router.push({
        pathname: '/public/[publicationId]/[channelId]',
        params: { publicationId, channelId: targetChannelId },
      });
    },
    [router, publicationId],
  );

  const fileReport = useCallback(
    (reason: PublicReportReason) => {
      if (!reportTarget) return;
      const target = reportTarget;
      const hostUrls = entry ? parseHostUrls(entry.host_urls) : [];
      setReportTarget(null);
      setReportNotice(null);
      void (async () => {
        try {
          // persistPublicReport signs with this device's key and writes the local
          // row; either can throw (key unavailable, storage failure).
          const outcome = await persistPublicReport(db, {
            publicationId,
            targetKind: target.targetKind,
            targetId: target.targetId,
            reason,
            reporter: identity,
            hostUrls,
          });
          setReportNotice(outcome.notice);
        } catch {
          setReportNotice('The report could not be saved on this device. Nothing was sent.');
        }
      })();
    },
    [db, entry, identity, publicationId, reportTarget],
  );

  // A request-policy join is a SHARED-network action gated by humanity (AM1). The
  // descriptor awaiting a token sits here while the VerifySheet is up.
  const [pendingJoin, setPendingJoin] = useState<SignedPublicationDescriptor | null>(null);

  // Two fast taps must not seal + park the request twice (the humanity token is
  // single-use); the ref is taken synchronously before the first await.
  const joinInFlightRef = useRef(false);
  // A join queued behind the VerifySheet dismissal: submitJoinRequest ends in an
  // Alert, which must never fire while the sheet's Modal is still dismissing.
  const queuedJoinRef = useRef<SignedPublicationDescriptor | null>(null);

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
        const outcome = await requestPublicJoin(db, identity, descriptor, token);
        // The token is single-use: drop it so the next join re-verifies honestly.
        clearStoredHumanityToken(db);
        Alert.alert(
          READER_COPY.joinAction,
          outcome.kind === 'sent'
            ? 'Request sent. The owner approves it over a connection server before you get community access. Reading stays free and anonymous.'
            : outcome.kind === 'saved'
              ? 'Saved on this device. It will be sent when a connection server is available.'
              : 'This community is not accepting join requests right now. Reading stays free and anonymous.',
          [{ text: 'OK' }],
        );
      } catch {
        Alert.alert(
          READER_COPY.joinAction,
          'The join request could not be sent right now. Try again when you are online.',
          [{ text: 'OK' }],
        );
      } finally {
        joinInFlightRef.current = false;
      }
    })();
  }, [db, identity]);

  const onJoin = useCallback(() => {
    // Reading is anonymous; joining is an EXPLICIT action that uses this device's
    // identity. Dispatch by the owner-signed joinPolicy on the FRESHLY fetched
    // descriptor (result.descriptor is the live trust anchor). Honest copy only.
    if (!result || !result.ok) {
      Alert.alert(READER_COPY.joinAction, 'Open this content first, then join.', [{ text: 'OK' }]);
      return;
    }
    const descriptor = result.descriptor;
    if (descriptor.descriptor.joinPolicy === 'open' && verifyPublicJoinGrant(descriptor)) {
      // OPEN: record an owner-authorized ROSTER membership locally (no key access yet).
      const r = redeemPublicJoinGrant(db, identity, descriptor);
      Alert.alert(
        READER_COPY.joinAction,
        r.ok
          ? 'Saved on this device. You will get community access once a connection server delivers the key. Reading stays free and anonymous.'
          : 'This community is not accepting open joins right now.',
        [{ text: 'OK' }],
      );
    } else {
      // REQUEST (or no grant): seal an owner-sealed public-join request on the FRESHLY fetched
      // descriptor and best-effort park it over the effective-relay-gated backend. NEVER claim
      // "sent" unless a real relay park returned true; with no connection server it stays on this
      // device. Reading is unaffected either way.
      // Gate on humanity (AM1): a request-policy join reaches the owner, so it
      // needs a one-time human proof. Verified -> submit with the stored token;
      // otherwise open the VerifySheet (which blocks honestly when no service is
      // configured). We NEVER seal + park an empty-token request the owner rejects.
      if (humanityGateState(db) === 'verified') {
        submitJoinRequest(descriptor);
      } else {
        setPendingJoin(descriptor);
      }
    }
  }, [db, identity, result, submitJoinRequest]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/discover'); }}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <ArrowLeft size={20} color={c.text} strokeWidth={1.9} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1}>{headerTitle}</Text>
          <View style={styles.headerMetaRow}>
            <AudienceBadge rule={publicRule} />
            {categoryLabel ? (
              <View style={styles.categoryPill}>
                <Text style={styles.categoryPillText}>{categoryLabel}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 96 }]}
      >
        <HonestNotice text={READER_COPY.banner} />

        {descriptor?.description ? (
          <Text style={styles.description}>{descriptor.description}</Text>
        ) : null}

        {loadingNewer ? (
          <Text style={styles.newerNote}>Checking for newer posts…</Text>
        ) : null}

        {state.kind === 'loading' ? (
          <View style={styles.statePanel}>
            <ActivityIndicator color={c.accent} />
            <Text style={styles.stateText}>{READER_COPY.loading}</Text>
          </View>
        ) : null}

        {state.kind === 'empty' ? (
          <View style={styles.statePanel}>
            <Text style={styles.stateTitle}>{READER_COPY.empty}</Text>
          </View>
        ) : null}

        {state.kind === 'error' ? (
          <View style={styles.statePanel}>
            <Text style={styles.stateTitle}>{READER_COPY.errorTitle}</Text>
            <Text style={styles.stateText}>{state.detail}</Text>
          </View>
        ) : null}

        {state.kind === 'success' || state.kind === 'partial'
          ? groups.map((group) => (
              <PublicChannelSection
                key={group.channelId}
                group={group}
                postFilter={postId}
                showChannelHeader={!channelId && !postId}
                onOpenChannel={openChannel}
                onOpenPost={openPost}
                onReport={(target) => setReportTarget(target)}
              />
            ))
          : null}

        {state.kind === 'partial' ? (
          <View style={styles.partialPanel}>
            <Text style={styles.partialText}>{loadingOlderLabel(state.morePieces)}</Text>
            {state.skipped > 0 ? (
              <Text style={styles.skippedText}>{skippedItemsLabel(state.skipped)}</Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.joinPanel}>
          <SectionHeader title="Want to take part?" />
          <Text style={styles.joinText}>{READER_COPY.join}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={READER_COPY.joinAction}
            onPress={onJoin}
            style={({ pressed }) => [styles.joinButton, pressed && styles.pressed]}
          >
            <Text style={styles.joinButtonText}>{READER_COPY.joinAction}</Text>
          </Pressable>
        </View>

        {reportNotice ? (
          <View style={styles.reportNotice}>
            <Text style={styles.reportNoticeText}>{reportNotice}</Text>
          </View>
        ) : null}
      </ScrollView>

      {reportTarget ? (
        <View style={styles.reportSheetBackdrop}>
          <View style={styles.reportSheet}>
            <Text style={styles.reportSheetTitle}>Report public content</Text>
            <Text style={styles.reportSheetHint}>
              Reports are signed and saved on this device. Hiding is local until the owner unpublishes or a host removes it.
            </Text>
            <View style={styles.reasonGrid}>
              {PUBLIC_REPORT_REASONS.map((reason) => (
                <Pressable
                  key={reason.code}
                  accessibilityRole="button"
                  accessibilityLabel={`Report reason ${reason.label}`}
                  onPress={() => fileReport(reason.code)}
                  style={({ pressed }) => [styles.reasonChip, pressed && styles.pressed]}
                >
                  <Text style={styles.reasonChipText}>{reason.label}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel report"
              onPress={() => setReportTarget(null)}
              style={({ pressed }) => [styles.reportCancel, pressed && styles.pressed]}
            >
              <Text style={styles.reportCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <VerifySheet
        visible={pendingJoin !== null}
        onClose={() => setPendingJoin(null)}
        onVerified={() => { queuedJoinRef.current = pendingJoin; setPendingJoin(null); }}
        onDismissed={() => {
          const queued = queuedJoinRef.current;
          queuedJoinRef.current = null;
          if (queued) submitJoinRequest(queued);
        }}
        purpose="join this community"
      />
    </View>
  );
}

function PublicChannelSection({
  group,
  postFilter,
  showChannelHeader,
  onOpenChannel,
  onOpenPost,
  onReport,
}: {
  group: PublicChannelGroup;
  postFilter?: string;
  showChannelHeader: boolean;
  onOpenChannel: (channelId: string) => void;
  onOpenPost: (channelId: string, postId: string) => void;
  onReport: (target: ReportTarget) => void;
}) {
  const styles = useMkStyles(makeStyles);
  const posts = postFilter ? group.posts.filter((p) => p.postId === postFilter) : group.posts;
  const messages = postFilter ? [] : group.messages;

  return (
    <View style={styles.section}>
      {showChannelHeader ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open channel ${group.channelId}`}
          onPress={() => onOpenChannel(group.channelId)}
          style={({ pressed }) => [styles.channelHeader, pressed && styles.pressed]}
        >
          <Text style={styles.channelHeaderText} numberOfLines={1}>#{group.channelId}</Text>
          <ChevronRight size={15} color={styles.channelHeaderText.color as string} strokeWidth={2.2} />
        </Pressable>
      ) : null}

      {posts.map((post) => (
        <View key={post.postId} style={styles.postCard}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemAuthor} numberOfLines={1}>{shortHex(post.root.authorDeviceId)}</Text>
            <ReportChip onPress={() => onReport({ targetKind: 'post', targetId: post.root.id })} />
          </View>
          {post.title ? <Text style={styles.postTitle}>{post.title}</Text> : null}
          <Text style={styles.itemBody}>{post.root.body}</Text>
          {postFilter ? (
            post.replies.map((reply) => (
              <View key={reply.id} style={styles.replyCard}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemAuthor} numberOfLines={1}>{shortHex(reply.authorDeviceId)}</Text>
                  <ReportChip onPress={() => onReport({ targetKind: 'reply', targetId: reply.id })} />
                </View>
                <Text style={styles.itemBody}>{reply.body}</Text>
              </View>
            ))
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open post thread"
              onPress={() => onOpenPost(group.channelId, post.postId)}
              style={({ pressed }) => [styles.openThread, pressed && styles.pressed]}
            >
              <Text style={styles.openThreadText}>
                {post.replies.length === 0
                  ? 'No replies yet'
                  : `${post.replies.length} repl${post.replies.length === 1 ? 'y' : 'ies'}`}
              </Text>
            </Pressable>
          )}
        </View>
      ))}

      {messages.map((message) => (
        <View key={message.id} style={styles.messageCard}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemAuthor} numberOfLines={1}>{shortHex(message.authorDeviceId)}</Text>
            <ReportChip onPress={() => onReport({ targetKind: 'reply', targetId: message.id })} />
          </View>
          <Text style={styles.itemBody}>{message.body}</Text>
          <PublicAttachmentLinks event={message} />
        </View>
      ))}
    </View>
  );
}

function PublicAttachmentLinks({ event }: { event: ChannelMessageEvent }) {
  const styles = useMkStyles(makeStyles);
  if (!event.attachments || event.attachments.length === 0) return null;
  return (
    <View style={styles.attachments}>
      {event.attachments.map((att) => (
        <Text key={att.id} style={styles.attachmentLink} numberOfLines={1}>
          {att.name} ({att.mimeType})
        </Text>
      ))}
    </View>
  );
}

function ReportChip({ onPress }: { onPress: () => void }) {
  const styles = useMkStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Report"
      onPress={onPress}
      style={({ pressed }) => [styles.reportChip, pressed && styles.pressed]}
    >
      <Text style={styles.reportChipText}>{READER_COPY.reportAction}</Text>
    </Pressable>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 10,
    backgroundColor: c.surface,
    borderBottomColor: c.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerText: { flex: 1, minWidth: 0, gap: 4 },
  headerTitle: { color: c.text, fontSize: 18, fontWeight: '800' },
  headerMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  categoryPill: {
    borderRadius: MK_RADIUS.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderStrong,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  categoryPillText: { color: c.textSecondary, fontSize: 10.5, fontWeight: '800' },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: MK_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceHigh,
  },
  scroll: { flex: 1 },
  body: { padding: 16, gap: 14 },
  description: { color: c.textSecondary, fontSize: 14, lineHeight: 20 },
  newerNote: { color: c.textTertiary, fontSize: 12.5, fontWeight: '700' },
  statePanel: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.lg,
    padding: 16,
    gap: 8,
    alignItems: 'flex-start',
  },
  stateTitle: { color: c.text, fontSize: 16, fontWeight: '800' },
  stateText: { color: c.textSecondary, fontSize: 13.5, lineHeight: 20 },
  partialPanel: { gap: 4 },
  partialText: { color: c.textTertiary, fontSize: 12.5, fontWeight: '700' },
  skippedText: { color: c.warning, fontSize: 12.5, fontWeight: '700' },
  section: { gap: 10 },
  channelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: c.surfaceHigh,
    borderRadius: MK_RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  channelHeaderText: { color: c.accent, fontSize: 14, fontWeight: '800' },
  postCard: {
    backgroundColor: c.surfaceElevated,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.lg,
    padding: 12,
    gap: 8,
  },
  replyCard: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.md,
    padding: 10,
    gap: 6,
    marginLeft: 10,
  },
  messageCard: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.md,
    padding: 11,
    gap: 6,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  itemAuthor: { flex: 1, minWidth: 0, color: c.text, fontSize: 13, fontWeight: '800' },
  postTitle: { color: c.text, fontSize: 16, fontWeight: '800', lineHeight: 21 },
  itemBody: { color: c.text, fontSize: 15, lineHeight: 21 },
  openThread: {
    alignSelf: 'flex-start',
    backgroundColor: c.surfaceHigh,
    borderRadius: MK_RADIUS.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  openThreadText: { color: c.accent, fontSize: 12, fontWeight: '800' },
  attachments: { gap: 4 },
  attachmentLink: { color: c.accent, fontSize: 12.5, fontWeight: '700' },
  reportChip: {
    minHeight: 28,
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.danger,
    borderRadius: MK_RADIUS.sm,
    paddingHorizontal: 9,
    backgroundColor: c.dangerSoft,
  },
  reportChipText: { color: c.danger, fontSize: 11, fontWeight: '800' },
  joinPanel: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.lg,
    padding: 16,
    gap: 10,
  },
  joinText: { color: c.textSecondary, fontSize: 13.5, lineHeight: 20 },
  joinButton: {
    alignSelf: 'flex-start',
    backgroundColor: c.surfaceHigh,
    borderColor: c.accent,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  joinButtonText: { color: c.accent, fontSize: 14, fontWeight: '800' },
  reportNotice: {
    backgroundColor: c.surfaceHigh,
    borderColor: c.glassBorder,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  reportNoticeText: { color: c.textSecondary, fontSize: 12.5, lineHeight: 18 },
  reportSheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  reportSheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: MK_RADIUS.lg,
    borderTopRightRadius: MK_RADIUS.lg,
    padding: 18,
    gap: 12,
  },
  reportSheetTitle: { color: c.text, fontSize: 17, fontWeight: '800' },
  reportSheetHint: { color: c.textSecondary, fontSize: 12.5, lineHeight: 18 },
  reasonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reasonChip: {
    borderColor: c.borderStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  reasonChipText: { color: c.text, fontSize: 13, fontWeight: '800' },
  reportCancel: {
    alignSelf: 'flex-start',
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  reportCancelText: { color: c.textSecondary, fontSize: 14, fontWeight: '800' },
  pressed: { opacity: 0.7 },
});
