// Form-check review screen (both roles).
//
// Plays the form-check video inline via a signed URL (with expiry refresh that
// preserves the playhead, mirroring player.tsx), lists feedback anchored to
// video timestamps (tap to seek), and gives a composer: text notes, an "attach
// current timestamp" toggle, and an optional video reply. The trainer's post
// also flips the check to reviewed; either participant may leave notes, per RLS.
// Video replies play in the full voice player via ?formCheckId=&feedbackId=.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Clock, Flag, MessageSquarePlus, Play, Video as VideoIcon } from 'lucide-react-native';
import { WK_FONTS } from '@mylife/workouts';
import { useDoWorkCloud } from '../providers/DoWorkCloudProvider';
import {
  getClientLink,
  getFormCheck,
  listFormFeedback,
  postFormFeedback,
  uploadFeedbackReply,
  MAX_FEEDBACK_BODY,
  type ClientLink,
  type FormCheck,
  type FormFeedback,
} from '../data/cloud-coaching';
import { getPlaybackSource, isExpired, type PlaybackSource } from '../data/cloud-playback';
import { REPORT_REASONS, submitReport, type ReportTargetKind } from '../data/cloud-reports';
import { friendlyError } from '../data/friendly-errors';
import { pickOrRecordVideo } from '../components/coaching/pick-video';
import {
  Card,
  CoachingHeader,
  CoachingScreen,
  ErrorBlock,
  LoadingBlock,
  SectionLabel,
  StatusBadge,
  formatClock,
} from '../components/coaching/coaching-kit';
import { DW_ACCENT, DW_BORDER, DW_ON_ACCENT, DW_SURFACES, DW_TEXT } from '../theme/tokens';
import { formatDateLabel } from '../(tabs)/_screen-kit';

interface ReviewMeta {
  formCheck: FormCheck;
  link: ClientLink;
  isTrainer: boolean;
  isClient: boolean;
}

