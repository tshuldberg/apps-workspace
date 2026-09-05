/**
 * FullScreenSubmissionCard — Reels-style full-screen card for VoteFeed (P4-A).
 *
 * Renders one submission per page in the vertical paginated VoteFeed. Handles
 * upvote/downvote, reviewed-vote, comments, share, save, and chef-profile
 * navigation. Animations use React Native's built-in Animated API.
 *
 * Closes F-007 (like/upvote), F-008 (comments), F-009 (share),
 * F-010 (bookmark/save), F-011 (open chef profile).
 */

import React, {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Pressable,
  Share,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../../i18n/I18nProvider';
import {
  ThumbsUp,
  ThumbsDown,
  Award,
  MessageCircle,
  Send,
  Bookmark,
  Volume2,
  VolumeX,
  Flag,
} from 'lucide-react-native';
import { Text } from '@mylife/ui';
import { JAKARTA_FONTS } from '@mylife/bestchef';
import { DishVisual } from '@mylife/bestchef/ui';
import { formatCount } from './utils';
import { ReportMenu } from '../ReportMenu';
import type { Submission } from '@mylife/bestchef';

// ── SubmissionViewModel ───────────────────────────────────────────────────────

/**
 * Extended view-model wrapping the cloud Submission with display-layer extras:
 * video assets, comment count, user interaction state, and chef display info.
 */
export interface SubmissionVideo {
  uri: string;
}

export interface SubmissionViewModel extends Submission {
  /** Video assets for the submission, if any. */
  videos?: SubmissionVideo[];
  /** Cached comment count for the action bar counter. */
  comment_count: number;
  /** Whether the current viewer has already upvoted. */
  viewerUpvoted?: boolean;
  /** Whether the current viewer has already downvoted. */
  viewerDownvoted?: boolean;
  /** Whether the current viewer has saved/bookmarked this submission. */
  viewerSaved?: boolean;
  /** Whether the current viewer is following this chef. */
  viewerFollowing?: boolean;
  /** Chef display name. */
  chefDisplayName?: string;
  /** Chef avatar URL (optional). */
  chefAvatarUrl?: string | null;
  /** Whether the chef is a verified restaurant. */
  is_restaurant: boolean;
  /** Top ingredients for the marquee ticker. */
  topIngredients?: string[];
  /** Dish name for display. */
  dishName?: string;
  /** Cuisine label for display. */
  cuisine?: string | null;
  /** Emoji for the dish fallback visual. */
  emoji?: string | null;
  /** Gradient colours for the dish fallback visual. */
  gradientFrom?: string | null;
  gradientTo?: string | null;
  /** Chef ID for navigation. */
  chefId?: string | null;
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface FullScreenSubmissionCardProps {
  submission: SubmissionViewModel;
  isActive: boolean;
  onUpvoteChange: (next: 'up' | 'down' | null) => void;
  onReviewedVote: () => void;
  onCommentOpen: () => void;
  onShare: () => void;
  onSaveToggle: () => void;
  onFollowToggle: () => void;
  onChefPress: () => void;
}

// ── Layout constants ───────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const HERO_PRIMARY = '#22C55E';
const GOLD = '#C9894D';
const ACTION_BLUR_BG = 'rgba(0,0,0,0.35)';
const WHITE = '#FFFFFF';
const WHITE_70 = 'rgba(255,255,255,0.7)';
const WHITE_85 = 'rgba(255,255,255,0.85)';

// ── Helpers ────────────────────────────────────────────────────────────────────

function buildInitials(name: string): string {
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0]?.charAt(0).toUpperCase() ?? '?';
  return (parts[0]?.charAt(0) ?? '') + (parts[parts.length - 1]?.charAt(0) ?? '');
}

// ── Sub-components ─────────────────────────────────────────────────────────────

interface RailButtonProps {
  icon: React.ReactNode;
  count?: number;
  onPress: () => void;
  accessibilityLabel: string;
  scaleAnim: Animated.Value;
}

function RailButton({ icon, count, onPress, accessibilityLabel, scaleAnim }: RailButtonProps) {
  return (
    <View style={styles.railItem}>
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          hitSlop={8}
          style={styles.railButton}
        >
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFillObject} />
          <View style={styles.railIconWrap}>{icon}</View>
        </Pressable>
      </Animated.View>
      {count !== undefined && (
        <Text style={styles.railCount}>{formatCount(count)}</Text>
      )}
    </View>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

function FullScreenSubmissionCardInner({
  submission,
  isActive,
  onUpvoteChange,
  onReviewedVote,
  onCommentOpen,
  onShare: onShareProp,
  onSaveToggle,
  onFollowToggle,
  onChefPress,
}: FullScreenSubmissionCardProps) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const videoRef = useRef<Video>(null);

  // ── Playback state ─────────────────────────────────────────────────────────
  const [paused, setPaused] = useState(!isActive);
  const [muted, setMuted] = useState(true);
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const playIconTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Optimistic interaction state ───────────────────────────────────────────
  const [upvoted, setUpvoted] = useState(submission.viewerUpvoted ?? false);
  const [downvoted, setDownvoted] = useState(submission.viewerDownvoted ?? false);
  const [saved, setSaved] = useState(submission.viewerSaved ?? false);
  const [upvoteCount, setUpvoteCount] = useState(submission.upvoteCount);
  const [downvoteCount, setDownvoteCount] = useState(submission.downvoteCount);

  // ── Animations ─────────────────────────────────────────────────────────────
  const upvoteScale = useRef(new Animated.Value(1)).current;
  const downvoteScale = useRef(new Animated.Value(1)).current;
  const reviewedScale = useRef(new Animated.Value(1)).current;
  const commentScale = useRef(new Animated.Value(1)).current;
  const shareScale = useRef(new Animated.Value(1)).current;
  const saveScale = useRef(new Animated.Value(1)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;
  const heartScale = useRef(new Animated.Value(0)).current;
  const playIconOpacity = useRef(new Animated.Value(0)).current;
  const heartPosition = useRef({ x: SCREEN_WIDTH / 2, y: SCREEN_HEIGHT / 2 }).current;

  // Reviewed-vote pulse every 8s when reviewed_count = 0
  const reviewedPulseTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (submission.reviewedCount === 0 && isActive) {
      reviewedPulseTimer.current = setInterval(() => {
        Animated.sequence([
          Animated.timing(reviewedScale, { toValue: 1.15, duration: 300, useNativeDriver: true }),
          Animated.timing(reviewedScale, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]).start();
      }, 8000);
    }
    return () => {
      if (reviewedPulseTimer.current) clearInterval(reviewedPulseTimer.current);
    };
  }, [isActive, reviewedScale, submission.reviewedCount]);

  // ── Video active sync ──────────────────────────────────────────────────────
  useEffect(() => {
    if (isActive) {
      void videoRef.current?.playAsync();
      setPaused(false);
    } else {
      void videoRef.current?.pauseAsync();
      setPaused(true);
    }
  }, [isActive]);

  // ── Tap handlers ───────────────────────────────────────────────────────────
  const animateTap = useCallback((anim: Animated.Value) => {
    Animated.sequence([
      Animated.spring(anim, { toValue: 1.4, useNativeDriver: true, speed: 30, bounciness: 6 }),
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }),
    ]).start();
  }, []);

  const handleUpvote = useCallback(() => {
    animateTap(upvoteScale);
    if (upvoted) {
      setUpvoted(false);
      setUpvoteCount((c) => Math.max(0, c - 1));
      onUpvoteChange(null);
    } else {
      setUpvoted(true);
      setDownvoted(false);
      setUpvoteCount((c) => c + 1);
      if (downvoted) setDownvoteCount((c) => Math.max(0, c - 1));
      onUpvoteChange('up');
    }
  }, [animateTap, downvoted, onUpvoteChange, upvoteScale, upvoted]);

  const handleDownvote = useCallback(() => {
    animateTap(downvoteScale);
    if (downvoted) {
      setDownvoted(false);
      setDownvoteCount((c) => Math.max(0, c - 1));
      onUpvoteChange(null);
    } else {
      setDownvoted(true);
      setUpvoted(false);
      setDownvoteCount((c) => c + 1);
      if (upvoted) setUpvoteCount((c) => Math.max(0, c - 1));
      onUpvoteChange('down');
    }
  }, [animateTap, downvoteScale, downvoted, onUpvoteChange, upvoted]);

  const handleReviewedVote = useCallback(() => {
    animateTap(reviewedScale);
    onReviewedVote();
  }, [animateTap, onReviewedVote, reviewedScale]);

  const handleComment = useCallback(() => {
    animateTap(commentScale);
    onCommentOpen();
  }, [animateTap, commentScale, onCommentOpen]);

  const handleShare = useCallback(() => {
    animateTap(shareScale);
    const dishName = submission.dishName ?? 'this dish';
    const chefName = submission.chefDisplayName ?? 'a chef';
    void Share.share({
      title: `${dishName} by ${chefName} on BestChef`,
      message: `Check out ${dishName} by ${chefName} on BestChef!\nbestchef://feed?submissionId=${submission.id}`,
      url: `https://bestchef.app/submission/${submission.id}`,
    });
    onShareProp();
  }, [animateTap, onShareProp, shareScale, submission.chefDisplayName, submission.dishName, submission.id]);

  const handleSave = useCallback(() => {
    animateTap(saveScale);
    setSaved((s) => !s);
    onSaveToggle();
  }, [animateTap, onSaveToggle, saveScale]);

  // ── Double-tap heart ────────────────────────────────────────────────────────
  const spawnHeart = useCallback((x: number, y: number) => {
    heartPosition.x = x;
    heartPosition.y = y;
    heartOpacity.setValue(1);
    heartScale.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(heartScale, {
          toValue: 1.4,
          duration: 140,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(heartScale, {
          toValue: 1.0,
          duration: 140,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(140),
        Animated.timing(heartOpacity, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
    if (!upvoted) {
      setUpvoted(true);
      setUpvoteCount((c) => c + 1);
      onUpvoteChange('up');
    }
  }, [heartOpacity, heartPosition, heartScale, onUpvoteChange, upvoted]);

  // ── Single-tap play/pause ───────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    if (paused) {
      void videoRef.current?.playAsync();
    } else {
      void videoRef.current?.pauseAsync();
    }
    setPaused((p) => !p);
    playIconOpacity.setValue(1);
    if (playIconTimeout.current) clearTimeout(playIconTimeout.current);
    Animated.timing(playIconOpacity, {
      toValue: 0,
      duration: 600,
      delay: 200,
      useNativeDriver: true,
    }).start();
  }, [paused, playIconOpacity]);

  // ── Derived render values ───────────────────────────────────────────────────
  const videoUri = submission.videos?.[0]?.uri ?? null;
  const hasVideo = Boolean(videoUri);
  const chefName = submission.chefDisplayName ?? 'Chef';
  const initials = buildInitials(chefName);
  const ingredients = submission.topIngredients ?? [];
  const dishName = submission.dishName ?? '';
  const cuisine = submission.cuisine ?? '';
  const region = submission.region ?? '';
  const rank = submission.rank;

  const dishSource = {
    name: dishName,
    cuisine,
    gradientFrom: submission.gradientFrom,
    gradientTo: submission.gradientTo,
    emoji: submission.emoji,
    photoUrl: submission.photoUrl,
  };

  return (
    <View style={styles.card}>

      {/* Z=0: Background media */}
      {hasVideo ? (
        <Video
          ref={videoRef}
          source={{ uri: videoUri! }}
          style={StyleSheet.absoluteFillObject}
          resizeMode={ResizeMode.COVER}
          isLooping
          shouldPlay={isActive}
          isMuted={muted}
        />
      ) : submission.photoUrl ? (
        <Image
          source={{ uri: submission.photoUrl }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : (
        <DishVisual
          dish={dishSource}
          size={SCREEN_WIDTH}
          radius={0}
          style={StyleSheet.absoluteFillObject}
        />
      )}

      {/* Z=1: Top gradient */}
      <LinearGradient
        colors={['rgba(0,0,0,0.55)', 'transparent']}
        style={styles.topGradient}
        pointerEvents="none"
      />

      {/* Z=1: Bottom gradient */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.75)']}
        style={styles.bottomGradient}
        pointerEvents="none"
      />

      {/* Z=2: Rank badge (top-left) */}
      {rank !== null && rank !== undefined && rank <= 100 && (
        <View style={[styles.rankWrap, { top: insets.top + 12 }]}>
          <LinearGradient
            colors={['#F5C842', '#C9894D']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.rankPill}
          >
            <Text style={styles.rankText}>{t('#{rank} THIS WEEK', { rank })}</Text>
          </LinearGradient>
        </View>
      )}

      {/* Z=2: Mute toggle (top-right, video only) */}
      {hasVideo && (
        <View style={[styles.muteWrap, { top: insets.top + 12 }]}>
          <Pressable
            onPress={() => setMuted((m) => !m)}
            accessibilityRole="button"
            accessibilityLabel={muted ? 'Unmute video' : 'Mute video'}
            style={styles.muteButton}
          >
            <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFillObject} />
            <View style={styles.muteIcon}>
              {muted
                ? <VolumeX size={18} color={WHITE} strokeWidth={2} />
                : <Volume2 size={18} color={WHITE} strokeWidth={2} />}
            </View>
          </Pressable>
        </View>
      )}

      {/* Z=2: Right-rail action stack */}
      <View style={styles.railStack}>
        <RailButton
          icon={
            <ThumbsUp
              size={26}
              color={upvoted ? HERO_PRIMARY : WHITE}
              fill={upvoted ? HERO_PRIMARY : 'transparent'}
              strokeWidth={2}
            />
          }
          count={upvoteCount}
          onPress={handleUpvote}
          accessibilityLabel={upvoted ? 'Remove upvote' : 'Upvote submission'}
          scaleAnim={upvoteScale}
        />
        <RailButton
          icon={
            <ThumbsDown
              size={26}
              color={downvoted ? '#FF6B6B' : WHITE}
              fill={downvoted ? '#FF6B6B' : 'transparent'}
              strokeWidth={2}
            />
          }
          count={downvoteCount}
          onPress={handleDownvote}
          accessibilityLabel={downvoted ? 'Remove downvote' : 'Downvote submission'}
          scaleAnim={downvoteScale}
        />
        <RailButton
          icon={
            <Award
              size={26}
              color={GOLD}
              strokeWidth={2}
            />
          }
          count={submission.reviewedCount}
          onPress={handleReviewedVote}
          accessibilityLabel={t('Cast reviewed vote (CookProof)')}
          scaleAnim={reviewedScale}
        />
        <RailButton
          icon={<MessageCircle size={26} color={WHITE} strokeWidth={2} />}
          count={submission.comment_count}
          onPress={handleComment}
          accessibilityLabel={t('Open comments')}
          scaleAnim={commentScale}
        />
        <RailButton
          icon={<Send size={24} color={WHITE} strokeWidth={2} />}
          onPress={handleShare}
          accessibilityLabel={t('Share submission')}
          scaleAnim={shareScale}
        />
        <RailButton
          icon={
            <Bookmark
              size={24}
              color={saved ? GOLD : WHITE}
              fill={saved ? GOLD : 'transparent'}
              strokeWidth={2}
            />
          }
          onPress={handleSave}
          accessibilityLabel={saved ? 'Remove bookmark' : 'Bookmark submission'}
          scaleAnim={saveScale}
        />
        <View style={styles.railItem}>
          <ReportMenu
            targetKind="submission"
            targetId={submission.id}
            accessibilityLabel={t('Report submission')}
            style={styles.railButton}
          >
            <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.railIconWrap}>
              <Flag size={23} color={WHITE} strokeWidth={2} />
            </View>
          </ReportMenu>
        </View>
      </View>

      {/* Z=2: Bottom-left meta overlay */}
      <View style={[styles.meta, { bottom: insets.bottom + 24 }]}>
        {/* Chef row */}
        <Pressable
          onPress={onChefPress}
          accessibilityRole="button"
          accessibilityLabel={`View chef ${chefName}'s profile`}
          style={styles.chefRow}
        >
          {/* Avatar */}
          {submission.chefAvatarUrl ? (
            <Image
              source={{ uri: submission.chefAvatarUrl }}
              style={styles.avatar}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : (
            <LinearGradient
              colors={['#C9894D', '#8B5E3C']}
              style={styles.avatar}
            >
              <Text style={styles.avatarInitials}>{initials}</Text>
            </LinearGradient>
          )}
          <Text style={styles.chefName} numberOfLines={1}>{chefName}</Text>
          {submission.is_restaurant && (
            <Award size={14} color={GOLD} strokeWidth={2} style={styles.verifiedSeal} />
          )}
          {!submission.viewerFollowing && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                onFollowToggle();
              }}
              accessibilityRole="button"
              accessibilityLabel={`Follow ${chefName}`}
              style={styles.followPill}
            >
              <LinearGradient
                colors={[HERO_PRIMARY, '#16A34A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFillObject}
              />
              <Text style={styles.followText}>{t('Follow')}</Text>
            </Pressable>
          )}
        </Pressable>

        {/* Title */}
        {dishName ? (
          <Text style={styles.title} numberOfLines={2}>{dishName}</Text>
        ) : null}

        {/* Cuisine · region */}
        {(cuisine || region) && (
          <Text style={styles.cuisineRegion}>
            {[cuisine, region].filter(Boolean).join(' · ')}
          </Text>
        )}

        {/* Ingredient ticker */}
        {ingredients.length > 0 && (
          <IngredientMarquee ingredients={ingredients} isActive={isActive} />
        )}
      </View>

      {/* Z=3: Single-tap play/pause zone (video only, avoids rail) */}
      {hasVideo && (
        <Pressable
          style={styles.playZone}
          onPress={togglePlay}
          accessibilityRole="button"
          accessibilityLabel={paused ? 'Play video' : 'Pause video'}
        >
          <Animated.View style={[styles.playIconWrap, { opacity: playIconOpacity }]}>
            <View style={styles.playIconCircle}>
              <Text style={styles.playIconGlyph}>{paused ? '▶' : '⏸'}</Text>
            </View>
          </Animated.View>
        </Pressable>
      )}

      {/* Z=3: Double-tap heart overlay */}
      <DoubleTapZone onDoubleTap={spawnHeart} />

      {/* Heart spawn animation */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.heartSpawn,
          {
            left: heartPosition.x - 60,
            top: heartPosition.y - 60,
            opacity: heartOpacity,
            transform: [{ scale: heartScale }],
          },
        ]}
      >
        <Text style={styles.heartGlyph}>♥</Text>
      </Animated.View>
    </View>
  );
}

