// Voice-controlled signed-playback screen. Loads a short-lived signed URL for a
// trainer video or a form check, plays it with expo-video, and layers the
// hands-free VoiceCoach on top. Landscape is allowed only while this screen is
// focused; portrait is restored on blur.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView, isPictureInPictureSupported } from 'expo-video';
import { useKeepAwake } from 'expo-keep-awake';
import * as ScreenOrientation from 'expo-screen-orientation';
import {
  Check,
  ChevronLeft,
  Download,
  FastForward,
  PictureInPicture2,
  Rewind,
  Trash2,
  X,
} from 'lucide-react-native';
import {
  PLAYER_RATE_LADDER,
  stepRate,
  WK_FONTS,
  type PlayerVoiceMatch,
} from '@mylife/workouts';
import type { DatabaseAdapter } from '@mylife/db';
import { useDatabase } from './providers/DatabaseProvider';
import { useDoWorkCloud } from './providers/DoWorkCloudProvider';
import {
  getPlaybackSource,
  isExpired,
  type PlaybackParams,
  type PlaybackSource,
} from './data/cloud-playback';
import {
  deleteDownload,
  isVideoDownloaded,
  resolveDownloadedVideo,
  startVideoDownload,
  type DownloadHandle,
} from './data/downloads';
import { VoiceCoach } from './components/VoiceCoach';
import { friendlyError } from './data/friendly-errors';
import { getVoiceSettings } from '../../lib/voice/voice-settings';
import { describeCommand } from '../../lib/voice/voice-coach-core';
import { clampTime, formatClock, formatRemaining, resolveSeekDelta } from '../../lib/voice/player-format';
import { DW_ACCENT, DW_BORDER, DW_ON_ACCENT, DW_SURFACES, DW_TEXT } from './theme/tokens';

const RESUME_PREFIX = 'voice.player.resume.';
const RESUME_INTERVAL_MS = 10_000;
const MIN_RESUME_SECONDS = 3;
const EXPIRY_POLL_INTERVAL_MS = 60_000;

