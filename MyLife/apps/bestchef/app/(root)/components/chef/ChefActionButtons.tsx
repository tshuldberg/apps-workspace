import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Pressable, StyleSheet, View } from 'react-native';
import { Check, MessageCircle, Plus } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '@mylife/ui';
import { HERO_GRADIENT, JAKARTA_FONTS } from '@mylife/bestchef';
import { cloudFollowChef, cloudIsFollowingChef, cloudUnfollowChef } from '@mylife/bestchef';
import { useAppThemeColors as useThemeColors } from '../../providers/AppThemeProvider';
import { useAppThemeProfile as useTheme } from '../../providers/AppThemeProvider';
import { useI18n } from '../../i18n/I18nProvider';

interface Props {
  chefId: string;
}

export function ChefActionButtons({ chefId }: Props) {
  const tc = useThemeColors();
  const theme = useTheme();
  const { t } = useI18n();

  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Optimistic animation: scale the follow button on press
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let cancelled = false;
    void cloudIsFollowingChef({ chefId }).then((result) => {
      if (!cancelled) {
        if (result.ok) setIsFollowing(result.data);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [chefId]);

  const handleFollow = useCallback(async () => {
    const prev = isFollowing;
    // Optimistic update
    setIsFollowing(!prev);
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.92, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
    ]).start();

    const result = prev
      ? await cloudUnfollowChef({ chefId })
      : await cloudFollowChef({ chefId });

    if (!result.ok) {
      // Revert
      setIsFollowing(prev);
      Alert.alert(t('Error'), result.error);
    }
  }, [chefId, isFollowing, scaleAnim, t]);

  function handleDM() {
    Alert.alert(t('Coming soon'), t('Direct messages are coming in a future update.'));
  }

  return (
    <View style={styles.row}>
      {/* Follow / Unfollow */}
      <Animated.View style={[styles.followWrap, { transform: [{ scale: scaleAnim }] }]}>
        <Pressable
          style={styles.followBtn}
          onPress={() => void handleFollow()}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel={isFollowing ? t('Following') : t('Follow')}
          accessibilityState={{ selected: isFollowing }}
        >
          {isFollowing ? (
            <View style={[styles.followingPill, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
              <Check size={14} color={tc.text} strokeWidth={2.5} />
              <Text style={[styles.btnLabel, { color: tc.text }]}>{t('Following')}</Text>
            </View>
          ) : (
            <LinearGradient
              colors={[HERO_GRADIENT.from, HERO_GRADIENT.to]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.followGradient}
            >
              <Plus size={14} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={[styles.btnLabel, { color: '#FFFFFF' }]}>{t('Follow')}</Text>
            </LinearGradient>
          )}
        </Pressable>
      </Animated.View>

      {/* DM */}
      <Pressable
        style={[styles.dmBtn, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}
        onPress={handleDM}
        accessibilityRole="button"
        accessibilityLabel={t('Message')}
      >
        <MessageCircle size={16} color={tc.text} strokeWidth={2} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    alignSelf: 'stretch',
  },
  followWrap: {
    flex: 1,
  },
  followBtn: {
    flex: 1,
  },
  followGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 999,
    paddingVertical: 13,
  },
  followingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 999,
    paddingVertical: 13,
    borderWidth: 1,
  },
  dmBtn: {
    width: 48,
    height: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  btnLabel: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 14,
  },
});
