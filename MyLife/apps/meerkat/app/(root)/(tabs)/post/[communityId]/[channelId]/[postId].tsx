import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import {
  channelArchived,
  createCommunityAudienceRule,
  createReplyAudienceRule,
  listCommunities,
  type ChannelMessageEvent,
} from '@mylife/sync';
import { AudienceRuleSummary } from '../../../../components/AudienceRule';
import { HonestNotice } from '../../../../components/kit';
import {
  ChatComposer,
  MessageActionsSheet,
  MessageBubble,
  formatClockTime,
  resolveReactionTap,
  segmentBodyMentions,
  type ChatKitMessage,
} from '../../../../components/chat';
import { useMeerkatDatabase } from '../../../../providers/DatabaseProvider';
import { useIdentity } from '../../../../providers/IdentityProvider';
import { useChannel } from '../../../../providers/ChatProvider';
import { useAppThemeColors, useMkStyles } from '../../../../providers/AppThemeProvider';
import { CommunityThemeProvider } from '../../../../providers/CommunityThemeProvider';
import { CanvasHost } from '../../../../components/canvas/CanvasHost';
import { channelThemeExtras,
  getCanvasById, parseCanvasPostBody } from '../../../../data/canvas-core';
import {
  buildCommunityPeerNameMap,
  resolveCommunityPersona,
  resolveCommunityAvatarImage,
  listChannelPostThread,
  listChannelReactions,
  type ChannelPostThread,
  type ChannelPostThreadNode,
  type MessageReactionGroup,
} from '../../../../data/community-core';
import { Avatar, avatarImageUri } from '../../../../components/Avatar';
import { mapChatItemToKit, mentionDisplayNames, replySnippet } from '../../../../data/channel-view-core';
import {
  isCommunityContentReportHidden,
  isCommunityPersonBlocked,
  reportCommunityContent,
} from '../../../../data/community-safety';
import { MK_RADIUS, shortHex, type MkColors } from '../../../../theme/tokens';

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

const EMPTY_REACTIONS: readonly MessageReactionGroup[] = Object.freeze([]);

function filterThreadNode(
  node: ChannelPostThreadNode,
  isHidden: (event: ChannelMessageEvent) => boolean,
): ChannelPostThreadNode | null {
  if (isHidden(node.event)) return null;
  return {
    event: node.event,
    replies: node.replies
      .map((child) => filterThreadNode(child, isHidden))
      .filter((child): child is ChannelPostThreadNode => child !== null),
  };
}

function countThreadReplies(nodes: readonly ChannelPostThreadNode[]): number {
  return nodes.reduce((sum, node) => sum + 1 + countThreadReplies(node.replies), 0);
}

function collectEvents(
  nodes: readonly ChannelPostThreadNode[],
  into: Map<string, ChannelMessageEvent>,
): void {
  for (const node of nodes) {
    into.set(node.event.id, node.event);
    collectEvents(node.replies, into);
  }
}

// The route wraps the post thread in the per-community theme boundary so it themes
// to its community; the tab bar and other tabs stay on the base theme.
export default function PostThreadRoute() {
  const params = useLocalSearchParams<{ communityId: string; channelId: string; postId: string }>();
  const routeDb = useMeerkatDatabase();
  const channelExtras = useMemo(
    () => channelThemeExtras(routeDb, param(params.communityId), param(params.channelId)),
    [routeDb, params.communityId, params.channelId],
  );
  return (
    <CommunityThemeProvider communityId={param(params.communityId)} channelExtras={channelExtras}>
      <PostThreadScreen />
    </CommunityThemeProvider>
  );
}

