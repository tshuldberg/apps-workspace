import {
  Fragment,
  useMemo,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { Text as RNText } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Polyline,
  Rect,
  Stop,
} from 'react-native-svg';
import type { Community, CommunityHealth, CommunityMember, UserProfile } from '@mylife/forums';
import {
  FR_ACCENT,
  FR_ACCENT_LIGHT,
  FR_DANGER,
  FR_INFO,
  FR_PINNED,
  FR_PURPLE_GLOW_STYLE,
  FR_SUCCESS,
  FR_SURFACES,
  FR_TEXT,
  FR_TEXT_MUTED,
  FR_TEXT_SECONDARY,
  FR_TEXT_TERTIARY,
  FR_TYPOGRAPHY,
  type ForumTrustTier,
  GlassCard,
  HumanVerifiedBadge,
  MaterialSymbol,
  SearchBar,
  SectionHeader,
} from '@mylife/forums';
import { useForumsData } from './_ui';

type HealthRange = '7d' | '30d' | '90d';
type ModeratorRole = Exclude<CommunityMember['role'], 'member'>;
type ModFilter =
  | 'All'
  | 'Removals'
  | 'Bans'
  | 'Warnings'
  | 'Locks'
  | 'Pins'
  | 'Auto-Actions';
type SocialPlatform = 'Twitter' | 'Mastodon' | 'GitHub' | 'Website';
type MessageAccess = 'Everyone' | 'Humans Only' | 'Mutuals Only' | 'Nobody';
type SpamFilterLevel = 'Off' | 'Low' | 'Medium' | 'High';

interface SocialLinkDraft {
  id: string;
  platform: SocialPlatform;
  url: string;
}

interface ProfilePhase4State {
  avatarUri: string | null;
  bannerUri: string | null;
  socialLinks: SocialLinkDraft[];
  showActivity: boolean;
  messageAccess: MessageAccess;
  showTrustTier: boolean;
  verificationRequested: boolean;
  linkedIdentities: string[];
  email: string;
  twoFactorEnabled: boolean;
}

interface RuleDraft {
  id: string;
  title: string;
  description: string;
}

interface FlaggedContentItem {
  id: string;
  snippet: string;
  reason: string;
  reportCount: number;
  severity: 'low' | 'medium' | 'high';
  status: 'pending' | 'resolved' | 'dismissed';
}

interface AutoModOverride {
  id: string;
  label: string;
  createdAt: string;
}

interface AutoModState {
  spamRemoved: number;
  botsBanned: number;
  postsFlagged: number;
  rulesActive: number;
  rulesPaused: number;
  overrideLog: AutoModOverride[];
}

interface CommunityPhase4State {
  displayName: string;
  coverUri: string | null;
  iconUri: string | null;
  tagline: string;
  description: string;
  communityType: Community['communityType'] | 'federated';
  humansOnly: boolean;
  trustRequirement: ForumTrustTier;
  nsfwEnabled: boolean;
  spamFilterLevel: SpamFilterLevel;
  autoBanRepeatOffenders: boolean;
  minTrustToPost: ForumTrustTier;
  rules: RuleDraft[];
  moderators: Array<{ profileId: string; role: ModeratorRole }>;
  flaggedQueue: FlaggedContentItem[];
  automod: AutoModState;
  archived: boolean;
  deleteConfirmText: string;
  deleteQueued: boolean;
}

interface EngagementMetric {
  id: string;
  label: string;
  value: string;
  delta: number;
  series: number[];
}

interface TrustDistributionBar {
  label: string;
  members: number;
  flagged: number;
}

interface TopModeratorRow {
  profileId: string;
  role: ModeratorRole;
  actions: number;
  windowLabel: string;
}

interface ModActionEntry {
  id: string;
  communityId: string;
  moderatorProfileId: string;
  actionType: 'Removed' | 'Banned' | 'Warned' | 'Locked' | 'Pinned' | 'AutoAction';
  targetLabel: string;
  reason: string;
  createdAt: string;
  reversible: boolean;
  auto: boolean;
  undone: boolean;
}

const HEALTH_RANGES: HealthRange[] = ['7d', '30d', '90d'];
const MOD_FILTERS: ModFilter[] = [
  'All',
  'Removals',
  'Bans',
  'Warnings',
  'Locks',
  'Pins',
  'Auto-Actions',
];
const PLATFORM_ORDER: SocialPlatform[] = ['Twitter', 'Mastodon', 'GitHub', 'Website'];
const MESSAGE_ACCESS_OPTIONS: MessageAccess[] = [
  'Everyone',
  'Humans Only',
  'Mutuals Only',
  'Nobody',
];
const SPAM_FILTER_LEVELS: SpamFilterLevel[] = ['Off', 'Low', 'Medium', 'High'];
const COMMUNITY_TYPE_OPTIONS: Array<Community['communityType'] | 'federated'> = [
  'public',
  'private',
  'federated',
];
const TRUST_TIER_OPTIONS: ForumTrustTier[] = ['new', 'trusted', 'highly_trusted'];

const PROFILE_STATE = new Map<string, ProfilePhase4State>();
const COMMUNITY_STATE = new Map<string, CommunityPhase4State>();
const MOD_ACTIONS = new Map<string, ModActionEntry[]>();

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
}

function getParamValue(value?: string | string[]): string | undefined {
  return Array.isArray(value) ? value[0] : value;
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

function toInitials(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function getProfileTrustTier(profile: UserProfile): ForumTrustTier {
  if (profile.isVerified && profile.karma >= 1000) return 'highly_trusted';
  if (profile.isVerified) return 'trusted';
  return 'new';
}

function getModeratorBadge(role: ModeratorRole): ForumTrustTier {
  return role === 'owner' || role === 'admin' || role === 'moderator'
    ? 'mod'
    : 'new';
}

function getCommunityRole(
  community: Community,
  currentProfile: UserProfile,
  members: CommunityMember[],
): CommunityMember['role'] {
  if (community.creatorId === currentProfile.userId) {
    return 'owner';
  }

  return (
    members.find(
      (member) => member.profileId === currentProfile.id && member.status === 'active',
    )?.role ?? 'member'
  );
}

function getRoleLabel(role: CommunityMember['role']): string {
  switch (role) {
    case 'owner':
      return 'Owner';
    case 'admin':
      return 'Admin';
    case 'moderator':
      return 'Moderator';
    default:
      return 'Member';
  }
}

function computeHealthScore(health: CommunityHealth): number {
  const responseScore = Math.max(0, 100 - Math.min(100, health.avgResponseTimeMinutes));
  const moderationLoadPenalty = Math.min(12, health.modActionsLast30Days * 0.35);

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        health.verifiedHumanPercent * 0.45 +
          health.signalToNoiseScore * 10 * 0.38 +
          responseScore * 0.22 -
          moderationLoadPenalty,
      ),
    ),
  );
}

function getHealthStatus(score: number): { label: string; color: string } {
  if (score >= 85) return { label: 'Thriving', color: FR_SUCCESS };
  if (score >= 72) return { label: 'Healthy', color: FR_ACCENT_LIGHT };
  if (score >= 58) return { label: 'At Risk', color: FR_PINNED };
  return { label: 'Struggling', color: FR_DANGER };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function buildSeries(seed: number, base: number): number[] {
  return Array.from({ length: 7 }, (_, index) => {
    const wave = Math.sin(seed * 0.19 + index * 0.65) * 0.14;
    const drift = index * 0.035;
    return Math.max(4, Math.round(base * (0.78 + wave + drift)));
  });
}

function buildHeatmap(seed: string, range: HealthRange): number[][] {
  const seedValue = seed
    .split('')
    .reduce((total, char) => total + char.charCodeAt(0), 0);
  const rangeFactor = range === '7d' ? 1 : range === '30d' ? 0.88 : 0.76;

  return Array.from({ length: 7 }, (_, dayIndex) =>
    Array.from({ length: 24 }, (_, hourIndex) => {
      const eveningBoost = hourIndex >= 18 && hourIndex <= 22 ? 0.26 : 0;
      const overnightDip = hourIndex <= 5 ? -0.18 : 0;
      const wave = Math.abs(
        Math.sin(seedValue * 0.011 + dayIndex * 0.83 + hourIndex * 0.39),
      );
      return clamp((wave * 0.72 + eveningBoost + overnightDip) * rangeFactor, 0.08, 1);
    }),
  );
}

function buildTrustDistribution(
  health: CommunityHealth,
  moderatorCount: number,
): TrustDistributionBar[] {
  const verifiedMembers = Math.round(
    (health.memberCount * health.verifiedHumanPercent) / 100,
  );
  const nonVerifiedMembers = Math.max(0, health.memberCount - verifiedMembers);
  const moderators = Math.max(1, moderatorCount);
  const highlyTrusted = Math.max(1, Math.round(verifiedMembers * 0.28));
  const trusted = Math.max(1, Math.round(verifiedMembers * 0.42));
  const human = Math.max(1, Math.round(nonVerifiedMembers * 0.35));
  const newMembers = Math.max(
    1,
    health.memberCount - highlyTrusted - trusted - human - moderators,
  );

  return [
    {
      label: 'New',
      members: newMembers,
      flagged: Math.round(newMembers * 0.18),
    },
    {
      label: 'Human',
      members: human,
      flagged: Math.round(human * 0.12),
    },
    {
      label: 'Trusted',
      members: trusted,
      flagged: Math.round(trusted * 0.05),
    },
    {
      label: 'High',
      members: highlyTrusted,
      flagged: Math.round(highlyTrusted * 0.03),
    },
    {
      label: 'Mods',
      members: moderators,
      flagged: 0,
    },
  ];
}

async function pickImageFromLibrary(
  aspect: [number, number],
): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert(
      'Photo access needed',
      'Grant photo access to select a cover or avatar.',
    );
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    allowsEditing: true,
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.9,
    aspect,
  });

  if (result.canceled || result.assets.length === 0) {
    return null;
  }

  return result.assets[0]?.uri ?? null;
}

function cloneProfileState(state: ProfilePhase4State): ProfilePhase4State {
  return {
    ...state,
    socialLinks: state.socialLinks.map((link) => ({ ...link })),
    linkedIdentities: [...state.linkedIdentities],
  };
}

