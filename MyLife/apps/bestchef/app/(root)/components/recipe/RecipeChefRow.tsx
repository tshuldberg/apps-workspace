import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BadgeCheck } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { JAKARTA_FONTS, HERO_GRADIENT } from '@mylife/bestchef';
import { useI18n } from '../../i18n/I18nProvider';
import { useAppThemeColors as useThemeColors, useAppThemeProfile as useTheme } from '../../providers/AppThemeProvider';

// Cloud follower helpers (Supabase bc_followers table)
import {
  cloudFollowChef,
  cloudUnfollowChef,
  cloudIsFollowingChef,
} from '@mylife/bestchef';

export interface RecipeChefRowProps {
  chefId: string;
  displayName: string;
  isRestaurant: boolean;
  region: string;
}

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();
}

/**
 * Chef identity row: avatar (initials) + name + verified seal + subtitle.
 * Trailing Follow/Following capsule with optimistic UI.
 */
export function RecipeChefRow({ chefId, displayName, isRestaurant, region }: RecipeChefRowProps) {
  const router = useRouter();
  const { t } = useI18n();
  const tc = useThemeColors();
  const theme = useTheme();
  const [isFollowing, setIsFollowing] = useState(false);
  const followReqRef = useRef(0);

  useEffect(() => {
    if (!chefId) return;
    void cloudIsFollowingChef({ chefId }).then((result) => {
      if (result.ok) setIsFollowing(result.data);
    });
  }, [chefId]);

  const handleFollowToggle = useCallback(async () => {
    const next = !isFollowing;
    const reqId = ++followReqRef.current;
    setIsFollowing(next); // optimistic

    const result = next
      ? await cloudFollowChef({ chefId })
      : await cloudUnfollowChef({ chefId });

    if (followReqRef.current !== reqId) return;
    if (!result.ok) {
      setIsFollowing(!next); // revert
      Alert.alert(t('Error'), result.error);
    }
  }, [chefId, isFollowing, t]);

  const subtitle = isRestaurant
    ? t('Verified restaurant · {region}', { region })
    : t('Home chef · {region}', { region });

  return (
    <View style={[styles.row, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
      <Pressable
        style={styles.identity}
        onPress={() => router.push(`/chef/${chefId}`)}
        accessibilityRole="button"
        accessibilityLabel={t('View chef {handle}', { handle: displayName })}
      >
        {/* Avatar */}
        <View style={[styles.avatar, { backgroundColor: `${tc.accent}22` }]}>
          <Text style={[styles.avatarText, { color: tc.accent }]}>{initials(displayName)}</Text>
        </View>

        {/* Name + subtitle */}
        <View style={styles.nameCol}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: tc.text }]} numberOfLines={1}>
              {displayName}
            </Text>
            {isRestaurant ? (
              <BadgeCheck size={14} color="#8BCFF0" strokeWidth={2} />
            ) : null}
          </View>
          <Text style={[styles.subtitle, { color: tc.textSecondary }]} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </Pressable>

      {/* Follow button */}
      <Pressable
        onPress={() => void handleFollowToggle()}
        accessibilityRole="button"
        accessibilityLabel={isFollowing ? t('Following') : t('Follow')}
        hitSlop={8}
      >
        {isFollowing ? (
          <View style={[styles.followingCapsule, { borderColor: theme.glass.cardBorder }]}>
            <Text style={[styles.followingText, { color: tc.textSecondary }]}>{t('Following')}</Text>
          </View>
        ) : (
          <LinearGradient
            colors={[HERO_GRADIENT.from, HERO_GRADIENT.to]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.followCapsule}
          >
            <Text style={styles.followText}>{t('Follow')}</Text>
          </LinearGradient>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  identity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    textAlign: 'center',
  },
  nameCol: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  name: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 16,
  },
  subtitle: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
  },
  followCapsule: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  followingCapsule: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followingText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 13,
  },
});
