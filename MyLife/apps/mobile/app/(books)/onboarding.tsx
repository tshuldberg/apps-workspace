import { useState, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Dimensions,
  FlatList,
  type ViewToken,
  Text as RNText,
} from 'react-native';
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
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ShieldCheckIcon = icons.ShieldCheck;
const BookOpenIcon = icons.BookOpen;
const LibraryIcon = icons.Library;
const SearchIcon = icons.Search;


// ── Onboarding Pages ──────────────────────────────────────

interface OnboardingPage {
  id: string;
  icon: React.ReactNode;
  title: string;
  displayTitle: string;
  description: string;
  card?: { icon: React.ReactNode; title: string; description: string };
  badges?: string[];
}

const PAGES: OnboardingPage[] = [
  {
    id: 'welcome',
    icon: <BookOpenIcon size={32} color={BOOKS_ACCENT} />,
    title: 'MyBooks',
    displayTitle: 'Your sanctuary for\nthought.',
    description:
      'Welcome to a private library designed for the modern intellectual. No ads, no tracking, just your books and your progress.',
    card: {
      icon: <ShieldCheckIcon size={24} color={BOOKS_ACCENT} />,
      title: 'Privacy First',
      description:
        'Your reading habits stay on your device. We use end-to-end encryption for syncing.',
    },
    badges: ['GDPR COMPLIANT', 'ENCRYPTED'],
  },
  {
    id: 'library',
    icon: <LibraryIcon size={32} color={BOOKS_ACCENT} />,
    title: 'MyBooks',
    displayTitle: 'Build your\nlibrary.',
    description:
      'Track every book you read, want to read, or are currently reading. Organize with shelves and tags.',
    card: {
      icon: <LibraryIcon size={24} color={BOOKS_ACCENT} />,
      title: 'Smart Organization',
      description:
        'Create custom shelves, tag books by mood, and let the system learn your preferences.',
    },
  },
  {
    id: 'discover',
    icon: <SearchIcon size={32} color={BOOKS_ACCENT} />,
    title: 'MyBooks',
    displayTitle: 'Discover what\nresonates.',
    description:
      'Get personalized recommendations based on your reading patterns, not algorithms designed to sell.',
  },
];

export default function BooksOnboardingScreen() {
  const router = useRouter();
  const db = useDatabase();
  const [currentPage, setCurrentPage] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handleComplete = () => {
    setSetting(db, 'onboarding_complete', 'true');
    router.replace('/(books)/');
  };

  const handleContinue = () => {
    if (currentPage < PAGES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentPage + 1, animated: true });
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    setSetting(db, 'onboarding_complete', 'true');
    router.replace('/(books)/');
  };

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setCurrentPage(viewableItems[0].index);
      }
    },
    [],
  );

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const renderPage = ({ item }: { item: OnboardingPage }) => (
    <View style={styles.page}>
      {/* App Icon */}
      <View style={styles.iconContainer}>{item.icon}</View>
      <RNText style={styles.appTitle}>{item.title}</RNText>

      {/* Display Title */}
      <RNText style={styles.displayTitle}>{item.displayTitle}</RNText>

      {/* Description */}
      <RNText style={styles.description}>{item.description}</RNText>

      {/* Feature Card */}
      {item.card && (
        <GlassCard level={2} style={styles.featureCard}>
          <View style={styles.featureCardRow}>
            <View style={styles.featureIconWrap}>{item.card.icon}</View>
            <View style={styles.featureCardText}>
              <RNText style={styles.featureCardTitle}>{item.card.title}</RNText>
              <RNText style={styles.featureCardDesc}>{item.card.description}</RNText>
            </View>
          </View>
        </GlassCard>
      )}

      {/* Badges */}
      {item.badges && (
        <View style={styles.badgeRow}>
          {item.badges.map((badge, i) => (
            <View key={badge} style={styles.badgeItem}>
              {i > 0 && <RNText style={styles.badgeDot}>{'  \u2022  '}</RNText>}
              <RNText style={styles.badgeText}>{badge}</RNText>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={PAGES}
        renderItem={renderPage}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
      />

      {/* Bottom Controls */}
      <View style={styles.bottomSection}>
        {/* Progress Dots */}
        <View style={styles.dotsRow}>
          {PAGES.map((page, i) => (
            <View
              key={page.id}
              style={[
                styles.dot,
                i === currentPage ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>

        {/* Actions */}
        <View style={styles.actionsRow}>
          <Pressable onPress={handleSkip} hitSlop={12} style={styles.skipButton}>
            <RNText style={styles.skipText}>Skip</RNText>
          </Pressable>
          <GradientButton
            label={currentPage === PAGES.length - 1 ? 'Get Started' : 'Continue'}
            onPress={handleContinue}
            style={styles.continueButton}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BOOKS_SURFACES.depth,
  },
  page: {
    width: SCREEN_WIDTH,
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 80,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: BOOKS_SURFACES.lift,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  appTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 16,
    color: '#E4E1E9',
    marginBottom: 32,
  },
  displayTitle: {
    ...BOOKS_TYPOGRAPHY.displayLg,
    fontSize: 36,
    letterSpacing: -0.02 * 36,
    color: '#E4E1E9',
    textAlign: 'center',
    marginBottom: 20,
  },
  description: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 16,
    lineHeight: 26,
    color: '#D6C3B5',
    textAlign: 'center',
    maxWidth: 320,
    marginBottom: 32,
  },
  featureCard: {
    width: '100%',
    marginBottom: 20,
  },
  featureCardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  featureIconWrap: {
    marginTop: 2,
  },
  featureCardText: {
    flex: 1,
    gap: 4,
  },
  featureCardTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 16,
    color: '#E4E1E9',
  },
  featureCardDesc: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: '#D6C3B5',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeDot: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 12,
    color: BOOKS_ACCENT,
  },
  badgeText: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: '#D6C3B5',
    fontSize: 11,
  },
  bottomSection: {
    paddingHorizontal: 32,
    paddingBottom: 48,
    gap: 24,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    height: 4,
    borderRadius: 2,
  },
  dotActive: {
    width: 24,
    backgroundColor: BOOKS_ACCENT,
  },
  dotInactive: {
    width: 8,
    backgroundColor: BOOKS_SURFACES.focus,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skipButton: {
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  skipText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 16,
    color: '#D6C3B5',
  },
  continueButton: {
    flex: 1,
    marginLeft: 24,
  },
});
