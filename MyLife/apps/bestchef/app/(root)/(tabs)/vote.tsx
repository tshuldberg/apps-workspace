/**
 * VoteFeed -- P4-B: Reels-style vertical paginated feed.
 *
 * - Full-bleed FlatList with pagingEnabled (one card per page snap)
 * - Active card autoplays; inactive cards are paused
 * - Prefetches next 2 video URIs + next 5 photo URIs on index change
 * - SessionStats pill (Liked / Passed / Reviewed) auto-hides after 3s idle
 * - First-run HintBubble (shown once, persisted in rc_settings)
 * - Empty state with Refresh CTA
 * - Tab bar: transparent + LinearGradient overlay so action buttons are readable
 *
 * Uses React Native built-in Animated API only (no react-native-reanimated).
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  Share,
  StyleSheet,
  View,
  ViewabilityConfig,
  ViewToken,
} from 'react-native';
import { router } from 'expo-router';
import { Video } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThumbsUp, ThumbsDown, Award, ChefHat, RotateCcw } from 'lucide-react-native';
import { Text } from '@mylife/ui';
import { listBlockedProfileIdsCloud } from '../data/cloud-blocks';
import { isSaved, toggleSaved } from '../data/saved-submissions';
import { listCachedSavedIds, markSavedLocally } from '@mylife/bestchef';
import {
  JAKARTA_FONTS,
  castTapVote,
  cloudFollowChef,
  cloudUnfollowChef,
  getVoteFeed,
} from '@mylife/bestchef';
import type { SubmissionViewModel } from '../components/vote/FullScreenSubmissionCard';
import { FullScreenSubmissionCard } from '../components/vote/FullScreenSubmissionCard';
import type { DemoSubmission } from '../data/demo';
import { getChefTomSeedDishMeta, ensureChefTomSeedSubmissions } from '../data/cheftom-seed';
import { isCloudSubmissionId } from '../data/cloud-submissions';
import { getAllLocalSubmissions, saveVote } from '../data/local-submissions';
import { getBestChefPublicRenderPolicy } from '../data/public-render-policy';
import { useBestChefCloud } from '../providers/BestChefCloudProvider';
import { useDatabase } from '../providers/DatabaseProvider';
import { useI18n } from '../i18n/I18nProvider';

// ── Constants ─────────────────────────────────────────────────────────────────

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_GREEN = '#22C55E';
const STATS_BG = 'rgba(0,0,0,0.45)';
const HINT_SEEN_KEY = 'vote_hint_seen';

type VoteFeedSource = 'cloud' | 'local' | 'empty' | 'error' | 'languageEmpty';

// ── rc_settings helpers ───────────────────────────────────────────────────────

function getStringSetting(
  db: ReturnType<typeof useDatabase>,
  key: string,
): string | null {
  try {
    const rows = db.query<{ value: string }>(
      `SELECT value FROM rc_settings WHERE key = ?`,
      [key],
    );
    return rows[0]?.value ?? null;
  } catch {
    return null;
  }
}

function setStringSetting(
  db: ReturnType<typeof useDatabase>,
  key: string,
  value: string,
): void {
  try {
    db.execute(
      `INSERT OR REPLACE INTO rc_settings (key, value) VALUES (?, ?)`,
      [key, value],
    );
  } catch {
    // best-effort
  }
}

/**
 * Bookmarks ride the F-010 cloud engine (rc_saved_submissions_cache +
 * bc_saved_submissions). The old settings-blob store migrates into the
 * cache once (queued as pending saves so they reach the cloud) and is
 * then cleared.
 */
function getSavedSubmissions(db: ReturnType<typeof useDatabase>): string[] {
  const raw = getStringSetting(db, 'saved_submissions');
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        for (const id of parsed as string[]) {
          if (typeof id === 'string' && id && !isSaved(db, id)) {
            markSavedLocally(db, id);
          }
        }
      }
    } catch {
      // Corrupt legacy blob: nothing to migrate.
    }
    setStringSetting(db, 'saved_submissions', '');
  }
  return listCachedSavedIds(db);
}

