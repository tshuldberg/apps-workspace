import { useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BadgeCheck, ThumbsDown, ThumbsUp } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { HERO_GRADIENT, JAKARTA_FONTS } from '@mylife/bestchef/ui';
import {
  castTapVote,
  type CastTapVoteResult,
} from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useI18n } from '../../i18n/I18nProvider';
import { saveVote } from '../../data/local-submissions';
import { useAppThemeColors as useThemeColors } from '../../providers/AppThemeProvider';
import { useDatabase } from '../../providers/DatabaseProvider';

type TapDirection = 'up' | 'down' | null;

interface VoteButtonProps {
  icon: 'thumbs-up' | 'thumbs-down';
  label: string;
  active: boolean;
  activeColor: string;
  inactiveColor: string;
  onPress: () => void;
  disabled?: boolean;
}

function VoteButton({
  icon,
  label,
  active,
  activeColor,
  inactiveColor,
  onPress,
  disabled = false,
}: VoteButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    if (disabled) return;
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.88, duration: 80, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  const iconColor = active ? activeColor : inactiveColor;

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.voteButtonHit}
    >
      <Animated.View style={[styles.voteButtonInner, { transform: [{ scale }] }]}>
        {icon === 'thumbs-up' ? (
          <ThumbsUp
            size={22}
            color={iconColor}
            fill={active ? iconColor : 'transparent'}
            strokeWidth={2}
          />
        ) : (
          <ThumbsDown
            size={22}
            color={iconColor}
            fill={active ? iconColor : 'transparent'}
            strokeWidth={2}
          />
        )}
        <Text style={[styles.voteButtonLabel, { color: iconColor }]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

export interface RecipeVoteFooterProps {
  submissionId: string;
  currentUserId: string | null;
  chefId: string;
  initialVoteDirection: TapDirection;
  supabase: SupabaseClient | null;
  voterProfileId: string | null;
  onVoteChange?: (direction: TapDirection) => void;
}

export function RecipeVoteFooter({
  submissionId,
  currentUserId,
  chefId,
  initialVoteDirection,
  supabase,
  voterProfileId,
  onVoteChange,
}: RecipeVoteFooterProps) {
  const tc = useThemeColors();
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const db = useDatabase();
  const [userVote, setUserVote] = useState<TapDirection>(initialVoteDirection);
  const pendingRef = useRef(false);

  // Hide footer for own submission
  if (currentUserId && chefId === currentUserId) {
    return null;
  }

  const handleTap = (direction: 'up' | 'down') => {
    if (pendingRef.current) return;
    const next: TapDirection = userVote === direction ? null : direction;
    // Optimistic update
    setUserVote(next);
    onVoteChange?.(next);
    saveVote(db, submissionId, next === 'up' ? 1 : next === 'down' ? -1 : 0);

    if (!voterProfileId || !supabase) return;

    pendingRef.current = true;

    void castTapVote({
      submissionId,
      direction,
      voterProfileId,
      supabase: supabase ?? undefined,
    }).then((result: CastTapVoteResult) => {
      pendingRef.current = false;
      if (!result.ok) {
        // Revert optimistic state
        setUserVote(userVote);
        onVoteChange?.(userVote);
      }
    }).catch(() => {
      pendingRef.current = false;
      setUserVote(userVote);
      onVoteChange?.(userVote);
    });
  };

  const footerPaddingBottom = insets.bottom + 12;

  return (
    <View
      style={[
        styles.footer,
        {
          backgroundColor: Platform.OS === 'android'
            ? 'rgba(13, 13, 18, 0.92)'
            : 'rgba(0, 0, 0, 0.55)',
          paddingBottom: footerPaddingBottom,
        },
      ]}
    >
      {/* Pass button */}
      <VoteButton
        icon="thumbs-down"
        label={t('Pass')}
        active={userVote === 'down'}
        activeColor={tc.textSecondary ?? 'rgba(214,195,181,0.85)'}
        inactiveColor="rgba(255,255,255,0.45)"
        onPress={() => handleTap('down')}
      />

      {/* Yum button */}
      <VoteButton
        icon="thumbs-up"
        label={t('Yum')}
        active={userVote === 'up'}
        activeColor={HERO_GRADIENT.from}
        inactiveColor="rgba(255,255,255,0.45)"
        onPress={() => handleTap('up')}
      />

      {/* Reviewed Vote CTA */}
      <Pressable
        onPress={() => router.push(`/reviewed-vote/${submissionId}`)}
        accessibilityRole="button"
        accessibilityLabel={t('Reviewed Vote')}
        style={({ pressed }) => [styles.reviewedHit, pressed && { opacity: 0.8 }]}
      >
        <LinearGradient
          colors={[HERO_GRADIENT.from, HERO_GRADIENT.to]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.reviewedGradient}
        >
          <BadgeCheck size={15} color="#FFFFFF" strokeWidth={2.5} />
          <Text style={styles.reviewedText}>{t('Reviewed Vote')}</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 12,
    gap: 8,
  },

  voteButtonHit: {
    width: 64,
    alignItems: 'center',
  },
  voteButtonInner: {
    alignItems: 'center',
    gap: 4,
  },
  voteButtonLabel: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 10,
    letterSpacing: 0.2,
  },

  reviewedHit: {
    flex: 1,
  },
  reviewedGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  reviewedText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
});
