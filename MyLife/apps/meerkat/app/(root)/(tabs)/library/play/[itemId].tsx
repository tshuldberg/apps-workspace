// Plan 38 Phase 6a (MOBILE): the A/V player. In a dev build it plays the item's
// sealed blocks through the on-device loopback range server (loopback-server.ts):
// no A/V plaintext is ever written to disk; the native player pulls verified,
// decrypt-on-the-fly ranges over 127.0.0.1. In Expo Go (no loopback native
// module) it falls back HONESTLY -- it offers to open the file with another app,
// which exports a decrypted copy, always behind an explicit warning. Resume comes
// from cm_library_progress (personal, your own devices only). For a music library
// it drives a device-local queue with next/previous and, in a dev build with
// react-native-track-player, mirrors state onto the OS transport controls.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { encodeBase64 } from 'tweetnacl-util';
import { ArrowLeft, Pause, Play, SkipBack, SkipForward, Share2 } from 'lucide-react-native';
import { useMeerkatDatabase } from '../../../providers/DatabaseProvider';
import { useNode } from '../../../providers/NodeProvider';
import { useIdentity } from '../../../providers/IdentityProvider';
import { useSync } from '../../../providers/SyncProvider';
import { Button, HonestNotice } from '../../../components/kit';
import { MK_RADIUS, type MkColors } from '../../../theme/tokens';
import { useAppThemeColors, useMkStyles } from '../../../providers/AppThemeProvider';
import {
  getLibrary,
  getLibraryItem,
  getLibraryProgress,
  listLibraryItems,
  openLibraryItemContent,
  setLibraryProgress,
} from '../../../data/library-store-core';
import {
  startLoopbackServer,
  LOOPBACK_UNAVAILABLE,
  type RunningLoopbackServer,
} from '../../../data/loopback-server';
import {
  loadTrackPlayerBackend,
  type TrackPlayerBackend,
} from '../../../data/track-player-backend';
import {
  musicQueueReducer,
  currentTrack as selectCurrent,
  hasNext as selectHasNext,
  hasPrevious as selectHasPrevious,
  EMPTY_QUEUE,
  type MusicQueueState,
  type QueueTrack,
} from '../../../data/music-queue-core';
import type { LibraryItemEvent } from '../../../data/library-data-core';

// Canonical honest strings (locked wording; never a fake "playing" status).
const NOT_PLAYABLE_EXPO_GO =
  'Not playable in Expo Go. Use a dev build for in-app playback, or open with another app (this exports a decrypted copy).';
const EXPORT_WARNING = 'This exports a decrypted copy outside Meerkat.';

type Phase = 'starting' | 'ready' | 'expo_go' | 'locked' | 'error';

function isMusic(mime: string | null): boolean {
  return (mime ?? '').toLowerCase().startsWith('audio/');
}