function shouldUseLocalSeedFallback(): boolean {
  const policy = getBestChefPublicRenderPolicy();
  return policy.showDemoContent && !policy.isPublicLaunch;
}

function localSubmissionToVoteCard(
  submission: DemoSubmission,
  savedIds: string[],
): SubmissionViewModel {
  const seedMeta = getChefTomSeedDishMeta(submission.dishId);
  const createdAt = new Date(submission.createdAt);

  return {
    id: submission.id,
    dishId: submission.dishId,
    recipeSnapshotId: `${submission.id}:snapshot`,
    profileId: submission.chefId,
    photoUrl: submission.photoUrl ?? null,
    photoVerified: submission.photoVerified,
    photoVerifiedAt: null,
    verificationMethod: null,
    chefLocation: null,
    chefLocationLat: null,
    chefLocationLng: null,
    chefOrigin: null,
    countryCode: null,
    voteScore: submission.voteScore,
    likeCount: submission.likeCount ?? submission.voteScore,
    rank: submission.rank,
    moderationStatus: 'approved',
    region: seedMeta?.region ?? null,
    isRestaurant: false,
    is_restaurant: false,
    upvoteCount: submission.upvoteCount ?? Math.max(0, submission.voteScore),
    downvoteCount: submission.downvoteCount ?? 0,
    reviewedCount: submission.reviewedCount ?? 0,
    tapCount: 0,
    createdAt,
    updatedAt: createdAt,
    comment_count: 0,
    viewerSaved: savedIds.includes(submission.id),
    chefDisplayName: submission.chefName,
    chefAvatarUrl: null,
    chefId: submission.chefId,
    dishName: seedMeta?.dishName ?? submission.title,
    cuisine: seedMeta?.cuisine ?? null,
    gradientFrom: seedMeta?.gradientFrom,
    gradientTo: seedMeta?.gradientTo,
    emoji: seedMeta?.emoji,
    topIngredients: submission.ingredients.slice(0, 8),
    videos: [],
  } as SubmissionViewModel;
}

function getLocalSeedVoteFeed(
  db: ReturnType<typeof useDatabase>,
  savedIds: string[],
): SubmissionViewModel[] {
  if (!shouldUseLocalSeedFallback()) return [];
  ensureChefTomSeedSubmissions(db);
  return getAllLocalSubmissions(db)
    .map((submission) => localSubmissionToVoteCard(submission, savedIds));
}

// ── SessionStats pill ─────────────────────────────────────────────────────────

interface SessionStatsProps {
  liked: number;
  passed: number;
  reviewed: number;
  opacity: Animated.Value;
  topOffset: number;
}

function SessionStats({ liked, passed, reviewed, opacity, topOffset }: SessionStatsProps) {
  const { t } = useI18n();
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.statsPill, { top: topOffset, opacity }]}
    >
      <View style={styles.statItem}>
        <ThumbsUp size={14} color={HERO_GREEN} strokeWidth={2.5} />
        <Text style={styles.statValue}>{liked}</Text>
        <Text style={styles.statLabel}>{t('Liked')}</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <ThumbsDown size={14} color="rgba(255,255,255,0.6)" strokeWidth={2.5} />
        <Text style={styles.statValue}>{passed}</Text>
        <Text style={styles.statLabel}>{t('Passed')}</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Award size={14} color="#C9894D" strokeWidth={2.5} />
        <Text style={styles.statValue}>{reviewed}</Text>
        <Text style={styles.statLabel}>{t('Reviewed')}</Text>
      </View>
    </Animated.View>
  );
}

// ── HintBubble ────────────────────────────────────────────────────────────────

interface HintBubbleProps {
  text: string;
  bottomOffset: number;
}

function HintBubble({ text, bottomOffset }: HintBubbleProps) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }).start();
    }, 4000);
    return () => clearTimeout(timer);
  }, [opacity]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.hintBubble, { bottom: bottomOffset, opacity }]}
    >
      <Text style={styles.hintText}>{text}</Text>
    </Animated.View>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

