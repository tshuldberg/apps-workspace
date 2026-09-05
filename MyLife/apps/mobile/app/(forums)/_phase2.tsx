import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import {
  FR_ACCENT,
  FR_ACCENT_LIGHT,
  FR_CARD_RADIUS,
  FR_COMMUNITY_TYPES,
  FR_DANGER,
  FR_GLASS_NAV,
  FR_INFO,
  FR_ON_ACCENT,
  FR_PINNED,
  FR_PURPLE_GLOW_STYLE,
  FR_SURFACES,
  FR_TEXT,
  FR_TEXT_SECONDARY,
  FR_TEXT_TERTIARY,
  FR_TRUST_TIERS,
  FR_TYPOGRAPHY,
  CommunityPill,
  GlassCard,
  HumanVerifiedBadge,
  MaterialSymbol,
  ReplyBubble,
  SectionHeader,
  ThreadCard,
  VoteControls,
  getCachedCommunityById,
  getCommunityTone,
  upsertCachedCommunity,
  upsertCachedReply,
  upsertCachedThread,
  type Community,
  type CommunityRule,
  type DatabaseAdapter,
  type Reply,
  type UserProfile,
} from '@mylife/forums';
import { useForumsData } from './_ui';

type ForumVoteState = 'up' | 'down' | null;
type ThreadSort = 'best' | 'top' | 'new' | 'old';
type CommunitySort = 'hot' | 'new' | 'top';
type CommunityTab = 'threads' | 'about' | 'rules' | 'members';
type PreviewTab = 'write' | 'preview';
type ComposerTab = 'write' | 'preview';
type CommunityDraftType = 'public' | 'private' | 'federated';
type TrustRequirement = 'none' | 'new' | 'trusted' | 'highly_trusted';

type MediaAttachment = {
  id: string;
  uri: string;
  kind: 'image' | 'video';
  width: number | null;
  height: number | null;
};

type RuleDraft = {
  id: string;
  title: string;
  description: string;
};

type ThreadExtra = {
  tagNames: string[];
  attachments: MediaAttachment[];
  allowReplies: boolean;
  nsfw: boolean;
  crossPostIds: string[];
};

type CommunityExtra = {
  tagline: string;
  description: string;
  uiType: CommunityDraftType;
  trustRequirement: TrustRequirement;
  coverUri: string | null;
  iconUri: string | null;
  colorTheme: string;
  rules: RuleDraft[];
};

type ThreadDraftSnapshot = {
  communityId: string;
  title: string;
  body: string;
  previewTab: PreviewTab;
  selectedTagNames: string[];
  attachments: MediaAttachment[];
  nsfw: boolean;
  allowReplies: boolean;
  crossPostIds: string[];
};

type CommunityDraftSnapshot = {
  displayName: string;
  slug: string;
  tagline: string;
  description: string;
  uiType: CommunityDraftType;
  humansOnly: boolean;
  trustRequirement: TrustRequirement;
  coverUri: string | null;
  iconUri: string | null;
  colorTheme: string;
  rules: RuleDraft[];
};