function PostThreadScreen() {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const db = useMeerkatDatabase();
  const { identity } = useIdentity();
  const params = useLocalSearchParams<{ communityId: string; channelId: string; postId: string }>();
  const communityId = param(params.communityId);
  const channelId = param(params.channelId);
  const postId = param(params.postId);
  const channel = useChannel(communityId, channelId);
  const [draft, setDraft] = useState('');
  const [replyTarget, setReplyTarget] = useState<ChannelMessageEvent | null>(null);
  const [editingEvent, setEditingEvent] = useState<ChannelMessageEvent | null>(null);
  // The unsent reply text stashed when entering edit mode, restored on cancel or
  // after the edit lands, so opening an edit never discards a half-written reply
  // (same shape as the channel screen's stashedCompose).
  const [stashedDraft, setStashedDraft] = useState<string | null>(null);
  const [actionTargetId, setActionTargetId] = useState<string | null>(null);
  const [safetyRevision, setSafetyRevision] = useState(0);

  const audienceRule = useMemo(() => createCommunityAudienceRule(communityId), [communityId]);
  const replyAudienceRule = useMemo(() => createReplyAudienceRule(audienceRule), [audienceRule]);
  const thread = useMemo<ChannelPostThread | null>(
    () => {
      void channel.messages;
      void safetyRevision;
      const raw = listChannelPostThread(db, communityId, channelId, postId);
      if (!raw) return null;
      const isHidden = (event: ChannelMessageEvent): boolean => {
        if (isCommunityPersonBlocked(db, communityId, event.authorDeviceId)) return true;
        if (isCommunityContentReportHidden(db, communityId, 'message', event.id)) return true;
        if (event.postId && isCommunityContentReportHidden(db, communityId, 'post', event.postId)) return true;
        return false;
      };
      if (isHidden(raw.root)) return null;
      const replies = raw.replies
        .map((node) => filterThreadNode(node, isHidden))
        .filter((node): node is ChannelPostThreadNode => node !== null);
      return { ...raw, replies, replyCount: countThreadReplies(replies) };
    },
    [db, communityId, channelId, postId, channel.messages, safetyRevision],
  );

  const community = useMemo(
    () => listCommunities(db).find((item) => item.communityId === communityId) ?? null,
    [db, communityId],
  );
  const descriptorChannel = community?.descriptor.channels.find((item) => item.id === channelId) ?? null;
  const channelName = descriptorChannel?.name ?? channelId;
  // Plan 38 Phase 2: an archived channel is read-only EVERYWHERE, including its
  // post threads; without this gate the thread composer was a reply back door.
  const channelIsArchived = descriptorChannel ? channelArchived(descriptorChannel) : false;

  // Deep links and relaunch restores can make this the only route; back then
  // needs a real destination (the thread's channel).
  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/channel/[communityId]/[channelId]', params: { communityId, channelId } });
  }, [router, communityId, channelId]);

  const peerNames = useMemo(() => {
    return community ? buildCommunityPeerNameMap(db, community.communityId) : new Map<string, string>();
  }, [community, db]);

  const resolvePeerName = useCallback((deviceId: string): string => {
    if (deviceId === identity.publicKey) {
      const communityName = peerNames.get(deviceId);
      return communityName ? `You as ${communityName}` : 'You';
    }
    return peerNames.get(deviceId) ?? shortHex(deviceId);
  }, [identity.publicKey, peerNames]);

  // Raw community name (no "You" substitution): the mention-highlight needle,
  // matching the display name a mention inserted into the body.
  const rawPeerName = useCallback(
    (deviceId: string): string => peerNames.get(deviceId) ?? shortHex(deviceId),
    [peerNames],
  );

  // AC-6: a reply author's signed community avatar (image -> initial -> ?). Only a
  // signature-verified v2 profile yields an image; db is read live.
  const resolveAvatarUri = useCallback(
    (deviceId: string): string | null =>
      avatarImageUri(resolveCommunityAvatarImage(db, communityId, deviceId)),
    [db, communityId],
  );
  const mentionNamesFor = useCallback(
    (event: ChannelMessageEvent): string[] => mentionDisplayNames(event, rawPeerName),
    [rawPeerName],
  );

  const reactionsByParent = useMemo(
    () => {
      void channel.messages;
      void safetyRevision;
      return listChannelReactions(db, communityId, channelId, identity.publicKey);
    },
    [db, communityId, channelId, channel.messages, identity.publicKey, safetyRevision],
  );

  const eventsById = useMemo(() => {
    const map = new Map<string, ChannelMessageEvent>();
    if (thread) {
      map.set(thread.root.id, thread.root);
      collectEvents(thread.replies, map);
    }
    return map;
  }, [thread]);

  const toKit = useCallback((event: ChannelMessageEvent): ChatKitMessage => (
    mapChatItemToKit(
      { kind: 'event', status: 'sent', event },
      {
        selfDeviceId: identity.publicKey,
        eventsById: new Map(),
        resolveReplyName: resolvePeerName,
        resolveNameColor: (deviceId) => resolveCommunityPersona(db, communityId, deviceId).nameColor,
      },
    )
  ), [communityId, db, identity.publicKey, resolvePeerName]);

  const toggleReaction = useCallback((event: ChannelMessageEvent, emoji: string) => {
    // Archived channels are read-only: existing reaction chips stay visible as
    // preserved content, but no tap may write a new react/remove event.
    if (channelIsArchived) return;
    const groups = reactionsByParent.get(event.id) ?? EMPTY_REACTIONS;
    const action = resolveReactionTap(groups, emoji);
    if (action.action === 'remove') channel.removeReaction(action.myEventId);
    else channel.react({ eventId: event.id, postId: event.postId ?? postId }, action.emoji);
  }, [reactionsByParent, channel, postId, channelIsArchived]);

  const startEdit = useCallback((event: ChannelMessageEvent) => {
    // Stash the in-progress reply ONCE (don't clobber it when hopping edits).
    setStashedDraft((prev) => prev ?? draft);
    setReplyTarget(null);
    setEditingEvent(event);
    setDraft(event.body);
  }, [draft]);

  const cancelEdit = useCallback(() => {
    setEditingEvent(null);
    setDraft(stashedDraft ?? '');
    setStashedDraft(null);
  }, [stashedDraft]);

  const beginReply = useCallback((event: ChannelMessageEvent) => {
    // Leaving edit mode via Reply restores the stashed reply text; a reply
    // started while NOT editing keeps whatever is already typed.
    if (editingEvent) {
      setEditingEvent(null);
      setDraft(stashedDraft ?? '');
      setStashedDraft(null);
    }
    setReplyTarget(event);
  }, [editingEvent, stashedDraft]);

  const confirmDelete = useCallback((event: ChannelMessageEvent) => {
    Alert.alert(
      'Delete from thread?',
      'This records a deletion for members who receive the update. Existing community history may update after a later history refresh.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const result = channel.delete(event);
            if (result.ok && editingEvent?.id === event.id) cancelEdit();
          },
        },
      ],
    );
  }, [cancelEdit, channel, editingEvent]);

  const reportThreadEvent = useCallback((event: ChannelMessageEvent) => {
    const root = event.id === thread?.root.id;
    Alert.alert(
      root ? 'Report and hide post?' : 'Report and hide reply?',
      root
        ? 'This hides the post on this device and adds it to local owner review. It does not remove the post for other members.'
        : 'This hides the reply on this device and adds it to local owner review. It does not remove the reply for other members.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: () => {
            reportCommunityContent(db, {
              communityId,
              channelId,
              targetKind: root ? 'post' : 'message',
              targetId: root ? postId : event.id,
              targetAuthorDeviceId: event.authorDeviceId,
              targetLabel: `${root ? 'Post' : 'Reply'} from ${resolvePeerName(event.authorDeviceId)}`,
              reason: 'Reported from thread',
            });
            setSafetyRevision((value) => value + 1);
          },
        },
      ],
    );
  }, [channelId, communityId, db, postId, resolvePeerName, thread?.root.id]);

  // Async so the composer's send latch releases when this settles, letting a
  // failed reply/edit (which leaves the field unchanged) be retried.
  const submitComposer = useCallback(async (body: string): Promise<void> => {
    if (editingEvent) {
      const result = channel.edit(editingEvent, body);
      if (result.ok) cancelEdit();
      return;
    }
    const parent = replyTarget ?? thread?.root ?? null;
    if (!parent) return;
    const result = channel.replyToPost(parent, body);
    if (result.ok) {
      setDraft('');
      setReplyTarget(null);
    }
  }, [cancelEdit, channel, editingEvent, replyTarget, thread]);

  if (!thread) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.missingTitle}>Post unavailable</Text>
        <HonestNotice text="This device does not have a verified root post for that thread. Nothing is loaded from a fallback server." />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={goBack}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const actionEvent = actionTargetId ? eventsById.get(actionTargetId) ?? null : null;
  const actionIsMine = actionEvent ? actionEvent.authorDeviceId === identity.publicKey : false;
  // 4.5: a canvas-post root renders its canvas, not the token body. Computed
  // per render (a single indexed row read), no hook: this sits below an early
  // return so a memo here would break the rules of hooks.
  const rootCanvasId = thread ? parseCanvasPostBody(thread.root.body) : null;
  const rootCanvas = rootCanvasId ? getCanvasById(db, rootCanvasId) : null;

  const target = replyTarget ?? thread.root;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to channel"
          onPress={goBack}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <ArrowLeft size={20} color={c.text} strokeWidth={1.9} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1}>Post thread</Text>
          <Text style={styles.headerMeta} numberOfLines={1}>#{channelName} · {thread.replyCount} replies</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.rootWrap}>
          <Text style={styles.rootCaption}>Original post</Text>
          {rootCanvas && community ? (
            <CanvasHost community={community} canvas={rootCanvas} />
          ) : rootCanvasId ? (
            <Text style={styles.emptyReplies}>
              A canvas post. Its canvas has not arrived on this device yet; it comes with a sync from a member who has it.
            </Text>
          ) : null}
          {rootCanvasId ? null : (
          <RootPost
            event={thread.root}
            authorName={resolvePeerName(thread.root.authorDeviceId)}
            avatarImageBase64={resolveCommunityAvatarImage(db, communityId, thread.root.authorDeviceId)}
            mentionNames={mentionNamesFor(thread.root)}
            reactions={reactionsByParent.get(thread.root.id) ?? EMPTY_REACTIONS}
            onToggleReaction={(emoji) => toggleReaction(thread.root, emoji)}
            onLongPress={() => setActionTargetId(thread.root.id)}
          />
          )}
        </View>

        {thread.replies.length === 0 ? (
          <Text style={styles.emptyReplies}>No replies yet.</Text>
        ) : (
          thread.replies.map((node) => (
            <ReplyNode
              key={node.event.id}
              node={node}
              toKit={toKit}
              ownDeviceId={identity.publicKey}
              resolveName={resolvePeerName}
              resolveAvatarUri={resolveAvatarUri}
              getReactions={(id) => reactionsByParent.get(id) ?? EMPTY_REACTIONS}
              mentionNamesFor={mentionNamesFor}
              onLongPress={setActionTargetId}
              onToggleReaction={toggleReaction}
              depth={0}
            />
          ))
        )}
        <HonestNotice text="This thread shows only signed post and reply events saved on this device. Replies inherit the original audience and cannot be made more public here." />
      </ScrollView>

      <View style={[styles.replyWrap, { paddingBottom: insets.bottom + 10 }]}>
        {channel.error ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear reply error"
            onPress={channel.clearError}
            style={styles.errorPanel}
          >
            <Text style={styles.errorTitle}>Couldn't post</Text>
            <Text style={styles.errorText}>{channel.error}</Text>
          </Pressable>
        ) : null}
        {channelIsArchived ? (
          <HonestNotice text="Archived channel. Content is preserved and read-only here." />
        ) : (
        <>
        <AudienceRuleSummary rule={replyAudienceRule} title="Reply audience" />
        <ChatComposer
          value={draft}
          onChangeText={setDraft}
          onSend={submitComposer}
          mentionCandidates={[]}
          sendDisabled={channel.busy}
          placeholder="Write a reply"
          reply={editingEvent ? null : {
            authorName: resolvePeerName(target.authorDeviceId),
            snippet: replySnippet(target),
          }}
          onCancelReply={() => setReplyTarget(null)}
          editing={editingEvent !== null}
          onCancelEdit={cancelEdit}
        />
        </>
        )}
      </View>

      <MessageActionsSheet
        visible={actionEvent !== null}
        onClose={() => setActionTargetId(null)}
        canReact={!channelIsArchived}
        canReply={!channelIsArchived}
        canCopy={(actionEvent?.body ?? '').length > 0}
        canEdit={actionIsMine && !channelIsArchived}
        canDelete={actionIsMine && !channelIsArchived}
        canReport={actionEvent !== null && !actionIsMine}
        onReact={(emoji) => { if (actionEvent) toggleReaction(actionEvent, emoji); }}
        onReply={() => { if (actionEvent) beginReply(actionEvent); }}
        onCopy={() => {
          if (!actionEvent?.body) return;
          Clipboard.setStringAsync(actionEvent.body).catch(() => {
            Alert.alert('Copy', 'Could not copy the text.');
          });
        }}
        onEdit={() => { if (actionEvent) startEdit(actionEvent); }}
        onDelete={() => { if (actionEvent) confirmDelete(actionEvent); }}
        onReport={() => { if (actionEvent) reportThreadEvent(actionEvent); }}
      />
    </KeyboardAvoidingView>
  );
}

