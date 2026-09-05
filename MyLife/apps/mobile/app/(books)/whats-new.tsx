import { View, ScrollView, StyleSheet, Text as RNText } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@mylife/ui';
import {
  GlassCard,
  GradientButton,
  BOOKS_SURFACES,
  BOOKS_TYPOGRAPHY,
  JAKARTA_FONTS,
} from '@mylife/books/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { setSetting } from '../../lib/books/settings';
import { icons } from 'lucide-react-native';

const BOOKS_ACCENT = colors.modules.books;
const CURRENT_VERSION = '2.4.0';

const LockIcon = icons.Lock;
const BarChartIcon = icons.ChartBar;
const SparklesIcon = icons.Sparkles;
const QuoteIcon = icons.Quote;
const MoonIcon = icons.Moon;

// ── Feature Cards ─────────────────────────────────────────

const FEATURES = [
  {
    icon: <LockIcon size={20} color={BOOKS_ACCENT} />,
    title: 'Encrypted Journaling',
    description:
      'Your private reflections on literature are now protected by end-to-end encryption. Store your deepest insights without compromise.',
    action: 'Explore Security',
    highlight: true,
  },
  {
    icon: <BarChartIcon size={20} color={BOOKS_ACCENT} />,
    title: 'Reading Stats',
    description:
      'Visualize your reading velocity and genre distribution with our new immersive analytics engine.',
    badge: 'NEW TOOL',
  },
  {
    icon: <SparklesIcon size={20} color={BOOKS_ACCENT} />,
    title: 'AI Curator',
    description:
      'Discover your next obsession with recommendations based on thematic resonance rather than just categories.',
    action: 'Learn More',
  },
  {
    icon: <QuoteIcon size={18} color={BOOKS_ACCENT} />,
    title: 'Quotes Collection',
    description: 'Extract and organize beautiful passages instantly.',
  },
  {
    icon: <MoonIcon size={18} color={BOOKS_ACCENT} />,
    title: 'Obsidian Mode',
    description: 'Enhanced high-contrast dark theme for night curators.',
  },
];

// ── Release Timeline ──────────────────────────────────────

const RELEASES = [
  {
    date: 'OCT 20, 2023',
    version: 'v2.4.0',
    title: 'The Encryption Update',
    items: [
      'AES-256 local vault encryption',
      'Biometric journal unlocking',
      'PDF Annotation sync fixes',
    ],
  },
  {
    date: 'SEP 12, 2023',
    version: 'v2.3.5',
    title: 'Refined Search Engine',
    items: [
      'Improved fuzzy matching and multi-library indexing speed by 40%.',
    ],
  },
];

// ── Screen ────────────────────────────────────────────────