const PHASE2_DIR = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}forums-phase2/`
  : null;
const THREAD_DRAFT_FILE = 'create-thread.json';
const COMMUNITY_DRAFT_FILE = 'create-community.json';

const THREAD_EXTRAS = new Map<string, ThreadExtra>();
const COMMUNITY_EXTRAS = new Map<string, CommunityExtra>();
const LIVE_REPLY_SEEN = new Set<string>();

const COMMUNITY_COLOR_OPTIONS = [
  FR_ACCENT,
  '#8BCFF0',
  '#FFB877',
  '#30D158',
  '#D65DB1',
];

function getParamValue(value?: string | string[]): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || `community-${Date.now()}`;
}

function formatRelativeTime(value: string): string {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function formatDateLabel(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function initials(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function getTrustTier(profile: UserProfile, role?: string): keyof typeof FR_TRUST_TIERS {
  if (role === 'owner' || role === 'admin' || role === 'moderator') {
    return 'mod';
  }
  if (profile.isVerified && profile.karma >= 1000) return 'highly_trusted';
  if (profile.isVerified) return 'trusted';
  if (profile.karma > 0) return 'new';
  return 'unverified';
}

async function ensurePhase2Dir(): Promise<string | null> {
  if (!PHASE2_DIR) return null;
  const info = await FileSystem.getInfoAsync(PHASE2_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(PHASE2_DIR, { intermediates: true });
  }
  return PHASE2_DIR;
}

async function readDraftFile<T>(filename: string): Promise<T | null> {
  try {
    const dir = await ensurePhase2Dir();
    if (!dir) return null;
    const path = `${dir}${filename}`;
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(path);
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeDraftFile(filename: string, payload: unknown): Promise<void> {
  try {
    const dir = await ensurePhase2Dir();
    if (!dir) return;
    await FileSystem.writeAsStringAsync(`${dir}${filename}`, JSON.stringify(payload));
  } catch {
    // Ignore local draft failures on unsupported environments.
  }
}

async function clearDraftFile(filename: string): Promise<void> {
  try {
    const dir = await ensurePhase2Dir();
    if (!dir) return;
    await FileSystem.deleteAsync(`${dir}${filename}`, { idempotent: true });
  } catch {
    // Ignore cleanup failures.
  }
}

function ensureVotesTable(db: DatabaseAdapter) {
  db.run(
    `CREATE TABLE IF NOT EXISTS fr_votes_local (
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      profile_id TEXT NOT NULL,
      direction TEXT NOT NULL,
      PRIMARY KEY (target_type, target_id, profile_id)
    )`,
  );
}

function getStoredVote(
  db: DatabaseAdapter,
  targetType: 'thread' | 'reply',
  targetId: string,
  profileId: string,
): ForumVoteState {
  ensureVotesTable(db);
  const row = db.get<{ direction: 'up' | 'down' }>(
    'SELECT direction FROM fr_votes_local WHERE target_type = ? AND target_id = ? AND profile_id = ?',
    [targetType, targetId, profileId],
  );
  return row?.direction ?? null;
}

function getVoteDelta(previous: ForumVoteState, next: ForumVoteState): number {
  const scoreFor = (vote: ForumVoteState) => {
    if (vote === 'up') return 1;
    if (vote === 'down') return -1;
    return 0;
  };
  return scoreFor(next) - scoreFor(previous);
}

function applyLocalVote(params: {
  db: DatabaseAdapter;
  targetType: 'thread' | 'reply';
  targetId: string;
  profileId: string;
  direction: 'up' | 'down';
}): ForumVoteState {
  const { db, direction, profileId, targetId, targetType } = params;
  ensureVotesTable(db);
  const previous = getStoredVote(db, targetType, targetId, profileId);
  const next = previous === direction ? null : direction;
  const delta = getVoteDelta(previous, next);

  if (next == null) {
    db.run(
      'DELETE FROM fr_votes_local WHERE target_type = ? AND target_id = ? AND profile_id = ?',
      [targetType, targetId, profileId],
    );
  } else {
    db.run(
      `INSERT OR REPLACE INTO fr_votes_local (target_type, target_id, profile_id, direction)
       VALUES (?, ?, ?, ?)`,
      [targetType, targetId, profileId, next],
    );
  }

  if (delta !== 0) {
    const table = targetType === 'thread' ? 'fr_threads_cache' : 'fr_replies_cache';
    db.run(
      `UPDATE ${table} SET vote_score = vote_score + ?, updated_at = ? WHERE id = ?`,
      [delta, new Date().toISOString(), targetId],
    );
  }

  return next;
}

function getThreadExtra(threadId: string, fallbackTags: string[]): ThreadExtra {
  return (
    THREAD_EXTRAS.get(threadId) ?? {
      tagNames: fallbackTags.slice(0, 3),
      attachments: [],
      allowReplies: true,
      nsfw: false,
      crossPostIds: [],
    }
  );
}

function getCommunityExtra(community: Community): CommunityExtra {
  return (
    COMMUNITY_EXTRAS.get(community.id) ?? {
      tagline: community.description ?? 'Human-centered discussion with context first.',
      description: community.description ?? 'A slower, higher-signal forum space.',
      uiType: getCommunityTone({
        humansOnly: community.humansOnly,
        communityType: community.communityType,
      }) === 'private'
        ? 'private'
        : 'public',
      trustRequirement: community.humansOnly ? 'trusted' : 'none',
      coverUri: community.bannerUrl,
      iconUri: community.iconUrl,
      colorTheme: FR_ACCENT,
      rules: [],
    }
  );
}

function getCommunityRules(communityId: string, baseRules: CommunityRule[]): RuleDraft[] {
  const extras = COMMUNITY_EXTRAS.get(communityId);
  if (!extras || extras.rules.length === 0) {
    return baseRules.map((rule) => ({
      id: rule.id,
      title: rule.title,
      description: rule.description,
    }));
  }
  return extras.rules;
}

async function pickMediaFromLibrary(
  allowsEditing = false,
): Promise<MediaAttachment | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('Library access needed', 'Allow photo library access to attach images.');
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing,
    quality: 0.82,
    selectionLimit: 1,
  });

  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return {
    id: makeId('media'),
    uri: asset.uri,
    kind: asset.type === 'video' ? 'video' : 'image',
    width: asset.width ?? null,
    height: asset.height ?? null,
  };
}

function insertMarkdownToken(body: string, token: string): string {
  if (!body.trim()) {
    return `${token}${token}`;
  }
  return `${body}\n${token}${token}`;
}

type MarkdownBlock =
  | { kind: 'title'; text: string }
  | { kind: 'subtitle'; text: string }
  | { kind: 'bullet'; text: string }
  | { kind: 'quote'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'body'; text: string };

function parseMarkdown(content: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const lines = content.split('\n');
  let inCodeBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (!trimmed) continue;
    if (inCodeBlock) {
      blocks.push({ kind: 'code', text: line });
      continue;
    }
    if (trimmed.startsWith('# ')) {
      blocks.push({ kind: 'title', text: trimmed.slice(2) });
      continue;
    }
    if (trimmed.startsWith('## ')) {
      blocks.push({ kind: 'subtitle', text: trimmed.slice(3) });
      continue;
    }
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      blocks.push({ kind: 'bullet', text: trimmed.slice(2) });
      continue;
    }
    if (trimmed.startsWith('> ')) {
      blocks.push({ kind: 'quote', text: trimmed.slice(2) });
      continue;
    }
    blocks.push({ kind: 'body', text: line });
  }

  return blocks;
}

function MarkdownPreview({ content }: { content: string }) {
  const blocks = useMemo(() => parseMarkdown(content), [content]);

  if (!content.trim()) {
    return (
      <GlassCard style={styles.previewEmptyCard}>
        <Text style={styles.previewEmptyTitle}>Nothing to preview yet</Text>
        <Text style={styles.previewEmptyBody}>
          Start writing and the rendered preview will appear here.
        </Text>
      </GlassCard>
    );
  }

  return (
    <View style={styles.markdownWrap}>
      {blocks.map((block, index) => {
        if (block.kind === 'title') {
          return (
            <Text key={`${block.kind}-${index}`} style={styles.markdownTitle}>
              {block.text}
            </Text>
          );
        }
        if (block.kind === 'subtitle') {
          return (
            <Text key={`${block.kind}-${index}`} style={styles.markdownSubtitle}>
              {block.text}
            </Text>
          );
        }
        if (block.kind === 'bullet') {
          return (
            <View key={`${block.kind}-${index}`} style={styles.markdownBulletRow}>
              <View style={styles.markdownBulletDot} />
              <Text style={styles.markdownBody}>{block.text}</Text>
            </View>
          );
        }
        if (block.kind === 'quote') {
          return (
            <View key={`${block.kind}-${index}`} style={styles.markdownQuote}>
              <Text style={styles.markdownQuoteText}>{block.text}</Text>
            </View>
          );
        }
        if (block.kind === 'code') {
          return (
            <View key={`${block.kind}-${index}`} style={styles.markdownCode}>
              <Text style={styles.markdownCodeText}>{block.text}</Text>
            </View>
          );
        }
        return (
          <Text key={`${block.kind}-${index}`} style={styles.markdownBody}>
            {block.text}
          </Text>
        );
      })}
    </View>
  );
}

function Phase2Header({
  title,
  subtitle,
  onBack,
  onClose,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onClose?: () => void;
  right?: ReactNode;
}) {
  return (
    <BlurView intensity={FR_GLASS_NAV.blur} tint="dark" style={styles.headerShell}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          {onClose ? (
            <Pressable onPress={onClose} style={styles.iconButton}>
              <MaterialSymbol name="close" color={FR_TEXT} />
            </Pressable>
          ) : onBack ? (
            <Pressable onPress={onBack} style={styles.iconButton}>
              <Text style={styles.backText}>Back</Text>
            </Pressable>
          ) : (
            <View style={styles.iconButtonSpacer} />
          )}
          {onBack && onClose ? (
            <Pressable onPress={onBack} style={styles.iconButton}>
              <Text style={styles.backText}>Back</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.headerCenter}>
          <Text numberOfLines={1} style={styles.headerTitle}>
            {title}
          </Text>
          {subtitle ? (
            <Text numberOfLines={1} style={styles.headerSubtitle}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View style={styles.headerRight}>{right ?? <View style={styles.iconButtonSpacer} />}</View>
      </View>
    </BlurView>
  );
}

function StatPill({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <View style={styles.statPill}>
      <Text style={[styles.statPillValue, accent ? { color: accent } : null]}>{value}</Text>
      <Text style={styles.statPillLabel}>{label}</Text>
    </View>
  );
}

function Avatar({
  name,
  size = 42,
  accent = FR_ACCENT,
}: {
  name: string;
  size?: number;
  accent?: string;
}) {
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: accent,
        },
      ]}
    >
      <Text style={styles.avatarText}>{initials(name)}</Text>
    </View>
  );
}

function ActionChip({
  label,
  active = false,
  onPress,
  icon,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: keyof typeof FR_COMMUNITY_TYPES | 'tag' | 'add' | 'photo_camera' | 'send' | 'bookmark' | 'search' | 'flag' | 'block' | 'lock' | 'groups' | 'shield' | 'more_vert' | 'chat_bubble' | 'push_pin' | 'edit';
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.actionChip, active ? styles.actionChipActive : null]}
    >
      {icon ? (
        <MaterialSymbol
          name={icon as any}
          size={14}
          color={active ? FR_ON_ACCENT : FR_TEXT_SECONDARY}
        />
      ) : null}
      <Text style={[styles.actionChipText, active ? styles.actionChipTextActive : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

function AttachmentGrid({
  attachments,
  onRemove,
  compact = false,
}: {
  attachments: MediaAttachment[];
  onRemove?: (attachmentId: string) => void;
  compact?: boolean;
}) {
  if (attachments.length === 0) return null;

  return (
    <View style={[styles.attachmentGrid, compact ? styles.attachmentGridCompact : null]}>
      {attachments.map((attachment) => (
        <View key={attachment.id} style={styles.attachmentCard}>
          <View
            style={[
              styles.attachmentPreview,
              compact ? styles.attachmentPreviewCompact : null,
            ]}
          >
            <Text style={styles.attachmentPreviewText}>
              {attachment.kind === 'video' ? 'Video' : 'Image'}
            </Text>
          </View>
          <Text numberOfLines={1} style={styles.attachmentLabel}>
            {attachment.uri.split('/').pop() ?? 'attachment'}
          </Text>
          {onRemove ? (
            <Pressable onPress={() => onRemove(attachment.id)} style={styles.attachmentRemove}>
              <Text style={styles.attachmentRemoveText}>Remove</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function useCommunityPickerSearch(
  communities: Community[],
  query: string,
) {
  return useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return communities;
    return communities.filter((community) =>
      `${community.displayName} ${community.description ?? ''} ${community.name}`
        .toLowerCase()
        .includes(needle),
    );
  }, [communities, query]);
}

function ThreadReplyTree({
  parentReplyId,
  replies,
  depth,
  findProfile,
  memberRoles,
  getVote,
  onVote,
  onReply,
}: {
  parentReplyId: string | null;
  replies: Reply[];
  depth: number;
  findProfile: (profileId?: string | null) => UserProfile;
  memberRoles: Map<string, string>;
  getVote: (replyId: string) => ForumVoteState;
  onVote: (replyId: string, direction: 'up' | 'down') => void;
  onReply: (replyId: string, authorName: string) => void;
}) {
  const children = replies.filter((reply) => (reply.parentReplyId ?? null) === parentReplyId);

  return (
    <>
      {children.map((reply) => {
        const author = findProfile(reply.authorId);
        const role = memberRoles.get(reply.authorId);
        const cappedDepth = Math.min(depth, 5);

        return (
          <View key={reply.id} style={depth > 0 ? styles.replyBranch : null}>
            {depth > 4 ? (
              <Pressable onPress={() => onReply(reply.id, author.displayName)} style={styles.replyOverflowLink}>
                <Text style={styles.replyOverflowText}>View thread branch</Text>
              </Pressable>
            ) : (
              <ReplyBubble
                reply={reply}
                author={author}
                depth={cappedDepth}
                userVote={getVote(reply.id)}
                onVote={(direction) => onVote(reply.id, direction)}
                onReply={() => onReply(reply.id, author.displayName)}
                onReport={() =>
                  Alert.alert('Reply actions', 'Choose how to handle this reply.', [
                    { text: 'Report', style: 'destructive' },
                    { text: 'Cancel', style: 'cancel' },
                  ])
                }
              />
            )}
            <View style={styles.replyMetaRow}>
              <HumanVerifiedBadge tier={getTrustTier(author, role)} />
              <Text style={styles.replyMetaText}>depth {reply.depth + 1}</Text>
            </View>
            {depth < 5 ? (
              <ThreadReplyTree
                parentReplyId={reply.id}
                replies={replies}
                depth={depth + 1}
                findProfile={findProfile}
                memberRoles={memberRoles}
                getVote={getVote}
                onVote={onVote}
                onReply={onReply}
              />
            ) : null}
          </View>
        );
      })}
    </>
  );
}

export function ForumsThreadDetailPhase2Screen() {
  const params = useLocalSearchParams<{ threadId?: string }>();
  const router = useRouter();
  const {
    db,
    refresh,
    currentProfile,
    findCommunity,
    findProfile,
    findThread,
    repliesForThread,
    toggleBookmark,
    bookmarks,
    createReply,
    membersForCommunity,
    tagsForCommunity,
  } = useForumsData();

  const thread = findThread(getParamValue(params.threadId));
  const community = findCommunity(thread.communityId);
  const author = findProfile(thread.authorId);
  const threadExtra = getThreadExtra(
    thread.id,
    tagsForCommunity(thread.communityId).map((tag) => tag.name),
  );
  const [sort, setSort] = useState<ThreadSort>('best');
  const [replyDraft, setReplyDraft] = useState('');
  const [composerTab, setComposerTab] = useState<ComposerTab>('write');
  const [composerVisible, setComposerVisible] = useState(false);
  const [replyTarget, setReplyTarget] = useState<{ id: string; authorName: string } | null>(null);
  const [liveReplyCount, setLiveReplyCount] = useState(0);
  const [voteRevision, setVoteRevision] = useState(0);

  const rawReplies = repliesForThread(thread.id);
  const replies = useMemo(() => {
    const items = rawReplies.slice();
    if (sort === 'new') {
      return items.sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      );
    }
    if (sort === 'old') {
      return items.sort(
        (left, right) =>
          new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
      );
    }
    return items.sort((left, right) => {
      if (right.voteScore !== left.voteScore) return right.voteScore - left.voteScore;
      return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
    });
  }, [rawReplies, sort]);

  const memberRoles = useMemo(() => {
    const map = new Map<string, string>();
    membersForCommunity(community.id).forEach((member) => {
      map.set(member.profileId, member.role);
    });
    return map;
  }, [community.id, membersForCommunity]);

  const isSaved = bookmarks.some((bookmark) => bookmark.threadId === thread.id);
  const localThreadVote = useMemo(
    () => getStoredVote(db, 'thread', thread.id, currentProfile.id),
    [currentProfile.id, db, thread.id, voteRevision],
  );

  const getReplyVote = useCallback(
    (replyId: string) => getStoredVote(db, 'reply', replyId, currentProfile.id),
    [currentProfile.id, db, voteRevision],
  );

  useEffect(() => {
    if (LIVE_REPLY_SEEN.has(thread.id)) return;

    const timer = setTimeout(() => {
      try {
        const guest =
          replies.find((reply) => reply.authorId !== currentProfile.id) ??
          replies[0];
        const guestProfile = findProfile(guest?.authorId ?? author.id);
        upsertCachedReply(db, {
          id: makeId('reply'),
          threadId: thread.id,
          parentReplyId: null,
          authorId: guestProfile.id,
          body: 'Realtime pulse: a new reply landed while you were reading. This keeps the bottom banner and incremental update flow visible in the redesigned discussion screen.',
          voteScore: 2,
          depth: 0,
          status: 'open',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        upsertCachedThread(db, {
          ...thread,
          replyCount: thread.replyCount + 1,
          updatedAt: new Date().toISOString(),
        });
        LIVE_REPLY_SEEN.add(thread.id);
        setLiveReplyCount((value) => value + 1);
        refresh();
      } catch {
        // Ignore simulated realtime failures.
      }
    }, 18_000);

    return () => clearTimeout(timer);
  }, [author.id, currentProfile.id, db, findProfile, refresh, replies, thread]);

  const handleThreadVote = useCallback(
    (direction: 'up' | 'down') => {
      try {
        applyLocalVote({
          db,
          targetType: 'thread',
          targetId: thread.id,
          profileId: currentProfile.id,
          direction,
        });
        setVoteRevision((value) => value + 1);
        refresh();
      } catch {
        Alert.alert('Vote failed', 'The vote could not be stored locally.');
      }
    },
    [currentProfile.id, db, refresh, thread.id],
  );

  const handleReplyVote = useCallback(
    (replyId: string, direction: 'up' | 'down') => {
      try {
        applyLocalVote({
          db,
          targetType: 'reply',
          targetId: replyId,
          profileId: currentProfile.id,
          direction,
        });
        setVoteRevision((value) => value + 1);
        refresh();
      } catch {
        Alert.alert('Vote failed', 'The reply vote could not be stored locally.');
      }
    },
    [currentProfile.id, db, refresh],
  );

  const postReply = useCallback(() => {
    if (!replyDraft.trim()) {
      Alert.alert('Reply missing', 'Write something before posting your reply.');
      return;
    }

    try {
      createReply(thread.id, replyDraft.trim(), replyTarget?.id ?? null);
      setReplyDraft('');
      setReplyTarget(null);
      setComposerVisible(false);
      setComposerTab('write');
      refresh();
    } catch {
      Alert.alert('Reply failed', 'The reply could not be saved locally.');
    }
  }, [createReply, refresh, replyDraft, replyTarget, thread.id]);

  const handleOverflow = () => {
    const currentUserRole = memberRoles.get(currentProfile.id);
    Alert.alert('Thread actions', 'Choose an action for this thread.', [
      { text: isSaved ? 'Unsave' : 'Save', onPress: () => toggleBookmark(thread.id) },
      { text: 'Report', style: 'destructive' },
      { text: 'Block author' },
      ...(currentUserRole === 'owner' || currentUserRole === 'admin' || currentUserRole === 'moderator'
        ? [{ text: 'Moderator tools' as const }]
        : []),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const composerLocked = !threadExtra.allowReplies || thread.status !== 'open';

  return (
    <SafeAreaView style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Phase2Header
          title={community.displayName}
          subtitle={thread.isPinned ? 'Pinned discussion' : 'Thread discussion'}
          onBack={() => router.back()}
          right={
            <View style={styles.headerActions}>
              <Pressable
                onPress={() => toggleBookmark(thread.id)}
                style={styles.iconButton}
              >
                <MaterialSymbol
                  name="bookmark"
                  color={isSaved ? FR_ACCENT_LIGHT : FR_TEXT}
                  filled={isSaved}
                />
              </Pressable>
              <Pressable onPress={handleOverflow} style={styles.iconButton}>
                <MaterialSymbol name="more_vert" color={FR_TEXT} />
              </Pressable>
            </View>
          }
        />

        <View style={styles.screen}>
          <ScrollView
            contentContainerStyle={styles.threadScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <GlassCard style={styles.opCard} glow={community.humansOnly}>
              <View style={styles.threadMetaTop}>
                <CommunityPill community={community} size="md" />
                <View style={styles.threadMetaActions}>
                  {thread.isPinned ? (
                    <View style={styles.inlineBadge}>
                      <MaterialSymbol name="push_pin" size={12} color={FR_PINNED} filled />
                      <Text style={styles.inlineBadgeText}>Pinned</Text>
                    </View>
                  ) : null}
                  {community.humansOnly ? (
                    <HumanVerifiedBadge tier="trusted" />
                  ) : null}
                </View>
              </View>

              <View style={styles.authorRow}>
                <Avatar name={author.displayName} size={48} accent={FR_ACCENT} />
                <View style={styles.authorTextWrap}>
                  <Text style={styles.authorName}>{author.displayName}</Text>
                  <View style={styles.authorMetaRow}>
                    <HumanVerifiedBadge
                      tier={getTrustTier(author, memberRoles.get(author.id))}
                    />
                    <Text style={styles.authorMetaText}>
                      {formatRelativeTime(thread.createdAt)}
                    </Text>
                  </View>
                </View>
              </View>

              <Text style={styles.threadTitle}>{thread.title}</Text>
              <MarkdownPreview content={thread.body} />

              {threadExtra.attachments.length > 0 ? (
                <AttachmentGrid attachments={threadExtra.attachments} compact />
              ) : null}

              <View style={styles.tagRow}>
                {threadExtra.tagNames.map((tagName) => (
                  <ActionChip key={tagName} label={`#${tagName}`} icon="tag" />
                ))}
                {threadExtra.nsfw ? <ActionChip label="NSFW" active /> : null}
              </View>

              <View style={styles.threadStatsRow}>
                <StatPill label="Votes" value={String(thread.voteScore)} accent={FR_ACCENT_LIGHT} />
                <StatPill label="Replies" value={String(thread.replyCount)} accent={FR_INFO} />
                <StatPill label="Views" value={String(thread.viewCount)} />
              </View>

              <View style={styles.threadVoteRow}>
                <VoteControls
                  count={thread.voteScore}
                  userVote={localThreadVote}
                  orientation="horizontal"
                  onUp={() => handleThreadVote('up')}
                  onDown={() => handleThreadVote('down')}
                />
                <ActionChip label="Share" onPress={() => Alert.alert('Share', 'Share actions wire here.')} />
                <ActionChip
                  label={isSaved ? 'Saved' : 'Save'}
                  active={isSaved}
                  icon="bookmark"
                  onPress={() => toggleBookmark(thread.id)}
                />
              </View>
            </GlassCard>

            <View style={styles.sectionSplitRow}>
              <SectionHeader title={`${replies.length} Replies`} action={null} />
              <View style={styles.sectionChipRow}>
                {(['best', 'top', 'new', 'old'] as const).map((option) => (
                  <ActionChip
                    key={option}
                    label={option}
                    active={sort === option}
                    onPress={() => setSort(option)}
                  />
                ))}
              </View>
            </View>

            {replies.length === 0 ? (
              <GlassCard style={styles.emptyDiscussionCard}>
                <Text style={styles.emptyDiscussionTitle}>No replies yet</Text>
                <Text style={styles.emptyDiscussionBody}>
                  Start the discussion and the threaded reply tree will build from here.
                </Text>
              </GlassCard>
            ) : (
              <ThreadReplyTree
                parentReplyId={null}
                replies={replies}
                depth={0}
                findProfile={findProfile}
                memberRoles={memberRoles}
                getVote={getReplyVote}
                onVote={handleReplyVote}
                onReply={(replyId, authorName) => {
                  setReplyTarget({ id: replyId, authorName });
                  setComposerVisible(true);
                }}
              />
            )}
          </ScrollView>

          {liveReplyCount > 0 ? (
            <Pressable
              onPress={() => setLiveReplyCount(0)}
              style={styles.liveReplyBanner}
            >
              <Text style={styles.liveReplyBannerText}>
                {liveReplyCount} new {liveReplyCount === 1 ? 'reply' : 'replies'}
              </Text>
            </Pressable>
          ) : null}

          <BlurView intensity={FR_GLASS_NAV.blur} tint="dark" style={styles.replyComposerDock}>
            {replyTarget ? (
              <View style={styles.replyTargetRow}>
                <Text style={styles.replyTargetText}>Replying to {replyTarget.authorName}</Text>
                <Pressable onPress={() => setReplyTarget(null)}>
                  <Text style={styles.replyTargetCancel}>Cancel</Text>
                </Pressable>
              </View>
            ) : null}
            {composerLocked ? (
              <Text style={styles.replyLockedText}>
                Replies are disabled for this discussion.
              </Text>
            ) : (
              <View style={styles.replyComposerRow}>
                <Avatar name={currentProfile.displayName} size={36} accent={FR_ACCENT_LIGHT} />
                <Pressable
                  onPress={() => setComposerVisible(true)}
                  style={styles.replyComposerInputShell}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.replyComposerPlaceholder,
                      replyDraft.trim() ? styles.replyComposerDraft : null,
                    ]}
                  >
                    {replyDraft.trim() || 'Reply with context, not noise'}
                  </Text>
                </Pressable>
                <Pressable onPress={postReply} style={styles.sendButton}>
                  <MaterialSymbol name="send" color={FR_ON_ACCENT} />
                </Pressable>
              </View>
            )}
          </BlurView>
        </View>

        <Modal visible={composerVisible} animationType="slide" onRequestClose={() => setComposerVisible(false)}>
          <SafeAreaView style={styles.modalScreen}>
            <Phase2Header
              title={replyTarget ? `Reply to ${replyTarget.authorName}` : 'Reply'}
              subtitle="Full markdown composer"
              onClose={() => setComposerVisible(false)}
              right={
                <Pressable onPress={postReply} style={styles.postHeaderButton}>
                  <Text style={styles.postHeaderButtonText}>Post</Text>
                </Pressable>
              }
            />
            <View style={styles.modalTabs}>
              <ActionChip
                label="Write"
                active={composerTab === 'write'}
                onPress={() => setComposerTab('write')}
              />
              <ActionChip
                label="Preview"
                active={composerTab === 'preview'}
                onPress={() => setComposerTab('preview')}
              />
            </View>
            {composerTab === 'write' ? (
              <>
                <View style={styles.toolbarRow}>
                  <ActionChip label="Bold" onPress={() => setReplyDraft((value) => insertMarkdownToken(value, '**'))} />
                  <ActionChip label="Italic" onPress={() => setReplyDraft((value) => insertMarkdownToken(value, '*'))} />
                  <ActionChip label="Quote" onPress={() => setReplyDraft((value) => `${value}\n> `)} />
                  <ActionChip label="List" onPress={() => setReplyDraft((value) => `${value}\n- `)} />
                  <ActionChip label="Code" onPress={() => setReplyDraft((value) => `${value}\n\`\`\`\n\n\`\`\``)} />
                </View>
                <TextInput
                  value={replyDraft}
                  onChangeText={setReplyDraft}
                  multiline
                  autoFocus
                  placeholder="Write a thoughtful reply"
                  placeholderTextColor={FR_TEXT_TERTIARY}
                  style={styles.fullComposerInput}
                />
              </>
            ) : (
              <ScrollView contentContainerStyle={styles.previewScroll}>
                <MarkdownPreview content={replyDraft} />
              </ScrollView>
            )}
          </SafeAreaView>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function ForumsCommunityDetailPhase2Screen() {
  const params = useLocalSearchParams<{ communityId?: string }>();
  const router = useRouter();
  const {
    db,
    refresh,
    communities,
    communityHealth,
    currentProfile,
    joinedCommunityIds,
    toggleCommunityMembership,
    threadsForCommunity,
    rulesForCommunity,
    membersForCommunity,
    findCommunity,
    findProfile,
  } = useForumsData();

  const community = findCommunity(getParamValue(params.communityId));
  const communityExtra = getCommunityExtra(community);
  const [tab, setTab] = useState<CommunityTab>('threads');
  const [threadSort, setThreadSort] = useState<CommunitySort>('hot');
  const [topRange, setTopRange] = useState<'today' | 'week' | 'month' | 'all'>('week');
  const [memberQuery, setMemberQuery] = useState('');
  const [memberSort, setMemberSort] = useState<'newest' | 'most_active' | 'mods_first'>('mods_first');
  const [refreshing, setRefreshing] = useState(false);

  const health =
    communityHealth.find((item) => item.communityId === community.id) ?? communityHealth[0];
  const onlineCount = Math.max(8, Math.round((health?.activePostersLast7Days ?? 24) / 4));
  const members = membersForCommunity(community.id);
  const pinnedThreads = threadsForCommunity(community.id).filter((thread) => thread.isPinned);
  const computedRules = getCommunityRules(community.id, rulesForCommunity(community.id));

  const threadList = useMemo(() => {
    const items = threadsForCommunity(community.id).slice();
    if (threadSort === 'new') {
      return items.sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      );
    }
    if (threadSort === 'top') {
      const now = Date.now();
      const rangeMs =
        topRange === 'today'
          ? 24 * 60 * 60 * 1000
          : topRange === 'week'
            ? 7 * 24 * 60 * 60 * 1000
            : topRange === 'month'
              ? 30 * 24 * 60 * 60 * 1000
              : Number.POSITIVE_INFINITY;
      return items
        .filter((thread) => now - new Date(thread.createdAt).getTime() <= rangeMs)
        .sort((left, right) => right.voteScore - left.voteScore);
    }
    return items.sort((left, right) => {
      if (right.isPinned !== left.isPinned) return Number(right.isPinned) - Number(left.isPinned);
      if (right.voteScore !== left.voteScore) return right.voteScore - left.voteScore;
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });
  }, [community.id, threadSort, threadsForCommunity, topRange]);

  const modTeam = useMemo(() => {
    return members
      .filter((member) => member.role !== 'member')
      .map((member) => ({
        member,
        profile: findProfile(member.profileId),
      }));
  }, [findProfile, members]);

  const linkedCommunities = useMemo(() => {
    return communities
      .filter((item) => item.id !== community.id && item.humansOnly === community.humansOnly)
      .slice(0, 3);
  }, [communities, community.humansOnly, community.id]);

  const visibleMembers = useMemo(() => {
    const filtered = members
      .map((member) => ({ member, profile: findProfile(member.profileId) }))
      .filter(({ profile }) =>
        `${profile.displayName} ${profile.username}`
          .toLowerCase()
          .includes(memberQuery.trim().toLowerCase()),
      );

    if (memberSort === 'newest') {
      return filtered.sort(
        (left, right) =>
          new Date(right.member.joinedAt).getTime() - new Date(left.member.joinedAt).getTime(),
      );
    }
    if (memberSort === 'most_active') {
      return filtered.sort((left, right) => right.profile.karma - left.profile.karma);
    }
    return filtered.sort((left, right) => {
      const weight = (role: string) =>
        role === 'owner' ? 0 : role === 'admin' ? 1 : role === 'moderator' ? 2 : 3;
      return weight(left.member.role) - weight(right.member.role);
    });
  }, [findProfile, memberQuery, memberSort, members]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    refresh();
    setTimeout(() => setRefreshing(false), 500);
  }, [refresh]);

  const handleMembershipToggle = useCallback(() => {
    try {
      toggleCommunityMembership(community.id);
      refresh();
    } catch {
      Alert.alert('Membership failed', 'The join state could not be updated.');
    }
  }, [community.id, refresh, toggleCommunityMembership]);

  const tone = FR_COMMUNITY_TYPES[getCommunityTone({
    humansOnly: community.humansOnly,
    communityType: community.communityType,
    federated: communityExtra.uiType === 'federated',
  })];

  return (
    <SafeAreaView style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.screen}>
        <View style={[styles.communityBanner, { backgroundColor: tone }]}>
          <LinearGradient
            colors={['rgba(14,14,19,0.1)', 'rgba(14,14,19,0.92)']}
            style={StyleSheet.absoluteFill}
          />
          <Phase2Header
            title={community.displayName}
            subtitle={communityExtra.uiType === 'federated' ? 'Federated community' : 'Community'}
            onBack={() => router.back()}
            right={
              <Pressable
                onPress={() =>
                  Alert.alert('Community actions', 'Share and moderation tools land here.', [
                    { text: 'Share' },
                    { text: 'Report', style: 'destructive' },
                    { text: 'Cancel', style: 'cancel' },
                  ])
                }
                style={styles.iconButton}
              >
                <MaterialSymbol name="more_vert" color={FR_TEXT} />
              </Pressable>
            }
          />
          <View style={styles.communityIconWrap}>
            <Avatar name={community.displayName} size={72} accent={communityExtra.colorTheme} />
          </View>
        </View>

        <ScrollView
          refreshControl={
            <RefreshControl
              tintColor={FR_ACCENT_LIGHT}
              refreshing={refreshing}
              onRefresh={handleRefresh}
            />
          }
          contentContainerStyle={styles.communityScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <GlassCard style={styles.communitySummaryCard} glow={community.humansOnly}>
            <View style={styles.communitySummaryTop}>
              <View style={styles.communityTitleBlock}>
                <Text style={styles.communityTitle}>{community.displayName}</Text>
                <Text style={styles.communityTagline}>{communityExtra.tagline}</Text>
              </View>
              <View style={styles.communityBadgeColumn}>
                {community.humansOnly ? <HumanVerifiedBadge tier="trusted" /> : null}
                {communityExtra.uiType === 'federated' ? (
                  <View style={styles.inlineBadge}>
                    <MaterialSymbol name="groups" size={12} color={FR_ACCENT_LIGHT} />
                    <Text style={styles.inlineBadgeText}>Federated</Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={styles.threadStatsRow}>
              <StatPill label="Members" value={String(community.memberCount)} accent={FR_ACCENT_LIGHT} />
              <StatPill label="Threads" value={String(community.threadCount)} accent={FR_INFO} />
              <StatPill label="Online" value={String(onlineCount)} accent="#30D158" />
              <StatPill label="Moderators" value={String(modTeam.length)} />
            </View>

            <View style={styles.communityActionRow}>
              <Pressable onPress={handleMembershipToggle} style={styles.primaryActionButton}>
                <Text style={styles.primaryActionText}>
                  {joinedCommunityIds.has(community.id) ? 'Leave Community' : 'Join Community'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  router.push(`/(forums)/create-thread?communityId=${encodeURIComponent(community.id)}` as never)
                }
                style={styles.secondaryActionButton}
              >
                <Text style={styles.secondaryActionText}>Create Thread</Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  Alert.alert('Mods', 'Messaging the moderation team wires here.')
                }
                style={styles.secondaryIconButton}
              >
                <MaterialSymbol name="chat_bubble" color={FR_TEXT_SECONDARY} />
              </Pressable>
            </View>
          </GlassCard>

          {pinnedThreads.length > 0 ? (
            <View style={styles.sectionGroup}>
              <SectionHeader title="Pinned" action={<Text style={styles.sectionAction}>Curated</Text>} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.horizontalCards}>
                  {pinnedThreads.map((thread) => (
                    <View key={thread.id} style={styles.horizontalCardItem}>
                      <ThreadCard
                        thread={thread}
                        author={findProfile(thread.authorId)}
                        community={community}
                        userVote={getStoredVote(db, 'thread', thread.id, currentProfile.id)}
                        variant="compact"
                        onPress={() =>
                          router.push(`/(forums)/thread-detail?threadId=${encodeURIComponent(thread.id)}` as never)
                        }
                      />
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          ) : null}

          <View style={styles.sectionChipRow}>
            {(['threads', 'about', 'rules', 'members'] as const).map((option) => (
              <ActionChip
                key={option}
                label={option}
                active={tab === option}
                onPress={() => setTab(option)}
              />
            ))}
          </View>

          {tab === 'threads' ? (
            <View style={styles.sectionGroup}>
              <View style={styles.sectionChipRow}>
                {(['hot', 'new', 'top'] as const).map((option) => (
                  <ActionChip
                    key={option}
                    label={option}
                    active={threadSort === option}
                    onPress={() => setThreadSort(option)}
                  />
                ))}
              </View>
              {threadSort === 'top' ? (
                <View style={styles.sectionChipRow}>
                  {(['today', 'week', 'month', 'all'] as const).map((option) => (
                    <ActionChip
                      key={option}
                      label={option}
                      active={topRange === option}
                      onPress={() => setTopRange(option)}
                    />
                  ))}
                </View>
              ) : null}
              {threadList.map((thread) => (
                <ThreadCard
                  key={thread.id}
                  thread={thread}
                  author={findProfile(thread.authorId)}
                  community={community}
                  userVote={getStoredVote(db, 'thread', thread.id, currentProfile.id)}
                  onPress={() =>
                    router.push(`/(forums)/thread-detail?threadId=${encodeURIComponent(thread.id)}` as never)
                  }
                />
              ))}
            </View>
          ) : null}

          {tab === 'about' ? (
            <View style={styles.sectionGroup}>
              <GlassCard style={styles.panelCard}>
                <MarkdownPreview content={communityExtra.description} />
              </GlassCard>
              <View style={styles.threadStatsRow}>
                <StatPill label="Created" value={formatDateLabel(community.createdAt)} />
                <StatPill label="Founder" value={findProfile(members[0]?.profileId).displayName.split(' ')[0] ?? 'Unknown'} />
              </View>
              <GlassCard style={styles.panelCard}>
                <SectionHeader title="Tags" action={null} />
                <View style={styles.tagRow}>
                  {threadList
                    .flatMap((thread) => getThreadExtra(thread.id, []).tagNames)
                    .filter((value, index, array) => array.indexOf(value) === index)
                    .slice(0, 6)
                    .map((tag) => (
                      <ActionChip key={tag} label={`#${tag}`} icon="tag" />
                    ))}
                </View>
              </GlassCard>
              {linkedCommunities.length > 0 ? (
                <GlassCard style={styles.panelCard}>
                  <SectionHeader title="Linked Communities" action={null} />
                  {linkedCommunities.map((linked) => (
                    <Pressable
                      key={linked.id}
                      onPress={() =>
                        router.push(`/(forums)/community-detail?communityId=${encodeURIComponent(linked.id)}` as never)
                      }
                      style={styles.linkedCommunityRow}
                    >
                      <Avatar name={linked.displayName} size={34} accent={FR_ACCENT_LIGHT} />
                      <View style={styles.linkedCommunityText}>
                        <Text style={styles.linkedCommunityTitle}>{linked.displayName}</Text>
                        <Text style={styles.linkedCommunityBody}>
                          {linked.description ?? 'Related forum'}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </GlassCard>
              ) : null}
              <GlassCard style={styles.panelCard}>
                <SectionHeader title="Mod Team" action={null} />
                {modTeam.map(({ member, profile }) => (
                  <View key={member.id} style={styles.memberRow}>
                    <Avatar name={profile.displayName} size={40} accent={FR_ACCENT_LIGHT} />
                    <View style={styles.memberText}>
                      <Text style={styles.memberName}>{profile.displayName}</Text>
                      <Text style={styles.memberMeta}>
                        @{profile.username} · {member.role}
                      </Text>
                    </View>
                    <HumanVerifiedBadge tier={getTrustTier(profile, member.role)} />
                  </View>
                ))}
              </GlassCard>
            </View>
          ) : null}

          {tab === 'rules' ? (
            <View style={styles.sectionGroup}>
              {computedRules.map((rule, index) => (
                <GlassCard key={rule.id} style={styles.ruleCard}>
                  <View style={styles.ruleHeader}>
                    <Text style={styles.ruleIndex}>{index + 1}</Text>
                    <View style={styles.ruleTextBlock}>
                      <Text style={styles.ruleTitle}>{rule.title}</Text>
                      <Text style={styles.ruleDescription}>{rule.description}</Text>
                    </View>
                    <Pressable
                      onPress={() =>
                        Alert.alert('Report rule', 'Rule enforcement workflows wire here.')
                      }
                    >
                      <Text style={styles.ruleAction}>Report</Text>
                    </Pressable>
                  </View>
                </GlassCard>
              ))}
            </View>
          ) : null}

          {tab === 'members' ? (
            <View style={styles.sectionGroup}>
              <GlassCard style={styles.panelCard}>
                <TextInput
                  value={memberQuery}
                  onChangeText={setMemberQuery}
                  placeholder="Search members"
                  placeholderTextColor={FR_TEXT_TERTIARY}
                  style={styles.searchInput}
                />
                <View style={styles.sectionChipRow}>
                  <ActionChip
                    label="Newest"
                    active={memberSort === 'newest'}
                    onPress={() => setMemberSort('newest')}
                  />
                  <ActionChip
                    label="Most Active"
                    active={memberSort === 'most_active'}
                    onPress={() => setMemberSort('most_active')}
                  />
                  <ActionChip
                    label="Mods First"
                    active={memberSort === 'mods_first'}
                    onPress={() => setMemberSort('mods_first')}
                  />
                </View>
              </GlassCard>
              {visibleMembers.map(({ member, profile }) => (
                <Pressable
                  key={member.id}
                  onPress={() =>
                    router.push(`/(forums)/user-profile?profileId=${encodeURIComponent(profile.id)}` as never)
                  }
                >
                  <GlassCard style={styles.memberCard}>
                    <Avatar name={profile.displayName} size={42} accent={communityExtra.colorTheme} />
                    <View style={styles.memberText}>
                      <Text style={styles.memberName}>{profile.displayName}</Text>
                      <Text style={styles.memberMeta}>
                        @{profile.username} · {member.role} · joined {formatDateLabel(member.joinedAt)}
                      </Text>
                    </View>
                    <HumanVerifiedBadge tier={getTrustTier(profile, member.role)} />
                  </GlassCard>
                </Pressable>
              ))}
            </View>
          ) : null}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

export function ForumsCreateThreadPhase2Screen() {
  const params = useLocalSearchParams<{ communityId?: string }>();
  const router = useRouter();
  const {
    communities,
    joinedCommunityIds,
    createThread,
    tagsForCommunity,
  } = useForumsData();

  const joinedCommunities = useMemo(() => {
    const joined = communities.filter((community) => joinedCommunityIds.has(community.id));
    return joined.length > 0 ? joined : communities;
  }, [communities, joinedCommunityIds]);

  const initialCommunityId =
    getParamValue(params.communityId) ??
    joinedCommunities[0]?.id ??
    communities[0]?.id ??
    '';
  const [communityId, setCommunityId] = useState(initialCommunityId);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [previewTab, setPreviewTab] = useState<PreviewTab>('write');
  const [selectedTagNames, setSelectedTagNames] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<MediaAttachment[]>([]);
  const [optionsExpanded, setOptionsExpanded] = useState(false);
  const [nsfw, setNsfw] = useState(false);
  const [allowReplies, setAllowReplies] = useState(true);
  const [crossPostIds, setCrossPostIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  const availableTags = tagsForCommunity(communityId);
  const selectedCommunity =
    communities.find((community) => community.id === communityId) ?? joinedCommunities[0] ?? communities[0];
  const pickerResults = useCommunityPickerSearch(joinedCommunities, pickerQuery);

  useEffect(() => {
    let active = true;
    void readDraftFile<ThreadDraftSnapshot>(THREAD_DRAFT_FILE).then((draft) => {
      if (!active || !draft) {
        setHydrated(true);
        return;
      }
      setCommunityId(draft.communityId || initialCommunityId);
      setTitle(draft.title);
      setBody(draft.body);
      setPreviewTab(draft.previewTab);
      setSelectedTagNames(draft.selectedTagNames);
      setAttachments(draft.attachments);
      setNsfw(draft.nsfw);
      setAllowReplies(draft.allowReplies);
      setCrossPostIds(draft.crossPostIds);
      setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, [initialCommunityId]);

  const threadDraftSnapshot = useMemo<ThreadDraftSnapshot>(() => ({
    communityId,
    title,
    body,
    previewTab,
    selectedTagNames,
    attachments,
    nsfw,
    allowReplies,
    crossPostIds,
  }), [allowReplies, attachments, body, communityId, crossPostIds, nsfw, previewTab, selectedTagNames, title]);

  useEffect(() => {
    if (!hydrated) return;
    if (!title.trim() && !body.trim() && attachments.length === 0) return;

    const interval = setInterval(() => {
      void writeDraftFile(THREAD_DRAFT_FILE, threadDraftSnapshot);
      setLastSavedAt(new Date().toISOString());
    }, 5_000);

    return () => clearInterval(interval);
  }, [attachments.length, body, hydrated, threadDraftSnapshot, title]);

  const dirty =
    title.trim().length > 0 ||
    body.trim().length > 0 ||
    attachments.length > 0 ||
    selectedTagNames.length > 0;

  const confirmClose = useCallback(() => {
    if (!dirty) {
      router.back();
      return;
    }
    Alert.alert('Discard draft?', 'You have unsaved thread changes.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => router.back() },
    ]);
  }, [dirty, router]);

  const handleAttachmentAdd = useCallback(async () => {
    try {
      const attachment = await pickMediaFromLibrary();
      if (!attachment) return;
      setAttachments((current) => [...current, attachment]);
    } catch {
      Alert.alert('Attachment failed', 'The media picker did not complete.');
    }
  }, []);

  const handlePost = useCallback(async () => {
    if (!selectedCommunity?.id || !title.trim() || !body.trim()) {
      Alert.alert('Thread incomplete', 'Add a community, title, and body before posting.');
      return;
    }

    setPosting(true);
    try {
      const threadId = createThread({
        communityId: selectedCommunity.id,
        title: title.trim().slice(0, 200),
        body: body.trim(),
      });

      THREAD_EXTRAS.set(threadId, {
        tagNames: selectedTagNames,
        attachments,
        allowReplies,
        nsfw,
        crossPostIds,
      });

      await clearDraftFile(THREAD_DRAFT_FILE);
      router.replace(`/(forums)/thread-detail?threadId=${encodeURIComponent(threadId)}` as never);
    } catch {
      Alert.alert('Posting failed', 'The thread could not be created.');
    } finally {
      setPosting(false);
    }
  }, [
    allowReplies,
    attachments,
    body,
    createThread,
    crossPostIds,
    nsfw,
    router,
    selectedCommunity?.id,
    selectedTagNames,
    title,
  ]);

  return (
    <SafeAreaView style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Phase2Header
          title="New Thread"
          subtitle={selectedCommunity?.displayName ?? 'Choose a community'}
          onClose={confirmClose}
          right={
            <View style={styles.headerActions}>
              <View style={styles.savedDraftBadge}>
                <Text style={styles.savedDraftBadgeText}>
                  {lastSavedAt ? 'Draft saved' : 'Draft'}
                </Text>
              </View>
              <Pressable
                onPress={handlePost}
                style={[styles.postHeaderButton, posting ? styles.postHeaderButtonDisabled : null]}
              >
                <Text style={styles.postHeaderButtonText}>Post</Text>
              </Pressable>
            </View>
          }
        />

        <ScrollView contentContainerStyle={styles.createScrollContent} showsVerticalScrollIndicator={false}>
          <GlassCard style={styles.panelCard}>
            <Text style={styles.sectionEyebrow}>Community</Text>
            <Pressable onPress={() => setPickerVisible(true)} style={styles.communityPickerCard}>
              <View style={styles.communityPickerText}>
                <Text style={styles.communityPickerTitle}>
                  {selectedCommunity?.displayName ?? 'Select community'}
                </Text>
                <Text style={styles.communityPickerBody}>
                  {selectedCommunity?.description ?? 'Choose where this conversation belongs.'}
                </Text>
              </View>
              {selectedCommunity?.humansOnly ? <HumanVerifiedBadge tier="trusted" /> : null}
            </Pressable>
          </GlassCard>

          <GlassCard style={styles.panelCard}>
            <Text style={styles.sectionEyebrow}>Title</Text>
            <TextInput
              value={title}
              onChangeText={(value) => setTitle(value.slice(0, 200))}
              placeholder="Thread title..."
              placeholderTextColor={FR_TEXT_TERTIARY}
              style={styles.titleInput}
            />
            <Text style={styles.counterText}>{title.length}/200</Text>
          </GlassCard>

          <GlassCard style={styles.panelCard}>
            <SectionHeader title="Tags" action={<Text style={styles.sectionAction}>Max 5</Text>} />
            <View style={styles.tagRow}>
              {availableTags.map((tag) => {
                const active = selectedTagNames.includes(tag.name);
                return (
                  <ActionChip
                    key={tag.id}
                    label={tag.name}
                    active={active}
                    icon="tag"
                    onPress={() =>
                      setSelectedTagNames((current) => {
                        if (active) return current.filter((name) => name !== tag.name);
                        if (current.length >= 5) return current;
                        return [...current, tag.name];
                      })
                    }
                  />
                );
              })}
            </View>
          </GlassCard>

          <GlassCard style={styles.panelCard}>
            <View style={styles.sectionChipRow}>
              <ActionChip
                label="Write"
                active={previewTab === 'write'}
                onPress={() => setPreviewTab('write')}
              />
              <ActionChip
                label="Preview"
                active={previewTab === 'preview'}
                onPress={() => setPreviewTab('preview')}
              />
            </View>
            {previewTab === 'write' ? (
              <>
                <View style={styles.toolbarRow}>
                  <ActionChip label="Bold" onPress={() => setBody((value) => insertMarkdownToken(value, '**'))} />
                  <ActionChip label="Italic" onPress={() => setBody((value) => insertMarkdownToken(value, '*'))} />
                  <ActionChip label="Link" onPress={() => setBody((value) => `${value}\n[link](https://)`)} />
                  <ActionChip label="List" onPress={() => setBody((value) => `${value}\n- `)} />
                  <ActionChip label="Quote" onPress={() => setBody((value) => `${value}\n> `)} />
                  <ActionChip label="Code" onPress={() => setBody((value) => `${value}\n\`\`\`\n\n\`\`\``)} />
                </View>
                <TextInput
                  value={body}
                  onChangeText={setBody}
                  multiline
                  placeholder="Write with enough context that someone can answer well."
                  placeholderTextColor={FR_TEXT_TERTIARY}
                  style={styles.editorInput}
                />
              </>
            ) : (
              <MarkdownPreview content={body} />
            )}
          </GlassCard>

          <GlassCard style={styles.panelCard}>
            <SectionHeader title="Attachments" action={null} />
            <View style={styles.sectionChipRow}>
              <ActionChip label="Add media" icon="photo_camera" active onPress={() => void handleAttachmentAdd()} />
            </View>
            <AttachmentGrid
              attachments={attachments}
              onRemove={(attachmentId) =>
                setAttachments((current) => current.filter((item) => item.id !== attachmentId))
              }
            />
          </GlassCard>

          <GlassCard style={styles.panelCard}>
            <Pressable
              onPress={() => setOptionsExpanded((value) => !value)}
              style={styles.optionsHeader}
            >
              <Text style={styles.optionsTitle}>Posting options</Text>
              <Text style={styles.optionsToggle}>
                {optionsExpanded ? 'Hide' : 'Show'}
              </Text>
            </Pressable>
            {optionsExpanded ? (
              <View style={styles.optionsBody}>
                <View style={styles.toggleRow}>
                  <View style={styles.toggleText}>
                    <Text style={styles.toggleTitle}>Mark as NSFW</Text>
                    <Text style={styles.toggleBody}>Keep sensitive content clearly labeled.</Text>
                  </View>
                  <Switch value={nsfw} onValueChange={setNsfw} trackColor={{ true: FR_ACCENT }} />
                </View>
                <View style={styles.toggleRow}>
                  <View style={styles.toggleText}>
                    <Text style={styles.toggleTitle}>Allow replies</Text>
                    <Text style={styles.toggleBody}>Lock discussion if this should stay announcement-only.</Text>
                  </View>
                  <Switch value={allowReplies} onValueChange={setAllowReplies} trackColor={{ true: FR_ACCENT }} />
                </View>
                <View style={styles.crossPostWrap}>
                  <Text style={styles.toggleTitle}>Cross-post</Text>
                  <View style={styles.tagRow}>
                    {joinedCommunities
                      .filter((community) => community.id !== communityId)
                      .slice(0, 4)
                      .map((community) => {
                        const active = crossPostIds.includes(community.id);
                        return (
                          <ActionChip
                            key={community.id}
                            label={community.displayName}
                            active={active}
                            onPress={() =>
                              setCrossPostIds((current) =>
                                active
                                  ? current.filter((id) => id !== community.id)
                                  : [...current, community.id],
                              )
                            }
                          />
                        );
                      })}
                  </View>
                </View>
              </View>
            ) : null}
          </GlassCard>
        </ScrollView>

        <View style={styles.footerCtaWrap}>
          <LinearGradient
            colors={[FR_ACCENT_LIGHT, FR_ACCENT]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientCta}
          >
            <Pressable onPress={handlePost} style={styles.gradientCtaButton}>
              <Text style={styles.gradientCtaText}>
                {posting ? 'Posting…' : 'Post thread'}
              </Text>
            </Pressable>
          </LinearGradient>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={pickerVisible} animationType="slide" onRequestClose={() => setPickerVisible(false)}>
        <SafeAreaView style={styles.modalScreen}>
          <Phase2Header
            title="Pick a community"
            subtitle="Joined communities first"
            onClose={() => setPickerVisible(false)}
          />
          <ScrollView contentContainerStyle={styles.pickerScroll}>
            <TextInput
              value={pickerQuery}
              onChangeText={setPickerQuery}
              placeholder="Search communities"
              placeholderTextColor={FR_TEXT_TERTIARY}
              style={styles.searchInput}
            />
            {pickerResults.map((community) => (
              <Pressable
                key={community.id}
                onPress={() => {
                  setCommunityId(community.id);
                  setPickerVisible(false);
                }}
              >
                <GlassCard style={styles.communityPickerResult}>
                  <View style={styles.communityPickerText}>
                    <Text style={styles.communityPickerTitle}>{community.displayName}</Text>
                    <Text style={styles.communityPickerBody}>
                      {community.description ?? 'No description yet.'}
                    </Text>
                  </View>
                  {community.humansOnly ? <HumanVerifiedBadge tier="trusted" /> : null}
                </GlassCard>
              </Pressable>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

export function ForumsCreateCommunityPhase2Screen() {
  const router = useRouter();
  const {
    db,
    refresh,
    communities,
    createCommunity,
  } = useForumsData();

  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState('');
  const [slug, setSlug] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [uiType, setUiType] = useState<CommunityDraftType>('public');
  const [humansOnly, setHumansOnly] = useState(true);
  const [trustRequirement, setTrustRequirement] = useState<TrustRequirement>('trusted');
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [iconUri, setIconUri] = useState<string | null>(null);
  const [colorTheme, setColorTheme] = useState(COMMUNITY_COLOR_OPTIONS[0]);
  const [rules, setRules] = useState<RuleDraft[]>([
    { id: makeId('rule'), title: 'Be respectful', description: 'Critique the idea, not the person.' },
    { id: makeId('rule'), title: 'No spam', description: 'Promotional posts need context and consent.' },
    { id: makeId('rule'), title: 'Follow sitewide rules', description: 'Community rules add to the global baseline.' },
  ]);
  const [newRuleTitle, setNewRuleTitle] = useState('');
  const [newRuleDescription, setNewRuleDescription] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [creating, setCreating] = useState(false);
  const [successCommunityId, setSuccessCommunityId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void readDraftFile<CommunityDraftSnapshot>(COMMUNITY_DRAFT_FILE).then((draft) => {
      if (!active || !draft) {
        setHydrated(true);
        return;
      }
      setDisplayName(draft.displayName);
      setSlug(draft.slug);
      setTagline(draft.tagline);
      setDescription(draft.description);
      setUiType(draft.uiType);
      setHumansOnly(draft.humansOnly);
      setTrustRequirement(draft.trustRequirement);
      setCoverUri(draft.coverUri);
      setIconUri(draft.iconUri);
      setColorTheme(draft.colorTheme);
      setRules(draft.rules);
      setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const snapshot: CommunityDraftSnapshot = {
      displayName,
      slug,
      tagline,
      description,
      uiType,
      humansOnly,
      trustRequirement,
      coverUri,
      iconUri,
      colorTheme,
      rules,
    };
    const interval = setInterval(() => {
      void writeDraftFile(COMMUNITY_DRAFT_FILE, snapshot);
    }, 5_000);

    return () => clearInterval(interval);
  }, [
    colorTheme,
    coverUri,
    description,
    displayName,
    humansOnly,
    hydrated,
    iconUri,
    rules,
    slug,
    tagline,
    trustRequirement,
    uiType,
  ]);

  useEffect(() => {
    if (!slug || slug.startsWith('community-')) {
      setSlug(slugify(displayName));
    }
  }, [displayName, slug]);

  const slugAvailable = useMemo(() => {
    const normalized = slugify(slug);
    return !communities.some((community) => community.name === normalized);
  }, [communities, slug]);

  const dirty =
    displayName.trim().length > 0 ||
    description.trim().length > 0 ||
    rules.length > 0;

  const confirmClose = useCallback(() => {
    if (!dirty) {
      router.back();
      return;
    }
    Alert.alert('Discard community draft?', 'You have unsaved community setup changes.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => router.back() },
    ]);
  }, [dirty, router]);

  const validateStep = useCallback((index: number): boolean => {
    if (index === 0) {
      return displayName.trim().length >= 3 && slug.trim().length >= 3 && slugAvailable;
    }
    if (index === 1) {
      return tagline.trim().length >= 8 && description.trim().length >= 20;
    }
    if (index === 2) {
      return true;
    }
    if (index === 3) {
      return !humansOnly || trustRequirement !== 'none';
    }
    if (index === 4) {
      return true;
    }
    return rules.every((rule) => rule.title.trim() && rule.description.trim());
  }, [description, displayName, humansOnly, rules, slug, slugAvailable, tagline, trustRequirement]);

  const stepLabels = [
    'Name',
    'Description',
    'Type',
    'Humans',
    'Visuals',
    'Rules',
  ];

  const pickCover = useCallback(async () => {
    try {
      const media = await pickMediaFromLibrary();
      if (media) setCoverUri(media.uri);
    } catch {
      Alert.alert('Upload failed', 'The cover image could not be selected.');
    }
  }, []);

  const pickIcon = useCallback(async () => {
    try {
      const media = await pickMediaFromLibrary(true);
      if (media) setIconUri(media.uri);
    } catch {
      Alert.alert('Upload failed', 'The icon image could not be selected.');
    }
  }, []);

  const handleCreateCommunity = useCallback(async () => {
    if (!validateStep(5)) {
      Alert.alert('Community incomplete', 'Add at least one valid rule before creating.');
      return;
    }

    setCreating(true);
    try {
      const communityId = createCommunity({
        displayName: displayName.trim(),
        description: tagline.trim(),
        humansOnly,
      });

      const cached = getCachedCommunityById(db, communityId);
      if (cached) {
        upsertCachedCommunity(db, {
          ...cached,
          name: slugify(slug || displayName),
          description: description.trim() || tagline.trim(),
          bannerUrl: coverUri,
          iconUrl: iconUri,
          communityType: uiType === 'private' ? 'private' : uiType === 'federated' ? 'restricted' : 'public',
          updatedAt: new Date().toISOString(),
        });
      }

      COMMUNITY_EXTRAS.set(communityId, {
        tagline: tagline.trim(),
        description: description.trim(),
        uiType,
        trustRequirement,
        coverUri,
        iconUri,
        colorTheme,
        rules,
      });

      refresh();
      await clearDraftFile(COMMUNITY_DRAFT_FILE);
      setSuccessCommunityId(communityId);
      setTimeout(() => {
        router.replace(`/(forums)/community-detail?communityId=${encodeURIComponent(communityId)}` as never);
      }, 800);
    } catch {
      Alert.alert('Community failed', 'The community could not be created locally.');
    } finally {
      setCreating(false);
    }
  }, [
    colorTheme,
    coverUri,
    createCommunity,
    db,
    description,
    displayName,
    humansOnly,
    iconUri,
    refresh,
    router,
    rules,
    slug,
    tagline,
    trustRequirement,
    uiType,
    validateStep,
  ]);

  return (
    <SafeAreaView style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Phase2Header
          title={`Step ${step + 1} of 6`}
          subtitle={stepLabels[step]}
          onClose={confirmClose}
          onBack={step > 0 ? () => setStep((value) => Math.max(0, value - 1)) : undefined}
        />

        <View style={styles.progressDots}>
          {stepLabels.map((label, index) => (
            <View
              key={label}
              style={[
                styles.progressDot,
                index === step ? styles.progressDotActive : null,
                index < step ? styles.progressDotComplete : null,
              ]}
            />
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.createScrollContent} showsVerticalScrollIndicator={false}>
          {step === 0 ? (
            <GlassCard style={styles.panelCard}>
              <Text style={styles.stepTitle}>Name your community</Text>
              <Text style={styles.stepBody}>
                Pick a distinct identity that people will remember and can type fast.
              </Text>
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Community name"
                placeholderTextColor={FR_TEXT_TERTIARY}
                style={styles.editorInput}
              />
              <TextInput
                value={slug}
                onChangeText={(value) => setSlug(slugify(value))}
                placeholder="community-slug"
                placeholderTextColor={FR_TEXT_TERTIARY}
                style={styles.searchInput}
              />
              <Text style={[styles.slugState, slugAvailable ? styles.slugStateGood : styles.slugStateBad]}>
                {slugAvailable ? 'Available' : 'Taken'}
              </Text>
            </GlassCard>
          ) : null}

          {step === 1 ? (
            <GlassCard style={styles.panelCard}>
              <Text style={styles.stepTitle}>What&apos;s it about?</Text>
              <TextInput
                value={tagline}
                onChangeText={(value) => setTagline(value.slice(0, 140))}
                placeholder="Short tagline"
                placeholderTextColor={FR_TEXT_TERTIARY}
                style={styles.searchInput}
              />
              <Text style={styles.counterText}>{tagline.length}/140</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                multiline
                placeholder="Write the full description in markdown."
                placeholderTextColor={FR_TEXT_TERTIARY}
                style={styles.editorInput}
              />
            </GlassCard>
          ) : null}

          {step === 2 ? (
            <GlassCard style={styles.panelCard}>
              <Text style={styles.stepTitle}>Who can join?</Text>
              <View style={styles.typeGrid}>
                {([
                  {
                    id: 'public',
                    title: 'Public',
                    body: 'Anyone can join and participate.',
                    icon: 'groups',
                  },
                  {
                    id: 'private',
                    title: 'Private',
                    body: 'Invite-only and tighter admission.',
                    icon: 'lock',
                  },
                  {
                    id: 'federated',
                    title: 'Federated',
                    body: 'Cross-instance community with extra context.',
                    icon: 'groups',
                  },
                ] as const).map((option) => {
                  const active = uiType === option.id;
                  return (
                    <Pressable
                      key={option.id}
                      onPress={() => setUiType(option.id)}
                    >
                      <GlassCard style={[styles.typeCard, active ? styles.typeCardActive : null]}>
                        <MaterialSymbol name={option.icon as any} color={active ? FR_ACCENT_LIGHT : FR_TEXT_SECONDARY} />
                        <Text style={styles.typeCardTitle}>{option.title}</Text>
                        <Text style={styles.typeCardBody}>{option.body}</Text>
                      </GlassCard>
                    </Pressable>
                  );
                })}
              </View>
            </GlassCard>
          ) : null}

          {step === 3 ? (
            <GlassCard style={[styles.panelCard, humansOnly ? FR_PURPLE_GLOW_STYLE : null]}>
              <Text style={styles.stepTitle}>Bots or humans?</Text>
              <View style={styles.toggleRow}>
                <View style={styles.toggleText}>
                  <Text style={styles.toggleTitle}>Humans Only</Text>
                  <Text style={styles.toggleBody}>
                    Filter out bot-detected accounts using the trust engine.
                  </Text>
                </View>
                <Switch value={humansOnly} onValueChange={setHumansOnly} trackColor={{ true: FR_ACCENT }} />
              </View>
              <View style={styles.tagRow}>
                {(['none', 'new', 'trusted', 'highly_trusted'] as const).map((option) => (
                  <ActionChip
                    key={option}
                    label={option.replace('_', ' ')}
                    active={trustRequirement === option}
                    onPress={() => setTrustRequirement(option)}
                  />
                ))}
              </View>
            </GlassCard>
          ) : null}

          {step === 4 ? (
            <GlassCard style={styles.panelCard}>
              <Text style={styles.stepTitle}>Visual identity</Text>
              <View style={styles.visualRow}>
                <Pressable onPress={() => void pickCover()} style={styles.visualCard}>
                  <Text style={styles.visualCardTitle}>Cover</Text>
                  <Text style={styles.visualCardBody}>{coverUri ? 'Selected' : 'Upload 16:9 image'}</Text>
                </Pressable>
                <Pressable onPress={() => void pickIcon()} style={styles.visualCard}>
                  <Text style={styles.visualCardTitle}>Icon</Text>
                  <Text style={styles.visualCardBody}>{iconUri ? 'Selected' : 'Upload square icon'}</Text>
                </Pressable>
              </View>
              <View style={styles.colorRow}>
                {COMMUNITY_COLOR_OPTIONS.map((color) => (
                  <Pressable
                    key={color}
                    onPress={() => setColorTheme(color)}
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: color },
                      colorTheme === color ? styles.colorSwatchActive : null,
                    ]}
                  />
                ))}
              </View>
            </GlassCard>
          ) : null}

          {step === 5 ? (
            <GlassCard style={styles.panelCard}>
              <Text style={styles.stepTitle}>Community rules</Text>
              <Text style={styles.stepBody}>
                Make expectations visible before the first thread goes live.
              </Text>
              <TextInput
                value={newRuleTitle}
                onChangeText={setNewRuleTitle}
                placeholder="Rule title"
                placeholderTextColor={FR_TEXT_TERTIARY}
                style={styles.searchInput}
              />
              <TextInput
                value={newRuleDescription}
                onChangeText={setNewRuleDescription}
                placeholder="Rule description"
                placeholderTextColor={FR_TEXT_TERTIARY}
                multiline
                style={styles.editorInput}
              />
              <Pressable
                onPress={() => {
                  if (!newRuleTitle.trim() || !newRuleDescription.trim()) {
                    Alert.alert('Rule missing', 'Add a rule title and description first.');
                    return;
                  }
                  setRules((current) => [
                    ...current,
                    {
                      id: makeId('rule'),
                      title: newRuleTitle.trim(),
                      description: newRuleDescription.trim(),
                    },
                  ]);
                  setNewRuleTitle('');
                  setNewRuleDescription('');
                }}
                style={styles.secondaryActionButton}
              >
                <Text style={styles.secondaryActionText}>Add rule</Text>
              </Pressable>

              <View style={styles.rulesList}>
                {rules.map((rule, index) => (
                  <GlassCard key={rule.id} style={styles.ruleCard}>
                    <View style={styles.ruleHeader}>
                      <Text style={styles.ruleIndex}>{index + 1}</Text>
                      <View style={styles.ruleTextBlock}>
                        <Text style={styles.ruleTitle}>{rule.title}</Text>
                        <Text style={styles.ruleDescription}>{rule.description}</Text>
                      </View>
                    </View>
                    <View style={styles.ruleControls}>
                      <ActionChip
                        label="Up"
                        onPress={() =>
                          setRules((current) => {
                            if (index === 0) return current;
                            const next = current.slice();
                            [next[index - 1], next[index]] = [next[index], next[index - 1]];
                            return next;
                          })
                        }
                      />
                      <ActionChip
                        label="Down"
                        onPress={() =>
                          setRules((current) => {
                            if (index === current.length - 1) return current;
                            const next = current.slice();
                            [next[index], next[index + 1]] = [next[index + 1], next[index]];
                            return next;
                          })
                        }
                      />
                      <ActionChip
                        label="Delete"
                        onPress={() =>
                          setRules((current) => current.filter((item) => item.id !== rule.id))
                        }
                      />
                    </View>
                  </GlassCard>
                ))}
              </View>
            </GlassCard>
          ) : null}

          {successCommunityId ? (
            <GlassCard style={[styles.panelCard, FR_PURPLE_GLOW_STYLE]}>
              <Text style={styles.successTitle}>Your community is live</Text>
              <Text style={styles.successBody}>
                Routing to the new community detail screen now.
              </Text>
            </GlassCard>
          ) : null}
        </ScrollView>

        <View style={styles.footerCtaWrap}>
          <LinearGradient
            colors={[FR_ACCENT_LIGHT, FR_ACCENT]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientCta}
          >
            <Pressable
              onPress={() => {
                if (step === 5) {
                  void handleCreateCommunity();
                  return;
                }
                if (!validateStep(step)) {
                  Alert.alert('Step incomplete', 'Complete the required fields before continuing.');
                  return;
                }
                setStep((value) => Math.min(5, value + 1));
              }}
              style={styles.gradientCtaButton}
            >
              <Text style={styles.gradientCtaText}>
                {step === 5 ? (creating ? 'Creating…' : 'Create community') : 'Next step'}
              </Text>
            </Pressable>
          </LinearGradient>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: FR_SURFACES.lowest,
  },
  headerShell: {
    backgroundColor: FR_GLASS_NAV.backgroundColor,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 72,
  },
  headerCenter: {
    flex: 1,
    gap: 2,
  },
  headerRight: {
    minWidth: 72,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    ...FR_TYPOGRAPHY.titleMd,
    color: FR_TEXT,
    textAlign: 'center',
  },
  headerSubtitle: {
    ...FR_TYPOGRAPHY.bodySm,
    color: FR_TEXT_TERTIARY,
    textAlign: 'center',
  },
  iconButton: {
    minWidth: 36,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  iconButtonSpacer: {
    width: 36,
    height: 36,
  },
  backText: {
    ...FR_TYPOGRAPHY.labelUpper,
    color: FR_TEXT,
  },
  threadScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 164,
    gap: 16,
  },
  opCard: {
    gap: 16,
  },
  threadMetaTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  threadMetaActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  inlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  inlineBadgeText: {
    ...FR_TYPOGRAPHY.labelTight,
    color: FR_TEXT_SECONDARY,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  authorTextWrap: {
    flex: 1,
    gap: 4,
  },
  authorName: {
    ...FR_TYPOGRAPHY.headlineMd,
    color: FR_TEXT,
  },
  authorMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  authorMetaText: {
    ...FR_TYPOGRAPHY.bodySm,
    color: FR_TEXT_TERTIARY,
  },
  threadTitle: {
    ...FR_TYPOGRAPHY.displayLg,
    color: FR_TEXT,
    fontSize: 34,
    lineHeight: 38,
  },
  markdownWrap: {
    gap: 10,
  },
  markdownTitle: {
    ...FR_TYPOGRAPHY.headlineMd,
    color: FR_TEXT,
    fontSize: 24,
    lineHeight: 30,
  },
  markdownSubtitle: {
    ...FR_TYPOGRAPHY.titleMd,
    color: FR_ACCENT_LIGHT,
  },
  markdownBody: {
    ...FR_TYPOGRAPHY.bodyMd,
    color: FR_TEXT_SECONDARY,
  },
  markdownBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  markdownBulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 8,
    backgroundColor: FR_ACCENT_LIGHT,
  },
  markdownQuote: {
    paddingLeft: 12,
    borderLeftWidth: 3,
    borderLeftColor: FR_ACCENT,
  },
  markdownQuoteText: {
    ...FR_TYPOGRAPHY.bodyMd,
    color: FR_TEXT,
  },
  markdownCode: {
    padding: 12,
    borderRadius: FR_CARD_RADIUS,
    backgroundColor: FR_SURFACES.base,
  },
  markdownCodeText: {
    ...FR_TYPOGRAPHY.bodySm,
    color: FR_ACCENT_LIGHT,
  },
  previewEmptyCard: {
    gap: 6,
  },
  previewEmptyTitle: {
    ...FR_TYPOGRAPHY.titleMd,
    color: FR_TEXT,
  },
  previewEmptyBody: {
    ...FR_TYPOGRAPHY.bodyMd,
    color: FR_TEXT_SECONDARY,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  threadStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statPill: {
    minWidth: 82,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    gap: 4,
  },
  statPillValue: {
    ...FR_TYPOGRAPHY.titleMd,
    color: FR_TEXT,
  },
  statPillLabel: {
    ...FR_TYPOGRAPHY.labelTight,
    color: FR_TEXT_TERTIARY,
  },
  threadVoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  sectionSplitRow: {
    gap: 12,
  },
  sectionChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  actionChipActive: {
    backgroundColor: FR_ACCENT,
  },
  actionChipText: {
    ...FR_TYPOGRAPHY.labelUpper,
    color: FR_TEXT_SECONDARY,
  },
  actionChipTextActive: {
    color: FR_ON_ACCENT,
  },
  emptyDiscussionCard: {
    gap: 6,
  },
  emptyDiscussionTitle: {
    ...FR_TYPOGRAPHY.titleMd,
    color: FR_TEXT,
  },
  emptyDiscussionBody: {
    ...FR_TYPOGRAPHY.bodyMd,
    color: FR_TEXT_SECONDARY,
  },
  replyBranch: {
    gap: 6,
  },
  replyMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 16,
    marginTop: 8,
  },
  replyMetaText: {
    ...FR_TYPOGRAPHY.bodySm,
    color: FR_TEXT_TERTIARY,
  },
  replyOverflowLink: {
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  replyOverflowText: {
    ...FR_TYPOGRAPHY.labelUpper,
    color: FR_ACCENT_LIGHT,
  },
  liveReplyBanner: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 108,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: FR_ACCENT,
  },
  liveReplyBannerText: {
    ...FR_TYPOGRAPHY.labelUpper,
    color: FR_ON_ACCENT,
  },
  replyComposerDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 18,
    gap: 10,
  },
  replyComposerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  replyComposerInputShell: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  replyComposerPlaceholder: {
    ...FR_TYPOGRAPHY.bodyMd,
    color: FR_TEXT_TERTIARY,
  },
  replyComposerDraft: {
    color: FR_TEXT,
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: FR_ACCENT,
  },
  replyTargetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  replyTargetText: {
    ...FR_TYPOGRAPHY.bodySm,
    color: FR_TEXT_SECONDARY,
  },
  replyTargetCancel: {
    ...FR_TYPOGRAPHY.labelUpper,
    color: FR_ACCENT_LIGHT,
  },
  replyLockedText: {
    ...FR_TYPOGRAPHY.bodySm,
    color: FR_TEXT_TERTIARY,
    textAlign: 'center',
  },
  modalScreen: {
    flex: 1,
    backgroundColor: FR_SURFACES.lowest,
  },
  modalTabs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  toolbarRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  fullComposerInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 20,
    color: FR_TEXT,
    ...FR_TYPOGRAPHY.bodyMd,
    textAlignVertical: 'top',
  },
  previewScroll: {
    padding: 16,
    gap: 16,
  },
  postHeaderButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: FR_ACCENT,
  },
  postHeaderButtonDisabled: {
    opacity: 0.6,
  },
  postHeaderButtonText: {
    ...FR_TYPOGRAPHY.labelUpper,
    color: FR_ON_ACCENT,
  },
  communityBanner: {
    height: 210,
    position: 'relative',
  },
  communityIconWrap: {
    position: 'absolute',
    left: 20,
    bottom: -34,
  },
  communityScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 40,
    gap: 16,
  },
  communitySummaryCard: {
    gap: 16,
  },
  communitySummaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  communityTitleBlock: {
    flex: 1,
    gap: 6,
  },
  communityTitle: {
    ...FR_TYPOGRAPHY.displayLg,
    color: FR_TEXT,
    fontSize: 30,
    lineHeight: 34,
  },
  communityTagline: {
    ...FR_TYPOGRAPHY.bodyMd,
    color: FR_TEXT_SECONDARY,
  },
  communityBadgeColumn: {
    alignItems: 'flex-end',
    gap: 8,
  },
  communityActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  primaryActionButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: FR_ACCENT,
  },
  primaryActionText: {
    ...FR_TYPOGRAPHY.labelUpper,
    color: FR_ON_ACCENT,
  },
  secondaryActionButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  secondaryActionText: {
    ...FR_TYPOGRAPHY.labelUpper,
    color: FR_TEXT,
  },
  secondaryIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  sectionGroup: {
    gap: 12,
  },
  sectionAction: {
    ...FR_TYPOGRAPHY.labelUpper,
    color: FR_ACCENT_LIGHT,
  },
  horizontalCards: {
    flexDirection: 'row',
    gap: 12,
  },
  horizontalCardItem: {
    width: 280,
  },
  panelCard: {
    gap: 12,
  },
  linkedCommunityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  linkedCommunityText: {
    flex: 1,
    gap: 4,
  },
  linkedCommunityTitle: {
    ...FR_TYPOGRAPHY.titleMd,
    color: FR_TEXT,
  },
  linkedCommunityBody: {
    ...FR_TYPOGRAPHY.bodySm,
    color: FR_TEXT_SECONDARY,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  memberText: {
    flex: 1,
    gap: 4,
  },
  memberName: {
    ...FR_TYPOGRAPHY.titleMd,
    color: FR_TEXT,
  },
  memberMeta: {
    ...FR_TYPOGRAPHY.bodySm,
    color: FR_TEXT_TERTIARY,
  },
  searchInput: {
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    color: FR_TEXT,
    ...FR_TYPOGRAPHY.bodyMd,
  },
  ruleCard: {
    gap: 12,
  },
  ruleHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  ruleIndex: {
    width: 30,
    textAlign: 'center',
    ...FR_TYPOGRAPHY.headlineMd,
    color: FR_ACCENT_LIGHT,
  },
  ruleTextBlock: {
    flex: 1,
    gap: 6,
  },
  ruleTitle: {
    ...FR_TYPOGRAPHY.titleMd,
    color: FR_TEXT,
  },
  ruleDescription: {
    ...FR_TYPOGRAPHY.bodyMd,
    color: FR_TEXT_SECONDARY,
  },
  ruleAction: {
    ...FR_TYPOGRAPHY.labelUpper,
    color: FR_ACCENT_LIGHT,
  },
  createScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 112,
    gap: 16,
  },
  sectionEyebrow: {
    ...FR_TYPOGRAPHY.labelUpper,
    color: FR_ACCENT_LIGHT,
  },
  communityPickerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 6,
  },
  communityPickerText: {
    flex: 1,
    gap: 4,
  },
  communityPickerTitle: {
    ...FR_TYPOGRAPHY.headlineMd,
    color: FR_TEXT,
  },
  communityPickerBody: {
    ...FR_TYPOGRAPHY.bodySm,
    color: FR_TEXT_SECONDARY,
  },
  titleInput: {
    minHeight: 72,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    paddingVertical: 16,
    color: FR_TEXT,
    ...FR_TYPOGRAPHY.headlineMd,
  },
  counterText: {
    ...FR_TYPOGRAPHY.bodySm,
    color: FR_TEXT_TERTIARY,
    alignSelf: 'flex-end',
  },
  editorInput: {
    minHeight: 170,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    paddingVertical: 16,
    color: FR_TEXT,
    ...FR_TYPOGRAPHY.bodyMd,
    textAlignVertical: 'top',
  },
  optionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionsTitle: {
    ...FR_TYPOGRAPHY.titleMd,
    color: FR_TEXT,
  },
  optionsToggle: {
    ...FR_TYPOGRAPHY.labelUpper,
    color: FR_ACCENT_LIGHT,
  },
  optionsBody: {
    gap: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toggleText: {
    flex: 1,
    gap: 4,
  },
  toggleTitle: {
    ...FR_TYPOGRAPHY.titleMd,
    color: FR_TEXT,
  },
  toggleBody: {
    ...FR_TYPOGRAPHY.bodySm,
    color: FR_TEXT_SECONDARY,
  },
  crossPostWrap: {
    gap: 8,
  },
  footerCtaWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 18,
  },
  gradientCta: {
    borderRadius: 18,
  },
  gradientCtaButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    borderRadius: 18,
  },
  gradientCtaText: {
    ...FR_TYPOGRAPHY.labelUpper,
    color: FR_ON_ACCENT,
    letterSpacing: 1.8,
  },
  pickerScroll: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 14,
  },
  communityPickerResult: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  attachmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  attachmentGridCompact: {
    marginTop: 2,
  },
  attachmentCard: {
    width: 112,
    gap: 6,
  },
  attachmentPreview: {
    height: 96,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentPreviewCompact: {
    height: 72,
  },
  attachmentPreviewText: {
    ...FR_TYPOGRAPHY.labelUpper,
    color: FR_TEXT_SECONDARY,
  },
  attachmentLabel: {
    ...FR_TYPOGRAPHY.bodySm,
    color: FR_TEXT_SECONDARY,
  },
  attachmentRemove: {
    alignSelf: 'flex-start',
  },
  attachmentRemoveText: {
    ...FR_TYPOGRAPHY.labelUpper,
    color: FR_DANGER,
  },
  savedDraftBadge: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  savedDraftBadgeText: {
    ...FR_TYPOGRAPHY.labelTight,
    color: FR_TEXT_SECONDARY,
  },
  progressDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 12,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  progressDotActive: {
    width: 22,
    backgroundColor: FR_ACCENT_LIGHT,
  },
  progressDotComplete: {
    backgroundColor: FR_ACCENT,
  },
  stepTitle: {
    ...FR_TYPOGRAPHY.displayLg,
    color: FR_TEXT,
    fontSize: 30,
    lineHeight: 34,
  },
  stepBody: {
    ...FR_TYPOGRAPHY.bodyMd,
    color: FR_TEXT_SECONDARY,
  },
  slugState: {
    ...FR_TYPOGRAPHY.labelUpper,
  },
  slugStateGood: {
    color: '#30D158',
  },
  slugStateBad: {
    color: FR_DANGER,
  },
  typeGrid: {
    gap: 12,
  },
  typeCard: {
    gap: 10,
  },
  typeCardActive: {
    ...FR_PURPLE_GLOW_STYLE,
    backgroundColor: 'rgba(124,77,255,0.14)',
  },
  typeCardTitle: {
    ...FR_TYPOGRAPHY.headlineMd,
    color: FR_TEXT,
  },
  typeCardBody: {
    ...FR_TYPOGRAPHY.bodySm,
    color: FR_TEXT_SECONDARY,
  },
  visualRow: {
    flexDirection: 'row',
    gap: 12,
  },
  visualCard: {
    flex: 1,
    minHeight: 120,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    gap: 8,
  },
  visualCardTitle: {
    ...FR_TYPOGRAPHY.titleMd,
    color: FR_TEXT,
  },
  visualCardBody: {
    ...FR_TYPOGRAPHY.bodySm,
    color: FR_TEXT_SECONDARY,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  colorSwatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  colorSwatchActive: {
    borderWidth: 3,
    borderColor: FR_TEXT,
  },
  rulesList: {
    gap: 10,
  },
  ruleControls: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  successTitle: {
    ...FR_TYPOGRAPHY.headlineMd,
    color: FR_TEXT,
  },
  successBody: {
    ...FR_TYPOGRAPHY.bodyMd,
    color: FR_TEXT_SECONDARY,
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...FR_TYPOGRAPHY.labelUpper,
    color: FR_ON_ACCENT,
  },
});
