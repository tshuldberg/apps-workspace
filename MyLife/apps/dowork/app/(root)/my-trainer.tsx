// Client-side trainer space.
//
// Reachable from Settings, the Home card, and the join flow. Shows the trainer
// the client is linked to, the trainer's video library (entitled via the active
// client link), a "send a form check" capture flow, and the client's own
// form-check thread with status + feedback counts. No active link -> honest
// state with a join CTA, never a fake trainer.

import { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Camera, ChevronRight, Film, ImageUp, Lock, Play } from 'lucide-react-native';
import { WK_FONTS } from '@mylife/workouts';
import { useDoWorkCloud } from './providers/DoWorkCloudProvider';
import {
  listFormChecks,
  listMyClientLinks,
  listTrainerLibrary,
  uploadFormCheck,
  type ClientLinkWithTrainer,
  type FormCheck,
  type TrainerLibraryVideo,
} from './data/cloud-coaching';
import { REPORT_REASONS, submitReport, type ReportTargetKind } from './data/cloud-reports';
import { friendlyError } from './data/friendly-errors';
import { pickOrRecordVideo } from './components/coaching/pick-video';
import { PushPrompt } from './components/PushPrompt';
import {
  Card,
  CoachingHeader,
  CoachingScreen,
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  SectionLabel,
  StatusBadge,
  formatClock,
} from './components/coaching/coaching-kit';
import { DW_ACCENT, DW_BORDER, DW_ON_ACCENT, DW_SURFACES, DW_TEXT } from './theme/tokens';
import { formatDateLabel } from './(tabs)/_screen-kit';

interface TrainerView {
  link: ClientLinkWithTrainer;
  library: TrainerLibraryVideo[];
  // A failed library/checks fetch keeps an honest error instead of an empty
  // list that reads as "nothing published yet".
  libraryError: string | null;
  checks: FormCheck[];
  checksError: string | null;
}

