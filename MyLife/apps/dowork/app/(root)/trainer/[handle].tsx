// Public trainer profile. Renders the trainer's hero, headline, socials, and a
// video library split into Free and Premium. Premium rows the viewer is
// entitled to watch render normally (RLS enforces this server-side); rows the
// viewer is NOT entitled to render as a locked teaser (title + thumbnail
// only, via dw_list_premium_video_teasers) that routes to the Subscribe
// paywall instead of playback. Otherwise a Subscribe area opens the
// RevenueCat paywall (PaywallSheet), which drives a real store purchase and
// shows honest unavailable/confirming states, never a faked one.
// Non-owner viewers get report/block affordances (App Review Guideline 1.2): an
// overflow action on the hero and a long-press on each video row.

import { memo, useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  AtSign,
  BadgeCheck,
  Check,
  ChevronLeft,
  Globe,
  Lock,
  MoreVertical,
  Play,
  Share2,
  Sparkles,
} from 'lucide-react-native';
import { WK_FONTS } from '@mylife/workouts';
import { useDoWorkCloud } from '../providers/DoWorkCloudProvider';
import {
  getTrainerByHandle,
  type CloudTrainerProfile,
} from '../data/cloud-trainers';
import {
  listPremiumVideoTeasers,
  listPublicTrainerVideos,
  type PremiumVideoTeaser,
  type TrainerVideoRow,
} from '../data/cloud-trainer-videos';
import {
  getMySubscriptionForTrainer,
  isSubscriptionActive,
} from '../data/cloud-subscriptions';
import { listMyClientLinks } from '../data/cloud-coaching';
import { REPORT_REASONS, submitReport, type ReportTargetKind } from '../data/cloud-reports';
import { blockUser } from '../data/cloud-blocks';
import { friendlyError } from '../data/friendly-errors';
import { PaywallSheet } from '../components/PaywallSheet';
import { TrainerSharePoster } from '../components/TrainerSharePoster';
import { DW_ACCENT, DW_BORDER, DW_ON_ACCENT, DW_SURFACES, DW_TEXT } from '../theme/tokens';

type LoadState =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'not-found' }
  | { state: 'ready'; trainer: CloudTrainerProfile; videos: TrainerVideoRow[] };