function cloneCommunityState(state: CommunityPhase4State): CommunityPhase4State {
  return {
    ...state,
    rules: state.rules.map((rule) => ({ ...rule })),
    moderators: state.moderators.map((moderator) => ({ ...moderator })),
    flaggedQueue: state.flaggedQueue.map((flag) => ({ ...flag })),
    automod: {
      ...state.automod,
      overrideLog: state.automod.overrideLog.map((item) => ({ ...item })),
    },
  };
}

function ensureProfileState(profile: UserProfile): ProfilePhase4State {
  const existing = PROFILE_STATE.get(profile.id);
  if (existing) {
    return cloneProfileState(existing);
  }

  const next: ProfilePhase4State = {
    avatarUri: profile.avatarUrl,
    bannerUri: profile.bannerUrl,
    socialLinks: [
      {
        id: `${profile.id}-website`,
        platform: 'Website',
        url: profile.websiteUrl ?? 'https://mylife.app',
      },
      {
        id: `${profile.id}-github`,
        platform: 'GitHub',
        url: `https://github.com/${profile.username}`,
      },
      {
        id: `${profile.id}-mastodon`,
        platform: 'Mastodon',
        url: `https://social.example/@${profile.username}`,
      },
    ],
    showActivity: true,
    messageAccess: profile.isVerified ? 'Humans Only' : 'Mutuals Only',
    showTrustTier: true,
    verificationRequested: false,
    linkedIdentities: [
      `mylife.app/@${profile.username}`,
      `${profile.username}@forums.mylife.app`,
    ],
    email: `${profile.username}@mylife.app`,
    twoFactorEnabled: true,
  };

  PROFILE_STATE.set(profile.id, cloneProfileState(next));
  return next;
}

function ensureCommunityState(params: {
  community: Community;
  currentProfile: UserProfile;
  members: CommunityMember[];
  profiles: UserProfile[];
  health: CommunityHealth;
  rules: Array<{ id: string; title: string; description: string }>;
}): CommunityPhase4State {
  const existing = COMMUNITY_STATE.get(params.community.id);
  if (existing) {
    return cloneCommunityState(existing);
  }

  const ownerProfile =
    params.profiles.find((profile) => profile.userId === params.community.creatorId) ??
    (params.community.creatorId === params.currentProfile.userId ? params.currentProfile : params.profiles[0]);

  const moderators = params.members
    .filter((member) => member.role !== 'member' && member.status === 'active')
    .map((member) => ({
      profileId: member.profileId,
      role: member.role as ModeratorRole,
    }));

  if (ownerProfile != null && !moderators.some((moderator) => moderator.profileId === ownerProfile.id)) {
    moderators.unshift({ profileId: ownerProfile.id, role: 'owner' });
  }

  const next: CommunityPhase4State = {
    displayName: params.community.displayName,
    coverUri: params.community.bannerUrl,
    iconUri: params.community.iconUrl,
    tagline: params.community.humansOnly
      ? 'High-context, human-first discussion'
      : 'Local context, low-noise conversation',
    description:
      params.community.description ??
      'A moderated space tuned for thoughtful replies, high trust, and low bot noise.',
    communityType:
      params.community.linkedModuleId != null ? 'federated' : params.community.communityType,
    humansOnly: params.community.humansOnly,
    trustRequirement: params.community.humansOnly ? 'trusted' : 'new',
    nsfwEnabled: false,
    spamFilterLevel: params.community.humansOnly ? 'High' : 'Medium',
    autoBanRepeatOffenders: params.community.humansOnly,
    minTrustToPost: params.community.humansOnly ? 'trusted' : 'new',
    rules: params.rules.map((rule) => ({
      id: rule.id,
      title: rule.title,
      description: rule.description,
    })),
    moderators,
    flaggedQueue: [
      {
        id: `${params.community.id}-flag-1`,
        snippet: 'Portfolio link drop with no discussion context and duplicate replies.',
        reason: 'Self-promo spam',
        reportCount: 4,
        severity: 'high',
        status: 'pending',
      },
      {
        id: `${params.community.id}-flag-2`,
        snippet: 'Drive-by comment accusing another member of bot behavior without evidence.',
        reason: 'Harassment',
        reportCount: 2,
        severity: 'medium',
        status: 'pending',
      },
      {
        id: `${params.community.id}-flag-3`,
        snippet: 'Cross-posted AI-generated summary with affiliate links in the footer.',
        reason: 'Link spam',
        reportCount: 3,
        severity: 'medium',
        status: 'pending',
      },
    ],
    automod: {
      spamRemoved: Math.max(2, Math.round(params.health.modActionsLast30Days * 0.55)),
      botsBanned: Math.max(1, Math.round(params.health.modActionsLast30Days * 0.18)),
      postsFlagged: Math.max(3, Math.round(params.health.modActionsLast30Days * 0.72)),
      rulesActive: params.community.humansOnly ? 6 : 4,
      rulesPaused: 1,
      overrideLog: [
        {
          id: `${params.community.id}-override-1`,
          label: 'Allowed a new member post after manual review',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 9).toISOString(),
        },
        {
          id: `${params.community.id}-override-2`,
          label: 'Restored a pinned thread caught by duplicate-title filter',
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString(),
        },
      ],
    },
    archived: false,
    deleteConfirmText: '',
    deleteQueued: false,
  };

  COMMUNITY_STATE.set(params.community.id, cloneCommunityState(next));
  return next;
}

function ensureModActions(params: {
  community: Community;
  moderators: Array<{ profileId: string; role: ModeratorRole }>;
  profiles: UserProfile[];
  threadTitles: string[];
}): ModActionEntry[] {
  const existing = MOD_ACTIONS.get(params.community.id);
  if (existing) {
    return existing.map((action) => ({ ...action }));
  }

  const fallbackModerator =
    params.moderators[0] ??
    (params.profiles[0]
      ? { profileId: params.profiles[0].id, role: 'moderator' as const }
      : null);

  const baseTargets = params.threadTitles.length > 0
    ? params.threadTitles
    : ['Spam link cluster', 'Repeated off-topic promo', 'Duplicate build log'];

  const templates: Array<Omit<ModActionEntry, 'id' | 'communityId' | 'moderatorProfileId' | 'createdAt'>> = [
    {
      actionType: 'Removed',
      targetLabel: baseTargets[0] ?? 'Spam link cluster',
      reason: 'Removed for repetitive self-promo without discussion context.',
      reversible: true,
      auto: false,
      undone: false,
    },
    {
      actionType: 'Warned',
      targetLabel: '@driveby-launches',
      reason: 'Asked the user to keep product drops inside the weekly thread.',
      reversible: true,
      auto: false,
      undone: false,
    },
    {
      actionType: 'Locked',
      targetLabel: baseTargets[1] ?? 'Repeated off-topic promo',
      reason: 'Thread cooled off after a pile-on.',
      reversible: true,
      auto: false,
      undone: false,
    },
    {
      actionType: 'Pinned',
      targetLabel: baseTargets[2] ?? 'Duplicate build log',
      reason: 'Pinned as the week’s onboarding reference.',
      reversible: true,
      auto: false,
      undone: false,
    },
    {
      actionType: 'Banned',
      targetLabel: '@keyword-stuffer',
      reason: 'Confirmed bot account after repeated low-trust link spam.',
      reversible: false,
      auto: false,
      undone: false,
    },
    {
      actionType: 'AutoAction',
      targetLabel: 'Generated summary thread with affiliate footer',
      reason: 'Auto-mod suppressed due to high bot-likelihood score.',
      reversible: true,
      auto: true,
      undone: false,
    },
  ];

  const generated = Array.from({ length: 64 }, (_, index) => {
    const moderator = params.moderators[index % Math.max(1, params.moderators.length)] ?? fallbackModerator;
    const template = templates[index % templates.length];
    const createdAt = new Date(
      Date.now() - (index * 5 + (index % 3) * 2) * 60 * 60 * 1000,
    ).toISOString();

    return {
      ...template,
      id: `${params.community.id}-mod-${index}`,
      communityId: params.community.id,
      moderatorProfileId: moderator?.profileId ?? params.profiles[0]?.id ?? 'unknown-profile',
      createdAt,
    };
  });

  MOD_ACTIONS.set(params.community.id, generated.map((action) => ({ ...action })));
  return generated;
}

function matchesFilter(action: ModActionEntry, filter: ModFilter): boolean {
  switch (filter) {
    case 'Removals':
      return action.actionType === 'Removed';
    case 'Bans':
      return action.actionType === 'Banned';
    case 'Warnings':
      return action.actionType === 'Warned';
    case 'Locks':
      return action.actionType === 'Locked';
    case 'Pins':
      return action.actionType === 'Pinned';
    case 'Auto-Actions':
      return action.actionType === 'AutoAction' || action.auto;
    case 'All':
    default:
      return true;
  }
}

function getActionCopy(action: ModActionEntry): string {
  switch (action.actionType) {
    case 'Removed':
      return 'Removed thread';
    case 'Banned':
      return 'Banned user';
    case 'Warned':
      return 'Warned user';
    case 'Locked':
      return 'Locked thread';
    case 'Pinned':
      return 'Pinned thread';
    case 'AutoAction':
    default:
      return 'Auto-moderated content';
  }
}

function getActionTone(action: ModActionEntry): string {
  switch (action.actionType) {
    case 'Pinned':
      return FR_PINNED;
    case 'Warned':
      return FR_INFO;
    case 'Banned':
      return FR_DANGER;
    case 'AutoAction':
      return FR_ACCENT_LIGHT;
    default:
      return FR_ACCENT;
  }
}

function getSeverityTone(severity: FlaggedContentItem['severity']): string {
  switch (severity) {
    case 'high':
      return FR_DANGER;
    case 'medium':
      return FR_PINNED;
    default:
      return FR_INFO;
  }
}

function rotatePlatform(platform: SocialPlatform): SocialPlatform {
  const currentIndex = PLATFORM_ORDER.indexOf(platform);
  return PLATFORM_ORDER[(currentIndex + 1) % PLATFORM_ORDER.length] ?? 'Website';
}