// ── DoubleTapZone ──────────────────────────────────────────────────────────────

interface DoubleTapZoneProps {
  onDoubleTap: (x: number, y: number) => void;
}

function DoubleTapZone({ onDoubleTap }: DoubleTapZoneProps) {
  const lastTap = useRef<number>(0);

  const handlePress = useCallback((evt: { nativeEvent: { locationX: number; locationY: number } }) => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      onDoubleTap(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  }, [onDoubleTap]);

  return (
    <Pressable
      style={styles.doubleTapZone}
      onPress={handlePress}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}

// ── IngredientMarquee ─────────────────────────────────────────────────────────

interface IngredientMarqueeProps {
  ingredients: string[];
  isActive: boolean;
}

function IngredientMarquee({ ingredients, isActive }: IngredientMarqueeProps) {
  const text = ingredients.map((i) => `• ${i}`).join('  ');
  const translateX = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!isActive) {
      animRef.current?.stop();
      return;
    }
    // Each character is ~7px wide; scroll at 25px/sec
    const charWidth = 7;
    const textWidth = text.length * charWidth;
    const duration = (textWidth / 25) * 1000;
    translateX.setValue(SCREEN_WIDTH * 0.55);
    const anim = Animated.loop(
      Animated.timing(translateX, {
        toValue: -textWidth,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animRef.current = anim;
    anim.start();
    return () => anim.stop();
  }, [isActive, text, translateX]);

  return (
    <View style={styles.marqueeContainer} pointerEvents="none">
      <Animated.Text
        style={[styles.marqueeText, { transform: [{ translateX }] }]}
        numberOfLines={1}
      >
        {text}
      </Animated.Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#000',
    overflow: 'hidden',
  },

  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.30,
    zIndex: 1,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.45,
    zIndex: 1,
  },

  // Rank badge
  rankWrap: {
    position: 'absolute',
    left: 16,
    zIndex: 2,
  },
  rankPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  rankText: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 12,
    color: '#3A1B00',
    letterSpacing: 0.3,
  },

  // Mute button
  muteWrap: {
    position: 'absolute',
    right: 16,
    zIndex: 2,
  },
  muteButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  muteIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Right-rail
  railStack: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 22,
    zIndex: 2,
  },
  railItem: {
    alignItems: 'center',
    gap: 4,
  },
  railButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACTION_BLUR_BG,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
    minWidth: 44,
    minHeight: 44,
  },
  railIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  railCount: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 12,
    color: WHITE,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // Bottom meta
  meta: {
    position: 'absolute',
    left: 16,
    right: 92,
    zIndex: 2,
    gap: 6,
  },
  chefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarInitials: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 14,
    lineHeight: 18,
    includeFontPadding: false,
    textAlign: 'center',
    color: WHITE,
  },
  chefName: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 15,
    color: WHITE,
    flex: 1,
  },
  verifiedSeal: {
    marginLeft: 2,
  },
  followPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 12,
    color: WHITE,
  },
  title: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 17,
    color: WHITE,
    lineHeight: 17 * 1.25,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  cuisineRegion: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    color: WHITE_85,
  },

  // Marquee
  marqueeContainer: {
    overflow: 'hidden',
    height: 18,
  },
  marqueeText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 12,
    color: WHITE_70,
    position: 'absolute',
    whiteSpace: 'nowrap',
  } as never,

  // Play/pause tap zone (avoids right 92pt of rail)
  playZone: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 92,
    bottom: 0,
    zIndex: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIconGlyph: {
    fontSize: 32,
    color: WHITE,
  },

  // Double-tap zone (full screen, below action buttons)
  doubleTapZone: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 92,
    bottom: 0,
    zIndex: 3,
  },

  // Heart spawn
  heartSpawn: {
    position: 'absolute',
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
    pointerEvents: 'none',
  },
  heartGlyph: {
    fontSize: 120,
    color: HERO_PRIMARY,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
});

export const FullScreenSubmissionCard = memo(
  FullScreenSubmissionCardInner,
  (prev, next) =>
    prev.submission.id === next.submission.id && prev.isActive === next.isActive,
);