interface EmptyStateProps {
  onRefresh: () => void;
  variant: 'empty' | 'error' | 'languageEmpty';
  onShowAllLanguages?: () => void;
}

/**
 * Cold start is a designed state, not an accident (N7): an empty market
 * invites the first submission instead of saying "come back later". Network
 * failure is a distinct, honest error state with a retry (N9).
 */
function EmptyState({ onRefresh, variant, onShowAllLanguages }: EmptyStateProps) {
  const { t } = useI18n();

  if (variant === 'languageEmpty') {
    // The language filter matched nothing: honest filtered-empty state,
    // never the unfiltered local seed (review finding, Phase 2.5).
    return (
      <View style={styles.emptyContainer}>
        <ChefHat size={64} color="rgba(255,255,255,0.3)" strokeWidth={1.5} />
        <Text style={styles.emptyTitle}>{t('No recipes in your language yet.')}</Text>
        <Text style={styles.emptySubtitle}>{t('Be the first chef to submit a recipe.')}</Text>
        <Pressable
          onPress={() => onShowAllLanguages?.()}
          accessibilityRole="button"
          accessibilityLabel={t('Show all languages')}
          style={styles.refreshButton}
        >
          <RotateCcw size={16} color={HERO_GREEN} strokeWidth={2} />
          <Text style={styles.refreshLabel}>{t('Show all languages')}</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/submit')}
          accessibilityRole="button"
          accessibilityLabel={t('Submit a recipe')}
          style={styles.refreshSecondary}
        >
          <ChefHat size={14} color="rgba(255,255,255,0.6)" strokeWidth={2} />
          <Text style={styles.refreshSecondaryLabel}>{t('Submit a recipe')}</Text>
        </Pressable>
      </View>
    );
  }

  if (variant === 'error') {
    return (
      <View style={styles.emptyContainer}>
        <ChefHat size={64} color="rgba(255,255,255,0.3)" strokeWidth={1.5} />
        <Text style={styles.emptyTitle}>{t('Could not load the vote feed')}</Text>
        <Text style={styles.emptySubtitle}>{t('Check your connection and try again.')}</Text>
        <Pressable
          onPress={onRefresh}
          accessibilityRole="button"
          accessibilityLabel={t('state_retry')}
          style={styles.refreshButton}
        >
          <RotateCcw size={16} color={HERO_GREEN} strokeWidth={2} />
          <Text style={styles.refreshLabel}>{t('state_retry')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.emptyContainer}>
      <ChefHat size={64} color="rgba(255,255,255,0.3)" strokeWidth={1.5} />
      <Text style={styles.emptyTitle}>{t('No recipes here yet')}</Text>
      <Text style={styles.emptySubtitle}>{t('Be the first chef to submit a recipe.')}</Text>
      <Pressable
        onPress={() => router.push('/submit')}
        accessibilityRole="button"
        accessibilityLabel={t('Submit a recipe')}
        style={styles.refreshButton}
      >
        <ChefHat size={16} color={HERO_GREEN} strokeWidth={2} />
        <Text style={styles.refreshLabel}>{t('Submit a recipe')}</Text>
      </Pressable>
      <Pressable
        onPress={onRefresh}
        accessibilityRole="button"
        accessibilityLabel={t('Refresh')}
        style={styles.refreshSecondary}
      >
        <RotateCcw size={14} color="rgba(255,255,255,0.6)" strokeWidth={2} />
        <Text style={styles.refreshSecondaryLabel}>{t('Refresh')}</Text>
      </Pressable>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function VoteTab() {
  const { t, language } = useI18n();
  // Reactive UGC language: switching the app language while the filter is
  // active must refetch (a module-holder read would go stale).
  const activeUgcLanguage = language.toLowerCase();
  const insets = useSafeAreaInsets();
  const db = useDatabase();
  const { supabase, profile } = useBestChefCloud();
  const viewerProfileId = profile?.id ?? null;

  // Feed state
  const [feed, setFeed] = useState<SubmissionViewModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [feedSource, setFeedSource] = useState<VoteFeedSource>('empty');

  // Session counters
  const [sessionLiked, setSessionLiked] = useState(0);
  const [sessionPassed, setSessionPassed] = useState(0);
  const [sessionReviewed, setSessionReviewed] = useState(0);

  // Stats pill auto-hide
  const statsOpacity = useRef(new Animated.Value(1)).current;
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hint bubble
  const [showHint, setShowHint] = useState(false);
  const initializedProfileRef = useRef<string | null | undefined>(undefined);
  const blockedIdsRef = useRef<Set<string>>(new Set());

  // Load the viewer's server-side block list so blocked chefs are hidden from the feed.
  useEffect(() => {
    if (!supabase || !viewerProfileId) return;
    let cancelled = false;
    void listBlockedProfileIdsCloud(supabase, viewerProfileId).then((ids) => {
      if (!cancelled) blockedIdsRef.current = new Set(ids);
    });
    return () => { cancelled = true; };
  }, [supabase, viewerProfileId]);

  // ── Fetch feed ──────────────────────────────────────────────────────────────

  // Language filter (plan 33 Phase 2.5): default all languages; the pill
  // toggles to only UGC tagged with the app language.
  const [myLanguageOnly, setMyLanguageOnly] = useState(false);
  const languageFilterInitRef = useRef(false);
  // Epoch token: bumped when the filter target changes so an in-flight
  // fetch from the previous filter can never commit into the cleared feed
  // (review finding: old-filter pages merged after a toggle).
  const feedEpochRef = useRef(0);
  const fetchingRef = useRef(false);

  const fetchFeed = useCallback(
    async (append = false) => {
      if (fetchingRef.current) return;
      fetchingRef.current = true;
      setFetching(true);
      const epoch = feedEpochRef.current;
      try {
        if (append && feedSource === 'local') return;
        const saved = getSavedSubmissions(db);
        const result = await getVoteFeed({
          supabase: supabase ?? undefined,
          limit: 20,
          viewerProfileId: viewerProfileId ?? undefined,
          language: myLanguageOnly ? activeUgcLanguage : undefined,
        });
        if (epoch !== feedEpochRef.current) return; // stale filter: drop
        if (result.ok && result.data.length > 0) {
          const blocked = blockedIdsRef.current;
          const items: SubmissionViewModel[] = result.data
            .filter((sub) => !blocked.has(sub.profileId))
            .map((sub) => {
            return {
              ...sub,
              comment_count: sub.comment_count,
              is_restaurant: sub.is_restaurant,
              viewerSaved: saved.includes(sub.id),
              chefDisplayName: sub.chefDisplayName ?? undefined,
              chefAvatarUrl: sub.chefAvatarUrl,
              chefId: sub.profileId,
            } as SubmissionViewModel;
          });
          setFeed((prev) => {
            if (!append) return items;
            const seen = new Set(prev.map((item) => item.id));
            return [...prev, ...items.filter((item) => !seen.has(item.id))];
          });
          setFeedSource('cloud');
          return;
        }

        if (result.ok && myLanguageOnly && !append) {
          // The cloud answered and there is genuinely nothing in this
          // language: honest filtered-empty state, never the unfiltered
          // local seed under an active filter (review finding).
          setFeed([]);
          setFeedSource('languageEmpty');
          return;
        }

        if (!append) {
          const localItems = getLocalSeedVoteFeed(db, saved);
          setFeed(localItems);
          setFeedSource(localItems.length > 0 ? 'local' : 'empty');
        }
      } catch {
        if (epoch !== feedEpochRef.current) return;
        if (!append) {
          if (myLanguageOnly) {
            // Never show unfiltered seed content under an active filter.
            setFeed([]);
            setFeedSource('error');
            return;
          }
          const saved = getSavedSubmissions(db);
          const localItems = getLocalSeedVoteFeed(db, saved);
          setFeed(localItems);
          // A failed fetch with nothing to show is an ERROR state with a
          // retry, never "all caught up" (N9).
          setFeedSource(localItems.length > 0 ? 'local' : 'error');
        }
      } finally {
        fetchingRef.current = false;
        setFetching(false);
        setLoading(false);
      }
    },
    [activeUgcLanguage, db, feedSource, myLanguageOnly, supabase, viewerProfileId],
  );

  useEffect(() => {
    const profileKey = viewerProfileId ?? 'public';
    if (initializedProfileRef.current === profileKey) return;
    initializedProfileRef.current = profileKey;

    void fetchFeed(false);
    // Show hint if first run
    const seen = getStringSetting(db, HINT_SEEN_KEY);
    if (!seen) {
      setShowHint(true);
      setStringSetting(db, HINT_SEEN_KEY, 'true');
    }
  }, [db, fetchFeed, supabase, viewerProfileId]);

  // Refetch from the top when the filter target changes (skip mount). Waits
  // out any in-flight fetch so fetchFeed's re-entrancy guard cannot swallow
  // the refetch (review finding: toggle silently no-oped during loads).
  useEffect(() => {
    if (!languageFilterInitRef.current) {
      languageFilterInitRef.current = true;
      return;
    }
    feedEpochRef.current += 1;
    const epoch = feedEpochRef.current;
    setFeed([]);
    setLoading(true);
    let cancelled = false;
    (async () => {
      while (!cancelled && fetchingRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 80));
      }
      if (!cancelled && epoch === feedEpochRef.current) {
        void fetchFeed(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch only when the filter target changes, not on every fetchFeed identity change
  }, [myLanguageOnly, myLanguageOnly ? activeUgcLanguage : null]);

  // Infinite scroll: fetch more when 5 items from end
  useEffect(() => {
    if (
      feedSource !== 'local'
      && !loading
      && !fetching
      && feed.length > 0
      && activeIndex >= feed.length - 5
    ) {
      void fetchFeed(true);
    }
  }, [activeIndex, feed.length, feedSource, fetchFeed, fetching, loading]);

  // ── Prefetch ────────────────────────────────────────────────────────────────

  useEffect(() => {
    const nextVideos = feed.slice(activeIndex + 1, activeIndex + 3);
    const nextPhotos = feed.slice(activeIndex + 1, activeIndex + 6);

    for (const item of nextVideos) {
      const uri = item.videos?.[0]?.uri;
      if (uri) {
        // Warm video URIs via a HEAD request (expo-av has no static prefetchAsync)
        void fetch(uri, { method: 'HEAD' }).catch(() => undefined);
      }
    }
    for (const item of nextPhotos) {
      if (item.photoUrl) {
        void Image.prefetch(item.photoUrl).catch(() => undefined);
      }
    }
  }, [activeIndex, feed]);

  // ── Stats pill idle timer ───────────────────────────────────────────────────

  const resetIdleTimer = useCallback(() => {
    statsOpacity.setValue(1);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      Animated.timing(statsOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }, 3000);
  }, [statsOpacity]);

  useEffect(() => {
    resetIdleTimer();
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScroll = useCallback(
    (_e: NativeSyntheticEvent<NativeScrollEvent>) => {
      resetIdleTimer();
    },
    [resetIdleTimer],
  );

  // ── Viewability ─────────────────────────────────────────────────────────────

  const viewabilityConfig = useMemo<ViewabilityConfig>(
    () => ({ itemVisiblePercentThreshold: 80 }),
    [],
  );

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      if (first?.index != null) {
        setActiveIndex(first.index);
        resetIdleTimer();
      }
    },
    [resetIdleTimer],
  );

  const viewabilityConfigCallbackPairs = useRef([
    { viewabilityConfig, onViewableItemsChanged },
  ]);

  // ── Card handlers ───────────────────────────────────────────────────────────

  const handleUpvoteChange = useCallback(
    (index: number, direction: 'up' | 'down' | null) => {
      const item = feed[index];
      if (!item || !viewerProfileId) return;

      // Optimistic update
      setFeed((prev) => {
        const next = [...prev];
        const current = next[index];
        if (!current) return prev;
        const updated = { ...current };
        const wasUp = current.viewerUpvoted;
        const wasDown = current.viewerDownvoted;

        if (direction === 'up') {
          updated.viewerUpvoted = true;
          updated.viewerDownvoted = false;
          updated.upvoteCount = (current.upvoteCount ?? 0) + 1;
          if (wasDown) updated.downvoteCount = Math.max(0, (current.downvoteCount ?? 0) - 1);
        } else if (direction === 'down') {
          updated.viewerDownvoted = true;
          updated.viewerUpvoted = false;
          updated.downvoteCount = (current.downvoteCount ?? 0) + 1;
          if (wasUp) updated.upvoteCount = Math.max(0, (current.upvoteCount ?? 0) - 1);
        } else {
          updated.viewerUpvoted = false;
          updated.viewerDownvoted = false;
          if (wasUp) updated.upvoteCount = Math.max(0, (current.upvoteCount ?? 0) - 1);
          if (wasDown) updated.downvoteCount = Math.max(0, (current.downvoteCount ?? 0) - 1);
        }
        next[index] = updated;
        return next;
      });

      if (direction === 'up') {
        setSessionLiked((c) => c + 1);
      } else if (direction === 'down') {
        setSessionPassed((c) => c + 1);
      }

      saveVote(db, item.id, direction === 'up' ? 1 : direction === 'down' ? -1 : 0);

      const cloudDirection = direction
        ?? (item.viewerUpvoted ? 'up' : item.viewerDownvoted ? 'down' : null);
      if (!cloudDirection || !isCloudSubmissionId(item.id)) return;

      // Background cast
      void castTapVote({
        submissionId: item.id,
        direction: cloudDirection,
        voterProfileId: viewerProfileId,
        supabase: supabase ?? undefined,
      });
    },
    [db, feed, supabase, viewerProfileId],
  );

  const handleReviewedVote = useCallback(
    (submissionId: string) => {
      setSessionReviewed((c) => c + 1);
      router.push(`/reviewed-vote/${submissionId}` as never);
    },
    [],
  );

  const handleCommentOpen = useCallback((submissionId: string) => {
    router.push(`/comments/${submissionId}` as never);
  }, []);

  const handleShare = useCallback(
    (submission: SubmissionViewModel) => {
      void Share.share({
        message: t('Check out {dishName} on BestChef!', { dishName: submission.dishName ?? t('this dish') }),
        url: `https://bestchef.app/recipe/${submission.id}`,
      });
    },
    [t],
  );

  const handleSaveToggle = useCallback(
    (submissionId: string) => {
      setFeed((prev) =>
        prev.map((item) =>
          item.id === submissionId
            ? { ...item, viewerSaved: !item.viewerSaved }
            : item,
        ),
      );
      void toggleSaved(db, submissionId, { supabase, profile }).then((nowSaved) => {
        // Reconcile if the engine rolled the optimistic change back.
        setFeed((prev) =>
          prev.map((item) =>
            item.id === submissionId && item.viewerSaved !== nowSaved
              ? { ...item, viewerSaved: nowSaved }
              : item,
          ),
        );
      }).catch(() => {});
    },
    [db, supabase, profile],
  );

  const handleFollowToggle = useCallback(
    (submission: SubmissionViewModel) => {
      if (!submission.chefId) return;
      const isFollowing = submission.viewerFollowing ?? false;
      setFeed((prev) =>
        prev.map((item) =>
          item.chefId === submission.chefId
            ? { ...item, viewerFollowing: !isFollowing }
            : item,
        ),
      );
      if (isFollowing) {
        void cloudUnfollowChef({ chefId: submission.chefId });
      } else {
        void cloudFollowChef({ chefId: submission.chefId });
      }
    },
    [],
  );

  const handleChefPress = useCallback((submission: SubmissionViewModel) => {
    if (submission.chefId) {
      router.push(`/chef/${submission.chefId}` as never);
    }
  }, []);

  // ── Render item ─────────────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item, index }: { item: SubmissionViewModel; index: number }) => (
      <FullScreenSubmissionCard
        submission={item}
        isActive={index === activeIndex}
        onUpvoteChange={(direction) => handleUpvoteChange(index, direction)}
        onReviewedVote={() => handleReviewedVote(item.id)}
        onCommentOpen={() => handleCommentOpen(item.id)}
        onShare={() => handleShare(item)}
        onSaveToggle={() => handleSaveToggle(item.id)}
        onFollowToggle={() => handleFollowToggle(item)}
        onChefPress={() => handleChefPress(item)}
      />
    ),
    [
      activeIndex,
      handleChefPress,
      handleCommentOpen,
      handleFollowToggle,
      handleReviewedVote,
      handleSaveToggle,
      handleShare,
      handleUpvoteChange,
    ],
  );

  const getItemLayout = useCallback(
    (_data: unknown, index: number) => ({
      length: SCREEN_HEIGHT,
      offset: SCREEN_HEIGHT * index,
      index,
    }),
    [],
  );

  // ── Computed layout values ──────────────────────────────────────────────────

  const statsTop = insets.top + 12;
  const hintBottom = insets.bottom + 100;
  const tabBarHeight = 88;
  const gradientBottom = insets.bottom + tabBarHeight;

  // ── Loading/empty ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.loadingContainer]}>
        <StatusBar style="light" translucent />
      </View>
    );
  }

  if (!loading && feed.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar style="light" translucent />
        <EmptyState
          variant={
            feedSource === 'error'
              ? 'error'
              : feedSource === 'languageEmpty'
                ? 'languageEmpty'
                : 'empty'
          }
          onRefresh={() => { void fetchFeed(false); }}
          onShowAllLanguages={() => setMyLanguageOnly(false)}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" translucent />

      <FlatList
        data={feed}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={SCREEN_HEIGHT}
        decelerationRate="fast"
        getItemLayout={getItemLayout}
        removeClippedSubviews
        windowSize={3}
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs.current}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={styles.list}
      />

      {/* Tab-bar gradient overlay (black-to-transparent) */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.4)']}
        style={[styles.tabGradient, { height: gradientBottom + 20 }]}
        pointerEvents="none"
      />

      {/* SessionStats pill */}
      <SessionStats
        liked={sessionLiked}
        passed={sessionPassed}
        reviewed={sessionReviewed}
        opacity={statsOpacity}
        topOffset={statsTop}
      />

      {/* Language filter pill (plan 33 Phase 2.5) */}
      <Pressable
        onPress={() => setMyLanguageOnly((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ selected: myLanguageOnly }}
        style={[styles.languagePill, { top: statsTop }, myLanguageOnly && styles.languagePillActive]}
      >
        <Text style={styles.languagePillText}>
          {myLanguageOnly ? t('My language') : t('All languages')}
        </Text>
      </Pressable>

      {/* First-run HintBubble */}
      {showHint && (
        <HintBubble
          text={t('Swipe up for next · Double-tap to like · Tap seal for Reviewed Vote')}
          bottomOffset={hintBottom}
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  list: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#131318',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // SessionStats pill
  statsPill: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: STATS_BG,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
    zIndex: 10,
  },
  statItem: {
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 16,
  },
  statLabel: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 10,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 12,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  // HintBubble
  languagePill: {
    position: 'absolute',
    left: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  languagePillActive: {
    borderColor: '#22C55E',
    backgroundColor: 'rgba(34,197,94,0.18)',
  },
  languagePillText: {
    color: '#E4E1E9',
    fontSize: 12,
    fontWeight: '600',
  },
  hintBubble: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    zIndex: 10,
    maxWidth: SCREEN_WIDTH - 48,
  },
  hintText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 18,
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 20,
    color: '#E4E1E9',
    marginTop: 8,
  },
  emptySubtitle: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: 'rgba(214,195,181,0.6)',
    textAlign: 'center',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: HERO_GREEN,
  },
  refreshLabel: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 14,
    color: HERO_GREEN,
  },
  refreshSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  refreshSecondaryLabel: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },

  // Tab gradient overlay
  tabGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    pointerEvents: 'none',
  },
});