function getWebsiteFromLinks(links: SocialLinkDraft[]): string {
  return (
    links.find((link) => link.platform === 'Website' && link.url.trim().length > 0)?.url ??
    ''
  );
}

function buildEngagementMetrics(params: {
  community: Community;
  health: CommunityHealth;
  threadsCreated: number;
  averageReplies: number;
  range: HealthRange;
}): EngagementMetric[] {
  const multiplier = params.range === '7d' ? 0.38 : params.range === '30d' ? 1 : 1.42;
  const activeMembers = Math.round(params.health.activePostersLast7Days * multiplier);
  const createdThreads = Math.max(1, Math.round(params.threadsCreated * multiplier));
  const repliesPerThread = params.averageReplies * (params.range === '90d' ? 0.92 : 1);
  const moderationPressure = Math.max(
    1,
    Math.round(params.health.modActionsLast30Days * (params.range === '7d' ? 0.32 : params.range === '30d' ? 1 : 1.3)),
  );

  return [
    {
      id: 'active-members',
      label: 'Active Members',
      value: String(activeMembers),
      delta: 9,
      series: buildSeries(activeMembers, activeMembers),
    },
    {
      id: 'threads-created',
      label: 'Threads Created',
      value: String(createdThreads),
      delta: 6,
      series: buildSeries(createdThreads + 7, createdThreads),
    },
    {
      id: 'replies-per-thread',
      label: 'Replies / Thread',
      value: repliesPerThread.toFixed(1),
      delta: 4,
      series: buildSeries(repliesPerThread * 10, repliesPerThread * 10),
    },
    {
      id: 'moderation-pressure',
      label: 'Flagged Events',
      value: String(moderationPressure),
      delta: -3,
      series: buildSeries(moderationPressure + 4, moderationPressure + 4),
    },
  ];
}

function buildTopModerators(params: {
  actions: ModActionEntry[];
  moderators: Array<{ profileId: string; role: ModeratorRole }>;
}): TopModeratorRow[] {
  const counts = new Map<string, number>();
  params.actions
    .filter((action) => !action.undone)
    .forEach((action) => {
      counts.set(action.moderatorProfileId, (counts.get(action.moderatorProfileId) ?? 0) + 1);
    });

  return params.moderators
    .map((moderator) => ({
      profileId: moderator.profileId,
      role: moderator.role,
      actions: counts.get(moderator.profileId) ?? 0,
      windowLabel: 'Last 30d',
    }))
    .sort((left, right) => right.actions - left.actions);
}

function PhaseScreen({
  eyebrow,
  title,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <RNText style={styles.headerEyebrow}>{eyebrow}</RNText>
          <RNText style={styles.headerTitle}>{title}</RNText>
        </View>
        {action}
      </View>
      {children}
    </ScrollView>
  );
}

function Avatar({
  name,
  uri,
  size = 48,
}: {
  name: string;
  uri?: string | null;
  size?: number;
}) {
  const borderRadius = size / 2;

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius }}
      />
    );
  }

  return (
    <LinearGradient
      colors={[FR_ACCENT_LIGHT, FR_ACCENT]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.avatarFallback,
        { width: size, height: size, borderRadius },
      ]}
    >
      <RNText style={[styles.avatarText, { fontSize: size >= 64 ? 20 : 14 }]}>
        {toInitials(name)}
      </RNText>
    </LinearGradient>
  );
}

function CoverArtwork({
  title,
  subtitle,
  uri,
  height = 176,
}: {
  title: string;
  subtitle: string;
  uri?: string | null;
  height?: number;
}) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.coverImage, { height }]}
      />
    );
  }

  return (
    <LinearGradient
      colors={['#2B2346', '#161826', '#0F1119']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.coverGradient, { height }]}
    >
      <RNText style={styles.coverEyebrow}>{subtitle}</RNText>
      <RNText style={styles.coverTitle}>{title}</RNText>
    </LinearGradient>
  );
}

function ActionChip({
  label,
  active = false,
  glow = false,
  onPress,
}: {
  label: string;
  active?: boolean;
  glow?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.actionChip,
        active && styles.actionChipActive,
        glow && active ? FR_PURPLE_GLOW_STYLE : null,
      ]}
    >
      <RNText style={[styles.actionChipLabel, active && styles.actionChipLabelActive]}>
        {label}
      </RNText>
    </Pressable>
  );
}

function SectionActionLabel({ label }: { label: string }) {
  return <RNText style={styles.sectionAction}>{label}</RNText>;
}

function InputLabel({ label }: { label: string }) {
  return <RNText style={styles.inputLabel}>{label}</RNText>;
}

function MetricSparkline({
  values,
  color,
}: {
  values: number[];
  color: string;
}) {
  const width = 108;
  const height = 28;
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const range = Math.max(1, max - min);
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * width;
      const y = height - ((value - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <Svg width={width} height={height}>
      <Polyline
        fill="none"
        points={points}
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={3}
      />
    </Svg>
  );
}

function ScoreRing({ score }: { score: number }) {
  const size = 108;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  return (
    <View style={styles.scoreRingWrap}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgLinearGradient id="forumsHealthScore" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={FR_ACCENT_LIGHT} />
            <Stop offset="100%" stopColor={FR_ACCENT} />
          </SvgLinearGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#forumsHealthScore)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference - progress}`}
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.scoreCenter}>
        <RNText style={styles.scoreValue}>{score}</RNText>
        <RNText style={styles.scoreCaption}>Score</RNText>
      </View>
    </View>
  );
}

function TrustDistributionChart({
  bars,
}: {
  bars: TrustDistributionBar[];
}) {
  const width = 320;
  const height = 176;
  const max = Math.max(...bars.map((bar) => bar.members), 1);

  return (
    <View style={styles.chartWrap}>
      <Svg width={width} height={height}>
        <Defs>
          <SvgLinearGradient id="forumsHistogramGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={FR_ACCENT_LIGHT} stopOpacity={0.95} />
            <Stop offset="100%" stopColor={FR_ACCENT} stopOpacity={0.5} />
          </SvgLinearGradient>
        </Defs>
        {bars.map((bar, index) => {
          const barWidth = 40;
          const x = 20 + index * 58;
          const membersHeight = Math.round((bar.members / max) * 124);
          const flaggedHeight = Math.round((bar.flagged / max) * 124);

          return (
            <Fragment key={bar.label}>
              <Rect
                key={`${bar.label}-members`}
                x={x}
                y={22 + (124 - membersHeight)}
                width={barWidth}
                height={membersHeight}
                rx={14}
                fill="url(#forumsHistogramGradient)"
              />
              {flaggedHeight > 0 ? (
                <Rect
                  key={`${bar.label}-flagged`}
                  x={x}
                  y={22 + (124 - flaggedHeight)}
                  width={barWidth}
                  height={flaggedHeight}
                  rx={14}
                  fill="rgba(255, 184, 119, 0.72)"
                />
              ) : null}
            </Fragment>
          );
        })}
      </Svg>
      <View style={styles.chartLegendRow}>
        {bars.map((bar) => (
          <View key={bar.label} style={styles.chartLegendItem}>
            <RNText style={styles.chartLegendLabel}>{bar.label}</RNText>
            <RNText style={styles.chartLegendValue}>{bar.members}</RNText>
          </View>
        ))}
      </View>
      <View style={styles.histogramLegend}>
        <View style={styles.legendPill}>
          <View style={[styles.legendDot, { backgroundColor: FR_ACCENT }]} />
          <RNText style={styles.legendText}>Trust distribution</RNText>
        </View>
        <View style={styles.legendPill}>
          <View style={[styles.legendDot, { backgroundColor: FR_PINNED }]} />
          <RNText style={styles.legendText}>Bot indicator overlay</RNText>
        </View>
      </View>
    </View>
  );
}

