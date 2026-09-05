import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Compass, Sparkles } from 'lucide-react-native';
import { Text } from '@mylife/ui';
import { JAKARTA_FONTS } from '@mylife/bestchef';
import { Pressable } from 'react-native';
import { AppToolbar } from './components/AppToolbar';
import { useAppThemeColors, useAppThemeProfile } from './providers/AppThemeProvider';
import { useI18n } from './i18n/I18nProvider';
import { PinwheelMenu } from './components/PinwheelMenu';
import {
  PINWHEEL_ACTION_CATALOG,
  PINWHEEL_PAGE_KEYS,
} from './data/pinwheel-config';
import { BackArrow, ForwardChevron } from './components/DirectionalIcons';

const PAGE_LABEL: Record<string, string> = {
  home: 'Home',
  leaderboard: 'Leaderboard',
  vote: 'Vote',
  kitchen: 'My Kitchen',
  profile: 'Profile',
  dishes: 'Browse Dishes',
  discover: 'Discover',
  feed: 'Cooking Videos',
  submit: 'Submit',
  recipe: 'Recipe Detail',
  dish: 'Dish Detail',
  grocery: 'Grocery',
  pantry: 'Pantry',
  settings: 'Settings',
};

export default function PinwheelMissionControl() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tc = useAppThemeColors();
  const theme = useAppThemeProfile();
  const { t } = useI18n();

  return (
    <View style={[styles.screen, { backgroundColor: tc.background }]}>
      <View style={{ paddingTop: insets.top }}>
        <AppToolbar
          pinwheelPageKey="settings"
          title={t('Pinwheel Mission Control')}
          titleIcon={<Compass size={18} color={tc.accent} strokeWidth={2.4} />}
        />
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 80 }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backRow, pressed && { opacity: 0.6 }]}
          hitSlop={8}
        >
          <BackArrow size={16} color={tc.textSecondary} strokeWidth={2} />
          <Text style={[styles.backText, { color: tc.textSecondary }]}>{t('Back')}</Text>
        </Pressable>

        <View style={[styles.heroCard, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
          <View style={styles.heroEyebrowRow}>
            <Sparkles size={14} color={tc.accent} strokeWidth={2.4} />
            <Text style={[styles.heroEyebrow, { color: tc.accent }]}>{t('Quick Actions')}</Text>
          </View>
          <Text style={[styles.heroTitle, { color: tc.text }]}>
            {t('Tap the gradient circle for shortcuts on every screen.')}
          </Text>
          <Text style={[styles.heroBody, { color: tc.textSecondary }]}>
            {t('Six actions fan out from the BestChef header. Pick which six in Settings, or override them per page so Home, Kitchen, and Profile each get tailored shortcuts.')}
          </Text>

          <View style={styles.previewBlock}>
            <Text style={[styles.previewLabel, { color: tc.textTertiary }]}>{t('Try it')}</Text>
            <View style={[styles.previewRow, { backgroundColor: tc.surface, borderColor: tc.border }]}>
              <View style={styles.previewLeft}>
                <Text style={[styles.previewTitle, { color: tc.text }]}>{t('Live Pinwheel')}</Text>
                <Text style={[styles.previewSub, { color: tc.textSecondary }]}>
                  {t('Open this page-scoped wheel to see the same animation users get.')}
                </Text>
              </View>
              <PinwheelMenu pageKey="settings" size={36} />
            </View>
          </View>
        </View>

        <Section title={t('Default actions')} subtitle={t('Six shortcuts that show on every page unless an override exists.')} accent={tc.accent}>
          <View style={styles.catalogStrip}>
            {PINWHEEL_ACTION_CATALOG.slice(0, 6).map((action) => {
              const Icon = action.icon;
              return (
                <View
                  key={action.id}
                  style={[styles.catalogTile, { backgroundColor: tc.surface, borderColor: tc.border }]}
                >
                  <View style={[styles.catalogIcon, { backgroundColor: `${action.tint}26` }]}>
                    <Icon size={16} color={action.tint} strokeWidth={2.4} />
                  </View>
                  <Text style={[styles.catalogLabel, { color: tc.text }]} numberOfLines={1}>{t(action.label)}</Text>
                </View>
              );
            })}
          </View>
        </Section>

        <Section title={t('Per-page overrides')} subtitle={t('Tap a row in Settings to set up shortcuts that only apply on that screen.')} accent={tc.accent}>
          <View style={[styles.pageList, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}>
            {PINWHEEL_PAGE_KEYS.map((key, i) => (
              <View
                key={key}
                style={[
                  styles.pageRow,
                  i < PINWHEEL_PAGE_KEYS.length - 1 && [styles.pageRowDivider, { borderBottomColor: tc.border }],
                ]}
              >
                <Text style={[styles.pageRowLabel, { color: tc.text }]}>
                  {t(PAGE_LABEL[key] ?? key)}
                </Text>
                <Text style={[styles.pageRowKey, { color: tc.textTertiary }]}>{key}</Text>
              </View>
            ))}
          </View>
        </Section>

        <Section title={t('Full HTML mission control')} subtitle={t('A static page lives in apps/bestchef/docs/pinwheel-mission-control.html with full animation specs, geometry tables, and design mockups.')} accent={tc.accent}>
          <View style={[styles.docCard, { backgroundColor: tc.surface, borderColor: tc.border }]}>
            <Text style={[styles.docPath, { color: tc.textSecondary }]}>
              docs/pinwheel-mission-control.html
            </Text>
            <ForwardChevron size={16} color={tc.textTertiary} strokeWidth={2} />
          </View>
        </Section>
      </ScrollView>
    </View>
  );
}

interface SectionProps {
  title: string;
  subtitle: string;
  accent: string;
  children: React.ReactNode;
}

function Section({ title, subtitle, accent, children }: SectionProps) {
  const tc = useAppThemeColors();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={[styles.sectionDot, { backgroundColor: accent }]} />
        <Text style={[styles.sectionTitle, { color: tc.text }]}>{title}</Text>
      </View>
      <Text style={[styles.sectionSub, { color: tc.textSecondary }]}>{subtitle}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { paddingHorizontal: 18, gap: 24, paddingTop: 8 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backText: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 13 },
  heroCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 22,
    gap: 14,
  },
  heroEyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroEyebrow: { fontFamily: JAKARTA_FONTS.bold, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase' },
  heroTitle: { fontFamily: JAKARTA_FONTS.extraBold, fontSize: 22, letterSpacing: -0.4, lineHeight: 28 },
  heroBody: { fontFamily: JAKARTA_FONTS.regular, fontSize: 13, lineHeight: 19 },
  previewBlock: { gap: 8 },
  previewLabel: { fontFamily: JAKARTA_FONTS.bold, fontSize: 10, letterSpacing: 1.6, textTransform: 'uppercase' },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  previewLeft: { flex: 1, gap: 4 },
  previewTitle: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 14 },
  previewSub: { fontFamily: JAKARTA_FONTS.regular, fontSize: 12, lineHeight: 17 },
  section: { gap: 10 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionDot: { width: 6, height: 6, borderRadius: 3 },
  sectionTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 17 },
  sectionSub: { fontFamily: JAKARTA_FONTS.regular, fontSize: 12, lineHeight: 17, marginBottom: 4 },
  catalogStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catalogTile: {
    flexBasis: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  catalogIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  catalogLabel: { flex: 1, fontFamily: JAKARTA_FONTS.semiBold, fontSize: 13 },
  pageList: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14 },
  pageRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  pageRowDivider: { borderBottomWidth: StyleSheet.hairlineWidth },
  pageRowLabel: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 14 },
  pageRowKey: { fontFamily: JAKARTA_FONTS.medium, fontSize: 11, letterSpacing: 0.4 },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  docPath: { flex: 1, fontFamily: JAKARTA_FONTS.medium, fontSize: 12, letterSpacing: 0.3 },
});
