import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  View,
  type ViewToken,
  Share,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Video, ResizeMode, type AVPlaybackStatus } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Bookmark,
  Check,
  Download,
  Heart,
  MessageCircle,
  Play,
  RefreshCw,
  Share2,
  Volume2,
  VolumeX,
} from 'lucide-react-native';
import { JAKARTA_FONTS } from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { useAppThemeColors as useThemeColors } from './providers/AppThemeProvider';
import { type DemoVideo } from './data/demo-videos';
import { loadFeedVideos } from './data/cloud-videos';
import { useI18n } from './i18n/I18nProvider';
import { useDatabase } from './providers/DatabaseProvider';
import { useBestChefCloud } from './providers/BestChefCloudProvider';
import { listBlocked } from './data/local-submissions';
import {
  ensureCloudSubmissionForAppId,
  isCloudSubmissionId,
} from './data/cloud-submissions';
import {
  buildOptimisticSubmissionLikeState,
  getCachedSubmissionLikeState,
  getSubmissionLikeViewerId,
  setSubmissionLikeDesired,
  syncSubmissionLikeState,
} from './data/feed-likes';
import {
  cacheMediaForOffline,
  getMediaCacheRecord,
  removeCachedMedia,
  resolveMediaUri,
  type MediaCacheRequest,
} from './data/media-cache';
import { BackArrow } from './components/DirectionalIcons';
import { isSaved, refreshSavedStateFor, toggleSaved } from './data/saved-submissions';
const VIEWER_ID = 'local-viewer';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } =
  Dimensions.get('window');

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function ActionButton({
  icon,
  count,
  onPress,
  accessibilityLabel,
}: {
  icon: React.ReactNode;
  count?: number;
  onPress?: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      style={styles.actionButton}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {icon}
      {count !== undefined && (
        <Text style={styles.actionCount}>{formatCount(count)}</Text>
      )}
    </Pressable>
  );
}

