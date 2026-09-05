import { Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Clock, Home } from 'lucide-react-native';
import { JAKARTA_FONTS } from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { useAppThemeColors as useThemeColors, useAppThemeProfile as useTheme } from './providers/AppThemeProvider';
import { useI18n } from './i18n/I18nProvider';
import { BackArrow } from './components/DirectionalIcons';

export default function SoonScreen() {
  const router = useRouter();
  const { feature, from } = useLocalSearchParams<{ feature?: string; from?: string }>();
  const tc = useThemeColors();
  const theme = useTheme();
  const { t } = useI18n();

  const featureName = typeof feature === 'string' && feature.trim() ? feature : t('This feature');
  const sourceName = typeof from === 'string' && from.trim() ? from : null;

  return (
    <View style={[styles.screen, { backgroundColor: tc.background }]}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('Back')}
        >
          <BackArrow size={24} color={tc.text} strokeWidth={2} />
        </Pressable>
        <Text style={[styles.topBarTitle, { color: tc.text }]}>{t('Coming Soon')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        <View style={[styles.card, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
          <View style={[styles.iconWrap, { backgroundColor: `${tc.accent}1F` }]}>
            <Clock size={32} color={tc.accent} strokeWidth={2} />
          </View>
          <Text style={[styles.title, { color: tc.text }]}>{featureName}</Text>
          <Text style={[styles.body, { color: tc.textSecondary }]}>
            {sourceName
              ? t('{featureName} from {sourceName} is not ready yet.', { featureName, sourceName })
              : t('{featureName} is not ready yet.', { featureName })}
          </Text>
          <Text style={[styles.body, { color: tc.textTertiary }]}>
            {t('This placeholder keeps every interaction routed to a real page while the next workflow is designed.')}
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: tc.accent },
              pressed && { opacity: 0.82 },
            ]}
            onPress={() => router.replace('/(tabs)')}
          >
            <Home size={18} color={tc.background} strokeWidth={2.4} />
            <Text style={[styles.primaryButtonText, { color: tc.background }]}>{t('Back to Home')}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { minHeight: 92, paddingTop: 52, paddingHorizontal: 20, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topBarTitle: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 18 },
  content: { flex: 1, paddingHorizontal: 24, justifyContent: 'center', paddingBottom: 92 },
  card: { borderWidth: 1, borderRadius: 22, padding: 24, alignItems: 'center', gap: 14 },
  iconWrap: { width: 68, height: 68, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 24, lineHeight: 31, textAlign: 'center' },
  body: { fontFamily: JAKARTA_FONTS.medium, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  primaryButton: { minHeight: 50, borderRadius: 999, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 8 },
  primaryButtonText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 14 },
});