function RootPost({
  event,
  authorName,
  avatarImageBase64,
  mentionNames,
  reactions,
  onToggleReaction,
  onLongPress,
}: {
  event: ChannelMessageEvent;
  authorName: string;
  avatarImageBase64: string | null;
  mentionNames: readonly string[];
  reactions: readonly MessageReactionGroup[];
  onToggleReaction: (emoji: string) => void;
  onLongPress: () => void;
}) {
  const styles = useMkStyles(makeStyles);
  const segments = mentionNames.length > 0 ? segmentBodyMentions(event.body, mentionNames) : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Original post from ${authorName}. Hold for actions.`}
      onLongPress={onLongPress}
      delayLongPress={280}
      style={styles.rootCard}
    >
      <View style={styles.rootHeader}>
        <Avatar
          imageBase64={avatarImageBase64}
          initial={authorName.trim().charAt(0).toUpperCase() || '?'}
          size={32}
        />
        <Text style={styles.rootAuthor} numberOfLines={1}>{authorName}</Text>
        <Text style={styles.rootTime}>
          {formatClockTime(event.hlc.wall)}
          {event.supersedes && !event.supersedes.deleted ? ' · Edited' : ''}
        </Text>
      </View>
      <Text style={styles.rootBody}>
        {segments
          ? segments.map((segment, index) => (
              segment.mention
                ? <Text key={index} style={styles.mention}>{segment.text}</Text>
                : <Text key={index}>{segment.text}</Text>
            ))
          : event.body}
      </Text>
      <ReactionRow reactions={reactions} onToggle={onToggleReaction} />
    </Pressable>
  );
}

function ReplyNode({
  node,
  toKit,
  ownDeviceId,
  resolveName,
  resolveAvatarUri,
  getReactions,
  mentionNamesFor,
  onLongPress,
  onToggleReaction,
  depth,
}: {
  node: ChannelPostThreadNode;
  toKit: (event: ChannelMessageEvent) => ChatKitMessage;
  ownDeviceId: string;
  resolveName: (deviceId: string) => string;
  resolveAvatarUri: (deviceId: string) => string | null;
  getReactions: (id: string) => readonly MessageReactionGroup[];
  mentionNamesFor: (event: ChannelMessageEvent) => readonly string[];
  onLongPress: (id: string) => void;
  onToggleReaction: (event: ChannelMessageEvent, emoji: string) => void;
  depth: number;
}) {
  const styles = useMkStyles(makeStyles);
  const authorName = resolveName(node.event.authorDeviceId);
  return (
    <View style={[styles.replyNode, depth > 0 && styles.nestedReply]}>
      <MessageBubble
        item={toKit(node.event)}
        isMine={node.event.authorDeviceId === ownDeviceId}
        isGroupStart
        isGroupEnd
        authorName={authorName}
        avatarInitial={authorName.trim().charAt(0).toUpperCase() || '?'}
        avatarImageUri={resolveAvatarUri(node.event.authorDeviceId)}
        reactions={getReactions(node.event.id)}
        mentionNames={mentionNamesFor(node.event)}
        onLongPress={onLongPress}
        onPressReaction={(_id, emoji) => onToggleReaction(node.event, emoji)}
      />
      {node.replies.map((child) => (
        <ReplyNode
          key={child.event.id}
          node={child}
          toKit={toKit}
          ownDeviceId={ownDeviceId}
          resolveName={resolveName}
          resolveAvatarUri={resolveAvatarUri}
          getReactions={getReactions}
          mentionNamesFor={mentionNamesFor}
          onLongPress={onLongPress}
          onToggleReaction={onToggleReaction}
          depth={depth + 1}
        />
      ))}
    </View>
  );
}

function ReactionRow({
  reactions,
  onToggle,
}: {
  reactions: readonly MessageReactionGroup[];
  onToggle: (emoji: string) => void;
}) {
  const styles = useMkStyles(makeStyles);
  if (reactions.length === 0) return null;
  return (
    <View style={styles.reactionRow}>
      {reactions.map((group) => (
        <Pressable
          key={group.emoji}
          accessibilityRole="button"
          accessibilityLabel={`${group.emoji} ${group.count}${group.mine ? ', including you. Tap to remove.' : '. Tap to add.'}`}
          accessibilityState={{ selected: group.mine }}
          onPress={() => onToggle(group.emoji)}
          style={[styles.reactionChip, group.mine && styles.reactionChipMine]}
        >
          <Text style={styles.reactionEmoji}>{group.emoji}</Text>
          <Text style={[styles.reactionCount, group.mine && styles.reactionCountMine]}>{group.count}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  center: { padding: 16, justifyContent: 'center', gap: 14 },
  missingTitle: { color: c.text, fontSize: 22, fontWeight: '800' },
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
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: MK_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceHigh,
  },
  headerText: { flex: 1, minWidth: 0 },
  headerTitle: { color: c.text, fontSize: 18, fontWeight: '800' },
  headerMeta: { color: c.textSecondary, fontSize: 12, marginTop: 1 },
  scroll: { flex: 1 },
  content: { padding: 14, gap: 12 },
  rootWrap: { gap: 6 },
  rootCaption: { color: c.textTertiary, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  rootCard: {
    backgroundColor: c.glass,
    borderColor: c.accent,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.lg,
    padding: 13,
    gap: 8,
  },
  rootHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rootAuthor: { flex: 1, minWidth: 0, color: c.text, fontSize: 14, fontWeight: '800' },
  rootTime: { color: c.textTertiary, fontSize: 11, fontWeight: '700' },
  rootBody: { color: c.text, fontSize: 17, lineHeight: 24, fontWeight: '700' },
  mention: { color: c.accentDim, fontWeight: '800' },
  emptyReplies: { color: c.textSecondary, fontSize: 13, lineHeight: 19, paddingHorizontal: 4 },
  replyNode: { gap: 6 },
  nestedReply: {
    marginLeft: 14,
    paddingLeft: 10,
    borderLeftColor: c.borderStrong,
    borderLeftWidth: StyleSheet.hairlineWidth,
  },
  reactionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 1 },
  reactionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 26,
    paddingHorizontal: 8,
    borderRadius: MK_RADIUS.pill,
    backgroundColor: c.surfaceHigh,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  reactionChipMine: { borderColor: c.accent, backgroundColor: c.glass },
  reactionEmoji: { fontSize: 13 },
  reactionCount: { color: c.textSecondary, fontSize: 12, fontWeight: '700' },
  reactionCountMine: { color: c.accentDim },
  replyWrap: {
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: c.surface,
    borderTopColor: c.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  errorPanel: {
    backgroundColor: c.dangerSoft,
    borderColor: c.danger,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.md,
    padding: 12,
    gap: 3,
  },
  errorTitle: { color: c.danger, fontSize: 13, fontWeight: '800' },
  errorText: { color: c.danger, fontSize: 12, lineHeight: 17 },
  secondaryButton: {
    alignSelf: 'flex-start',
    backgroundColor: c.surfaceHigh,
    borderRadius: MK_RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryButtonText: { color: c.text, fontSize: 14, fontWeight: '800' },
  pressed: { opacity: 0.72 },
});