function getResumeSeconds(db: DatabaseAdapter, key: string): number {
  const rows = db.query<{ value: string }>(
    'SELECT value FROM hub_settings WHERE key = ? LIMIT 1',
    [`${RESUME_PREFIX}${key}`],
  );
  const raw = rows[0]?.value;
  const value = raw ? Number.parseFloat(raw) : NaN;
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function setResumeSeconds(db: DatabaseAdapter, key: string, seconds: number): void {
  db.execute(
    `INSERT INTO hub_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [`${RESUME_PREFIX}${key}`, String(Math.floor(seconds))],
  );
}

// hub_settings has no LRU cap on resume rows today, so they grow unbounded
// across every video ever opened. Deleting on a confirmed revoke keeps dead
// entitlements from accumulating; a future pass should add a broader prune
// (e.g. cap by row count or age) for videos that are never revoked but also
// never resumed again.
function clearResumeSeconds(db: DatabaseAdapter, key: string): void {
  db.execute('DELETE FROM hub_settings WHERE key = ?', [`${RESUME_PREFIX}${key}`]);
}

type LoadState =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'ready'; source: PlaybackSource; local: boolean };

type DownloadUiState = 'idle' | 'active' | 'done';

export default function PlayerScreen() {
  const db = useDatabase();
  const router = useRouter();
  const { supabase } = useDoWorkCloud();
  const params = useLocalSearchParams<{
    videoId?: string;
    formCheckId?: string;
    feedbackId?: string;
    title?: string;
  }>();

  const videoId = params.videoId ?? null;
  const formCheckId = params.formCheckId ?? null;
  const feedbackId = params.feedbackId ?? null;

  const playbackParams = useMemo<PlaybackParams | null>(() => {
    if (videoId) return { videoId };
    if (formCheckId) return feedbackId ? { formCheckId, feedbackId } : { formCheckId };
    return null;
  }, [videoId, formCheckId, feedbackId]);

  const resumeKey = videoId ?? (formCheckId ? `form:${formCheckId}` : null);

  useKeepAwake();

  const [load, setLoad] = useState<LoadState>({ state: 'loading' });
  const [settings, setSettings] = useState(() => getVoiceSettings(db));
  const [rate, setRate] = useState(1);
  const [toast, setToast] = useState<string | null>(null);
  const [pipSupported, setPipSupported] = useState(false);
  // Set when a mid-playback error survives the single refresh attempt, so the
  // frozen frame gets the same error UI the initial load uses instead of nothing.
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  // Offline-download state. Only trainer videos are downloadable; form checks
  // are never saved to the sandbox.
  const isDownloadable = Boolean(videoId);
  const [downloaded, setDownloaded] = useState(() => (videoId ? isVideoDownloaded(db, videoId) : false));
  const [downloadUi, setDownloadUi] = useState<DownloadUiState>('idle');
  const [downloadFraction, setDownloadFraction] = useState(0);
  const downloadHandleRef = useRef<DownloadHandle | null>(null);

  const expiresAtRef = useRef<string | null>(null);
  const loadedUrlRef = useRef<string | null>(null);
  const refreshedForErrorRef = useRef(false);
  // Local playback has no signed URL to refresh; this gates the expiry paths.
  const isLocalRef = useRef(false);
  const videoRef = useRef<VideoView>(null);
  // True for the duration of refreshExpiredSource. Voice commands, seek, rate,
  // and the rail buttons no-op honestly instead of racing player.replace().
  const isRefreshingRef = useRef(false);

  const player = useVideoPlayer(null, (instance) => {
    instance.timeUpdateEventInterval = 5;
    instance.staysActiveInBackground = false;
  });

  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const { status } = useEvent(player, 'statusChange', { status: player.status });

  const showToast = useCallback((text: string) => {
    setToast(text);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 1600);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    setPipSupported(isPictureInPictureSupported());
  }, []);

  // Landscape only while focused; restore portrait on blur. On iOS the
  // expo-screen-orientation native hook overrides the portrait Info.plist lock
  // for the focused screen. Real-device rotation behaviour is a Phase 7 QA item.
  useFocusEffect(
    useCallback(() => {
      ScreenOrientation.unlockAsync().catch(() => {});
      setSettings(getVoiceSettings(db));
      return () => {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      };
    }, [db]),
  );

  const fetchSource = useCallback(async () => {
    if (!playbackParams) {
      setLoad({ state: 'error', message: 'No video was specified.' });
      return;
    }
    setLoad({ state: 'loading' });

    // Downloaded trainer videos play from the sandbox: no signed-URL fetch, and
    // playback works offline. Entitlement is re-verified honestly first; if the
    // server has definitively revoked access the file is deleted and we say so,
    // but a transient/offline check never removes content the user owns.
    if (videoId) {
      const resolved = await resolveDownloadedVideo({ supabase, db, videoId });
      if (resolved.status === 'revoked') {
        setDownloaded(false);
        setDownloadUi('idle');
        isLocalRef.current = false;
        // The entitlement is gone for good; the saved playhead for it is dead
        // weight in hub_settings, not something the user will resume into.
        clearResumeSeconds(db, videoId);
        setLoad({ state: 'error', message: resolved.message });
        return;
      }
      if (resolved.status === 'play_local') {
        setDownloaded(true);
        setDownloadUi('done');
        isLocalRef.current = true;
        expiresAtRef.current = null;
        setLoad({
          state: 'ready',
          local: true,
          source: {
            url: resolved.fileUri,
            expiresAt: '',
            kind: 'trainer_video',
            title: resolved.entry.title,
            durationSeconds: null,
          },
        });
        return;
      }
      // not_downloaded -> stream below.
      setDownloaded(false);
    }

    if (!supabase) {
      setLoad({ state: 'error', message: 'Video playback needs a cloud connection.' });
      return;
    }
    const result = await getPlaybackSource(supabase, playbackParams);
    if (!result.ok) {
      // Machine codes (not_entitled, not_found, ...) never reach the screen raw.
      setLoad({
        state: 'error',
        message: friendlyError(result.error, 'This video could not be loaded.'),
      });
      return;
    }
    isLocalRef.current = false;
    expiresAtRef.current = result.expiresAt;
    setLoad({ state: 'ready', local: false, source: result });
  }, [supabase, db, playbackParams, videoId]);

  useEffect(() => {
    void fetchSource();
  }, [fetchSource]);

  // Initial (or param-changed) load: attach the source, resume, and play.
  useEffect(() => {
    if (load.state !== 'ready') return;
    if (loadedUrlRef.current === load.source.url) return;
    loadedUrlRef.current = load.source.url;
    player.replace({
      uri: load.source.url,
      metadata: load.source.title ? { title: load.source.title } : undefined,
    });
    const resume = resumeKey ? getResumeSeconds(db, resumeKey) : 0;
    if (resume > MIN_RESUME_SECONDS) {
      player.currentTime = resume;
      showToast(`Resumed at ${formatClock(resume)}`);
    }
    player.play();
  }, [load, player, db, resumeKey, showToast]);

  // Seamless swap when the signed URL is close to expiry or the player errors:
  // refetch and restore the exact playhead without dropping the session. Returns
  // null on recovery, or a raw error string when the refresh could not recover so
  // the caller can surface friendly copy.
  const refreshExpiredSource = useCallback(async (): Promise<string | null> => {
    // A local file has no signed URL to refresh; the retry path re-attaches it.
    if (isLocalRef.current) return 'local_playback_failed';
    if (!supabase || !playbackParams) return 'Video playback needs a cloud connection.';
    isRefreshingRef.current = true;
    try {
      let preserved = 0;
      let wasPlaying = false;
      try {
        preserved = player.currentTime;
        wasPlaying = player.playing;
      } catch {
        // player may be mid-teardown
      }
      const result = await getPlaybackSource(supabase, playbackParams);
      if (!result.ok) return result.error;
      expiresAtRef.current = result.expiresAt;
      loadedUrlRef.current = result.url;
      player.replace({
        uri: result.url,
        metadata: result.title ? { title: result.title } : undefined,
      });
      if (preserved > 0) player.currentTime = preserved;
      if (wasPlaying) player.play();
      return null;
    } finally {
      isRefreshingRef.current = false;
    }
  }, [supabase, playbackParams, player]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && expiresAtRef.current && isExpired(expiresAtRef.current)) {
        void refreshExpiredSource();
      }
    });
    return () => sub.remove();
  }, [refreshExpiredSource]);

  // AppState only fires on foreground/background transitions, so a screen left
  // active and foregrounded (the common case mid-workout) never re-checked
  // expiry on its own; the signed URL could go stale while fully in view.
  // Poll independently of AppState so expiry is always caught proactively.
  useEffect(() => {
    const id = setInterval(() => {
      if (expiresAtRef.current && isExpired(expiresAtRef.current)) {
        void refreshExpiredSource();
      }
    }, EXPIRY_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refreshExpiredSource]);

  // One refresh attempt on a player error (commonly an expired signed URL). If
  // that single attempt cannot recover (e.g. the network died mid-playback), the
  // frozen frame gets the load-error UI instead of a silent dead player.
  useEffect(() => {
    if (status === 'error' && !refreshedForErrorRef.current) {
      refreshedForErrorRef.current = true;
      void (async () => {
        const failure = await refreshExpiredSource();
        // Recovery flips status to readyToPlay and that branch clears the overlay.
        if (failure) setPlaybackError(friendlyError(failure));
      })();
    }
    if (status === 'readyToPlay') {
      refreshedForErrorRef.current = false;
      setPlaybackError(null);
    }
  }, [status, refreshExpiredSource]);

  // Retry from the error overlay: persist the exact playhead, then re-run the
  // full source fetch so streaming re-signs and downloads re-attach, resuming in
  // place. Clearing loadedUrlRef forces the load effect to re-apply the source
  // even when the URL is unchanged (local files).
  const retryPlayback = useCallback(() => {
    if (resumeKey) {
      try {
        if (player.currentTime > 0) setResumeSeconds(db, resumeKey, player.currentTime);
      } catch {
        // player mid-error; fall back to the last persisted position
      }
    }
    setPlaybackError(null);
    refreshedForErrorRef.current = false;
    loadedUrlRef.current = null;
    void fetchSource();
  }, [fetchSource, player, db, resumeKey]);

  // Persist the resume position every 10 s while playing and once on unmount.
  useEffect(() => {
    const id = setInterval(() => {
      if (!resumeKey) return;
      try {
        if (player.playing && player.currentTime > 0) {
          setResumeSeconds(db, resumeKey, player.currentTime);
        }
      } catch {
        // ignore transient player access errors
      }
    }, RESUME_INTERVAL_MS);
    return () => {
      clearInterval(id);
      if (!resumeKey) return;
      try {
        if (player.currentTime > 0) setResumeSeconds(db, resumeKey, player.currentTime);
      } catch {
        // player released during teardown
      }
    };
  }, [player, db, resumeKey]);

  const applyRate = useCallback(
    (next: number) => {
      if (isRefreshingRef.current) {
        showToast('Reconnecting, try again in a moment');
        return;
      }
      player.playbackRate = next;
      setRate(next);
    },
    [player, showToast],
  );

  const seekBy = useCallback(
    (deltaSeconds: number) => {
      if (isRefreshingRef.current) {
        showToast('Reconnecting, try again in a moment');
        return;
      }
      let duration = 0;
      try {
        duration = player.duration;
      } catch {
        duration = 0;
      }
      player.currentTime = clampTime(player.currentTime + deltaSeconds, duration);
    },
    [player, showToast],
  );

  const cycleRate = useCallback(() => {
    const index = PLAYER_RATE_LADDER.indexOf(rate as (typeof PLAYER_RATE_LADDER)[number]);
    const next = PLAYER_RATE_LADDER[(index + 1) % PLAYER_RATE_LADDER.length];
    applyRate(next);
  }, [rate, applyRate]);

  const titleText = load.state === 'ready' ? load.source.title ?? params.title ?? null : params.title ?? null;

  // Cancel any in-flight download when the screen unmounts so a background
  // task can't outlive the player.
  useEffect(() => {
    return () => {
      void downloadHandleRef.current?.cancel();
    };
  }, []);

  const startDownload = useCallback(() => {
    if (!videoId || !supabase) return;
    setDownloadUi('active');
    setDownloadFraction(0);
    const handle = startVideoDownload(
      { supabase, db, videoId, title: titleText },
      { onProgress: (progress) => setDownloadFraction(progress.fraction) },
    );
    downloadHandleRef.current = handle;
    void handle.promise
      .then((result) => {
        downloadHandleRef.current = null;
        if (result.ok) {
          setDownloaded(true);
          setDownloadUi('done');
          showToast('Saved for offline');
        } else if (result.cancelled) {
          setDownloadUi('idle');
        } else {
          setDownloadUi('idle');
          showToast(result.error);
        }
      })
      .catch((error: unknown) => {
        // A thrown rejection (e.g. full disk) must not leave the rail pinned
        // on 'active' forever with no way to retry.
        downloadHandleRef.current = null;
        setDownloadUi('idle');
        showToast(friendlyError(error instanceof Error ? error.message : String(error)));
      });
  }, [videoId, supabase, db, titleText, showToast]);

  const cancelDownload = useCallback(() => {
    void downloadHandleRef.current?.cancel();
  }, []);

  const removeDownload = useCallback(() => {
    if (!videoId) return;
    Alert.alert(
      'Remove download?',
      'This video will play from the internet instead. You can download it again anytime.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            void deleteDownload(db, videoId).then(() => {
              setDownloaded(false);
              setDownloadUi('idle');
              showToast('Download removed');
            });
          },
        },
      ],
    );
  }, [videoId, db, showToast]);

  // Executes an accepted voice command and returns the toast label. Honest
  // about drops: a command spoken mid-refresh is never silently applied
  // against the pre-refresh player, and the toast never claims success it
  // did not deliver.
  const handleVoiceCommand = useCallback(
    (match: PlayerVoiceMatch): string => {
      if (isRefreshingRef.current) {
        return 'Reconnecting, try that again';
      }
      const action = match.action;
      let duration = 0;
      try {
        duration = player.duration;
      } catch {
        duration = 0;
      }
      switch (action.kind) {
        case 'pause':
          player.pause();
          return 'Paused';
        case 'play':
          player.play();
          return 'Playing';
        case 'restart':
          player.currentTime = 0;
          player.play();
          return 'From the top';
        case 'seek': {
          const delta = resolveSeekDelta(action.deltaSeconds, match.raw, settings.seekSeconds);
          player.currentTime = clampTime(player.currentTime + delta, duration);
          return describeCommand({ kind: 'seek', deltaSeconds: delta });
        }
        case 'rate_step': {
          const next = stepRate(rate, action.direction);
          applyRate(next);
          return describeCommand(action, next);
        }
        case 'rate_set':
          applyRate(action.rate);
          return describeCommand(action, action.rate);
        case 'info': {
          if (action.query === 'current_exercise') {
            return titleText ?? 'This exercise';
          }
          let current = 0;
          try {
            current = player.currentTime;
          } catch {
            current = 0;
          }
          return `${formatRemaining(current, duration)} left`;
        }
      }
    },
    [player, rate, applyRate, settings.seekSeconds, titleText],
  );

  if (load.state === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={DW_ACCENT} />
        <Text style={styles.centeredText}>Loading video…</Text>
      </View>
    );
  }

  if (load.state === 'error') {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Can&rsquo;t play this video</Text>
        <Text style={styles.centeredText}>{load.message}</Text>
        <Pressable
          style={({ pressed }) => [styles.retryButton, pressed && { opacity: 0.86 }]}
          onPress={() => void fetchSource()}
          accessibilityRole="button"
        >
          <Text style={styles.retryLabel}>Retry</Text>
        </Pressable>
        <Pressable style={styles.backLink} onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.backLinkText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <VideoView
        ref={videoRef}
        style={styles.video}
        player={player}
        contentFit="contain"
        nativeControls
        allowsFullscreen
        allowsPictureInPicture={pipSupported}
        startsPictureInPictureAutomatically={false}
      />

      <View style={styles.topBar} pointerEvents="box-none">
        <Pressable
          style={styles.iconButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ChevronLeft size={22} color={DW_TEXT.primary} />
        </Pressable>
        {titleText ? (
          <Text style={styles.title} numberOfLines={1}>
            {titleText}
          </Text>
        ) : (
          <View style={styles.titleSpacer} />
        )}
        {downloaded ? (
          <View style={styles.downloadedBadge} accessibilityLabel="Downloaded for offline">
            <Check size={12} color={DW_ACCENT} />
            <Text style={styles.downloadedBadgeText}>Downloaded</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.rail} pointerEvents="box-none">
        <Pressable
          style={styles.railButton}
          onPress={() => seekBy(-settings.seekSeconds)}
          accessibilityRole="button"
          accessibilityLabel={`Back ${settings.seekSeconds} seconds`}
        >
          <Rewind size={18} color={DW_TEXT.primary} />
          <Text style={styles.railButtonText}>{settings.seekSeconds}</Text>
        </Pressable>

        <Pressable
          style={styles.railButton}
          onPress={cycleRate}
          accessibilityRole="button"
          accessibilityLabel={`Playback speed ${rate}x`}
        >
          <Text style={styles.rateText}>{rate}x</Text>
        </Pressable>

        <Pressable
          style={styles.railButton}
          onPress={() => seekBy(settings.seekSeconds)}
          accessibilityRole="button"
          accessibilityLabel={`Forward ${settings.seekSeconds} seconds`}
        >
          <FastForward size={18} color={DW_TEXT.primary} />
          <Text style={styles.railButtonText}>{settings.seekSeconds}</Text>
        </Pressable>

        {pipSupported ? (
          <Pressable
            style={styles.railButton}
            onPress={() => videoRef.current?.startPictureInPicture()}
            accessibilityRole="button"
            accessibilityLabel="Picture in picture"
          >
            <PictureInPicture2 size={18} color={DW_TEXT.primary} />
          </Pressable>
        ) : null}

        {isDownloadable && supabase ? (
          downloadUi === 'active' ? (
            <Pressable
              style={styles.railButton}
              onPress={cancelDownload}
              accessibilityRole="button"
              accessibilityLabel={`Cancel download, ${Math.round(downloadFraction * 100)} percent`}
            >
              <X size={16} color={DW_TEXT.primary} />
              <Text style={styles.railButtonText}>
                {downloadFraction > 0 ? `${Math.round(downloadFraction * 100)}%` : '…'}
              </Text>
            </Pressable>
          ) : downloaded ? (
            <Pressable
              style={styles.railButton}
              onPress={removeDownload}
              accessibilityRole="button"
              accessibilityLabel="Remove offline download"
            >
              <Trash2 size={16} color={DW_TEXT.primary} />
            </Pressable>
          ) : (
            <Pressable
              style={styles.railButton}
              onPress={startDownload}
              accessibilityRole="button"
              accessibilityLabel="Download for offline"
            >
              <Download size={18} color={DW_TEXT.primary} />
            </Pressable>
          )
        ) : null}
      </View>

      {toast ? (
        <View style={styles.screenToast} pointerEvents="none">
          <Text style={styles.screenToastText}>{toast}</Text>
        </View>
      ) : null}

      <VoiceCoach enabled={settings.enabled} playing={isPlaying} onCommand={handleVoiceCommand} />

      {playbackError ? (
        <View style={styles.playbackErrorOverlay}>
          <Text style={styles.errorTitle}>Can&rsquo;t play this video</Text>
          <Text style={styles.centeredText}>{playbackError}</Text>
          <Pressable
            style={({ pressed }) => [styles.retryButton, pressed && { opacity: 0.86 }]}
            onPress={retryPlayback}
            accessibilityRole="button"
            accessibilityLabel="Retry playback"
          >
            <Text style={styles.retryLabel}>Retry</Text>
          </Pressable>
          <Pressable
            style={styles.backLink}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.backLinkText}>Go back</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000',
  },
  video: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: DW_SURFACES.base,
    gap: 12,
    paddingHorizontal: 32,
  },
  playbackErrorOverlay: {
    ...StyleSheet.absoluteFillObject,
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
  topBar: {
    position: 'absolute',
    top: 44,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderWidth: 1,
    borderColor: DW_BORDER.subtle,
  },
  title: {
    flex: 1,
    fontFamily: WK_FONTS.semiBold,
    fontSize: 15,
    color: DW_TEXT.primary,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowRadius: 4,
  },
  titleSpacer: {
    flex: 1,
  },
  downloadedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    height: 26,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderWidth: 1,
    borderColor: DW_BORDER.default,
  },
  downloadedBadgeText: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 11,
    color: DW_ACCENT,
  },
  rail: {
    position: 'absolute',
    top: 44,
    right: 12,
    flexDirection: 'column',
    gap: 10,
    alignItems: 'flex-end',
  },
  railButton: {
    minWidth: 44,
    height: 44,
    paddingHorizontal: 10,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderWidth: 1,
    borderColor: DW_BORDER.default,
  },
  railButtonText: {
    fontFamily: WK_FONTS.bold,
    fontSize: 11,
    color: DW_TEXT.primary,
  },
  rateText: {
    fontFamily: WK_FONTS.bold,
    fontSize: 14,
    color: DW_ACCENT,
  },
  screenToast: {
    position: 'absolute',
    top: 100,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  screenToastText: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 13,
    color: DW_TEXT.primary,
  },
});