function formatDuration(seconds: number | null): string | null {
  if (!seconds || seconds <= 0) return null;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function instagramUrl(value: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  return `https://instagram.com/${value.replace(/^@/, '')}`;
}

function websiteUrl(value: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

// Locked teaser row for a premium video the viewer is not entitled to watch.
// Shows title + thumbnail only (never storage_path); tapping routes to the
// Subscribe paywall instead of playback, since the signed URL is not
// mintable for a non-entitled caller anyway (server-enforced).
function LockedVideoCard({ teaser, onPress }: { teaser: PremiumVideoTeaser; onPress: () => void }) {
  const duration = formatDuration(teaser.durationSeconds);
  return (
    <Pressable
      style={({ pressed }) => [styles.videoCard, pressed && { opacity: 0.9 }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${teaser.title ?? 'Premium video'}, locked. Subscribe to watch.`}
    >
      <View style={styles.videoThumb}>
        {teaser.thumbnailUrl ? (
          <Image source={{ uri: teaser.thumbnailUrl }} style={[styles.videoThumbImage, styles.lockedThumbImage]} />
        ) : (
          <View style={styles.videoThumbPlaceholder} />
        )}
        <View style={styles.lockedScrim} />
        <View style={styles.lockedBadge}>
          <Lock size={18} color={DW_TEXT.primary} />
        </View>
        {duration ? (
          <View style={styles.durationTag}>
            <Text style={styles.durationText}>{duration}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.videoCopy}>
        <Text style={styles.videoTitle} numberOfLines={1}>
          {teaser.title ?? 'Premium video'}
        </Text>
        <Text style={styles.lockedSubscribeText}>Subscribe to watch</Text>
      </View>
    </Pressable>
  );
}

const VideoCard = memo(function VideoCard({
  video,
  onOpen,
  onReport,
  canReport,
}: {
  video: TrainerVideoRow;
  onOpen: (video: TrainerVideoRow) => void;
  onReport: (video: TrainerVideoRow) => void;
  canReport: boolean;
}) {
  const duration = formatDuration(video.durationSeconds);
  return (
    <Pressable
      style={({ pressed }) => [styles.videoCard, pressed && { opacity: 0.9 }]}
      onPress={() => onOpen(video)}
      onLongPress={canReport ? () => onReport(video) : undefined}
      accessibilityRole="button"
      accessibilityLabel={`Play ${video.title ?? 'demo video'}`}
      accessibilityHint={canReport ? 'Long press for report options' : undefined}
    >
      <View style={styles.videoThumb}>
        {video.thumbnailUrl ? (
          <Image source={{ uri: video.thumbnailUrl }} style={styles.videoThumbImage} />
        ) : (
          <View style={styles.videoThumbPlaceholder} />
        )}
        <View style={styles.playBadge}>
          <Play size={16} color={DW_ON_ACCENT} fill={DW_ON_ACCENT} />
        </View>
        {video.isPremium ? (
          <View style={styles.premiumTag}>
            <Lock size={11} color={DW_TEXT.primary} />
            <Text style={styles.premiumTagText}>Premium</Text>
          </View>
        ) : null}
        {duration ? (
          <View style={styles.durationTag}>
            <Text style={styles.durationText}>{duration}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.videoCopy}>
        <Text style={styles.videoTitle} numberOfLines={1}>
          {video.title ?? 'Demo video'}
        </Text>
        {video.description ? (
          <Text style={styles.videoDesc} numberOfLines={2}>
            {video.description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
});

type ProfileVideoRow =
  | { type: 'free-title'; key: string }
  | { type: 'premium-title'; key: string; showPill: boolean; pillLabel: string }
  | { type: 'video'; key: string; video: TrainerVideoRow }
  | { type: 'locked-video'; key: string; teaser: PremiumVideoTeaser }
  | { type: 'empty'; key: string; text: string }
  | { type: 'subscribe'; key: string };

function TrainerProfileVideoList({
  header,
  trainer,
  freeVideos,
  premiumVideos,
  lockedTeasers,
  showPremiumList,
  isOwner,
  subscribed,
  coachingIncluded,
  onOpenVideo,
  onReportVideo,
  onSubscribe,
}: {
  header: ReactElement;
  trainer: CloudTrainerProfile;
  freeVideos: TrainerVideoRow[];
  premiumVideos: TrainerVideoRow[];
  lockedTeasers: PremiumVideoTeaser[];
  showPremiumList: boolean;
  isOwner: boolean;
  subscribed: boolean;
  coachingIncluded: boolean;
  onOpenVideo: (video: TrainerVideoRow) => void;
  onReportVideo: (video: TrainerVideoRow) => void;
  onSubscribe: () => void;
}) {
  const rows = useMemo<ProfileVideoRow[]>(() => {
    const next: ProfileVideoRow[] = [{ type: 'free-title', key: 'free-title' }];
    if (freeVideos.length > 0) {
      freeVideos.forEach((video) => next.push({ type: 'video', key: `free-${video.id}`, video }));
    } else {
      next.push({ type: 'empty', key: 'free-empty', text: 'No free videos published yet.' });
    }

    next.push({
      type: 'premium-title',
      key: 'premium-title',
      showPill: (subscribed || coachingIncluded) && !isOwner,
      pillLabel: coachingIncluded ? 'Included' : 'Subscribed',
    });

    if (showPremiumList) {
      if (premiumVideos.length > 0 || lockedTeasers.length > 0) {
        premiumVideos.forEach((video) =>
          next.push({ type: 'video', key: `premium-${video.id}`, video }),
        );
        lockedTeasers.forEach((teaser) =>
          next.push({ type: 'locked-video', key: `locked-${teaser.id}`, teaser }),
        );
      } else {
        next.push({
          type: 'empty',
          key: 'premium-empty',
          text: isOwner
            ? 'Mark videos premium in your Studio to build a paid library.'
            : 'No premium videos published yet.',
        });
      }
    } else if (subscribed || coachingIncluded) {
      next.push({
        type: 'empty',
        key: 'premium-message',
        text: coachingIncluded
          ? `You train with ${trainer.displayName}, so new premium videos appear here automatically.`
          : "You're subscribed. New premium videos will appear here as they're published.",
      });
    } else {
      next.push({ type: 'subscribe', key: 'premium-subscribe' });
    }

    return next;
  }, [freeVideos, premiumVideos, lockedTeasers, showPremiumList, isOwner, subscribed, coachingIncluded, trainer.displayName]);

  const renderRow = useCallback(
    ({ item }: { item: ProfileVideoRow }) => {
      switch (item.type) {
        case 'free-title':
          return (
            <View style={styles.listTitleRow}>
              <Text style={styles.sectionTitle}>Free videos</Text>
            </View>
          );
        case 'premium-title':
          return (
            <View style={styles.listTitleRow}>
              <View style={styles.premiumHeaderRow}>
                <Text style={styles.sectionTitle}>Premium library</Text>
                {item.showPill ? (
                  <View style={styles.entitledPill}>
                    <Check size={12} color={DW_ACCENT} />
                    <Text style={styles.entitledPillText}>{item.pillLabel}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          );
        case 'video':
          return (
            <View style={styles.listContentRow}>
              <VideoCard
                video={item.video}
                onOpen={onOpenVideo}
                onReport={onReportVideo}
                canReport={!isOwner}
              />
            </View>
          );
        case 'locked-video':
          return (
            <View style={styles.listContentRow}>
              <LockedVideoCard teaser={item.teaser} onPress={onSubscribe} />
            </View>
          );
        case 'empty':
          return (
            <View style={styles.listContentRow}>
              <View style={styles.emptyRow}>
                <Text style={styles.emptyRowText}>{item.text}</Text>
              </View>
            </View>
          );
        case 'subscribe':
          return (
            <View style={styles.listContentRow}>
              <View style={styles.subscribeCard}>
                <View style={styles.subscribeIcon}>
                  <Lock size={20} color={DW_ACCENT} />
                </View>
                <Text style={styles.subscribeTitle}>Subscribe</Text>
                <Text style={styles.subscribeBody}>
                  Unlock {trainer.displayName}&rsquo;s premium coaching videos. Clients working
                  directly with {trainer.displayName} get the premium library included.
                </Text>
                <Pressable
                  style={styles.subscribeButton}
                  onPress={onSubscribe}
                  accessibilityRole="button"
                  accessibilityLabel="Subscribe"
                >
                  <Text style={styles.subscribeButtonText}>Subscribe</Text>
                </Pressable>
              </View>
            </View>
          );
        default:
          return null;
      }
    },
    [onOpenVideo, onReportVideo, isOwner, trainer.displayName, onSubscribe],
  );

  const keyExtractor = useCallback((item: ProfileVideoRow) => item.key, []);

  return (
    <FlatList
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      data={rows}
      renderItem={renderRow}
      keyExtractor={keyExtractor}
      ListHeaderComponent={header}
      initialNumToRender={8}
      windowSize={7}
    />
  );
}

export default function TrainerProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ handle: string }>();
  const handle = params.handle ?? '';
  const { supabase, userId, trainerProfile } = useDoWorkCloud();
  const [load, setLoad] = useState<LoadState>({ state: 'loading' });
  const [showPaywall, setShowPaywall] = useState(false);
  const [showShare, setShowShare] = useState(false);
  // Server-truth entitlement, resolved alongside the profile: a paid
  // subscription row or an active coaching link (founder decision 5).
  const [subscribed, setSubscribed] = useState(false);
  const [coachingIncluded, setCoachingIncluded] = useState(false);
  const [premiumTeasers, setPremiumTeasers] = useState<PremiumVideoTeaser[]>([]);

  const fetchProfile = useCallback(async () => {
    if (!supabase) {
      setLoad({ state: 'error', message: 'Trainer profiles need a cloud connection.' });
      return;
    }
    if (!handle) {
      setLoad({ state: 'not-found' });
      return;
    }
    setLoad({ state: 'loading' });
    const trainerResult = await getTrainerByHandle(supabase, handle);
    if (!trainerResult.ok) {
      setLoad({ state: 'error', message: trainerResult.error });
      return;
    }
    if (!trainerResult.trainer) {
      setLoad({ state: 'not-found' });
      return;
    }
    const trainer = trainerResult.trainer;
    const videosResult = await listPublicTrainerVideos(supabase, trainer.id);
    if (!videosResult.ok) {
      setLoad({ state: 'error', message: videosResult.error });
      return;
    }

    // Entitlement is the server's call; read the caller's own rows so the CTA
    // reflects reality (subscribed / coaching-included / neither).
    if (userId) {
      const [subResult, linksResult] = await Promise.all([
        getMySubscriptionForTrainer(supabase, userId, trainer.id),
        listMyClientLinks(supabase, userId),
      ]);
      setSubscribed(
        subResult.ok && subResult.subscription !== null && isSubscriptionActive(subResult.subscription),
      );
      setCoachingIncluded(
        linksResult.ok &&
          linksResult.links.some((link) => link.trainerId === trainer.id && link.status === 'active'),
      );
    } else {
      setSubscribed(false);
      setCoachingIncluded(false);
    }

    // Premium teaser metadata (CG-8). listPublicTrainerVideos already returns
    // full premium rows when the caller IS entitled (RLS lets those through);
    // this fills in title/thumbnail for the premium videos RLS hid because
    // the caller is not entitled, so those can render as locked rows instead
    // of vanishing entirely.
    const teasersResult = await listPremiumVideoTeasers(supabase, trainer.id);
    setPremiumTeasers(teasersResult.ok ? teasersResult.teasers : []);

    setLoad({ state: 'ready', trainer, videos: videosResult.videos });
  }, [supabase, handle, userId]);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  const isOwner = useMemo(() => {
    if (load.state !== 'ready') return false;
    return trainerProfile?.id === load.trainer.id || userId === load.trainer.userId;
  }, [load, trainerProfile, userId]);

  const openVideo = useCallback(
    (video: TrainerVideoRow) => {
      router.push(`/(root)/player?videoId=${video.id}` as never);
    },
    [router],
  );

  // Report/block affordances (App Review Guideline 1.2). Reports land in
  // dw_reports; a block inserts a dw_user_blocks row (existing blocks semantics).
  const runReport = useCallback(
    async (kind: ReportTargetKind, targetId: string, reason: string) => {
      if (!supabase || !userId) {
        Alert.alert('Sign in to report', 'You need to be signed in to report content.');
        return;
      }
      const result = await submitReport(supabase, {
        reporterUserId: userId,
        targetKind: kind,
        targetId,
        reason,
      });
      Alert.alert(
        result.ok ? 'Report received' : 'Report failed',
        result.ok ? 'Thanks. Reports are reviewed within 24 hours.' : friendlyError(result.error),
      );
    },
    [supabase, userId],
  );

  const openReportReasons = useCallback(
    (kind: ReportTargetKind, targetId: string) => {
      Alert.alert('Why are you reporting this?', undefined, [
        ...REPORT_REASONS.map((reason) => ({
          text: reason,
          onPress: () => void runReport(kind, targetId, reason),
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ]);
    },
    [runReport],
  );

  const openVideoActions = useCallback(
    (video: TrainerVideoRow) => {
      Alert.alert(video.title ?? 'Video', undefined, [
        { text: 'Report video', onPress: () => openReportReasons('trainer_video', video.id) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [openReportReasons],
  );

  const openTrainerActions = useCallback(() => {
    if (load.state !== 'ready') return;
    const { trainer } = load;
    Alert.alert(trainer.displayName, undefined, [
      { text: 'Report trainer', onPress: () => openReportReasons('profile', trainer.id) },
      {
        text: 'Block trainer',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            if (!supabase || !userId) {
              Alert.alert('Sign in to block', 'You need to be signed in to block a trainer.');
              return;
            }
            const result = await blockUser(supabase, userId, trainer.userId);
            if (!result.ok) {
              Alert.alert('Block failed', friendlyError(result.error));
              return;
            }
            Alert.alert(
              'Blocked',
              `${trainer.displayName} will no longer appear in your feed. Manage blocks in Settings.`,
              [{ text: 'OK', onPress: () => router.back() }],
            );
          })();
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [load, supabase, userId, router, openReportReasons]);

  if (load.state === 'loading') {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={DW_ACCENT} />
        <Text style={styles.centeredText}>Loading profile…</Text>
      </View>
    );
  }

  if (load.state === 'error' || load.state === 'not-found') {
    const message =
      load.state === 'error' ? load.message : 'This trainer profile could not be found.';
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.errorTitle}>
          {load.state === 'not-found' ? 'Trainer not found' : "Can't load profile"}
        </Text>
        <Text style={styles.centeredText}>{message}</Text>
        {load.state === 'error' ? (
          <Pressable
            style={({ pressed }) => [styles.retryButton, pressed && { opacity: 0.86 }]}
            onPress={() => void fetchProfile()}
            accessibilityRole="button"
          >
            <Text style={styles.retryLabel}>Retry</Text>
          </Pressable>
        ) : null}
        <Pressable style={styles.backLink} onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.backLinkText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const { trainer, videos } = load;
  const freeVideos = videos.filter((video) => !video.isPremium);
  const premiumVideos = videos.filter((video) => video.isPremium);
  // Teasers RLS would otherwise hide entirely; skip any id the viewer IS
  // entitled to (already in premiumVideos, rendering fully) so a video never
  // shows twice.
  const entitledPremiumIds = new Set(premiumVideos.map((video) => video.id));
  const lockedTeasers = premiumTeasers.filter((teaser) => !entitledPremiumIds.has(teaser.id));
  const showPremiumList = isOwner || premiumVideos.length > 0 || lockedTeasers.length > 0;

  const profileHeader = (
    <View>
      <View style={styles.hero}>
        {trainer.heroImagePath ? (
          <Image source={{ uri: trainer.heroImagePath }} style={styles.heroImage} />
        ) : (
          <View style={styles.heroPlaceholder} />
        )}
        <View style={styles.heroScrim} />
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ChevronLeft size={22} color={DW_TEXT.primary} />
        </Pressable>
        <Pressable
          style={styles.shareButton}
          onPress={() => setShowShare(true)}
          accessibilityRole="button"
          accessibilityLabel="Share profile"
        >
          <Share2 size={20} color={DW_TEXT.primary} />
        </Pressable>
        {!isOwner ? (
          <Pressable
            style={styles.moreButton}
            onPress={openTrainerActions}
            accessibilityRole="button"
            accessibilityLabel="More options"
          >
            <MoreVertical size={20} color={DW_TEXT.primary} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{trainer.displayName}</Text>
          {trainer.isVerified ? <BadgeCheck size={20} color={DW_ACCENT} /> : null}
        </View>
        {trainer.handle ? <Text style={styles.handle}>@{trainer.handle}</Text> : null}
        {trainer.headline ? <Text style={styles.headline}>{trainer.headline}</Text> : null}

        <Text style={styles.subscribers}>
          {trainer.subscriberCount} {trainer.subscriberCount === 1 ? 'subscriber' : 'subscribers'}
        </Text>

        {trainer.specialties.length > 0 ? (
          <View style={styles.chipRow}>
            {trainer.specialties.map((specialty) => (
              <View key={specialty} style={styles.chip}>
                <Text style={styles.chipText}>{specialty}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {(trainer.instagram || trainer.website) ? (
          <View style={styles.socialRow}>
            {trainer.instagram ? (
              <Pressable
                style={styles.socialButton}
                onPress={() => void Linking.openURL(instagramUrl(trainer.instagram as string))}
                accessibilityRole="link"
                accessibilityLabel="Instagram"
              >
                <AtSign size={16} color={DW_TEXT.primary} />
                <Text style={styles.socialText}>Instagram</Text>
              </Pressable>
            ) : null}
            {trainer.website ? (
              <Pressable
                style={styles.socialButton}
                onPress={() => void Linking.openURL(websiteUrl(trainer.website as string))}
                accessibilityRole="link"
                accessibilityLabel="Website"
              >
                <Globe size={16} color={DW_TEXT.primary} />
                <Text style={styles.socialText}>Website</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {isOwner ? (
          <Pressable
            style={styles.ownerCard}
            onPress={() => router.push('/(root)/studio' as never)}
            accessibilityRole="button"
          >
            <Text style={styles.ownerText}>This is your public profile.</Text>
            <Text style={styles.ownerLink}>Edit in Studio</Text>
          </Pressable>
        ) : (
          <View>
            <Pressable
              style={styles.workWithMe}
              onPress={() => router.push('/(root)/client-invite' as never)}
              accessibilityRole="button"
              accessibilityLabel="Work with me"
            >
              <Sparkles size={16} color={DW_ON_ACCENT} />
              <Text style={styles.workWithMeText}>Work with me</Text>
            </Pressable>
            <Text style={styles.workWithMeHint}>
              Your trainer gives you a personal invite code or QR.
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <TrainerProfileVideoList
        header={profileHeader}
        trainer={trainer}
        freeVideos={freeVideos}
        premiumVideos={premiumVideos}
        showPremiumList={showPremiumList}
        isOwner={isOwner}
        subscribed={subscribed}
        coachingIncluded={coachingIncluded}
        lockedTeasers={lockedTeasers}
        onOpenVideo={openVideo}
        onReportVideo={openVideoActions}
        onSubscribe={() => setShowPaywall(true)}
      />

      {supabase ? (
        <PaywallSheet
          visible={showPaywall}
          onClose={() => setShowPaywall(false)}
          supabase={supabase}
          userId={userId}
          trainer={{ id: trainer.id, displayName: trainer.displayName, priceTier: trainer.priceTier }}
          hasActiveClientLink={coachingIncluded}
          onConfirmed={() => {
            setSubscribed(true);
            void fetchProfile();
          }}
        />
      ) : null}

      <TrainerSharePoster
        visible={showShare}
        handle={trainer.handle}
        displayName={trainer.displayName}
        headline={trainer.headline}
        onClose={() => setShowShare(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: DW_SURFACES.base,
  },
  content: {
    paddingBottom: 48,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: DW_SURFACES.base,
    gap: 12,
    paddingHorizontal: 32,
  },
  centeredText: {
    fontFamily: WK_FONTS.regular,
    fontSize: 14,
    color: DW_TEXT.secondary,
    textAlign: 'center',
  },
  errorTitle: {
    fontFamily: WK_FONTS.bold,
    fontSize: 18,
    color: DW_TEXT.primary,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 4,
    backgroundColor: DW_ACCENT,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  retryLabel: {
    fontFamily: WK_FONTS.bold,
    fontSize: 14,
    color: DW_ON_ACCENT,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  backLink: {
    paddingVertical: 8,
  },
  backLinkText: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 13,
    color: DW_TEXT.tertiary,
  },
  hero: {
    height: 220,
    backgroundColor: DW_SURFACES.high,
    position: 'relative',
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  heroPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: DW_SURFACES.high,
  },
  heroScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11, 11, 14, 0.35)',
  },
  backButton: {
    position: 'absolute',
    top: 48,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderWidth: 1,
    borderColor: DW_BORDER.subtle,
  },
  shareButton: {
    position: 'absolute',
    top: 48,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderWidth: 1,
    borderColor: DW_BORDER.subtle,
  },
  moreButton: {
    position: 'absolute',
    top: 48,
    right: 64,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderWidth: 1,
    borderColor: DW_BORDER.subtle,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontFamily: WK_FONTS.extraBold,
    fontSize: 28,
    color: DW_TEXT.primary,
    letterSpacing: -0.6,
  },
  handle: {
    fontFamily: WK_FONTS.medium,
    fontSize: 14,
    color: DW_ACCENT,
  },
  headline: {
    marginTop: 4,
    fontFamily: WK_FONTS.regular,
    fontSize: 15,
    color: DW_TEXT.secondary,
    lineHeight: 22,
  },
  subscribers: {
    marginTop: 4,
    fontFamily: WK_FONTS.semiBold,
    fontSize: 12,
    color: DW_TEXT.tertiary,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  chip: {
    backgroundColor: DW_SURFACES.high,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: DW_BORDER.subtle,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 12,
    color: DW_TEXT.secondary,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: DW_SURFACES.low,
    borderColor: DW_BORDER.default,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  socialText: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 13,
    color: DW_TEXT.primary,
  },
  ownerCard: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: DW_SURFACES.low,
    borderColor: DW_BORDER.default,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  ownerText: {
    fontFamily: WK_FONTS.medium,
    fontSize: 13,
    color: DW_TEXT.secondary,
  },
  ownerLink: {
    fontFamily: WK_FONTS.bold,
    fontSize: 13,
    color: DW_ACCENT,
  },
  workWithMe: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: DW_ACCENT,
    borderRadius: 14,
    paddingVertical: 14,
  },
  workWithMeText: {
    fontFamily: WK_FONTS.bold,
    fontSize: 14,
    color: DW_ON_ACCENT,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  workWithMeHint: {
    marginTop: 8,
    fontFamily: WK_FONTS.regular,
    fontSize: 12,
    color: DW_TEXT.tertiary,
    textAlign: 'center',
  },
  listTitleRow: {
    paddingHorizontal: 20,
    marginTop: 30,
  },
  listContentRow: {
    paddingHorizontal: 20,
    marginTop: 12,
  },
  sectionTitle: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 12,
    color: DW_TEXT.secondary,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  premiumHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  entitledPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${DW_ACCENT}18`,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  entitledPillText: {
    fontFamily: WK_FONTS.bold,
    fontSize: 11,
    color: DW_ACCENT,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  videoCard: {
    backgroundColor: DW_SURFACES.low,
    borderColor: DW_BORDER.subtle,
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  videoThumb: {
    height: 170,
    backgroundColor: DW_SURFACES.high,
    position: 'relative',
  },
  videoThumbImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  videoThumbPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: DW_SURFACES.high,
  },
  playBadge: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -22,
    marginLeft: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DW_ACCENT,
  },
  premiumTag: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  premiumTagText: {
    fontFamily: WK_FONTS.bold,
    fontSize: 10,
    color: DW_TEXT.primary,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  durationTag: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  durationText: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 11,
    color: DW_TEXT.primary,
  },
  lockedThumbImage: {
    opacity: 0.45,
  },
  lockedScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11, 11, 14, 0.35)',
  },
  lockedBadge: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -22,
    marginLeft: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
    borderWidth: 1,
    borderColor: DW_BORDER.subtle,
  },
  lockedSubscribeText: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 12,
    color: DW_ACCENT,
  },
  videoCopy: {
    padding: 14,
    gap: 4,
  },
  videoTitle: {
    fontFamily: WK_FONTS.bold,
    fontSize: 15,
    color: DW_TEXT.primary,
  },
  videoDesc: {
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    color: DW_TEXT.secondary,
    lineHeight: 19,
  },
  emptyRow: {
    backgroundColor: DW_SURFACES.low,
    borderColor: DW_BORDER.subtle,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },
  emptyRowText: {
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    color: DW_TEXT.tertiary,
  },
  subscribeCard: {
    backgroundColor: DW_SURFACES.low,
    borderColor: DW_BORDER.default,
    borderWidth: 1,
    borderRadius: 18,
    padding: 20,
    gap: 8,
    alignItems: 'flex-start',
  },
  subscribeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${DW_ACCENT}18`,
  },
  subscribeTitle: {
    fontFamily: WK_FONTS.bold,
    fontSize: 18,
    color: DW_TEXT.primary,
  },
  subscribeBody: {
    fontFamily: WK_FONTS.regular,
    fontSize: 14,
    color: DW_TEXT.secondary,
    lineHeight: 21,
  },
  subscribeButton: {
    marginTop: 6,
    backgroundColor: DW_ACCENT,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  subscribeButtonText: {
    fontFamily: WK_FONTS.bold,
    fontSize: 14,
    color: DW_ON_ACCENT,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});
