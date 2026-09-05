import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus } from 'lucide-react-native';
import { HERO_GRADIENT, JAKARTA_FONTS } from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { useI18n } from '../../i18n/I18nProvider';

export function SubmitCTA() {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <Pressable
      style={({ pressed }) => [pressed && { opacity: 0.92 }]}
      onPress={() => router.push('/submit')}
    >
      <LinearGradient
        colors={[HERO_GRADIENT.from, HERO_GRADIENT.to]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.content}>
          <View style={styles.textBlock}>
            <Text style={styles.title}>{t('Submit a recipe')}</Text>
            <Text style={styles.subtitle}>
              {t('Photos, ingredients & a 5-min video to enter the Top 100.')}
            </Text>
          </View>
          <View style={styles.circle}>
            <Plus size={22} color={HERO_GRADIENT.from} strokeWidth={3} />
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  gradient: {
    borderRadius: 22,
    minHeight: 90,
    ...Platform.select({
      ios: {
        shadowColor: HERO_GRADIENT.from,
        shadowOpacity: 0.35,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 8 },
      },
      android: {
        elevation: 8,
      },
    }),
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    gap: 16,
  },
  textBlock: {
    flex: 1,
    gap: 6,
  },
  title: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 20,
    fontWeight: '700',
    // Warm near-black ink: white on the saffron gradient end was ~2:1 (N10);
    // this holds AA on both gradient stops.
    color: '#33200F',
    lineHeight: 24,
  },
  subtitle: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(51, 32, 15, 0.82)',
    lineHeight: 18,
  },
  circle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