export default function FormCheckReviewScreen() {
  const router = useRouter();
  const { supabase, userId, trainerProfile } = useDoWorkCloud();
  const params = useLocalSearchParams<{ id?: string }>();
  const formCheckId = params.id ?? null;

  const [meta, setMeta] = useState<ReviewMeta | null>(null);
  const [feedback, setFeedback] = useState<FormFeedback[]>([]);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [source, setSource] = useState<PlaybackSource | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [body, setBody] = useState('');
  const [attachTimestamp, setAttachTimestamp] = useState(true);
  const [posting, setPosting] = useState(false);
  const [uploadingReply, setUploadingReply] = useState(false);
  const [replyProgress, setReplyProgress] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const expiresAtRef = useRef<string | null>(null);
  const loadedUrlRef = useRef<string | null>(null);
  const refreshedForErrorRef = useRef(false);

  const player = useVideoPlayer(null, (instance) => {
    instance.timeUpdateEventInterval = 1;
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });

  const loadMeta = useCallback(async () => {
    if (!supabase || !userId) {
      setError('Reviewing form checks needs a cloud connection.');
      setLoadState('error');
      return;
    }
    if (!formCheckId) {
      setError('No form check was specified.');
      setLoadState('error');
      return;
    }
    const checkResult = await getFormCheck(supabase, formCheckId);
    if (!checkResult.ok) {
      setError(checkResult.error);
      setLoadState('error');
      return;
    }
    const linkResult = await getClientLink(supabase, checkResult.formCheck.clientLinkId);
    if (!linkResult.ok) {
      setError(linkResult.error);
      setLoadState('error');
      return;
    }
    const link = linkResult.link;
    setMeta({
      formCheck: checkResult.formCheck,
      link,
      isTrainer: Boolean(trainerProfile && trainerProfile.id === link.trainerId),
      isClient: link.clientUserId === userId,
    });
    const feedbackResult = await listFormFeedback(supabase, formCheckId);
    if (feedbackResult.ok) {
      setFeedback(feedbackResult.feedback);
      setFeedbackError(null);
    } else {
      // A load failure is not an empty thread: keep whatever is on screen and
      // show a retryable error instead of a false "No feedback yet."
      setFeedbackError(friendlyError(feedbackResult.error, 'Feedback could not be loaded.'));
    }
    setLoadState('ready');
  }, [supabase, userId, formCheckId, trainerProfile]);

  const fetchSource = useCallback(async () => {
    if (!supabase || !formCheckId) return;
    setVideoError(null);
    const result = await getPlaybackSource(supabase, { formCheckId });
    if (!result.ok) {
      // Metadata + feedback still work without playback; the video slot shows a
      // dedicated error with its own Retry so the slot never spins forever.
      setVideoError(friendlyError(result.error, 'This video could not be loaded.'));
      return;
    }
    expiresAtRef.current = result.expiresAt;
    setSource(result);
  }, [supabase, formCheckId]);

  useEffect(() => {
    void loadMeta();
    void fetchSource();
  }, [loadMeta, fetchSource]);

  // Attach the signed URL once it arrives.
  useEffect(() => {
    if (!source) return;
    if (loadedUrlRef.current === source.url) return;
    loadedUrlRef.current = source.url;
    player.replace({ uri: source.url });
  }, [source, player]);

  const refreshExpiredSource = useCallback(async () => {
    if (!supabase || !formCheckId) return;
    let preserved = 0;
    let wasPlaying = false;
    try {
      preserved = player.currentTime;
      wasPlaying = player.playing;
    } catch {
      // player mid-teardown
    }
    const result = await getPlaybackSource(supabase, { formCheckId });
    if (!result.ok) return;
    expiresAtRef.current = result.expiresAt;
    loadedUrlRef.current = result.url;
    player.replace({ uri: result.url });
    if (preserved > 0) player.currentTime = preserved;
    if (wasPlaying) player.play();
  }, [supabase, formCheckId, player]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && expiresAtRef.current && isExpired(expiresAtRef.current)) {
        void refreshExpiredSource();
      }
    });
    return () => sub.remove();
  }, [refreshExpiredSource]);

  useEffect(() => {
    if (status === 'error' && !refreshedForErrorRef.current) {
      refreshedForErrorRef.current = true;
      void refreshExpiredSource();
    }
    if (status === 'readyToPlay') {
      refreshedForErrorRef.current = false;
    }
  }, [status, refreshExpiredSource]);

  const seekTo = useCallback(
    (seconds: number) => {
      try {
        player.currentTime = Math.max(0, seconds);
        player.play();
      } catch {
        // player not ready yet
      }
    },
    [player],
  );

  const currentTimestamp = useCallback((): number | null => {
    if (!attachTimestamp) return null;
    try {
      const t = player.currentTime;
      return Number.isFinite(t) && t > 0 ? Math.round(t * 100) / 100 : 0;
    } catch {
      return null;
    }
  }, [attachTimestamp, player]);

  const reload = useCallback(async () => {
    setRefreshing(true);
    await loadMeta();
    setRefreshing(false);
  }, [loadMeta]);

  const handlePostText = useCallback(async () => {
    if (!supabase || !userId || !meta || posting) return;
    const trimmed = body.trim();
    if (!trimmed) {
      setNotice('Add a note before sending.');
      return;
    }
    setPosting(true);
    setNotice(null);
    const result = await postFormFeedback(supabase, {
      formCheckId: meta.formCheck.id,
      authorUserId: userId,
      body: trimmed,
      videoTimestampSeconds: currentTimestamp(),
      markReviewed: meta.isTrainer,
    });
    setPosting(false);
    if (!result.ok) {
      if (result.queued) {
        // Genuinely transport-shaped: the note is queued and flushes on
        // reconnect, so this confirmation is honest.
        setNotice('Saved offline. It will send when you reconnect.');
        setBody('');
      } else {
        // Server said no (ended link, removed check, validation): keep the
        // draft and say why instead of pretending it was saved.
        setNotice(friendlyError(result.error, 'This note could not be sent.'));
      }
      return;
    }
    setBody('');
    await loadMeta();
  }, [supabase, userId, meta, posting, body, currentTimestamp, loadMeta]);

  const handleVideoReply = useCallback(
    async (mediaSource: 'camera' | 'library') => {
      if (!supabase || !userId || !meta || uploadingReply) return;
      const picked = await pickOrRecordVideo(mediaSource);
      if (!picked.ok) {
        if (!('cancelled' in picked)) setNotice(friendlyError(picked.error));
        return;
      }
      setUploadingReply(true);
      setReplyProgress(0);
      setNotice(null);
      const result = await uploadFeedbackReply(supabase, {
        clientLinkId: meta.link.id,
        formCheckId: meta.formCheck.id,
        authorUserId: userId,
        fileUri: picked.video.fileUri,
        contentType: picked.video.contentType,
        contentLength: picked.video.contentLength,
        body: body.trim() || null,
        videoTimestampSeconds: currentTimestamp(),
        markReviewed: meta.isTrainer,
        onProgress: setReplyProgress,
      });
      setUploadingReply(false);
      if (!result.ok) {
        setNotice(friendlyError(result.error));
        return;
      }
      setBody('');
      await loadMeta();
    },
    [supabase, userId, meta, uploadingReply, body, currentTimestamp, loadMeta],
  );

  const handleReport = useCallback(
    (targetKind: Extract<ReportTargetKind, 'form_check' | 'form_feedback'>, targetId: string) => {
      if (!supabase || !userId) return;
      Alert.alert('Why are you reporting this?', undefined, [
        ...REPORT_REASONS.map((reason) => ({
          text: reason,
          onPress: () => {
            void (async () => {
              const result = await submitReport(supabase, {
                reporterUserId: userId,
                targetKind,
                targetId,
                reason,
              });
              Alert.alert(
                result.ok ? 'Report received' : 'Report failed',
                result.ok
                  ? 'Reports are reviewed within 24 hours.'
                  : friendlyError(result.error, 'The report could not be submitted.'),
              );
            })();
          },
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ]);
    },
    [supabase, userId],
  );

  const roleLabel = useMemo(() => {
    if (!meta) return undefined;
    if (meta.isTrainer) return 'Reviewing as coach';
    if (meta.isClient) return 'Your form check';
    return undefined;
  }, [meta]);

  const linkEnded = meta !== null && meta.link.status !== 'active';

  if (loadState === 'loading') {
    return (
      <CoachingScreen>
        <CoachingHeader title="Form check" />
        <LoadingBlock label="Loading form check…" />
      </CoachingScreen>
    );
  }

  if (loadState === 'error' || !meta) {
    return (
      <CoachingScreen>
        <CoachingHeader title="Form check" />
        <ErrorBlock message={friendlyError(error, 'Could not load this form check.')} onRetry={() => void loadMeta()} />
      </CoachingScreen>
    );
  }

  const title = meta.formCheck.exerciseSlug ? formatSlug(meta.formCheck.exerciseSlug) : 'Form check';

  return (
    <CoachingScreen
      keyboardAvoiding
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={DW_ACCENT} />
      }
    >
      <CoachingHeader
        title={title}
        subtitle={roleLabel}
        trailing={<StatusBadge tone={meta.formCheck.status} />}
      />

      <View style={styles.videoWrap}>
        {source ? (
          <VideoView style={styles.video} player={player} contentFit="contain" nativeControls />
        ) : videoError ? (
          <View style={styles.videoPlaceholder}>
            <VideoIcon size={22} color={DW_TEXT.tertiary} />
            <Text style={styles.placeholderText}>{videoError}</Text>
            <Pressable
              style={({ pressed }) => [styles.videoRetry, pressed && { opacity: 0.85 }]}
              onPress={() => void fetchSource()}
              accessibilityRole="button"
              accessibilityLabel="Retry loading video"
            >
              <Text style={styles.videoRetryText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.videoPlaceholder}>
            <ActivityIndicator color={DW_ACCENT} />
            <Text style={styles.placeholderText}>Loading video…</Text>
          </View>
        )}
      </View>

      {meta.formCheck.note ? <Text style={styles.checkNote}>“{meta.formCheck.note}”</Text> : null}
      <View style={styles.metaRow}>
        <Text style={styles.metaLine}>
          Sent {formatDateLabel(meta.formCheck.createdAt)}
          {meta.formCheck.durationSeconds ? ` · ${formatClock(meta.formCheck.durationSeconds)}` : ''}
        </Text>
        {meta.formCheck.authorUserId !== userId ? (
          <Pressable
            style={({ pressed }) => [styles.reportChip, pressed && { opacity: 0.75 }]}
            onPress={() => handleReport('form_check', meta.formCheck.id)}
            accessibilityRole="button"
            accessibilityLabel="Report this form check"
          >
            <Flag size={12} color={DW_TEXT.tertiary} />
            <Text style={styles.reportChipText}>Report</Text>
          </Pressable>
        ) : null}
      </View>

      <SectionLabel>Feedback</SectionLabel>
      {feedbackError ? (
        <View style={styles.feedbackErrorCard}>
          <Text style={styles.feedbackErrorText}>{feedbackError}</Text>
          <Pressable
            style={({ pressed }) => [styles.videoRetry, pressed && { opacity: 0.85 }]}
            onPress={() => void loadMeta()}
            accessibilityRole="button"
            accessibilityLabel="Retry loading feedback"
          >
            <Text style={styles.videoRetryText}>Retry</Text>
          </Pressable>
        </View>
      ) : feedback.length === 0 ? (
        <Text style={styles.emptyLine}>
          {linkEnded
            ? 'No feedback was left on this check.'
            : meta.isTrainer
              ? 'No feedback yet. Add the first note below.'
              : 'No feedback yet.'}
        </Text>
      ) : (
        <View style={styles.list}>
          {feedback.map((item) => (
            <FeedbackRow
              key={item.id}
              item={item}
              isMine={item.authorUserId === userId}
              onSeek={() =>
                item.videoTimestampSeconds !== null ? seekTo(item.videoTimestampSeconds) : undefined
              }
              onPlayReply={() =>
                router.push(`/(root)/player?formCheckId=${meta.formCheck.id}&feedbackId=${item.id}`)
              }
              onReport={() => handleReport('form_feedback', item.id)}
            />
          ))}
        </View>
      )}

      {linkEnded ? (
        <View style={styles.endedCard}>
          <Text style={styles.endedTitle}>Coaching ended</Text>
          <Text style={styles.endedBody}>
            This coaching relationship has ended, so the thread is read-only. Past videos and
            feedback stay available to both of you.
          </Text>
        </View>
      ) : (
        <>
      <SectionLabel>{meta.isTrainer ? 'Add feedback' : 'Reply'}</SectionLabel>
      <Card>
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        <TextInput
          style={styles.input}
          value={body}
          onChangeText={setBody}
          placeholder={meta.isTrainer ? 'Cue the fix, tag a moment…' : 'Ask a question or reply…'}
          placeholderTextColor={DW_TEXT.disabled}
          multiline
          maxLength={MAX_FEEDBACK_BODY}
          accessibilityLabel="Feedback note"
        />

        <Pressable
          style={styles.timestampRow}
          onPress={() => setAttachTimestamp((v) => !v)}
          accessibilityRole="switch"
          accessibilityState={{ checked: attachTimestamp }}
        >
          <View style={styles.timestampLabel}>
            <Clock size={16} color={DW_TEXT.secondary} />
            <Text style={styles.timestampText}>Attach current timestamp</Text>
          </View>
          <Switch
            value={attachTimestamp}
            onValueChange={setAttachTimestamp}
            trackColor={{ false: DW_SURFACES.high, true: DW_ACCENT }}
            thumbColor={DW_TEXT.primary}
          />
        </Pressable>

        {uploadingReply ? (
          <View style={styles.uploadRow}>
            <Text style={styles.uploadText}>Uploading reply… {Math.round(replyProgress * 100)}%</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(replyProgress * 100)}%` }]} />
            </View>
          </View>
        ) : (
          <View style={styles.composerActions}>
            <Pressable
              style={({ pressed }) => [styles.postButton, pressed && { opacity: 0.86 }, posting && { opacity: 0.5 }]}
              onPress={() => void handlePostText()}
              disabled={posting}
              accessibilityRole="button"
              accessibilityLabel="Send feedback"
            >
              <MessageSquarePlus size={18} color={DW_ON_ACCENT} />
              <Text style={styles.postButtonText}>{posting ? 'Sending…' : 'Send'}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.replyButton, pressed && { opacity: 0.8 }]}
              onPress={() => void handleVideoReply('camera')}
              accessibilityRole="button"
              accessibilityLabel="Record a video reply"
            >
              <VideoIcon size={18} color={DW_TEXT.primary} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.replyButton, pressed && { opacity: 0.8 }]}
              onPress={() => void handleVideoReply('library')}
              accessibilityRole="button"
              accessibilityLabel="Attach a video reply"
            >
              <Play size={18} color={DW_TEXT.primary} />
            </Pressable>
          </View>
        )}
      </Card>
        </>
      )}
    </CoachingScreen>
  );
}

function FeedbackRow({
  item,
  isMine,
  onSeek,
  onPlayReply,
  onReport,
}: {
  item: FormFeedback;
  isMine: boolean;
  onSeek: () => void;
  onPlayReply: () => void;
  onReport: () => void;
}) {
  const hasTimestamp = item.videoTimestampSeconds !== null;
  return (
    <View style={[styles.feedbackRow, isMine && styles.feedbackMine]}>
      <View style={styles.feedbackTop}>
        <Text style={styles.feedbackAuthor}>{isMine ? 'You' : 'Coach'}</Text>
        <View style={styles.feedbackTopRight}>
          <Text style={styles.feedbackTime}>{formatDateLabel(item.createdAt)}</Text>
          {!isMine ? (
            <Pressable
              onPress={onReport}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Report this feedback"
            >
              <Flag size={13} color={DW_TEXT.tertiary} />
            </Pressable>
          ) : null}
        </View>
      </View>
      {item.body ? <Text style={styles.feedbackBody}>{item.body}</Text> : null}
      <View style={styles.feedbackActions}>
        {hasTimestamp ? (
          <Pressable
            style={({ pressed }) => [styles.chip, pressed && { opacity: 0.8 }]}
            onPress={onSeek}
            accessibilityRole="button"
            accessibilityLabel={`Jump to ${formatClock(item.videoTimestampSeconds ?? 0)}`}
          >
            <Clock size={13} color={DW_ACCENT} />
            <Text style={styles.chipText}>{formatClock(item.videoTimestampSeconds ?? 0)}</Text>
          </Pressable>
        ) : null}
        {item.replyStoragePath ? (
          <Pressable
            style={({ pressed }) => [styles.chip, pressed && { opacity: 0.8 }]}
            onPress={onPlayReply}
            accessibilityRole="button"
            accessibilityLabel="Play video reply"
          >
            <Play size={13} color={DW_ACCENT} />
            <Text style={styles.chipText}>Video reply</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
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
  videoWrap: {
    marginHorizontal: 16,
    aspectRatio: 16 / 9,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  video: {
    flex: 1,
  },
  videoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  placeholderText: {
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    color: DW_TEXT.secondary,
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 18,
  },
  videoRetry: {
    marginTop: 4,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: DW_BORDER.default,
    backgroundColor: DW_SURFACES.mid,
  },
  videoRetryText: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 13,
    color: DW_TEXT.primary,
    letterSpacing: 0.3,
  },
  checkNote: {
    fontFamily: WK_FONTS.medium,
    fontSize: 15,
    color: DW_TEXT.primary,
    paddingHorizontal: 20,
    fontStyle: 'italic',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 20,
  },
  metaLine: {
    fontFamily: WK_FONTS.regular,
    fontSize: 12,
    color: DW_TEXT.tertiary,
    paddingHorizontal: 20,
  },
  reportChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  reportChipText: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 12,
    color: DW_TEXT.tertiary,
  },
  feedbackErrorCard: {
    marginHorizontal: 16,
    backgroundColor: 'rgba(255, 107, 107, 0.08)',
    borderColor: 'rgba(255, 107, 107, 0.28)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 10,
    alignItems: 'flex-start',
  },
  feedbackErrorText: {
    fontFamily: WK_FONTS.medium,
    fontSize: 13,
    color: '#FF8B7A',
    lineHeight: 19,
  },
  endedCard: {
    marginHorizontal: 16,
    backgroundColor: DW_SURFACES.low,
    borderColor: DW_BORDER.subtle,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  endedTitle: {
    fontFamily: WK_FONTS.bold,
    fontSize: 14,
    color: DW_TEXT.primary,
  },
  endedBody: {
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    color: DW_TEXT.secondary,
    lineHeight: 19,
  },
  feedbackTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  feedbackRow: {
    backgroundColor: DW_SURFACES.low,
    borderColor: DW_BORDER.subtle,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  feedbackMine: {
    borderColor: 'rgba(255, 139, 51, 0.3)',
    backgroundColor: 'rgba(255, 107, 0, 0.06)',
  },
  feedbackTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feedbackAuthor: {
    fontFamily: WK_FONTS.bold,
    fontSize: 13,
    color: DW_TEXT.primary,
  },
  feedbackTime: {
    fontFamily: WK_FONTS.regular,
    fontSize: 11,
    color: DW_TEXT.tertiary,
  },
  feedbackBody: {
    fontFamily: WK_FONTS.regular,
    fontSize: 14,
    color: DW_TEXT.secondary,
    lineHeight: 20,
  },
  feedbackActions: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 107, 0, 0.12)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipText: {
    fontFamily: WK_FONTS.bold,
    fontSize: 12,
    color: DW_ACCENT,
  },
  input: {
    minHeight: 72,
    backgroundColor: DW_SURFACES.mid,
    borderColor: DW_BORDER.subtle,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: WK_FONTS.regular,
    fontSize: 15,
    color: DW_TEXT.primary,
    textAlignVertical: 'top',
  },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timestampLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timestampText: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 14,
    color: DW_TEXT.secondary,
  },
  composerActions: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  postButton: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: DW_ACCENT,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postButtonText: {
    fontFamily: WK_FONTS.bold,
    fontSize: 15,
    color: DW_ON_ACCENT,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  replyButton: {
    width: 50,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: DW_BORDER.default,
    backgroundColor: DW_SURFACES.mid,
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
});
