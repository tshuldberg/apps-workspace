import { Alert, Share } from 'react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BadgeCheck, Flame, Share2 } from 'lucide-react-native';
import { Text } from '@mylife/ui';
import { HERO_GRADIENT, JAKARTA_FONTS } from '@mylife/bestchef';
import { useAppThemeColors as useThemeColors } from '../../providers/AppThemeProvider';
import { useI18n } from '../../i18n/I18nProvider';

export interface ProfileHeaderChef {
  displayName: string;
  handle: string;
  city?: string;
  bio?: string;
  isVerified?: boolean;
  initials: string;
  avatarColor?: string;
  id: string;
}

interface ProfileHeaderProps {
  chef: ProfileHeaderChef;
  isPublic?: boolean;
}

export function ProfileHeader({ chef, isPublic = true }: ProfileHeaderProps) {
  const router = useRouter();
  const tc = useThemeColors();
  const { t } = useI18n();

  const subtitle = [chef.handle ? `@${chef.handle}` : null, chef.city]
    .filter(Boolean)
    .join(' · ');

  async function handleShare() {
    if (!isPublic) {
      Alert.alert(t('Profile is private'), t('Turn on Public profile in Edit Profile to share your link.'));
      return;
    }
    if (!chef.handle) {
      Alert.alert(t('Profile is private'), t('Set a handle in Edit Profile to share your link.'));
      return;
    }
    const publicUrl = `https://bestchef.app/c/${chef.handle}`;
    try {
      await Share.share({
        message: t('Check out my chef profile on BestChef!\n{url}', { url: publicUrl }),
        url: publicUrl,
      });
    } catch {
      // dismissed -- no-op
    }
  }

  return (
    <View style={styles.container}>
      {/* Avatar */}
      <View style={styles.avatarWrap}>
        <LinearGradient
          colors={[HERO_GRADIENT.from, HERO_GRADIENT.to]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.avatar}
        >
          <Text style={styles.initials}>{chef.initials}</Text>
        </LinearGradient>

        {/* Flame badge overlay */}
        <View style={[styles.flameBadge, { backgroundColor: tc.surface }]}>
          <Flame size={14} color={HERO_GRADIENT.from} fill={HERO_GRADIENT.from} strokeWidth={0} />
        </View>
      </View>

      {/* Name + verified seal */}
      <View style={styles.nameRow}>
        <Text style={[styles.displayName, { color: tc.text }]}>{chef.displayName}</Text>
        {chef.isVerified && (
          <BadgeCheck size={14} color="#8BCFF0" strokeWidth={2} />
        )}
      </View>

      {/* Handle · city */}
      {subtitle ? (
        <Text style={[styles.subtitle, { color: tc.textSecondary }]}>{subtitle}</Text>
      ) : null}

      {/* Bio */}
      {chef.bio ? (
        <Text style={[styles.bio, { color: tc.textSecondary }]} numberOfLines={4}>
          {chef.bio}
        </Text>
      ) : null}

      {/* Action buttons */}
      <View style={styles.buttonRow}>
        <Pressable
          style={({ pressed }) => [styles.editButton, pressed && { opacity: 0.88 }]}
          onPress={() => router.push('/edit-profile')}
          accessibilityRole="button"
          accessibilityLabel={t('Edit Profile')}
        >
          <LinearGradient
            colors={[HERO_GRADIENT.from, HERO_GRADIENT.to]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, styles.editGradient]}
          />
          <Text style={styles.editButtonText}>{t('Edit Profile')}</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.shareButton,
            { backgroundColor: tc.surfaceElevated },
            pressed && { opacity: 0.88 },
          ]}
          onPress={() => void handleShare()}
          accessibilityRole="button"
          accessibilityLabel={t('Share')}
        >
          <Share2 size={16} color={tc.text} strokeWidth={2} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  avatarWrap: {
    position: 'relative',
    width: 100,
    height: 100,
    marginBottom: 4,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 32,
    lineHeight: 42,
    includeFontPadding: false,
    textAlign: 'center',
    color: '#FFFFFF',
  },
  flameBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateX: 4 }, { translateY: 4 }],
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  displayName: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 22,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
  },
  bio: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  editButton: {
    flex: 1,
    height: 42,
    borderRadius: 999,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editGradient: {
    borderRadius: 999,
  },
  editButtonText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  shareButton: {
    width: 44,
    height: 42,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