function VideoCard({
  video,
  isActive,
}: {
  video: DemoVideo;
  isActive: boolean;
}) {
  const tc = useThemeColors();
  const { t } = useI18n();
  const router = useRouter();
  const db = useDatabase();
  const cloud = useBestChefCloud();
  const videoRef = useRef<Video>(null);
  const likeTargetId = video.submissionId ?? video.id;
  const viewerId = useMemo(
    () => getSubmissionLikeViewerId(db, cloud.profile),
    [cloud.profile, db],
  );
  const mediaRequest = useMemo<MediaCacheRequest>(() => ({
    ownerKind: 'video',
    ownerId: video.id,
    mediaKind: 'video',
    remoteUri: video.videoUrl,
  }), [video.id, video.videoUrl]);
  const [sourceUri, setSourceUri] = useState(video.videoUrl);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [cloudSubmissionId, setCloudSubmissionId] = useState<string | null>(null);
  const [likeState, setLikeState] = useState(() => getCachedSubmissionLikeState(db, {
    localTargetId: likeTargetId,
    viewerId,
    fallbackCount: video.likes,
  }));
  const [saved, setSaved] = useState(() => isSaved(db, likeTargetId));
  const [paused, setPaused] = useState(!isActive);
  const [progress, setProgress] = useState(0);
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [muted, setMuted] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const playIconTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const likeRequestRef = useRef(0);

  const savedTargetId = cloudSubmissionId ?? likeTargetId;

  const handleBookmarkPress = () => {
    void toggleSaved(db, savedTargetId, cloud).then(setSaved).catch(() => {});
  };

  const handleSharePress = () => {
    void Share.share({
      message: t('Check out {dishName} on BestChef!', { dishName: video.dishName }),
      // Deep link only when the id is a real cloud uuid; local/demo ids
      // would 404 for the recipient.
      ...(isCloudSubmissionId(savedTargetId)
        ? { url: `https://bestchef.app/recipe/${savedTargetId}` }
        : {}),
    }).catch(() => {});
  };

  const handleCommentsPress = () => {
    router.push({ pathname: '/comments/[submissionId]', params: { submissionId: savedTargetId } });
  };

  const handleChefPress = () => {
    if (video.chefProfileId) {
      router.push({ pathname: '/chef/[id]', params: { id: video.chefProfileId } });
    }
  };

  useEffect(() => {
    setLikeState(getCachedSubmissionLikeState(db, {
      localTargetId: likeTargetId,
      viewerId,
      fallbackCount: video.likes,
    }));
  }, [db, likeTargetId, video.likes, viewerId]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      let resolvedId: string | null = isCloudSubmissionId(likeTargetId) ? likeTargetId : null;
      if (!resolvedId && cloud.isReady && cloud.profile && video.submissionId) {
        resolvedId = await ensureCloudSubmissionForAppId(db, cloud.profile, video.submissionId);
      }
      if (!cancelled) setCloudSubmissionId(resolvedId);

      const state = await syncSubmissionLikeState(db, {
        localTargetId: likeTargetId,
        viewerId,
        fallbackCount: video.likes,
        cloudSubmissionId: resolvedId,
      }, { supabase: cloud.supabase });
      if (!cancelled) setLikeState(state);

      if (resolvedId) {
        await refreshSavedStateFor(db, [resolvedId], cloud);
        if (!cancelled) setSaved(isSaved(db, resolvedId) || isSaved(db, likeTargetId));
      }
    })().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [
    cloud.isReady,
    cloud.profile,
    cloud.supabase,
    db,
    likeTargetId,
    video.likes,
    video.submissionId,
    viewerId,
  ]);

  useEffect(() => {
    let mounted = true;
    setSourceUri(video.videoUrl);
    setIsDownloaded(getMediaCacheRecord(db, mediaRequest)?.status === 'downloaded');

    void resolveMediaUri(db, mediaRequest)
      .then((uri) => {
        if (!mounted) return;
        setSourceUri(uri);
        setIsDownloaded(uri !== video.videoUrl);
      })
      .catch(() => {
        if (!mounted) return;
        setSourceUri(video.videoUrl);
        setIsDownloaded(false);
      });

    return () => {
      mounted = false;
    };
  }, [db, mediaRequest, video.videoUrl]);

  useEffect(() => {
    if (isActive) {
      videoRef.current?.playAsync();
      setPaused(false);
    } else {
      void videoRef.current?.stopAsync();
      setPaused(true);
      setProgress(0);
    }
  }, [isActive]);

  const togglePlay = useCallback(() => {
    if (paused) {
      videoRef.current?.playAsync();
    } else {
      videoRef.current?.pauseAsync();
    }
    setPaused((p) => !p);

    setShowPlayIcon(true);
    if (playIconTimeout.current) clearTimeout(playIconTimeout.current);
    playIconTimeout.current = setTimeout(() => setShowPlayIcon(false), 800);
  }, [paused]);

  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (status.isLoaded && status.durationMillis) {
      setProgress(status.positionMillis / status.durationMillis);
    }
  }, []);

  const handleRetry = useCallback(() => {
    setLoadFailed(false);
    setReloadKey((k) => k + 1);
  }, []);

  const handleDownloadPress = useCallback(() => {
    if (downloadBusy) return;
    setDownloadBusy(true);
    void (async () => {
      try {
        if (isDownloaded) {
          await removeCachedMedia(db, mediaRequest);
          setSourceUri(video.videoUrl);
          setIsDownloaded(false);
        } else {
          const record = await cacheMediaForOffline(db, mediaRequest);
          if (record.status === 'downloaded' && record.localUri) {
            setSourceUri(record.localUri);
            setIsDownloaded(true);
            setReloadKey((k) => k + 1);
          }
        }
      } finally {
        setDownloadBusy(false);
      }
    })();
  }, [db, downloadBusy, isDownloaded, mediaRequest, video.videoUrl]);

  const handleLikePress = useCallback(() => {
    const nextLiked = !likeState.liked;
    const optimistic = buildOptimisticSubmissionLikeState(likeState, nextLiked, cloudSubmissionId);
    const requestId = likeRequestRef.current + 1;
    likeRequestRef.current = requestId;
    setLikeState(optimistic);

    void setSubmissionLikeDesired(db, {
      localTargetId: likeTargetId,
      viewerId,
      fallbackCount: video.likes,
      cloudSubmissionId,
    }, nextLiked, { supabase: cloud.supabase })
      .then((state) => {
        if (likeRequestRef.current === requestId) setLikeState(state);
      })
      .catch(() => {
        if (likeRequestRef.current === requestId) setLikeState(optimistic);
      });
  }, [
    cloud.supabase,
    cloudSubmissionId,
    db,
    likeState,
    likeTargetId,
    video.likes,
    viewerId,
  ]);

  return (
    <View style={{ height: SCREEN_HEIGHT, width: SCREEN_WIDTH }}>
      <Video
        key={reloadKey}
        ref={videoRef}
        source={{ uri: sourceUri }}
        style={StyleSheet.absoluteFillObject}
        resizeMode={ResizeMode.COVER}
        isLooping
        shouldPlay={isActive}
        isMuted={muted}
        onPlaybackStatusUpdate={onPlaybackStatusUpdate}
        onError={() => setLoadFailed(true)}
      />

      {loadFailed && (
        <Pressable
          style={styles.retryOverlay}
          onPress={handleRetry}
          accessibilityRole="button"
          accessibilityLabel={t('Retry loading video')}
        >
          <View style={styles.retryCircle}>
            <RefreshCw size={40} color="white" strokeWidth={2} />
          </View>
          <Text style={styles.retryText}>{t('Tap to retry')}</Text>
        </Pressable>
      )}

      <Pressable
        style={StyleSheet.absoluteFillObject}
        onPress={togglePlay}
        accessibilityRole="button"
        accessibilityLabel={paused ? t('Play video') : t('Pause video')}
      >
        {(paused || showPlayIcon) && (
          <View style={styles.pauseOverlay}>
            <View style={styles.playIconCircle}>
              <Play size={48} color="white" fill="white" />
            </View>
          </View>
        )}
      </Pressable>

      <LinearGradient
        colors={['rgba(0,0,0,0.5)', 'transparent']}
        style={styles.topGradient}
        pointerEvents="none"
      />

      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.7)']}
        style={styles.bottomGradient}
        pointerEvents="none"
      />

      <View style={styles.bottomInfo}>
        <Text style={styles.infoDishName}>{video.dishName}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('View chef {handle}', { handle: video.chefHandle })}
          hitSlop={6}
          disabled={!video.chefProfileId}
          onPress={handleChefPress}
        >
          <Text style={styles.infoChef}>@{video.chefHandle}</Text>
        </Pressable>
        <Text style={styles.infoTitle} numberOfLines={1}>
          {video.title}
        </Text>
        <Text style={styles.infoDesc} numberOfLines={2}>
          {video.description}
        </Text>
      </View>

      <View style={styles.actionBar}>
        <ActionButton
          icon={<Heart size={28} color={likeState.liked ? '#FF4D67' : 'white'} fill={likeState.liked ? '#FF4D67' : 'transparent'} strokeWidth={2} />}
          count={likeState.likeCount}
          onPress={handleLikePress}
          accessibilityLabel={likeState.liked ? t('Unlike') : t('Like')}
        />
        <ActionButton
          icon={<MessageCircle size={28} color="white" strokeWidth={2} />}
          count={video.comments}
          onPress={handleCommentsPress}
          accessibilityLabel={t('Comment')}
        />
        <ActionButton
          icon={<Share2 size={26} color="white" strokeWidth={2} />}
          count={video.shares}
          onPress={handleSharePress}
          accessibilityLabel={t('Share')}
        />
        <ActionButton
          icon={<Bookmark size={26} color={saved ? '#F5C451' : 'white'} fill={saved ? '#F5C451' : 'transparent'} strokeWidth={2} />}
          onPress={handleBookmarkPress}
          accessibilityLabel={saved ? t('Remove from saved') : t('Save recipe')}
        />
        <ActionButton
          icon={downloadBusy
            ? <RefreshCw size={24} color="white" strokeWidth={2} />
            : isDownloaded
              ? <Check size={24} color="white" strokeWidth={2} />
              : <Download size={24} color="white" strokeWidth={2} />}
          onPress={handleDownloadPress}
          accessibilityLabel={isDownloaded ? t('Remove offline video') : t('Download video for offline')}
        />
        <ActionButton
          icon={muted
            ? <VolumeX size={24} color="white" strokeWidth={2} />
            : <Volume2 size={24} color="white" strokeWidth={2} />}
          onPress={() => setMuted((m) => !m)}
          accessibilityLabel={muted ? t('Unmute') : t('Mute')}
        />
      </View>

      <View style={styles.progressBarContainer}>
        <View
          style={[
            styles.progressBar,
            {
              width: `${progress * 100}%`,
              backgroundColor: tc.accent,
            },
          ]}
        />
      </View>
    </View>
  );
}