function HeatmapGrid({
  grid,
  onPressCell,
}: {
  grid: number[][];
  onPressCell: (dayIndex: number, hourIndex: number, intensity: number) => void;
}) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const hours = Array.from({ length: 24 }, (_, index) => index);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.heatmapContainer}>
        <View style={styles.heatmapHours}>
          <View style={styles.heatmapLabelSpacer} />
          {hours.map((hour) => (
            <RNText key={hour} style={styles.heatmapHourLabel}>
              {hour % 6 === 0 ? hour : ''}
            </RNText>
          ))}
        </View>
        {grid.map((row, dayIndex) => (
          <View key={days[dayIndex]} style={styles.heatmapRow}>
            <RNText style={styles.heatmapDayLabel}>{days[dayIndex]}</RNText>
            {row.map((intensity, hourIndex) => (
              <Pressable
                key={`${dayIndex}-${hourIndex}`}
                onPress={() => onPressCell(dayIndex, hourIndex, intensity)}
                style={[
                  styles.heatmapCell,
                  {
                    backgroundColor: `rgba(124,77,255,${0.12 + intensity * 0.72})`,
                  },
                ]}
              />
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function ToggleRow({
  icon,
  label,
  detail,
  value,
  onValueChange,
  glow = false,
}: {
  icon: ComponentProps<typeof MaterialSymbol>['name'];
  label: string;
  detail: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  glow?: boolean;
}) {
  return (
    <View style={[styles.toggleRow, glow && value ? FR_PURPLE_GLOW_STYLE : null]}>
      <View style={styles.toggleCopy}>
        <View style={styles.toggleIcon}>
          <MaterialSymbol name={icon} size={16} color={FR_ACCENT_LIGHT} filled />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <RNText style={styles.toggleLabel}>{label}</RNText>
          <RNText style={styles.toggleDetail}>{detail}</RNText>
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: 'rgba(255,255,255,0.16)', true: 'rgba(124,77,255,0.38)' }}
        thumbColor={value ? FR_ACCENT_LIGHT : '#B1A5C9'}
      />
    </View>
  );
}

function ModerationRoleRow({
  profile,
  role,
  actions,
  canRemove,
  onRemove,
}: {
  profile: UserProfile;
  role: ModeratorRole;
  actions?: number;
  canRemove?: boolean;
  onRemove?: () => void;
}) {
  return (
    <View style={styles.moderatorRow}>
      <View style={styles.moderatorIdentity}>
        <Avatar name={profile.displayName} uri={profile.avatarUrl} />
        <View style={{ flex: 1, gap: 4 }}>
          <View style={styles.rowWrap}>
            <RNText style={styles.moderatorName}>{profile.displayName}</RNText>
            <HumanVerifiedBadge tier={getModeratorBadge(role)} showLabel={false} />
          </View>
          <RNText style={styles.moderatorMeta}>
            {getRoleLabel(role)}
            {actions != null ? ` · ${actions} actions` : ''} · @{profile.username}
          </RNText>
        </View>
      </View>
      {canRemove ? (
        <Pressable onPress={onRemove} style={styles.mutedPill}>
          <RNText style={styles.mutedPillText}>Remove</RNText>
        </Pressable>
      ) : null}
    </View>
  );
}

export function ForumsCommunityHealthScreen() {
  const params = useLocalSearchParams<{ communityId?: string }>();
  const {
    currentProfile,
    communityHealth,
    findCommunity,
    findProfile,
    membersForCommunity,
    profiles,
    rulesForCommunity,
    threadsForCommunity,
  } = useForumsData();
  const [range, setRange] = useState<HealthRange>('30d');
  const [revision, setRevision] = useState(0);

  const community = findCommunity(getParamValue(params.communityId));
  const members = membersForCommunity(community.id);
  const health = communityHealth.find((item) => item.communityId === community.id) ?? communityHealth[0];
  const storedState = useMemo(
    () =>
      ensureCommunityState({
        community,
        currentProfile,
        members,
        profiles,
        health,
        rules: rulesForCommunity(community.id),
      }),
    [community, currentProfile, members, profiles, health, revision, rulesForCommunity],
  );
  const role = getCommunityRole(community, currentProfile, members);
  const canModerate = role !== 'member';
  const threads = threadsForCommunity(community.id);
  const modActions = useMemo(
    () =>
      ensureModActions({
        community,
        moderators: storedState.moderators,
        profiles,
        threadTitles: threads.map((thread) => thread.title),
      }),
    [community, profiles, revision, storedState.moderators, threads],
  );
  const pendingFlags = storedState.flaggedQueue.filter((item) => item.status === 'pending');
  const score = computeHealthScore(health);
  const status = getHealthStatus(score);
  const metrics = buildEngagementMetrics({
    community,
    health,
    threadsCreated: threads.length,
    averageReplies:
      threads.length === 0
        ? 0
        : threads.reduce((sum, thread) => sum + thread.replyCount, 0) / threads.length,
    range,
  });
  const trustDistribution = buildTrustDistribution(
    health,
    storedState.moderators.length,
  );
  const heatmap = buildHeatmap(community.id, range);
  const topModerators = buildTopModerators({
    actions: modActions,
    moderators: storedState.moderators,
  });

  const resolveFlag = (flagId: string, statusValue: FlaggedContentItem['status']) => {
    const nextState = cloneCommunityState(storedState);
    nextState.flaggedQueue = nextState.flaggedQueue.map((item) =>
      item.id === flagId ? { ...item, status: statusValue } : item,
    );
    COMMUNITY_STATE.set(community.id, nextState);
    setRevision((value) => value + 1);
  };

  return (
    <PhaseScreen eyebrow="COMMUNITY OPS" title="Community Health">
      <LinearGradient
        colors={['rgba(124,77,255,0.32)', 'rgba(167,139,250,0.12)', 'rgba(12,14,20,0.96)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroPanel}
      >
        <View style={styles.heroMetaRow}>
          <View style={styles.heroPill}>
            <MaterialSymbol name="shield" size={14} color={FR_ACCENT_LIGHT} filled />
            <RNText style={styles.heroPillLabel}>
              {community.humansOnly ? 'Humans Only' : 'Open Access'}
            </RNText>
          </View>
          <View style={[styles.statusPill, { backgroundColor: `${status.color}22` }]}>
            <RNText style={[styles.statusLabel, { color: status.color }]}>
              {status.label}
            </RNText>
          </View>
        </View>
        <View style={styles.heroSplit}>
          <View style={{ flex: 1, gap: 10 }}>
            <RNText style={styles.heroEyebrow}>{community.displayName}</RNText>
            <RNText style={styles.heroHeadline}>Trust signal over raw volume.</RNText>
            <RNText style={styles.heroDescription}>
              Verified-human share, reply quality, and moderation load for the last {range}.
            </RNText>
            <View style={styles.rowWrap}>
              {HEALTH_RANGES.map((option) => (
                <ActionChip
                  key={option}
                  label={option}
                  active={option === range}
                  glow
                  onPress={() => setRange(option)}
                />
              ))}
            </View>
          </View>
          <ScoreRing score={score} />
        </View>
      </LinearGradient>

      <View style={styles.sectionStack}>
        <SectionHeader title="Engagement Metrics" action={<SectionActionLabel label={`Range ${range}`} />} />
        <View style={styles.metricGrid}>
          {metrics.map((metric) => (
            <GlassCard key={metric.id} style={styles.metricCard}>
              <View style={styles.metricHeader}>
                <RNText style={styles.metricLabel}>{metric.label}</RNText>
                <RNText
                  style={[
                    styles.metricDelta,
                    { color: metric.delta >= 0 ? FR_SUCCESS : FR_DANGER },
                  ]}
                >
                  {metric.delta >= 0 ? '+' : ''}
                  {metric.delta}%
                </RNText>
              </View>
              <RNText style={styles.metricValue}>{metric.value}</RNText>
              <MetricSparkline
                values={metric.series}
                color={metric.delta >= 0 ? FR_ACCENT_LIGHT : FR_PINNED}
              />
            </GlassCard>
          ))}
        </View>
      </View>

      <GlassCard style={styles.sectionCard}>
        <SectionHeader
          title="Trust Score Distribution"
          action={<SectionActionLabel label={`${health.verifiedHumanPercent}% verified`} />}
        />
        <RNText style={styles.sectionDescription}>
          Verified humans are holding the center. The amber overlay shows where bot-like activity clusters.
        </RNText>
        <TrustDistributionChart bars={trustDistribution} />
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <SectionHeader
          title="Bot Detection Heatmap"
          action={<SectionActionLabel label="7 days × 24 hours" />}
        />
        <RNText style={styles.sectionDescription}>
          Tap a cell to inspect the hour with the highest bot-likelihood pattern.
        </RNText>
        <HeatmapGrid
          grid={heatmap}
          onPressCell={(dayIndex, hourIndex, intensity) => {
            Alert.alert(
              'Heatmap detail',
              `Day ${dayIndex + 1}, ${String(hourIndex).padStart(2, '0')}:00.\nEstimated bot intensity: ${Math.round(intensity * 100)}%.`,
            );
          }}
        />
      </GlassCard>

      {canModerate ? (
        <GlassCard style={styles.sectionCard}>
          <SectionHeader
            title="Flagged Content Queue"
            action={<SectionActionLabel label={`${pendingFlags.length} pending`} />}
          />
          <View style={styles.queueStack}>
            {pendingFlags.map((item) => (
              <View key={item.id} style={styles.queueItem}>
                <View style={styles.queueMeta}>
                  <View style={[styles.statusPill, { backgroundColor: `${getSeverityTone(item.severity)}22` }]}>
                    <RNText style={[styles.statusLabel, { color: getSeverityTone(item.severity) }]}>
                      {item.severity}
                    </RNText>
                  </View>
                  <RNText style={styles.queueReports}>{item.reportCount} reports</RNText>
                </View>
                <RNText style={styles.queueSnippet}>{item.snippet}</RNText>
                <RNText style={styles.queueReason}>{item.reason}</RNText>
                <View style={styles.rowWrap}>
                  <Pressable
                    onPress={() => resolveFlag(item.id, 'dismissed')}
                    style={styles.mutedPill}
                  >
                    <RNText style={styles.mutedPillText}>Dismiss</RNText>
                  </Pressable>
                  <Pressable
                    onPress={() => resolveFlag(item.id, 'resolved')}
                    style={styles.primaryPill}
                  >
                    <RNText style={styles.primaryPillText}>Resolve</RNText>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        </GlassCard>
      ) : null}

      {canModerate ? (
        <GlassCard style={styles.sectionCard}>
          <SectionHeader
            title="Auto-Moderation Stats"
            action={<SectionActionLabel label={`${storedState.automod.rulesActive} active rules`} />}
          />
          <View style={styles.metricGrid}>
            <GlassCard style={styles.metricCard}>
              <RNText style={styles.metricLabel}>Spam Removed</RNText>
              <RNText style={styles.metricValue}>{storedState.automod.spamRemoved}</RNText>
            </GlassCard>
            <GlassCard style={styles.metricCard}>
              <RNText style={styles.metricLabel}>Bots Banned</RNText>
              <RNText style={styles.metricValue}>{storedState.automod.botsBanned}</RNText>
            </GlassCard>
            <GlassCard style={styles.metricCard}>
              <RNText style={styles.metricLabel}>Posts Flagged</RNText>
              <RNText style={styles.metricValue}>{storedState.automod.postsFlagged}</RNText>
            </GlassCard>
            <GlassCard style={styles.metricCard}>
              <RNText style={styles.metricLabel}>Rules Paused</RNText>
              <RNText style={styles.metricValue}>{storedState.automod.rulesPaused}</RNText>
            </GlassCard>
          </View>
          <View style={styles.overrideStack}>
            {storedState.automod.overrideLog.map((item) => (
              <View key={item.id} style={styles.overrideRow}>
                <MaterialSymbol name="gavel" size={16} color={FR_ACCENT_LIGHT} />
                <View style={{ flex: 1, gap: 2 }}>
                  <RNText style={styles.overrideLabel}>{item.label}</RNText>
                  <RNText style={styles.overrideMeta}>{formatRelativeTime(item.createdAt)}</RNText>
                </View>
              </View>
            ))}
          </View>
        </GlassCard>
      ) : null}

      <GlassCard style={styles.sectionCard}>
        <SectionHeader title="Top Moderators" action={<SectionActionLabel label="Last 30d" />} />
        <View style={styles.moderatorStack}>
          {topModerators.map((moderator) => {
            const profile = findProfile(moderator.profileId);
            return (
              <ModerationRoleRow
                key={moderator.profileId}
                profile={profile}
                role={moderator.role}
                actions={moderator.actions}
              />
            );
          })}
        </View>
      </GlassCard>
    </PhaseScreen>
  );
}

export function ForumsModLogScreen() {
  const params = useLocalSearchParams<{ communityId?: string }>();
  const {
    currentProfile,
    findCommunity,
    findProfile,
    membersForCommunity,
    profiles,
    threadsForCommunity,
  } = useForumsData();
  const [filter, setFilter] = useState<ModFilter>('All');
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(50);
  const [revision, setRevision] = useState(0);

  const community = findCommunity(getParamValue(params.communityId));
  const members = membersForCommunity(community.id);
  const role = getCommunityRole(community, currentProfile, members);
  const canModerate = role !== 'member';
  const communityState = useMemo(
    () =>
      ensureCommunityState({
        community,
        currentProfile,
        members,
        profiles,
        health: {
          communityId: community.id,
          verifiedHumanPercent: 92,
          avgResponseTimeMinutes: 18,
          modActionsLast30Days: 12,
          signalToNoiseScore: 8.9,
          memberCount: Math.max(community.memberCount, 1),
          activePostersLast7Days: Math.max(12, Math.round(community.memberCount * 0.12)),
          computedAt: new Date().toISOString(),
        },
        rules: [],
      }),
    [community, currentProfile, members, profiles, revision],
  );
  const actions = useMemo(
    () =>
      ensureModActions({
        community,
        moderators: communityState.moderators,
        profiles,
        threadTitles: threadsForCommunity(community.id).map((thread) => thread.title),
      }),
    [community, communityState.moderators, profiles, revision, threadsForCommunity],
  );

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return actions
      .filter((action) => matchesFilter(action, filter))
      .filter((action) => {
        if (normalized.length === 0) return true;
        const moderator = findProfile(action.moderatorProfileId);
        return `${moderator.displayName} ${moderator.username} ${action.targetLabel} ${action.reason}`
          .toLowerCase()
          .includes(normalized);
      })
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      );
  }, [actions, filter, findProfile, query]);

  const visible = filtered.slice(0, visibleCount);

  const undoAction = (actionId: string) => {
    const nextActions = actions.map((action) =>
      action.id === actionId ? { ...action, undone: true, reversible: false } : action,
    );
    MOD_ACTIONS.set(community.id, nextActions);
    setRevision((value) => value + 1);
  };

  if (!canModerate) {
    return (
      <PhaseScreen eyebrow="COMMUNITY OPS" title="Moderation Log">
        <GlassCard style={styles.sectionCard}>
          <RNText style={styles.restrictedTitle}>Moderator access required</RNText>
          <RNText style={styles.sectionDescription}>
            This log is intentionally private to moderators and owners for the selected community.
          </RNText>
        </GlassCard>
      </PhaseScreen>
    );
  }

  return (
    <PhaseScreen eyebrow="COMMUNITY OPS" title="Moderation Log">
      <LinearGradient
        colors={['rgba(124,77,255,0.24)', 'rgba(124,77,255,0.08)', 'rgba(12,14,20,0.96)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroPanel}
      >
        <RNText style={styles.heroEyebrow}>{community.displayName}</RNText>
        <RNText style={styles.heroHeadline}>Chronological review of every moderation action.</RNText>
        <RNText style={styles.heroDescription}>
          Search by moderator or target. Filters keep the queue readable even when auto-actions spike.
        </RNText>
      </LinearGradient>

      <GlassCard style={styles.sectionCard}>
        <SearchBar
          value={query}
          onChange={(value) => {
            setQuery(value);
            setVisibleCount(50);
          }}
          placeholder="Search moderators or target content"
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRail}>
          {MOD_FILTERS.map((option) => (
            <ActionChip
              key={option}
              label={option}
              active={option === filter}
              glow={option === 'Auto-Actions'}
              onPress={() => {
                setFilter(option);
                setVisibleCount(50);
              }}
            />
          ))}
        </ScrollView>
      </GlassCard>

      <View style={styles.sectionStack}>
        {visible.map((action) => {
          const moderator = findProfile(action.moderatorProfileId);
          const recent =
            Date.now() - new Date(action.createdAt).getTime() < 1000 * 60 * 60 * 48;

          return (
            <GlassCard key={action.id} style={styles.logCard}>
              <View style={styles.logHeader}>
                <View style={styles.logIdentity}>
                  <Avatar name={moderator.displayName} uri={moderator.avatarUrl} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={styles.rowWrap}>
                      <RNText style={styles.moderatorName}>{moderator.displayName}</RNText>
                      <HumanVerifiedBadge
                        tier={getModeratorBadge(
                          communityState.moderators.find((item) => item.profileId === moderator.id)?.role ?? 'moderator',
                        )}
                        showLabel={false}
                      />
                    </View>
                    <RNText style={styles.overrideMeta}>@{moderator.username}</RNText>
                  </View>
                </View>
                <View style={[styles.statusPill, { backgroundColor: `${getActionTone(action)}22` }]}>
                  <RNText style={[styles.statusLabel, { color: getActionTone(action) }]}>
                    {action.auto ? 'Auto' : action.actionType}
                  </RNText>
                </View>
              </View>
              <RNText style={styles.logVerb}>{getActionCopy(action)}</RNText>
              <RNText style={styles.queueSnippet}>{action.targetLabel}</RNText>
              <RNText style={styles.queueReason}>{action.reason}</RNText>
              <View style={styles.logFooter}>
                <RNText style={styles.overrideMeta}>{formatRelativeTime(action.createdAt)}</RNText>
                {action.undone ? (
                  <RNText style={[styles.overrideMeta, { color: FR_SUCCESS }]}>Undone</RNText>
                ) : action.reversible && recent ? (
                  <Pressable
                    onPress={() => {
                      Alert.alert(
                        'Undo action?',
                        'This will mark the action as reversed in the local moderation timeline.',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Undo', onPress: () => undoAction(action.id) },
                        ],
                      );
                    }}
                    style={styles.mutedPill}
                  >
                    <RNText style={styles.mutedPillText}>Undo</RNText>
                  </Pressable>
                ) : null}
              </View>
            </GlassCard>
          );
        })}
      </View>

      {visibleCount < filtered.length ? (
        <Pressable
          onPress={() => setVisibleCount((count) => count + 50)}
          style={styles.loadMoreButton}
        >
          <RNText style={styles.loadMoreText}>
            Load {Math.min(50, filtered.length - visibleCount)} more actions
          </RNText>
        </Pressable>
      ) : null}
    </PhaseScreen>
  );
}

export function ForumsCommunitySettingsScreen() {
  const params = useLocalSearchParams<{ communityId?: string }>();
  const {
    currentProfile,
    findCommunity,
    findProfile,
    membersForCommunity,
    profiles,
    communityHealth,
    rulesForCommunity,
  } = useForumsData();
  const [revision, setRevision] = useState(0);
  const [moderatorSearch, setModeratorSearch] = useState('');

  const community = findCommunity(getParamValue(params.communityId));
  const members = membersForCommunity(community.id);
  const health = communityHealth.find((item) => item.communityId === community.id) ?? communityHealth[0];
  const role = getCommunityRole(community, currentProfile, members);
  const canModerate = role !== 'member';
  const isOwner = role === 'owner';
  const stored = useMemo(
    () =>
      ensureCommunityState({
        community,
        currentProfile,
        members,
        profiles,
        health,
        rules: rulesForCommunity(community.id),
      }),
    [community, currentProfile, members, profiles, health, revision, rulesForCommunity],
  );
  const [draft, setDraft] = useState(() => cloneCommunityState(stored));

  const candidateProfiles = profiles.filter((profile) => {
    if (profile.id === currentProfile.id) return false;
    if (draft.moderators.some((item) => item.profileId === profile.id)) return false;
    const query = moderatorSearch.trim().toLowerCase();
    if (query.length === 0) return true;
    return `${profile.displayName} ${profile.username}`.toLowerCase().includes(query);
  });

  const persistDraft = () => {
    COMMUNITY_STATE.set(community.id, cloneCommunityState(draft));
    setRevision((value) => value + 1);
    Alert.alert('Settings saved', 'Community settings were updated in the local moderation workspace.');
  };

  return (
    <PhaseScreen
      eyebrow="COMMUNITY OPS"
      title="Community Settings"
      action={
        <Pressable onPress={persistDraft} style={styles.primaryPill}>
          <RNText style={styles.primaryPillText}>Save</RNText>
        </Pressable>
      }
    >
      <LinearGradient
        colors={['rgba(124,77,255,0.22)', 'rgba(255,255,255,0.04)', 'rgba(12,14,20,0.96)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroPanel}
      >
        <RNText style={styles.heroEyebrow}>{community.displayName}</RNText>
        <RNText style={styles.heroHeadline}>Moderation controls tuned for signal, not friction.</RNText>
        <RNText style={styles.heroDescription}>
          {getRoleLabel(role)} access · grouped configuration for basics, trust, rules, moderators, and safety rails.
        </RNText>
      </LinearGradient>

      <GlassCard style={styles.sectionCard}>
        <SectionHeader title="Basics" action={<SectionActionLabel label="Name, cover, identity" />} />
        <CoverArtwork
          title={draft.displayName}
          subtitle={draft.tagline}
          uri={draft.coverUri}
          height={140}
        />
        <View style={styles.rowWrap}>
          <Pressable
            style={styles.mutedPill}
            onPress={async () => {
              const uri = await pickImageFromLibrary([16, 9]);
              if (!uri) return;
              setDraft((current) => ({ ...current, coverUri: uri }));
            }}
          >
            <RNText style={styles.mutedPillText}>Upload Cover</RNText>
          </Pressable>
          <Pressable
            style={styles.mutedPill}
            onPress={async () => {
              const uri = await pickImageFromLibrary([1, 1]);
              if (!uri) return;
              setDraft((current) => ({ ...current, iconUri: uri }));
            }}
          >
            <RNText style={styles.mutedPillText}>Upload Icon</RNText>
          </Pressable>
        </View>
        <InputLabel label="Name" />
        <TextInput
          value={draft.displayName}
          onChangeText={(value) => setDraft((current) => ({ ...current, displayName: value }))}
          style={styles.input}
          placeholderTextColor={FR_TEXT_MUTED}
        />
        <InputLabel label="Slug" />
        <TextInput
          value={community.name}
          editable={false}
          style={[styles.input, styles.readOnlyInput]}
          placeholderTextColor={FR_TEXT_MUTED}
        />
        <InputLabel label="Tagline" />
        <TextInput
          value={draft.tagline}
          onChangeText={(value) => setDraft((current) => ({ ...current, tagline: value }))}
          style={styles.input}
          placeholder="Short community promise"
          placeholderTextColor={FR_TEXT_MUTED}
        />
        <InputLabel label="Description" />
        <TextInput
          value={draft.description}
          onChangeText={(value) => setDraft((current) => ({ ...current, description: value }))}
          multiline
          style={[styles.input, styles.largeInput]}
          placeholder="Markdown-friendly community description"
          placeholderTextColor={FR_TEXT_MUTED}
        />
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <SectionHeader title="Type" action={<SectionActionLabel label="Access and trust" />} />
        <View style={styles.rowWrap}>
          {COMMUNITY_TYPE_OPTIONS.map((option) => (
            <ActionChip
              key={option}
              label={option}
              active={draft.communityType === option}
              onPress={() =>
                setDraft((current) => ({ ...current, communityType: option }))
              }
            />
          ))}
        </View>
        <ToggleRow
          icon="shield"
          label="Humans Only"
          detail="Require verified-human trust to read and post."
          value={draft.humansOnly}
          glow
          onValueChange={(value) =>
            setDraft((current) => ({ ...current, humansOnly: value }))
          }
        />
        <InputLabel label="Trust Tier Requirement" />
        <View style={styles.rowWrap}>
          {TRUST_TIER_OPTIONS.map((option) => (
            <ActionChip
              key={option}
              label={option.replace('_', ' ')}
              active={draft.trustRequirement === option}
              glow={option !== 'new'}
              onPress={() =>
                setDraft((current) => ({ ...current, trustRequirement: option }))
              }
            />
          ))}
        </View>
        <ToggleRow
          icon="flag"
          label="NSFW Content"
          detail="Gate sensitive content behind an explicit opt-in."
          value={draft.nsfwEnabled}
          onValueChange={(value) =>
            setDraft((current) => ({ ...current, nsfwEnabled: value }))
          }
        />
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <SectionHeader
          title="Rules"
          action={
            <Pressable
              onPress={() =>
                setDraft((current) => ({
                  ...current,
                  rules: [
                    ...current.rules,
                    {
                      id: makeId('forum-rule'),
                      title: 'New rule',
                      description: 'Describe the norm you want members to follow.',
                    },
                  ],
                }))
              }
            >
              <SectionActionLabel label="+ Add Rule" />
            </Pressable>
          }
        />
        <View style={styles.rulesStack}>
          {draft.rules.map((rule, index) => (
            <GlassCard key={rule.id} style={styles.ruleCard}>
              <InputLabel label={`Rule ${index + 1}`} />
              <TextInput
                value={rule.title}
                onChangeText={(value) =>
                  setDraft((current) => ({
                    ...current,
                    rules: current.rules.map((item) =>
                      item.id === rule.id ? { ...item, title: value } : item,
                    ),
                  }))
                }
                style={styles.input}
                placeholder="Rule title"
                placeholderTextColor={FR_TEXT_MUTED}
              />
              <TextInput
                value={rule.description}
                onChangeText={(value) =>
                  setDraft((current) => ({
                    ...current,
                    rules: current.rules.map((item) =>
                      item.id === rule.id ? { ...item, description: value } : item,
                    ),
                  }))
                }
                multiline
                style={[styles.input, styles.mediumInput]}
                placeholder="Why the rule exists"
                placeholderTextColor={FR_TEXT_MUTED}
              />
              <View style={styles.rowWrap}>
                <Pressable
                  style={styles.mutedPill}
                  onPress={() => {
                    if (index === 0) return;
                    setDraft((current) => {
                      const next = [...current.rules];
                      const swap = next[index - 1];
                      next[index - 1] = next[index]!;
                      next[index] = swap!;
                      return { ...current, rules: next };
                    });
                  }}
                >
                  <RNText style={styles.mutedPillText}>Move Up</RNText>
                </Pressable>
                <Pressable
                  style={styles.mutedPill}
                  onPress={() => {
                    if (index === draft.rules.length - 1) return;
                    setDraft((current) => {
                      const next = [...current.rules];
                      const swap = next[index + 1];
                      next[index + 1] = next[index]!;
                      next[index] = swap!;
                      return { ...current, rules: next };
                    });
                  }}
                >
                  <RNText style={styles.mutedPillText}>Move Down</RNText>
                </Pressable>
                <Pressable
                  style={styles.dangerPill}
                  onPress={() => {
                    Alert.alert('Delete rule?', 'This removes the rule from the visible list.', [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () =>
                          setDraft((current) => ({
                            ...current,
                            rules: current.rules.filter((item) => item.id !== rule.id),
                          })),
                      },
                    ]);
                  }}
                >
                  <RNText style={styles.dangerPillText}>Delete</RNText>
                </Pressable>
              </View>
            </GlassCard>
          ))}
        </View>
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <SectionHeader title="Moderators" action={<SectionActionLabel label={getRoleLabel(role)} />} />
        <View style={styles.moderatorStack}>
          {draft.moderators.map((moderator) => {
            const profile = findProfile(moderator.profileId);
            return (
              <ModerationRoleRow
                key={moderator.profileId}
                profile={profile}
                role={moderator.role}
                canRemove={isOwner && moderator.role !== 'owner'}
                onRemove={() => {
                  Alert.alert('Remove moderator?', `Remove ${profile.displayName} from the moderator team?`, [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Remove',
                      style: 'destructive',
                      onPress: () =>
                        setDraft((current) => ({
                          ...current,
                          moderators: current.moderators.filter(
                            (item) => item.profileId !== moderator.profileId,
                          ),
                        })),
                    },
                  ]);
                }}
              />
            );
          })}
        </View>

        {isOwner ? (
          <>
            <InputLabel label="Add Moderator" />
            <TextInput
              value={moderatorSearch}
              onChangeText={setModeratorSearch}
              style={styles.input}
              placeholder="Search users to add"
              placeholderTextColor={FR_TEXT_MUTED}
            />
            <View style={styles.searchResultsStack}>
              {candidateProfiles.slice(0, 3).map((profile) => (
                <Pressable
                  key={profile.id}
                  style={styles.searchResultRow}
                  onPress={() => {
                    setDraft((current) => ({
                      ...current,
                      moderators: [
                        ...current.moderators,
                        { profileId: profile.id, role: 'moderator' },
                      ],
                    }));
                    setModeratorSearch('');
                  }}
                >
                  <View style={styles.logIdentity}>
                    <Avatar name={profile.displayName} uri={profile.avatarUrl} />
                    <View style={{ gap: 2 }}>
                      <RNText style={styles.moderatorName}>{profile.displayName}</RNText>
                      <RNText style={styles.overrideMeta}>@{profile.username}</RNText>
                    </View>
                  </View>
                  <RNText style={styles.sectionAction}>Add</RNText>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <SectionHeader title="Auto-Moderation" action={<SectionActionLabel label="Write-path protection" />} />
        <InputLabel label="Spam Filter Level" />
        <View style={styles.rowWrap}>
          {SPAM_FILTER_LEVELS.map((option) => (
            <ActionChip
              key={option}
              label={option}
              active={draft.spamFilterLevel === option}
              onPress={() =>
                setDraft((current) => ({ ...current, spamFilterLevel: option }))
              }
            />
          ))}
        </View>
        <ToggleRow
          icon="block"
          label="Auto-ban repeat offenders"
          detail="Escalate repeated spam or harassment detections automatically."
          value={draft.autoBanRepeatOffenders}
          onValueChange={(value) =>
            setDraft((current) => ({ ...current, autoBanRepeatOffenders: value }))
          }
        />
        <InputLabel label="Minimum Trust Tier To Post" />
        <View style={styles.rowWrap}>
          {TRUST_TIER_OPTIONS.map((option) => (
            <ActionChip
              key={option}
              label={option.replace('_', ' ')}
              active={draft.minTrustToPost === option}
              glow={option !== 'new'}
              onPress={() =>
                setDraft((current) => ({ ...current, minTrustToPost: option }))
              }
            />
          ))}
        </View>
      </GlassCard>

      {canModerate ? (
        <GlassCard style={[styles.sectionCard, styles.dangerCard]}>
          <SectionHeader title="Danger Zone" action={<SectionActionLabel label={isOwner ? 'Owner only' : 'Read only'} />} />
          <View style={styles.queueItem}>
            <RNText style={styles.queueSnippet}>Archive community</RNText>
            <RNText style={styles.queueReason}>
              Freeze posting and keep the archive visible in read-only mode.
            </RNText>
            <Pressable
              style={styles.dangerPill}
              onPress={() => {
                if (!isOwner) {
                  Alert.alert('Owner only', 'Only the owner can archive this community.');
                  return;
                }
                Alert.alert('Archive community?', 'Posting will be disabled until the archive is reversed.', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: draft.archived ? 'Unarchive' : 'Archive',
                    onPress: () =>
                      setDraft((current) => ({
                        ...current,
                        archived: !current.archived,
                      })),
                  },
                ]);
              }}
            >
              <RNText style={styles.dangerPillText}>
                {draft.archived ? 'Unarchive' : 'Archive'}
              </RNText>
            </Pressable>
          </View>

          {isOwner ? (
            <View style={styles.queueItem}>
              <RNText style={styles.queueSnippet}>Delete community</RNText>
              <RNText style={styles.queueReason}>
                Type <RNText style={styles.inlineStrong}>{community.name}</RNText> to confirm deletion queueing.
              </RNText>
              <TextInput
                value={draft.deleteConfirmText}
                onChangeText={(value) =>
                  setDraft((current) => ({ ...current, deleteConfirmText: value }))
                }
                style={styles.input}
                placeholderTextColor={FR_TEXT_MUTED}
                placeholder={`Type ${community.name}`}
              />
              <Pressable
                style={styles.dangerPill}
                onPress={() => {
                  if (draft.deleteConfirmText.trim() !== community.name) {
                    Alert.alert(
                      'Confirmation mismatch',
                      `Type the exact slug "${community.name}" before queueing deletion.`,
                    );
                    return;
                  }
                  Alert.alert(
                    'Delete community?',
                    `This demo keeps the record local. To queue deletion, confirm the slug "${community.name}".`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Queue Delete',
                        style: 'destructive',
                        onPress: () =>
                          setDraft((current) => ({
                            ...current,
                            deleteConfirmText: community.name,
                            deleteQueued: true,
                          })),
                      },
                    ],
                  );
                }}
              >
                <RNText style={styles.dangerPillText}>
                  {draft.deleteQueued ? 'Deletion Queued' : 'Queue Delete'}
                </RNText>
              </Pressable>
            </View>
          ) : null}
        </GlassCard>
      ) : null}
    </PhaseScreen>
  );
}

export function ForumsEditProfileScreen() {
  const { currentProfile, saveProfile } = useForumsData();
  const [revision, setRevision] = useState(0);
  const stored = useMemo(
    () => ensureProfileState(currentProfile),
    [currentProfile, revision],
  );

  const [draft, setDraft] = useState(() => ({
    displayName: currentProfile.displayName,
    username: currentProfile.username,
    bio: currentProfile.bio,
    location: currentProfile.location,
    avatarUri: stored.avatarUri ?? currentProfile.avatarUrl,
    bannerUri: stored.bannerUri ?? currentProfile.bannerUrl,
    socialLinks: stored.socialLinks.map((link) => ({ ...link })),
    showActivity: stored.showActivity,
    messageAccess: stored.messageAccess,
    showTrustTier: stored.showTrustTier,
    verificationRequested: stored.verificationRequested,
    linkedIdentities: [...stored.linkedIdentities],
    email: stored.email,
    twoFactorEnabled: stored.twoFactorEnabled,
  }));

  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    JSON.stringify(draft),
  );

  const dirty = JSON.stringify(draft) !== savedSnapshot;
  const trustTier = currentProfile.isVerified
    ? getProfileTrustTier(currentProfile)
    : draft.verificationRequested
      ? 'trusted'
      : 'new';

  const onSave = () => {
    const trimmedDisplayName = draft.displayName.trim() || currentProfile.displayName;
    const trimmedBio = draft.bio.trim().slice(0, 280);
    const trimmedLocation = draft.location.trim();
    const websiteUrl = getWebsiteFromLinks(draft.socialLinks).trim();

    saveProfile({
      displayName: trimmedDisplayName,
      bio: trimmedBio,
      location: trimmedLocation,
      websiteUrl,
    });

    PROFILE_STATE.set(currentProfile.id, {
      avatarUri: draft.avatarUri,
      bannerUri: draft.bannerUri,
      socialLinks: draft.socialLinks.map((link) => ({ ...link })),
      showActivity: draft.showActivity,
      messageAccess: draft.messageAccess,
      showTrustTier: draft.showTrustTier,
      verificationRequested: draft.verificationRequested,
      linkedIdentities: [...draft.linkedIdentities],
      email: draft.email,
      twoFactorEnabled: draft.twoFactorEnabled,
    });
    setSavedSnapshot(JSON.stringify(draft));
    setRevision((value) => value + 1);
    Alert.alert('Profile saved', 'Your forum profile details were saved for the next sync pass.');
  };

  return (
    <PhaseScreen
      eyebrow="IDENTITY"
      title="Edit Profile"
      action={
        <Pressable
          disabled={!dirty}
          onPress={onSave}
          style={[styles.primaryPill, !dirty && styles.disabledPill]}
        >
          <RNText style={styles.primaryPillText}>Save</RNText>
        </Pressable>
      }
    >
      <View style={styles.profileHero}>
        <CoverArtwork
          title={draft.displayName}
          subtitle="Profile banner"
          uri={draft.bannerUri}
        />
        <View style={styles.profileHeroOverlay}>
          <Pressable
            style={[styles.iconOverlayButton, styles.coverButton]}
            onPress={async () => {
              const uri = await pickImageFromLibrary([16, 9]);
              if (!uri) return;
              setDraft((current) => ({ ...current, bannerUri: uri }));
            }}
          >
            <MaterialSymbol name="photo_camera" size={16} color={FR_TEXT} />
          </Pressable>
          <View style={styles.profileAvatarWrap}>
            <Avatar name={draft.displayName} uri={draft.avatarUri} size={96} />
            <Pressable
              style={styles.iconOverlayButton}
              onPress={async () => {
                const uri = await pickImageFromLibrary([1, 1]);
                if (!uri) return;
                setDraft((current) => ({ ...current, avatarUri: uri }));
              }}
            >
              <MaterialSymbol name="photo_camera" size={16} color={FR_TEXT} />
            </Pressable>
          </View>
        </View>
      </View>

      <GlassCard style={styles.sectionCard}>
        <SectionHeader title="Basics" action={<SectionActionLabel label={`${draft.bio.length}/280`} />} />
        <InputLabel label="Display Name" />
        <TextInput
          value={draft.displayName}
          onChangeText={(value) => setDraft((current) => ({ ...current, displayName: value }))}
          style={styles.input}
          placeholder="Display name"
          placeholderTextColor={FR_TEXT_MUTED}
        />
        <InputLabel label="Username" />
        <TextInput
          value={`@${draft.username}`}
          editable={false}
          style={[styles.input, styles.readOnlyInput]}
          placeholderTextColor={FR_TEXT_MUTED}
        />
        <RNText style={styles.helperText}>Username changes stay in the secure account flow.</RNText>
        <InputLabel label="Bio" />
        <TextInput
          value={draft.bio}
          onChangeText={(value) =>
            setDraft((current) => ({ ...current, bio: value.slice(0, 280) }))
          }
          multiline
          style={[styles.input, styles.largeInput]}
          placeholder="Tell people what you care about and what you moderate."
          placeholderTextColor={FR_TEXT_MUTED}
        />
        <InputLabel label="Location" />
        <TextInput
          value={draft.location}
          onChangeText={(value) => setDraft((current) => ({ ...current, location: value }))}
          style={styles.input}
          placeholder="City, region, or remote"
          placeholderTextColor={FR_TEXT_MUTED}
        />
      </GlassCard>

      <GlassCard style={[styles.sectionCard, styles.highlightCard]} glow>
        <SectionHeader title="Trust Verification" action={<SectionActionLabel label={trustTier.replace('_', ' ')} />} />
        <View style={styles.rowWrap}>
          <HumanVerifiedBadge tier={trustTier} />
          <RNText style={styles.sectionDescription}>
            Show that a real human is behind the account and keep access to humans-only communities.
          </RNText>
        </View>
        {currentProfile.isVerified ? (
          <View style={styles.legendPill}>
            <View style={[styles.legendDot, { backgroundColor: FR_SUCCESS }]} />
            <RNText style={styles.legendText}>Verification healthy. You keep full access.</RNText>
          </View>
        ) : (
          <Pressable
            style={styles.primaryPill}
            onPress={() => {
              setDraft((current) => ({ ...current, verificationRequested: true }));
              Alert.alert(
                'Verification started',
                'The trust engine flow was queued for the next native attestation step.',
              );
            }}
          >
            <RNText style={styles.primaryPillText}>Verify as Human</RNText>
          </Pressable>
        )}
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <SectionHeader
          title="Social Links"
          action={
            <Pressable
              onPress={() =>
                setDraft((current) => ({
                  ...current,
                  socialLinks: [
                    ...current.socialLinks,
                    {
                      id: makeId('forum-social'),
                      platform: 'Website',
                      url: '',
                    },
                  ],
                }))
              }
            >
              <SectionActionLabel label="+ Add Link" />
            </Pressable>
          }
        />
        <View style={styles.rulesStack}>
          {draft.socialLinks.map((link) => (
            <GlassCard key={link.id} style={styles.linkCard}>
              <View style={styles.rowWrap}>
                <Pressable
                  onPress={() =>
                    setDraft((current) => ({
                      ...current,
                      socialLinks: current.socialLinks.map((item) =>
                        item.id === link.id
                          ? { ...item, platform: rotatePlatform(item.platform) }
                          : item,
                      ),
                    }))
                  }
                  style={styles.mutedPill}
                >
                  <RNText style={styles.mutedPillText}>{link.platform}</RNText>
                </Pressable>
                <Pressable
                  onPress={() =>
                    setDraft((current) => ({
                      ...current,
                      socialLinks: current.socialLinks.filter((item) => item.id !== link.id),
                    }))
                  }
                  style={styles.dangerPill}
                >
                  <RNText style={styles.dangerPillText}>Remove</RNText>
                </Pressable>
              </View>
              <TextInput
                value={link.url}
                onChangeText={(value) =>
                  setDraft((current) => ({
                    ...current,
                    socialLinks: current.socialLinks.map((item) =>
                      item.id === link.id ? { ...item, url: value } : item,
                    ),
                  }))
                }
                style={styles.input}
                placeholder="https://"
                placeholderTextColor={FR_TEXT_MUTED}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </GlassCard>
          ))}
        </View>
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <SectionHeader title="Privacy" action={<SectionActionLabel label="Audience controls" />} />
        <ToggleRow
          icon="notifications"
          label="Show activity"
          detail="Let others see when you post, reply, and moderate."
          value={draft.showActivity}
          onValueChange={(value) =>
            setDraft((current) => ({ ...current, showActivity: value }))
          }
        />
        <InputLabel label="Allow Messages From" />
        <View style={styles.rowWrap}>
          {MESSAGE_ACCESS_OPTIONS.map((option) => (
            <ActionChip
              key={option}
              label={option}
              active={draft.messageAccess === option}
              glow={option === 'Humans Only'}
              onPress={() =>
                setDraft((current) => ({ ...current, messageAccess: option }))
              }
            />
          ))}
        </View>
        <ToggleRow
          icon="verified_user"
          label="Show trust tier"
          detail="Expose the human-verification badge on your public profile."
          value={draft.showTrustTier}
          onValueChange={(value) =>
            setDraft((current) => ({ ...current, showTrustTier: value }))
          }
          glow
        />
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <SectionHeader title="Account" action={<SectionActionLabel label="Linked identities" />} />
        <View style={styles.rulesStack}>
          {draft.linkedIdentities.map((identity) => (
            <View key={identity} style={styles.identityRow}>
              <MaterialSymbol name="lock" size={16} color={FR_ACCENT_LIGHT} />
              <RNText style={styles.identityText}>{identity}</RNText>
            </View>
          ))}
        </View>
        <InputLabel label="Email" />
        <TextInput
          value={draft.email}
          editable={false}
          style={[styles.input, styles.readOnlyInput]}
          placeholderTextColor={FR_TEXT_MUTED}
        />
        <ToggleRow
          icon="shield"
          label="Two-factor authentication"
          detail="Protect the account and moderation actions with a second factor."
          value={draft.twoFactorEnabled}
          onValueChange={(value) =>
            setDraft((current) => ({ ...current, twoFactorEnabled: value }))
          }
        />
        <View style={styles.rowWrap}>
          <Pressable
            style={styles.mutedPill}
            onPress={() => Alert.alert('Password flow', 'Password changes remain in the secure auth surface.')}
          >
            <RNText style={styles.mutedPillText}>Change Password</RNText>
          </Pressable>
          <Pressable
            style={styles.mutedPill}
            onPress={() => Alert.alert('Email flow', 'Email updates remain in the secure account surface.')}
          >
            <RNText style={styles.mutedPillText}>Manage Email</RNText>
          </Pressable>
        </View>
      </GlassCard>
    </PhaseScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: FR_SURFACES.lowest,
  },
  content: {
    padding: 16,
    paddingBottom: 120,
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  headerEyebrow: {
    ...FR_TYPOGRAPHY.labelUpper,
    color: FR_ACCENT_LIGHT,
  },
  headerTitle: {
    ...FR_TYPOGRAPHY.displayLg,
    color: FR_TEXT,
    fontSize: 30,
    lineHeight: 34,
  },
  heroPanel: {
    padding: 18,
    borderRadius: 28,
    gap: 14,
    shadowColor: '#000000',
    shadowOpacity: 0.26,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
  heroMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  heroSplit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  heroEyebrow: {
    ...FR_TYPOGRAPHY.labelUpper,
    color: FR_ACCENT_LIGHT,
  },
  heroHeadline: {
    ...FR_TYPOGRAPHY.headlineMd,
    color: FR_TEXT,
    fontSize: 24,
    lineHeight: 28,
  },
  heroDescription: {
    ...FR_TYPOGRAPHY.bodyMd,
    color: FR_TEXT_SECONDARY,
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  heroPillLabel: {
    ...FR_TYPOGRAPHY.labelTight,
    color: FR_TEXT,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  statusLabel: {
    ...FR_TYPOGRAPHY.labelTight,
  },
  scoreRingWrap: {
    width: 108,
    height: 108,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreCenter: {
    position: 'absolute',
    alignItems: 'center',
    gap: 2,
  },
  scoreValue: {
    ...FR_TYPOGRAPHY.headlineMd,
    color: FR_TEXT,
    fontSize: 28,
    lineHeight: 32,
  },
  scoreCaption: {
    ...FR_TYPOGRAPHY.labelTight,
    color: FR_TEXT_SECONDARY,
  },
  sectionStack: {
    gap: 12,
  },
  sectionCard: {
    gap: 14,
  },
  sectionDescription: {
    ...FR_TYPOGRAPHY.bodyMd,
    color: FR_TEXT_SECONDARY,
  },
  sectionAction: {
    ...FR_TYPOGRAPHY.labelUpper,
    color: FR_ACCENT_LIGHT,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    width: '47%',
    gap: 10,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  metricLabel: {
    ...FR_TYPOGRAPHY.labelUpper,
    color: FR_TEXT_SECONDARY,
    flex: 1,
  },
  metricDelta: {
    ...FR_TYPOGRAPHY.labelTight,
  },
  metricValue: {
    ...FR_TYPOGRAPHY.headlineMd,
    color: FR_TEXT,
    fontSize: 24,
    lineHeight: 28,
  },
  chartWrap: {
    gap: 12,
  },
  chartLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  chartLegendItem: {
    minWidth: 52,
    gap: 2,
  },
  chartLegendLabel: {
    ...FR_TYPOGRAPHY.labelTight,
    color: FR_TEXT_TERTIARY,
  },
  chartLegendValue: {
    ...FR_TYPOGRAPHY.titleMd,
    color: FR_TEXT,
  },
  histogramLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  legendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  legendText: {
    ...FR_TYPOGRAPHY.bodySm,
    color: FR_TEXT_SECONDARY,
  },
  heatmapContainer: {
    gap: 6,
  },
  heatmapHours: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heatmapLabelSpacer: {
    width: 32,
  },
  heatmapHourLabel: {
    width: 12,
    textAlign: 'center',
    ...FR_TYPOGRAPHY.labelTight,
    color: FR_TEXT_TERTIARY,
  },
  heatmapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heatmapDayLabel: {
    width: 32,
    ...FR_TYPOGRAPHY.labelTight,
    color: FR_TEXT_SECONDARY,
  },
  heatmapCell: {
    width: 12,
    height: 12,
    borderRadius: 4,
  },
  queueStack: {
    gap: 12,
  },
  queueItem: {
    gap: 10,
    padding: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  queueMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  queueReports: {
    ...FR_TYPOGRAPHY.labelTight,
    color: FR_TEXT_TERTIARY,
  },
  queueSnippet: {
    ...FR_TYPOGRAPHY.titleMd,
    color: FR_TEXT,
  },
  queueReason: {
    ...FR_TYPOGRAPHY.bodySm,
    color: FR_TEXT_SECONDARY,
  },
  overrideStack: {
    gap: 10,
  },
  overrideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  overrideLabel: {
    ...FR_TYPOGRAPHY.bodyMd,
    color: FR_TEXT,
  },
  overrideMeta: {
    ...FR_TYPOGRAPHY.bodySm,
    color: FR_TEXT_TERTIARY,
  },
  moderatorStack: {
    gap: 12,
  },
  moderatorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  moderatorIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  moderatorName: {
    ...FR_TYPOGRAPHY.titleMd,
    color: FR_TEXT,
  },
  moderatorMeta: {
    ...FR_TYPOGRAPHY.bodySm,
    color: FR_TEXT_SECONDARY,
  },
  actionChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  actionChipActive: {
    backgroundColor: 'rgba(124,77,255,0.22)',
  },
  actionChipLabel: {
    ...FR_TYPOGRAPHY.labelUpper,
    color: FR_TEXT_SECONDARY,
  },
  actionChipLabelActive: {
    color: FR_TEXT,
  },
  filterRail: {
    gap: 8,
  },
  logCard: {
    gap: 12,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  logIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  logVerb: {
    ...FR_TYPOGRAPHY.labelUpper,
    color: FR_ACCENT_LIGHT,
  },
  logFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  loadMoreButton: {
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  loadMoreText: {
    ...FR_TYPOGRAPHY.labelUpper,
    color: FR_ACCENT_LIGHT,
  },
  inputLabel: {
    ...FR_TYPOGRAPHY.labelUpper,
    color: FR_TEXT_SECONDARY,
  },
  input: {
    ...FR_TYPOGRAPHY.bodyMd,
    color: FR_TEXT,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  readOnlyInput: {
    color: FR_TEXT_TERTIARY,
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  mediumInput: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  largeInput: {
    minHeight: 132,
    textAlignVertical: 'top',
  },
  helperText: {
    ...FR_TYPOGRAPHY.bodySm,
    color: FR_TEXT_TERTIARY,
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  primaryPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: FR_ACCENT,
  },
  primaryPillText: {
    ...FR_TYPOGRAPHY.labelUpper,
    color: FR_TEXT,
  },
  mutedPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  mutedPillText: {
    ...FR_TYPOGRAPHY.labelUpper,
    color: FR_TEXT_SECONDARY,
  },
  dangerPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 69, 58, 0.14)',
  },
  dangerPillText: {
    ...FR_TYPOGRAPHY.labelUpper,
    color: FR_DANGER,
  },
  disabledPill: {
    opacity: 0.42,
  },
  rulesStack: {
    gap: 12,
  },
  ruleCard: {
    gap: 10,
  },
  searchResultsStack: {
    gap: 10,
  },
  searchResultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  highlightCard: {
    backgroundColor: 'rgba(124,77,255,0.08)',
  },
  coverImage: {
    width: '100%',
    borderRadius: 24,
  },
  coverGradient: {
    width: '100%',
    borderRadius: 24,
    padding: 18,
    justifyContent: 'flex-end',
    gap: 6,
  },
  coverEyebrow: {
    ...FR_TYPOGRAPHY.labelUpper,
    color: FR_ACCENT_LIGHT,
  },
  coverTitle: {
    ...FR_TYPOGRAPHY.headlineMd,
    color: FR_TEXT,
    fontSize: 24,
    lineHeight: 28,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...FR_TYPOGRAPHY.titleMd,
    color: FR_TEXT,
  },
  profileHero: {
    gap: 0,
    marginBottom: 36,
  },
  profileHeroOverlay: {
    marginTop: -48,
    marginHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  profileAvatarWrap: {
    alignItems: 'flex-end',
    gap: 8,
  },
  iconOverlayButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,10,15,0.72)',
  },
  coverButton: {
    alignSelf: 'flex-start',
  },
  linkCard: {
    gap: 10,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  identityText: {
    ...FR_TYPOGRAPHY.bodyMd,
    color: FR_TEXT,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  toggleCopy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  toggleIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124,77,255,0.18)',
  },
  toggleLabel: {
    ...FR_TYPOGRAPHY.titleMd,
    color: FR_TEXT,
  },
  toggleDetail: {
    ...FR_TYPOGRAPHY.bodySm,
    color: FR_TEXT_SECONDARY,
  },
  restrictedTitle: {
    ...FR_TYPOGRAPHY.headlineMd,
    color: FR_TEXT,
  },
  dangerCard: {
    backgroundColor: 'rgba(255, 69, 58, 0.08)',
  },
  inlineStrong: {
    color: FR_TEXT,
  },
});
