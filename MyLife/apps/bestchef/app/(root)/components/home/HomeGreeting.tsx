import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@mylife/ui';
import { HeroGradientView } from '@mylife/bestchef/ui';
import { JAKARTA_FONTS } from '@mylife/bestchef';
import { useAppThemeColors as useThemeColors } from '../../providers/AppThemeProvider';
import { useBestChefCloud } from '../../providers/BestChefCloudProvider';
import { useI18n } from '../../i18n/I18nProvider';
import type { TranslationKey } from '../../i18n/catalogs';

function getGreetingKey(): TranslationKey {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning, Chef';
  if (hour < 17) return 'Good afternoon, Chef';
  return 'Good evening, Chef';
}

function getInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0] ?? '').slice(0, 2).toUpperCase();
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

export function HomeGreeting() {
  const router = useRouter();
  const tc = useThemeColors();
  const { t } = useI18n();
  const { profile } = useBestChefCloud();

  const displayName = profile?.displayName ?? 'Chef';
  const initials = getInitials(displayName);

  return (
    <View style={styles.row}>
      <View style={styles.textCol}>
        <Text style={[styles.greeting, { color: tc.textSecondary }]}>
          {t(getGreetingKey())}
        </Text>
        <Text style={[styles.title, { color: tc.text }]}>
          {t("What's cooking tonight?")}
        </Text>
      </View>
      <Pressable
        onPress={() => router.push('/(tabs)/profile')}
        hitSlop={8}
        accessibilityLabel={displayName}
        accessibilityRole="button"
      >
        <HeroGradientView style={styles.avatar}>
          <Text style={styles.avatarInitials}>{initials}</Text>
        </HeroGradientView>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  textCol: {
    flex: 1,
    gap: 4,
  },
  greeting: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    letterSpacing: 0.1,
  },
  title: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 28,
    lineHeight: 34,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    textAlign: 'center',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});