export default function FeedScreen() {
  const { dishId, dishName, cuisine } =
    useLocalSearchParams<{
      dishId?: string;
      dishName?: string;
      cuisine?: string;
    }>();
  const router = useRouter();
  const tc = useThemeColors();
  const { t } = useI18n();
  const db = useDatabase();
  const [activeIndex, setActiveIndex] = useState(0);
  const [blockedHandles, setBlockedHandles] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const rows = listBlocked(db, VIEWER_ID);
    setBlockedHandles(new Set(rows.map((r) => r.blockedHandle.toLowerCase())));
  }, [db]);

  const [feedVideos, setFeedVideos] = useState<DemoVideo[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setFeedLoading(true);
    // Cloud video catalog (bc_media_assets); demo fixtures only when policy allows.
    void loadFeedVideos({ dishId, cuisine }).then((result) => {
      if (cancelled) return;
      setFeedVideos(result.videos);
      setFeedLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [cuisine, dishId]);

  const videos = useMemo(() => {
    if (blockedHandles.size === 0) return feedVideos;
    return feedVideos.filter((v) => !blockedHandles.has(v.chefHandle.toLowerCase()));
  }, [blockedHandles, feedVideos]);

  const headerTitle = dishName ?? cuisine ?? t('Cooking Videos');

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
  ).current;

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: SCREEN_HEIGHT,
      offset: SCREEN_HEIGHT * index,
      index,
    }),
    [],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: DemoVideo; index: number }) => (
      <VideoCard video={item} isActive={index === activeIndex} />
    ),
    [activeIndex],
  );

  if (feedLoading && videos.length === 0) {
    return (
      <View style={[styles.screen, { backgroundColor: tc.background }]}>
        <View style={styles.headerBar}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('Back')}>
            <BackArrow size={24} color={tc.text} strokeWidth={2} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: tc.text }]}>
            {headerTitle}
          </Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.emptyContainer}>
          <ActivityIndicator color={tc.accent} />
        </View>
      </View>
    );
  }

  if (videos.length === 0) {
    return (
      <View style={[styles.screen, { backgroundColor: tc.background }]}>
        <View style={styles.headerBar}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('Back')}>
            <BackArrow size={24} color={tc.text} strokeWidth={2} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: tc.text }]}>
            {headerTitle}
          </Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.emptyContainer}>
          <Play size={48} color={tc.textSecondary} strokeWidth={1.5} />
          <Text style={[styles.emptyText, { color: tc.text }]}>
            {t('No videos yet')}
          </Text>
          <Text style={[styles.emptySubtext, { color: tc.textSecondary }]}>
            {t('Videos for this dish will appear here')}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={videos}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        pagingEnabled
        snapToInterval={SCREEN_HEIGHT}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        getItemLayout={getItemLayout}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        windowSize={3}
        maxToRenderPerBatch={2}
        removeClippedSubviews
      />

      <View style={styles.headerOverlay}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('Back')}>
          <BackArrow size={24} color="white" strokeWidth={2} />
        </Pressable>
        <Text style={styles.headerOverlayTitle} numberOfLines={1}>
          {headerTitle}
        </Text>
        <View style={{ width: 24 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },

  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 12,
    gap: 12,
  },
  headerTitle: {
    flex: 1,
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 17,
    textAlign: 'center',
  },

  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 12,
    gap: 12,
    zIndex: 10,
  },
  headerOverlayTitle: {
    flex: 1,
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 17,
    textAlign: 'center',
    color: 'white',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  emptyText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 18 },
  emptySubtext: { fontFamily: JAKARTA_FONTS.medium, fontSize: 14 },

  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 280,
  },

  pauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    gap: 12,
    zIndex: 20,
  },
  retryCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 14,
    color: 'white',
  },
  playIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 6,
  },

  bottomInfo: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 80,
    gap: 4,
  },
  infoDishName: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 18,
    color: 'white',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  infoChef: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
  },
  infoTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 15,
    color: 'white',
    marginTop: 4,
  },
  infoDesc: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 18,
  },

  actionBar: {
    position: 'absolute',
    right: 12,
    bottom: 120,
    alignItems: 'center',
    gap: 20,
  },
  actionButton: { alignItems: 'center', gap: 4 },
  actionCount: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 12,
    color: 'white',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  progressBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  progressBar: { height: 3 },
});