export default function WhatsNewScreen() {
  const router = useRouter();
  const db = useDatabase();

  const handleDismiss = () => {
    setSetting(db, 'whats_new_seen', CURRENT_VERSION);
    router.back();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Version Badge */}
      <View style={styles.versionBadge}>
        <RNText style={styles.versionText}>
          CURRENT VERSION V{CURRENT_VERSION}
        </RNText>
      </View>

      {/* Display Title */}
      <RNText style={styles.displayTitle}>
        {'Curating your\n'}
        <RNText style={styles.displayTitleAccent}>intellectual sanctuary.</RNText>
      </RNText>

      {/* Subtitle */}
      <RNText style={styles.subtitle}>
        We've enhanced the library experience with encrypted journaling and deep-learning insights. Your knowledge, now more secure and insightful than ever.
      </RNText>

      {/* Hero Gradient Area */}
      <View style={styles.heroArea}>
        <View style={styles.heroGradient} />
      </View>

      {/* Feature Cards */}
      {FEATURES.map((feature) => (
        <GlassCard
          key={feature.title}
          level={feature.highlight ? 3 : 2}
          style={styles.featureCard}
        >
          <View style={styles.featureIconRow}>
            {feature.icon}
          </View>
          <RNText style={styles.featureTitle}>{feature.title}</RNText>
          <RNText style={styles.featureDesc}>{feature.description}</RNText>
          {feature.action && (
            <RNText style={styles.featureAction}>{feature.action}</RNText>
          )}
          {feature.badge && (
            <RNText style={styles.featureBadge}>{feature.badge}</RNText>
          )}
        </GlassCard>
      ))}

      {/* Release Timeline */}
      <RNText style={styles.timelineLabel}>RELEASE TIMELINE</RNText>

      {RELEASES.map((release) => (
        <View key={release.version} style={styles.releaseEntry}>
          <View style={styles.releaseHeader}>
            <RNText style={styles.releaseDate}>{release.date}</RNText>
            <View style={styles.releaseVersionBadge}>
              <RNText style={styles.releaseVersionText}>{release.version}</RNText>
            </View>
          </View>
          {/* Timeline dot + line */}
          <View style={styles.timelineDotRow}>
            <View style={styles.timelineDot} />
            <View style={styles.timelineLine} />
          </View>
          <RNText style={styles.releaseTitle}>{release.title}</RNText>
          {release.items.map((item) => (
            <View key={item} style={styles.releaseItemRow}>
              <RNText style={styles.releaseBullet}>{'\u2022'}</RNText>
              <RNText style={styles.releaseItemText}>{item}</RNText>
            </View>
          ))}
        </View>
      ))}

      {/* All Caught Up */}
      <GlassCard level={2} style={styles.caughtUpCard}>
        <RNText style={styles.caughtUpTitle}>You're all caught up!</RNText>
        <RNText style={styles.caughtUpDesc}>
          Start exploring your updated library or check our documentation for more advanced curator tips.
        </RNText>
        <GradientButton
          label="Got it, take me home"
          onPress={handleDismiss}
          style={styles.caughtUpButton}
        />
        <View style={styles.changelogButton}>
          <RNText style={styles.changelogText}>View Full Changelog</RNText>
        </View>
      </GlassCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BOOKS_SURFACES.depth,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 16,
  },
  versionBadge: {
    alignSelf: 'flex-start',
    backgroundColor: BOOKS_SURFACES.lift,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  versionText: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: BOOKS_ACCENT,
    fontSize: 10,
  },
  displayTitle: {
    ...BOOKS_TYPOGRAPHY.displayLg,
    fontSize: 34,
    letterSpacing: -0.02 * 34,
    color: '#E4E1E9',
  },
  displayTitleAccent: {
    color: BOOKS_ACCENT,
  },
  subtitle: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 15,
    lineHeight: 24,
    color: '#D6C3B5',
  },
  heroArea: {
    height: 180,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: BOOKS_SURFACES.lift,
  },
  heroGradient: {
    flex: 1,
    backgroundColor: BOOKS_SURFACES.focus,
    opacity: 0.6,
  },
  featureCard: {
    gap: 8,
  },
  featureIconRow: {
    marginBottom: 4,
  },
  featureTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 18,
    color: '#E4E1E9',
  },
  featureDesc: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: '#D6C3B5',
  },
  featureAction: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: BOOKS_ACCENT,
    marginTop: 4,
  },
  featureBadge: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: BOOKS_ACCENT,
    fontSize: 10,
    marginTop: 4,
  },
  timelineLabel: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: BOOKS_ACCENT,
    marginTop: 8,
  },
  releaseEntry: {
    paddingLeft: 4,
    marginBottom: 8,
  },
  releaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  releaseDate: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    color: '#D6C3B5',
  },
  releaseVersionBadge: {
    backgroundColor: BOOKS_SURFACES.lift,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  releaseVersionText: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: BOOKS_ACCENT,
    fontSize: 10,
  },
  timelineDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BOOKS_ACCENT,
  },
  timelineLine: {
    flex: 1,
    height: 1,
    backgroundColor: BOOKS_SURFACES.focus,
    marginLeft: 8,
  },
  releaseTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 17,
    color: '#E4E1E9',
    marginBottom: 8,
  },
  releaseItemRow: {
    flexDirection: 'row',
    gap: 8,
    paddingLeft: 4,
    marginBottom: 4,
  },
  releaseBullet: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: '#D6C3B5',
    lineHeight: 22,
  },
  releaseItemText: {
    flex: 1,
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: '#D6C3B5',
  },
  caughtUpCard: {
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
    paddingVertical: 28,
  },
  caughtUpTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 20,
    color: '#E4E1E9',
  },
  caughtUpDesc: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: '#D6C3B5',
    textAlign: 'center',
    maxWidth: 280,
  },
  caughtUpButton: {
    width: '100%',
    marginTop: 4,
  },
  changelogButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 999,
    backgroundColor: BOOKS_SURFACES.lift,
    width: '100%',
    alignItems: 'center',
  },
  changelogText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 15,
    color: '#E4E1E9',
  },
});