export default function MyTrainerScreen() {
  const router = useRouter();
  const { supabase, userId } = useDoWorkCloud();
  const params = useLocalSearchParams<{ welcome?: string }>();
  const showWelcome = params.welcome === '1';

  const [view, setView] = useState<TrainerView | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'no-link' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !userId) {
      setState('no-link');
      return;
    }
    const linksResult = await listMyClientLinks(supabase, userId);
    if (!linksResult.ok) {
      setError(linksResult.error);
      setState('error');
      return;
    }
    const active = linksResult.links.find((l) => l.status === 'active') ?? null;
    if (!active) {
      setState('no-link');
      setView(null);
      return;
    }
    const [libraryResult, checksResult] = await Promise.all([
      listTrainerLibrary(supabase, active.trainerId),
      listFormChecks(supabase, active.id),
    ]);
    setView({
      link: active,
      library: libraryResult.ok ? libraryResult.videos : [],
      libraryError: libraryResult.ok ? null : friendlyError(libraryResult.error),
      checks: checksResult.ok ? checksResult.formChecks : [],
      checksError: checksResult.ok ? null : friendlyError(checksResult.error),
    });
    setError(null);
    setState('ready');
  }, [supabase, userId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleSend = useCallback(
    async (source: 'camera' | 'library') => {
      if (!supabase || !view || uploading) return;
      const picked = await pickOrRecordVideo(source);
      if (!picked.ok) {
        if (!('cancelled' in picked)) setNotice(picked.error);
        return;
      }
      setUploading(true);
      setProgress(0);
      setNotice(null);
      const result = await uploadFormCheck(supabase, {
        clientLinkId: view.link.id,
        fileUri: picked.video.fileUri,
        contentType: picked.video.contentType,
        contentLength: picked.video.contentLength,
        durationSeconds: picked.video.durationSeconds,
        onProgress: setProgress,
      });
      setUploading(false);
      if (!result.ok) {
        setNotice(result.error);
        return;
      }
      setNotice('Form check sent. Your trainer has been notified.');
      await load();
    },
    [supabase, view, uploading, load],
  );

  // Report affordance on library rows (App Review Guideline 1.2). Any user can
  // flag a trainer video; moderation triages dw_reports server-side.
  const reportVideo = useCallback(
    async (videoId: string, reason: string) => {
      if (!supabase || !userId) {
        Alert.alert('Sign in to report', 'You need to be signed in to report content.');
        return;
      }
      const kind: ReportTargetKind = 'trainer_video';
      const result = await submitReport(supabase, {
        reporterUserId: userId,
        targetKind: kind,
        targetId: videoId,
        reason,
      });
      Alert.alert(
        result.ok ? 'Report received' : 'Report failed',
        result.ok ? 'Thanks. Reports are reviewed within 24 hours.' : friendlyError(result.error),
      );
    },
    [supabase, userId],
  );

  const openVideoReport = useCallback(
    (video: TrainerLibraryVideo) => {
      Alert.alert(video.title ?? formatSlug(video.exerciseSlug), undefined, [
        {
          text: 'Report video',
          onPress: () => {
            Alert.alert('Why are you reporting this?', undefined, [
              ...REPORT_REASONS.map((reason) => ({
                text: reason,
                onPress: () => void reportVideo(video.id, reason),
              })),
              { text: 'Cancel', style: 'cancel' as const },
            ]);
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [reportVideo],
  );

  if (state === 'loading') {
    return (
      <CoachingScreen>
        <CoachingHeader title="My trainer" />
        <LoadingBlock label="Loading your trainer…" />
      </CoachingScreen>
    );
  }

  if (state === 'no-link') {
    return (
      <CoachingScreen>
        <CoachingHeader title="My trainer" />
        <EmptyState
          title="You're not connected to a trainer"
          body="If a DoWork trainer sent you an invite, tap it or enter the code to open your coaching space."
          cta={{ label: 'Enter an invite code', onPress: () => router.push('/(root)/client-invite') }}
        />
        <Pressable
          style={styles.trainerLink}
          onPress={() => router.push('/(root)/redeem-invite')}
          accessibilityRole="button"
        >
          <Text style={styles.trainerLinkText}>Are you a trainer? Redeem a trainer invite</Text>
        </Pressable>
      </CoachingScreen>
    );
  }

  if (state === 'error' || !view) {
    return (
      <CoachingScreen>
        <CoachingHeader title="My trainer" />
        <ErrorBlock message={error ?? 'Could not load your trainer.'} onRetry={() => void load()} />
      </CoachingScreen>
    );
  }

  const trainer = view.link.trainer;
  const trainerName = trainer?.displayName ?? 'Your trainer';

  return (
    <CoachingScreen
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={DW_ACCENT} />
      }
    >
      <CoachingHeader title="My trainer" />

      <View style={styles.pushPromptWrap}>
        <PushPrompt />
      </View>

      {showWelcome ? (
        <View style={styles.welcome}>
          <Text style={styles.welcomeTitle}>You're in.</Text>
          <Text style={styles.welcomeBody}>
            Send {trainerName} a form check any time and get timestamped feedback back.
          </Text>
        </View>
      ) : null}

      <Card>
        <View style={styles.trainerHeader}>
          <View style={styles.trainerText}>
            <Text style={styles.trainerName}>{trainerName}</Text>
            {trainer?.handle ? <Text style={styles.trainerHandle}>@{trainer.handle}</Text> : null}
            {trainer?.headline ? <Text style={styles.trainerHeadline}>{trainer.headline}</Text> : null}
          </View>
          <StatusBadge tone="active" label="Coaching" />
        </View>
        {trainer?.handle ? (
          <Pressable
            style={({ pressed }) => [styles.profileLink, pressed && { opacity: 0.8 }]}
            onPress={() => router.push(`/(root)/trainer/${trainer.handle}`)}
            accessibilityRole="button"
          >
            <Text style={styles.profileLinkText}>View profile</Text>
            <ChevronRight size={16} color={DW_ACCENT} />
          </Pressable>
        ) : null}
      </Card>

      <SectionLabel>Send a form check</SectionLabel>
      <Card>
        <Text style={styles.sendHint}>
          Film your set or pick a clip. {trainerName} reviews it and drops feedback anchored to the
          exact moment.
        </Text>
        {uploading ? (
          <View style={styles.uploadRow}>
            <Text style={styles.uploadText}>Uploading… {Math.round(progress * 100)}%</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
          </View>
        ) : (
          <View style={styles.sendActions}>
            <Pressable
              style={({ pressed }) => [styles.sendPrimary, pressed && { opacity: 0.86 }]}
              onPress={() => void handleSend('camera')}
              accessibilityRole="button"
              accessibilityLabel="Record a form check"
            >
              <Camera size={18} color={DW_ON_ACCENT} />
              <Text style={styles.sendPrimaryText}>Record</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.sendGhost, pressed && { opacity: 0.8 }]}
              onPress={() => void handleSend('library')}
              accessibilityRole="button"
              accessibilityLabel="Choose a video"
            >
              <ImageUp size={18} color={DW_TEXT.primary} />
              <Text style={styles.sendGhostText}>Choose video</Text>
            </Pressable>
          </View>
        )}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      </Card>

      <SectionLabel>Your form checks</SectionLabel>
      {view.checksError ? (
        <ErrorBlock message={view.checksError} onRetry={() => void load()} />
      ) : view.checks.length === 0 ? (
        <Text style={styles.emptyLine}>No form checks yet. Send your first above.</Text>
      ) : (
        <View style={styles.list}>
          {view.checks.map((check) => (
            <Pressable
              key={check.id}
              style={({ pressed }) => [styles.checkRow, pressed && { opacity: 0.85 }]}
              onPress={() => router.push(`/(root)/form-check/${check.id}`)}
              accessibilityRole="button"
            >
              <View style={styles.checkText}>
                <Text style={styles.checkTitle}>
                  {check.exerciseSlug ? formatSlug(check.exerciseSlug) : 'Form check'}
                </Text>
                <Text style={styles.checkMeta}>
                  {formatDateLabel(check.createdAt)}
                  {check.feedbackCount > 0 ? ` · ${check.feedbackCount} notes` : ''}
                </Text>
              </View>
              <StatusBadge tone={check.status} />
            </Pressable>
          ))}
        </View>
      )}

      <SectionLabel>{`${trainerName}'s library`}</SectionLabel>
      {view.libraryError ? (
        <ErrorBlock message={view.libraryError} onRetry={() => void load()} />
      ) : view.library.length === 0 ? (
        <Text style={styles.emptyLine}>No videos published yet.</Text>
      ) : (
        <View style={styles.list}>
          {view.library.map((video) => (
            <Pressable
              key={video.id}
              style={({ pressed }) => [styles.videoRow, pressed && { opacity: 0.85 }]}
              onPress={() => router.push(`/(root)/player?videoId=${video.id}`)}
              onLongPress={() => openVideoReport(video)}
              accessibilityRole="button"
              accessibilityHint="Long press for report options"
            >
              <View style={styles.videoIcon}>
                <Play size={16} color={DW_ACCENT} />
              </View>
              <View style={styles.checkText}>
                <Text style={styles.checkTitle} numberOfLines={1}>
                  {video.title ?? formatSlug(video.exerciseSlug)}
                </Text>
                <Text style={styles.checkMeta}>
                  {video.durationSeconds ? formatClock(video.durationSeconds) : 'Video'}
                  {video.viewCount > 0 ? ` · ${video.viewCount} views` : ''}
                </Text>
              </View>
              {video.isPremium ? (
                <View style={styles.premiumChip}>
                  <Lock size={12} color={DW_TEXT.secondary} />
                  <Text style={styles.premiumText}>Premium</Text>
                </View>
              ) : (
                <Film size={16} color={DW_TEXT.tertiary} />
              )}
            </Pressable>
          ))}
        </View>
      )}
    </CoachingScreen>
  );
}

function formatSlug(slug: string): string {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

const styles = StyleSheet.create({
  pushPromptWrap: {
    marginHorizontal: 16,
  },
  welcome: {
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 107, 0, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 139, 51, 0.35)',
    gap: 4,
  },
  welcomeTitle: {
    fontFamily: WK_FONTS.extraBold,
    fontSize: 18,
    color: DW_TEXT.primary,
  },
  welcomeBody: {
    fontFamily: WK_FONTS.regular,
    fontSize: 14,
    color: DW_TEXT.secondary,
    lineHeight: 20,
  },
  trainerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  trainerText: {
    flex: 1,
    gap: 2,
  },
  trainerName: {
    fontFamily: WK_FONTS.extraBold,
    fontSize: 20,
    color: DW_TEXT.primary,
    letterSpacing: -0.4,
  },
  trainerHandle: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 13,
    color: DW_ACCENT,
  },
  trainerHeadline: {
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    color: DW_TEXT.secondary,
    marginTop: 2,
  },
  profileLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  profileLinkText: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 13,
    color: DW_ACCENT,
  },
  trainerLink: {
    marginHorizontal: 16,
    marginTop: 4,
    alignItems: 'center',
  },
  trainerLinkText: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 13,
    color: DW_TEXT.secondary,
    textDecorationLine: 'underline',
  },
  sendHint: {
    fontFamily: WK_FONTS.regular,
    fontSize: 14,
    color: DW_TEXT.secondary,
    lineHeight: 20,
  },
  sendActions: {
    flexDirection: 'row',
    gap: 10,
  },
  sendPrimary: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: DW_ACCENT,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendPrimaryText: {
    fontFamily: WK_FONTS.bold,
    fontSize: 15,
    color: DW_ON_ACCENT,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  sendGhost: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: DW_BORDER.default,
    backgroundColor: DW_SURFACES.mid,
  },
  sendGhostText: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 14,
    color: DW_TEXT.primary,
  },
  uploadRow: {
    gap: 8,
  },
  uploadText: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 14,
    color: DW_TEXT.primary,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: DW_SURFACES.high,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: DW_ACCENT,
  },
  notice: {
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    color: DW_TEXT.secondary,
    lineHeight: 18,
  },
  emptyLine: {
    fontFamily: WK_FONTS.regular,
    fontSize: 14,
    color: DW_TEXT.tertiary,
    paddingHorizontal: 20,
  },
  list: {
    marginHorizontal: 16,
    gap: 8,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: DW_SURFACES.low,
    borderColor: DW_BORDER.subtle,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  checkText: {
    flex: 1,
    gap: 2,
  },
  checkTitle: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 15,
    color: DW_TEXT.primary,
  },
  checkMeta: {
    fontFamily: WK_FONTS.regular,
    fontSize: 12,
    color: DW_TEXT.tertiary,
  },
  videoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: DW_SURFACES.low,
    borderColor: DW_BORDER.subtle,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  videoIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 107, 0, 0.14)',
  },
  premiumChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: DW_SURFACES.mid,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  premiumText: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 11,
    color: DW_TEXT.secondary,
  },
});
