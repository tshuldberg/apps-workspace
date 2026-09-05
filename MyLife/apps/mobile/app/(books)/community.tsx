import { useState, useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  Alert,
  RefreshControl,
} from 'react-native';
import { Text, LoadingState, EmptyState, colors, spacing } from '@mylife/ui';
import {
  GlassCard,
  GradientButton,
  GenreChip,
  ReadingProgressBar,
  BOOKS_SURFACES,
  JAKARTA_FONTS,
} from '@mylife/books/ui';
import { useCommunityChallenge } from '../../hooks/books/use-community-challenges';

const BOOKS_ACCENT = colors.modules.books;

const CATEGORIES = ['All Categories', 'Philosophy', 'Classics', 'Sci-Fi', 'Fiction', 'Non-Fiction'];
const DIFFICULTIES = ['Any Difficulty', 'Easy', 'Medium', 'Hard', 'Extreme'] as const;

const MOCK_CATALOG: MockChallenge[] = [
  { id: 'mc-1', emoji: '\uD83C\uDFCB\uFE0F', title: 'Weekend Warrior', desc: 'Complete a minimum of over 200 pages between Friday night and Sunday evening.', participants: 3043, category: 'Fiction', difficulty: 'easy' },
  { id: 'mc-2', emoji: '\uD83D\uDCDA', title: 'The Proust Pilgrimage', desc: "Finish Proust's 'In Search of Lost Time' series within six months. Not for the faint of heart.", participants: 891, category: 'Classics', difficulty: 'extreme' },
  { id: 'mc-3', emoji: '\uD83E\uDDE0', title: 'Modern Philosophy 101', desc: "Read 5 core books from 20th-century existentialists and write brief reflections on each.", participants: 4562, category: 'Philosophy', difficulty: 'medium' },
  { id: 'mc-4', emoji: '\uD83D\uDE80', title: 'Sci-Fi Odyssey', desc: "Travel through 5 different eras in sci-fi genres: Space Opera, Cyberpunk and Hard Sci-Fi.", participants: 2814, category: 'Sci-Fi', difficulty: 'medium' },
  { id: 'mc-5', emoji: '\uD83E\uDD1D', title: 'Buddy Read', desc: 'Read the same books as a friend and participate in 3 community discussions.', participants: 5414, category: 'Fiction', difficulty: 'easy' },
  { id: 'mc-6', emoji: '\uD83D\uDD0D', title: "Detective's Intuition", desc: 'Predict the killer in 5 different mystery/whodunnit series the first 50 pages.', participants: 1832, category: 'Fiction', difficulty: 'hard' },
  { id: 'mc-7', emoji: '\uD83C\uDF19', title: "The Poet's Corner", desc: 'Read 12 poetry collections and highlight at least 5 stanzas from each.', participants: 2109, category: 'Classics', difficulty: 'medium' },
  { id: 'mc-8', emoji: '\uD83E\uDDDB', title: 'Gothic Masterpieces', desc: 'Complete Dracula, Frankenstein, and Carmilla within the month of October.', participants: 3975, category: 'Classics', difficulty: 'medium' },
  { id: 'mc-9', emoji: '\uD83C\uDF0D', title: 'Around the World', desc: 'Read a book by an author from at least 5 countries you\'ve never visited.', participants: 6201, category: 'Fiction', difficulty: 'easy' },
  { id: 'mc-10', emoji: '\uD83C\uDFC6', title: 'Pulitzer Pursuit', desc: 'Read 3 Pulitzer Prize winners from 3 different decades.', participants: 4150, category: 'Non-Fiction', difficulty: 'medium' },
  { id: 'mc-11', emoji: '\uD83D\uDD2C', title: 'Non-Fiction Deep Dive', desc: 'Finish a non-fiction book on a single scientific topic and document key findings.', participants: 2876, category: 'Non-Fiction', difficulty: 'easy' },
  { id: 'mc-12', emoji: '\uD83D\uDCDC', title: 'Century of Classics', desc: 'Read a fundamental novel from every decade of the 19th century.', participants: 1823, category: 'Classics', difficulty: 'hard' },
];

interface MockChallenge {
  id: string;
  emoji: string;
  title: string;
  desc: string;
  participants: number;
  category: string;
  difficulty: string;
}