export default function LibraryPlayerScreen() {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const db = useMeerkatDatabase();
  const { store } = useNode();
  const { identity } = useIdentity();
  const { recordLocalChange } = useSync();
  const { itemId } = useLocalSearchParams<{ itemId: string }>();

  const initialItem = useMemo(() => (itemId ? getLibraryItem(db, itemId) : null), [db, itemId]);
  const config = useMemo(() => (initialItem ? getLibrary(db, initialItem.channelId) : null), [db, initialItem]);
  const musicMode = config?.mediaType === 'music';

  // Device-local queue: for a music library, the sibling audio items; otherwise
  // a single-track queue. Never synced, never leaks what you play.
  const [queue, setQueue] = useState<MusicQueueState>(EMPTY_QUEUE);
  useEffect(() => {
    if (!initialItem) return;
    if (musicMode) {
      const siblings = listLibraryItems(db, initialItem.channelId)
        .filter((r) => isMusic(r.event.mimeType))
        .map<QueueTrack>((r) => ({
          itemId: r.event.id,
          channelId: r.event.channelId,
          communityId: r.event.communityId,
          title: r.event.title,
          artist: readArtist(r.event),
          durationMs: r.event.durationMs,
        }));
      const start = Math.max(0, siblings.findIndex((t) => t.itemId === initialItem.id));
      setQueue(musicQueueReducer(EMPTY_QUEUE, { type: 'set', tracks: siblings, startIndex: start }));
    } else {
      setQueue(musicQueueReducer(EMPTY_QUEUE, {
        type: 'set',
        tracks: [{
          itemId: initialItem.id,
          channelId: initialItem.channelId,
          communityId: initialItem.communityId,
          title: initialItem.title,
          artist: readArtist(initialItem),
          durationMs: initialItem.durationMs,
        }],
      }));
    }
  }, [db, initialItem, musicMode]);

  const track = selectCurrent(queue);
  const activeItem = useMemo(
    () => (track ? getLibraryItem(db, track.itemId) : initialItem),
    [db, track, initialItem],
  );

  const [phase, setPhase] = useState<Phase>('starting');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const serverRef = useRef<RunningLoopbackServer | null>(null);
  const trackPlayerRef = useRef<TrackPlayerBackend | null>(null);
  const activeItemRef = useRef<LibraryItemEvent | null>(null);
  activeItemRef.current = activeItem;

  const player = useVideoPlayer(null, (instance) => {
    instance.timeUpdateEventInterval = 5;
    instance.staysActiveInBackground = musicMode;
  });

  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });

  // Persist resume position (personal_replica: your own devices only).
  const saveProgress = useCallback((completed: boolean) => {
    const it = activeItemRef.current;
    if (!it) return;
    const positionMs = Math.max(0, Math.floor(player.currentTime * 1000));
    setLibraryProgress(
      db, it.id,
      { positionMs, completed, communityId: it.communityId },
      recordLocalChange,
    );
  }, [db, player, recordLocalChange]);

  const timeUpdate = useEvent(player, 'timeUpdate');
  const lastSaveRef = useRef(0);
  useEffect(() => {
    if (phase !== 'ready') return;
    const now = Date.now();
    if (now - lastSaveRef.current < 5000) return;
    lastSaveRef.current = now;
    saveProgress(false);
  }, [timeUpdate?.currentTime, phase, saveProgress]);

  // Start (or restart) the loopback server for the active item and hand its URL
  // to the player. This is the ONLY playback path; there is no fake buffering.
  useEffect(() => {
    let cancelled = false;
    const item = activeItem;
    if (!item) return;
    setPhase('starting');
    setErrorMsg(null);

    void (async () => {
      // Stop any prior server before starting the next track's server.
      const prev = serverRef.current;
      serverRef.current = null;
      if (prev) await prev.stop().catch(() => {});

      try {
        const running = await startLoopbackServer({ db, store, identity, item });
        if (cancelled) { await running.stop().catch(() => {}); return; }
        serverRef.current = running;
        player.replace({ uri: running.url });
        const resume = getLibraryProgress(db, item.id);
        if (resume && !resume.completed && resume.positionMs > 0) {
          player.currentTime = resume.positionMs / 1000;
        }
        player.play();
        setPhase('ready');
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        if (message === LOOPBACK_UNAVAILABLE) setPhase('expo_go');
        else if (message.includes('not playable on this device')) setPhase('locked');
        else { setPhase('error'); setErrorMsg(message); }
      }
    })();

    return () => { cancelled = true; };
  }, [activeItem, db, store, identity, player]);

  // OS transport controls: best-effort, dev-build only (null in Expo Go).
  useEffect(() => {
    if (!musicMode) return;
    const backend = loadTrackPlayerBackend();
    if (!backend) return;
    trackPlayerRef.current = backend;
    void backend.setup().then((ok) => {
      if (!ok) return;
      backend.onRemoteCommand({
        onPlay: () => player.play(),
        onPause: () => player.pause(),
        onNext: () => setQueue((q) => musicQueueReducer(q, { type: 'next' })),
        onPrevious: () => setQueue((q) => musicQueueReducer(q, { type: 'previous' })),
      });
    });
    return () => { void backend.destroy(); trackPlayerRef.current = null; };
  }, [musicMode, player]);

  useEffect(() => {
    void trackPlayerRef.current?.setPlaying(isPlaying);
  }, [isPlaying]);

  // Clean shutdown: save progress and stop the server + player on unmount.
  useEffect(() => () => {
    saveProgress(false);
    const running = serverRef.current;
    serverRef.current = null;
    if (running) void running.stop().catch(() => {});
  }, [saveProgress]);

  const openWithAnotherApp = useCallback(() => {
    const item = activeItemRef.current;
    if (!item) return;
    Alert.alert(
      'Open outside Meerkat?',
      EXPORT_WARNING + ' Delete it from the other app when you are done.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open',
          onPress: () => {
            void (async () => {
              const bytes = await openLibraryItemContent(db, store, identity, item);
              if (!bytes) { Alert.alert('Not on this device', 'This item is not stored on this device yet.'); return; }
              if (!(await Sharing.isAvailableAsync())) {
                Alert.alert('Open unavailable', 'This platform cannot open exported files.');
                return;
              }
              const safeName = (item.title || 'media').replace(/[^\w.-]+/g, '_');
              const path = `${FileSystem.cacheDirectory}${safeName}`;
              await FileSystem.writeAsStringAsync(path, encodeBase64(bytes), { encoding: FileSystem.EncodingType.Base64 });
              await Sharing.shareAsync(path, {
                mimeType: item.mimeType ?? 'application/octet-stream',
                dialogTitle: item.title,
              });
              await FileSystem.deleteAsync(path, { idempotent: true }).catch(() => {});
            })().catch((err) => {
              Alert.alert('Could not open the file', err instanceof Error ? err.message : String(err));
            });
          },
        },
      ],
    );
  }, [db, store, identity]);

  if (!activeItem) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
        <Header onBack={() => { if (router.canGoBack()) router.back(); else router.replace(itemId ? `/library/item/${itemId}` : '/library'); }} title="Play" />
        <View style={styles.center}><Text style={styles.dim}>This item is no longer available on this device.</Text></View>
      </View>
    );
  }

  const showVideo = phase === 'ready' && !musicMode;

  return (
    <View style={styles.container}>
      <Header onBack={() => { if (router.canGoBack()) router.back(); else router.replace(itemId ? `/library/item/${itemId}` : '/library'); }} title={activeItem.title} topInset={insets.top} />

      <View style={styles.stage}>
        {showVideo ? (
          <VideoView player={player} style={styles.video} contentFit="contain" nativeControls allowsFullscreen />
        ) : musicMode && phase === 'ready' ? (
          <View style={styles.audioArt}>
            <Play size={64} color={c.accent} />
            <Text style={styles.audioTitle} numberOfLines={2}>{activeItem.title}</Text>
            {track?.artist ? <Text style={styles.audioArtist} numberOfLines={1}>{track.artist}</Text> : null}
          </View>
        ) : phase === 'starting' ? (
          <View style={styles.center}>
            <ActivityIndicator color={c.accent} />
            <Text style={styles.dim}>Starting local playback…</Text>
          </View>
        ) : phase === 'expo_go' ? (
          <View style={styles.center}>
            <HonestNotice text={NOT_PLAYABLE_EXPO_GO} />
            <View style={{ height: 12 }} />
            <Button title="Open with another app" onPress={openWithAnotherApp} />
          </View>
        ) : phase === 'locked' ? (
          <View style={styles.center}>
            <Text style={styles.dim}>
              This item is not stored on this device yet, or your device cannot unlock it. Sync with a device that holds it.
            </Text>
          </View>
        ) : (
          <View style={styles.center}>
            <Text style={styles.dim}>{errorMsg ?? 'Playback could not start.'}</Text>
            <View style={{ height: 12 }} />
            <Button title="Open with another app" variant="secondary" onPress={openWithAnotherApp} />
          </View>
        )}
      </View>

      {musicMode && phase === 'ready' ? (
        <View style={[styles.controls, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable
            onPress={() => setQueue((q) => musicQueueReducer(q, { type: 'previous' }))}
            disabled={!selectHasPrevious(queue)}
            hitSlop={12}
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}
          >
            <SkipBack size={30} color={selectHasPrevious(queue) ? c.text : c.textTertiary} />
          </Pressable>
          <Pressable onPress={() => (isPlaying ? player.pause() : player.play())} hitSlop={12} style={styles.playBtn}>
            {isPlaying ? <Pause size={34} color={c.background} /> : <Play size={34} color={c.background} />}
          </Pressable>
          <Pressable
            onPress={() => setQueue((q) => musicQueueReducer(q, { type: 'next' }))}
            disabled={!selectHasNext(queue)}
            hitSlop={12}
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}
          >
            <SkipForward size={30} color={selectHasNext(queue) ? c.text : c.textTertiary} />
          </Pressable>
        </View>
      ) : null}

      {phase === 'ready' ? (
        <View style={styles.footer}>
          <Text style={styles.status}>{isPlaying ? 'Playing' : 'Paused'} · plays from the sealed copy on this device</Text>
          <Pressable onPress={openWithAnotherApp} hitSlop={8} style={styles.exportRow}>
            <Share2 size={14} color={c.textSecondary} />
            <Text style={styles.exportText}>Open with another app</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function readArtist(item: LibraryItemEvent): string | null {
  try {
    const meta = JSON.parse(item.metadataJson) as Record<string, unknown>;
    return typeof meta.artist === 'string' ? meta.artist : null;
  } catch {
    return null;
  }
}

function Header({ onBack, title, topInset = 0 }: { onBack: () => void; title: string; topInset?: number }) {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  return (
    <View style={[styles.header, { paddingTop: topInset + 8 }]}>
      <Pressable onPress={onBack} hitSlop={10} accessibilityLabel="Back">
        <ArrowLeft size={24} color={c.text} />
      </Pressable>
      <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
    </View>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 8 },
  headerTitle: { color: c.text, fontSize: 16, fontWeight: '700', flex: 1 },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  video: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000', borderRadius: MK_RADIUS.md },
  audioArt: { alignItems: 'center', gap: 12, padding: 24 },
  audioTitle: { color: c.text, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  audioArtist: { color: c.textSecondary, fontSize: 15 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 8, width: '100%' },
  dim: { color: c.textSecondary, fontSize: 14, textAlign: 'center' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 40, paddingTop: 8 },
  playBtn: { width: 68, height: 68, borderRadius: 34, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  footer: { paddingHorizontal: 16, paddingBottom: 20, gap: 8, alignItems: 'center' },
  status: { color: c.textSecondary, fontSize: 12.5, textAlign: 'center' },
  exportRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  exportText: { color: c.textSecondary, fontSize: 12.5, fontWeight: '600' },
});