function formatParticipants(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k participants`;
  return `${n} participants`;
}

export default function CommunityScreen() {
  const { challenges, presets, loading, refresh, join, abandon } = useCommunityChallenge();
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('Any Difficulty');

  const joined = challenges.filter((c) => c.participation !== null);
  const featured = joined.find((c) => !c.isExpired && c.percentComplete < 100);
  const joinedIds = new Set(joined.map((c) => c.challenge.id));

  const filteredCatalog = useMemo(() => {
    return MOCK_CATALOG.filter((c) => {
      if (selectedCategory !== 'All Categories' && c.category !== selectedCategory) return false;
      if (selectedDifficulty !== 'Any Difficulty' && c.difficulty !== selectedDifficulty.toLowerCase()) return false;
      return true;
    });
  }, [selectedCategory, selectedDifficulty]);

  const daysRemaining = useMemo(() => {
    const endOfYear = new Date(new Date().getFullYear(), 11, 31);
    return Math.max(0, Math.ceil((endOfYear.getTime() - Date.now()) / 86_400_000));
  }, []);

  const handleAbandon = (participationId: string) => {
    Alert.alert('Abandon Challenge', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Abandon', style: 'destructive', onPress: () => abandon(participationId) },
    ]);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={BOOKS_ACCENT} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>ACTIVE CHALLENGES</Text>
        <View style={styles.daysChip}>
          <Text style={styles.daysNumber}>{daysRemaining}</Text>
          <Text style={styles.daysText}>days left</Text>
        </View>
      </View>

      {/* Featured Challenge Hero */}
      {featured ? (
        <GlassCard level={2} style={styles.heroCard}>
          <Text style={styles.heroTitle}>{featured.challenge.name}</Text>
          {featured.challenge.description && (
            <Text style={styles.heroDesc}>{featured.challenge.description}</Text>
          )}

          <View style={styles.heroProgressRow}>
            <View style={styles.heroMetaRow}>
              <Text style={styles.heroMeta}>
                {Math.round(featured.percentComplete)}% Complete
              </Text>
              <Text style={styles.heroMeta}>
                {Math.max(0, featured.challenge.target_value - (featured.participation?.current_value ?? 0))} Books remaining
              </Text>
            </View>
            <ReadingProgressBar
              progress={featured.percentComplete / 100}
              height={6}
            />
          </View>

          <View style={styles.heroStats}>
            <View style={styles.statBox}>
              <Text style={styles.statIcon}>{'\uD83C\uDFC6'}</Text>
              <Text style={styles.statValue}>Top 3%</Text>
              <Text style={styles.statLabel}>OVERALL RANK</Text>
              <Text style={styles.statSub}>Among 51,419 participants</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statIcon}>{'\u2B50'}</Text>
              <Text style={styles.statValue}>8,450 XP</Text>
              <Text style={styles.statLabel}>TOTAL XP EARNED</Text>
              <Text style={styles.statSub}>Uses &apos;The Cavern&apos; #1 Stl</Text>
            </View>
          </View>

          {featured.participation && (
            <Pressable
              onLongPress={() => featured.participation && handleAbandon(featured.participation.id)}
              style={styles.abandonHint}
            >
              <Text style={styles.abandonText}>Long press to abandon</Text>
            </Pressable>
          )}
        </GlassCard>
      ) : (
        <GlassCard level={2} style={styles.heroCard}>
          <EmptyState
            icon={'\uD83C\uDFC6'}
            title="Join a challenge"
            message="Browse community challenges below and join one to get started."
          />
        </GlassCard>
      )}

      {/* Category Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}
      >
        {CATEGORIES.map((cat) => (
          <GenreChip
            key={cat}
            label={cat}
            selected={selectedCategory === cat}
            onPress={() => setSelectedCategory(cat)}
          />
        ))}
      </ScrollView>

      {/* Difficulty Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {DIFFICULTIES.map((diff) => (
          <Pressable
            key={diff}
            style={[
              styles.diffChip,
              selectedDifficulty === diff && styles.diffChipActive,
            ]}
            onPress={() => setSelectedDifficulty(diff)}
          >
            <Text
              style={[
                styles.diffText,
                selectedDifficulty === diff && styles.diffTextActive,
              ]}
            >
              {diff}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Challenge Catalog */}
      <View style={styles.catalogSection}>
        {filteredCatalog.map((challenge) => (
          <GlassCard key={challenge.id} level={1} style={styles.catalogCard}>
            <View style={styles.catalogRow}>
              <Text style={styles.catalogEmoji}>{challenge.emoji}</Text>
              <View style={styles.catalogInfo}>
                <Text style={styles.catalogTitle}>{challenge.title}</Text>
                <Text style={styles.catalogDesc} numberOfLines={2}>
                  {challenge.desc}
                </Text>
                <View style={styles.catalogMeta}>
                  <Text style={styles.catalogParticipants}>
                    {'\uD83D\uDC65'} {formatParticipants(challenge.participants)}
                  </Text>
                </View>
              </View>
            </View>
            <GradientButton
              label="Join Challenge"
              onPress={() => {
                const matching = presets.find(
                  (p) => p.name === challenge.title,
                );
                if (matching && !joinedIds.has(matching.id)) {
                  join(matching.id);
                }
              }}
              style={styles.joinButton}
            />
          </GlassCard>
        ))}

        {filteredCatalog.length === 0 && (
          <EmptyState
            icon={'\uD83D\uDD0D'}
            title="No matching challenges"
            message="Try changing your filters to discover more challenges."
          />
        )}
      </View>

      {/* DB-sourced presets not in mock catalog */}
      {presets.filter((p) => !MOCK_CATALOG.some((m) => m.title === p.name)).length > 0 && (
        <View style={styles.catalogSection}>
          <Text style={styles.extraHeader}>More Challenges</Text>
          {presets
            .filter((p) => !MOCK_CATALOG.some((m) => m.title === p.name))
            .map((preset) => {
              const isJoined = joinedIds.has(preset.id);
              return (
                <GlassCard key={preset.id} level={1} style={styles.catalogCard}>
                  <Text style={styles.catalogTitle}>{preset.name}</Text>
                  {preset.description && (
                    <Text style={styles.catalogDesc}>{preset.description}</Text>
                  )}
                  <View style={styles.catalogMeta}>
                    <Text style={styles.catalogParticipants}>
                      {'\uD83D\uDC65'} {formatParticipants(preset.participant_count)}
                    </Text>
                  </View>
                  {isJoined ? (
                    <View style={styles.joinedBadge}>
                      <Text style={styles.joinedText}>Joined</Text>
                    </View>
                  ) : (
                    <GradientButton
                      label="Join Challenge"
                      onPress={() => join(preset.id)}
                      style={styles.joinButton}
                    />
                  )}
                </GlassCard>
              );
            })}
        </View>
      )}

      {loading && challenges.length === 0 && presets.length === 0 && (
        <LoadingState rows={4} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingBottom: 100 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  headerLabel: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 12,
    letterSpacing: 1.2,
    color: BOOKS_ACCENT,
    textTransform: 'uppercase',
  },
  daysChip: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    backgroundColor: BOOKS_SURFACES.focus,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  daysNumber: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 22,
    color: BOOKS_ACCENT,
  },
  daysText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 11,
    color: colors.textSecondary,
  },

  // Hero
  heroCard: { marginTop: spacing.md, gap: 12 },
  heroTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 26,
    color: colors.text,
    lineHeight: 32,
    letterSpacing: -0.3,
  },
  heroDesc: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  heroProgressRow: { marginTop: 4, gap: 6 },
  heroMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroMeta: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    color: colors.textSecondary,
  },
  heroStats: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: BOOKS_SURFACES.lift,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 14,
    alignItems: 'center',
    gap: 4,
  },
  statIcon: { fontSize: 20 },
  statValue: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 24,
    color: colors.text,
  },
  statLabel: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  statSub: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 11,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  abandonHint: { marginTop: 4 },
  abandonText: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 11,
    color: colors.textTertiary,
  },

  // Filters
  filterScroll: { marginTop: spacing.lg },
  filterRow: { gap: 8, paddingVertical: 4 },
  diffChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: BOOKS_SURFACES.focus,
  },
  diffChipActive: {
    backgroundColor: BOOKS_SURFACES.focus,
    shadowColor: BOOKS_ACCENT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  diffText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: '#D6C3B5',
  },
  diffTextActive: { color: BOOKS_ACCENT },

  // Catalog
  catalogSection: { marginTop: spacing.lg, gap: spacing.md },
  catalogCard: { gap: 10 },
  catalogRow: { flexDirection: 'row', gap: 12 },
  catalogEmoji: { fontSize: 28, marginTop: 2 },
  catalogInfo: { flex: 1, gap: 4 },
  catalogTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 17,
    color: colors.text,
  },
  catalogDesc: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  catalogMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  catalogParticipants: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 12,
    color: colors.textTertiary,
  },
  joinButton: { alignSelf: 'stretch' },
  joinedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: `${colors.success}22`,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  joinedText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: colors.success,
  },
  extraHeader: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 18,
    color: colors.text,
    marginBottom: 4,
  },
});
