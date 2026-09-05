import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  generateSuggestions,
  getRecentSuggestionKeys,
  getActivityCorrelations,
  getMoodEntryCount,
  getMoodDashboard,
  createSuggestionHistory,
  updateSuggestionAction,
  getSuggestionsByCategory as getCatalogByCategory,
  SUGGESTION_CATALOG,
  type GeneratedSuggestion,
  type SuggestionCategory,
  type CatalogSuggestion,
  GlassCard,
  SectionHeader,
  MOOD_TYPOGRAPHY,
  MOOD_ACCENT,
  MOOD_ACCENT_LIGHT,
  MOOD_SURFACES,
} from '@mylife/mood';
import { colors } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

// ── Category metadata ───────────────────────────────────────────────

const CATEGORIES: { key: SuggestionCategory; label: string }[] = [
  { key: 'physical', label: 'Physical' },
  { key: 'social', label: 'Social' },
  { key: 'creative', label: 'Creative' },
  { key: 'relaxation', label: 'Relaxation' },
  { key: 'mindfulness', label: 'Mindfulness' },
];

const CATEGORY_ICONS: Record<SuggestionCategory, string> = {
  physical: '🏃',
  social: '📞',
  creative: '🎨',
  relaxation: '🍵',
  mindfulness: '🧘',
};

// ── Suggestion icons by key prefix ──────────────────────────────────

const SUGGESTION_ICONS: Record<string, string> = {
  'physical-walk': '🚶',
  'physical-stretch': '🤸',
  'physical-dance': '💃',
  'physical-cold-water': '💧',
  'physical-run': '🏃',
  'social-call-friend': '📞',
  'social-text-someone': '💬',
  'social-compliment': '🌟',
  'social-pet-time': '🐾',
  'social-gratitude-text': '🙏',
  'creative-doodle': '✏️',
  'creative-journal': '📝',
  'creative-music': '🎵',
  'creative-photo': '📸',
  'creative-cook': '🍳',
  'relaxation-bath': '🛁',
  'relaxation-tea': '🍵',
  'relaxation-nature': '🌿',
  'relaxation-read': '📖',
  'relaxation-nap': '😴',
  'mindfulness-breathing': '🫁',
  'mindfulness-body-scan': '🧘',
  'mindfulness-gratitude': '🙏',
  'mindfulness-meditation': '🧘‍♂️',
  'mindfulness-grounding': '🌍',
  'mindfulness-progressive': '💆',
};

// ── Quick actions ───────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { icon: '🫁', label: 'Breathe' },
  { icon: '📖', label: 'Read' },
  { icon: '📝', label: 'Journal' },
  { icon: '🎵', label: 'Listen' },
];

export default function MoodSuggestionsScreen() {
  const db = useDatabase();
  const dashboard = getMoodDashboard(db);

  const [selectedCategory, setSelectedCategory] = useState<SuggestionCategory>('physical');
  const [searchQuery, setSearchQuery] = useState('');
  const [triedKeys, setTriedKeys] = useState<Set<string>>(new Set());

  // ── Data-driven recommendations ─────────────────────────────────

  const [recommendations, setRecommendations] = useState<
    (GeneratedSuggestion & { historyId: string })[]
  >([]);

  const loadRecommendations = useCallback(() => {
    try {
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const recentKeys = getRecentSuggestionKeys(db, twentyFourHoursAgo);
      const correlations = getActivityCorrelations(db, 30);
      const entryCount = getMoodEntryCount(db);

      const generated = generateSuggestions({
        currentScore: dashboard.todayAverage ?? 5,
        activityCorrelations: correlations,
        recentSuggestionKeys: recentKeys,
        enabledModules: [],
        entryCount,
      });

      const tracked = generated.map((s) => {
        const historyId = uuid();
        createSuggestionHistory(db, historyId, {
          suggestionKey: s.key,
          category: s.category,
          source: s.source,
        });
        return { ...s, historyId };
      });

      setRecommendations(tracked);
    } catch {
      // noop
    }
  }, [db, dashboard.todayAverage]);

  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  const handleAction = useCallback(
    (historyId: string, action: 'completed' | 'dismissed') => {
      updateSuggestionAction(db, historyId, action);
      setRecommendations((prev) => prev.filter((s) => s.historyId !== historyId));
    },
    [db],
  );

  // ── Category catalog ────────────────────────────────────────────

  const catalogItems = useMemo(() => {
    const items = getCatalogByCategory(selectedCategory);
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(
      (s) =>
        s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q),
    );
  }, [selectedCategory, searchQuery]);

  // ── Full catalog for Idea Catalog section ───────────────────────

  const fullCatalog = useMemo(() => {
    if (!searchQuery.trim()) return SUGGESTION_CATALOG;
    const q = searchQuery.toLowerCase();
    return SUGGESTION_CATALOG.filter(
      (s) =>
        s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q),
    );
  }, [searchQuery]);

  const handleTryIt = useCallback(
    (item: CatalogSuggestion) => {
      const historyId = uuid();
      createSuggestionHistory(db, historyId, {
        suggestionKey: item.key,
        category: item.category,
        source: 'catalog',
      });
    },
    [db],
  );

  const handleTriedToggle = useCallback(
    (item: CatalogSuggestion) => {
      setTriedKeys((prev) => {
        const next = new Set(prev);
        if (next.has(item.key)) {
          next.delete(item.key);
        } else {
          next.add(item.key);
          handleTryIt(item);
        }
        return next;
      });
    },
    [handleTryIt],
  );

  const featuredRec = recommendations[0];
  const remainingRecs = recommendations.slice(1);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>CURATED FOR YOU</Text>
        <Text style={styles.headerTitle}>Daily Suggestions</Text>
      </View>

      {/* ── Search ──────────────────────────────────────────────── */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Explore ideas..."
          placeholderTextColor="rgba(255,255,255,0.35)"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* ── Category chips ──────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {CATEGORIES.map((cat) => {
          const selected = cat.key === selectedCategory;
          return (
            <Pressable
              key={cat.key}
              onPress={() => setSelectedCategory(cat.key)}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text
                style={[styles.chipText, selected && styles.chipTextSelected]}
              >
                {cat.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* ── Recommended for You ─────────────────────────────────── */}
      {recommendations.length > 0 && (
        <>
          <SectionHeader label="✨ Recommended for You" title="" />

          {/* Featured card with image-style background */}
          {featuredRec != null && (
            <GlassCard level={3} style={styles.featuredCard}>
              <View style={styles.featuredImagePlaceholder}>
                <View style={styles.featuredBoostBadge}>
                  <Text style={styles.featuredBoostText}>1.2X BOOST</Text>
                </View>
                <Text style={styles.featuredEmoji}>
                  {SUGGESTION_ICONS[featuredRec.key] ?? '✨'}
                </Text>
              </View>
              <Text style={styles.featuredTitle}>{featuredRec.title}</Text>
              <Text style={styles.featuredDesc}>{featuredRec.description}</Text>
              <View style={styles.featuredActions}>
                <Pressable
                  style={styles.featuredPlayBtn}
                  onPress={() => handleAction(featuredRec.historyId, 'completed')}
                >
                  <Text style={styles.featuredPlayIcon}>▶</Text>
                </Pressable>
              </View>
            </GlassCard>
          )}

          {/* Remaining recommendation cards */}
          {remainingRecs.map((rec) => (
            <GlassCard key={rec.historyId} level={2} style={styles.recCard}>
              <View style={styles.recIconContainer}>
                <Text style={styles.recIcon}>
                  {SUGGESTION_ICONS[rec.key] ?? '✨'}
                </Text>
              </View>
              <Text style={styles.recTitle}>{rec.title}</Text>
              <Text style={styles.recDesc}>{rec.description}</Text>
              <View style={styles.recFooter}>
                <Text style={styles.recCategory}>
                  {rec.source === 'data_driven'
                    ? 'DATA INSIGHT'
                    : rec.category.toUpperCase().replace('_', ' ')}
                </Text>
                <Pressable onPress={() => handleAction(rec.historyId, 'completed')}>
                  <Text style={styles.recArrow}>→</Text>
                </Pressable>
              </View>
            </GlassCard>
          ))}
        </>
      )}

      {/* ── Quick Actions Grid ──────────────────────────────────── */}
      <View style={styles.quickGrid}>
        {QUICK_ACTIONS.map((action) => (
          <GlassCard key={action.label} level={2} style={styles.quickCard}>
            <Text style={styles.quickIcon}>{action.icon}</Text>
            <Text style={styles.quickLabel}>{action.label}</Text>
          </GlassCard>
        ))}
      </View>

      {/* ── Idea Catalog ────────────────────────────────────────── */}
      <SectionHeader
        title="Idea Catalog"
        label={`${fullCatalog.length} curated ideas`}
        action={{ text: 'View All', onPress: () => {} }}
      />

      {fullCatalog.slice(0, 5).map((item) => (
        <GlassCard key={item.key} level={1} style={styles.catalogCard}>
          <View style={styles.catalogRow}>
            <Text style={styles.catalogIcon}>
              {SUGGESTION_ICONS[item.key] ?? CATEGORY_ICONS[item.category]}
            </Text>
            <View style={styles.catalogInfo}>
              <Text style={styles.catalogTitle}>{item.title}</Text>
              <Text style={styles.catalogDesc}>{item.description}</Text>
            </View>
          </View>
        </GlassCard>
      ))}

      {fullCatalog.length > 5 && (
        <View style={styles.exploreMore}>
          <Text style={styles.exploreIcon}>⊞</Text>
          <Text style={styles.exploreText}>
            Explore {fullCatalog.length - 5} more ideas in the full archive
          </Text>
        </View>
      )}

      {/* ── Category Activity Cards ─────────────────────────────── */}
      <SectionHeader
        label={selectedCategory.toUpperCase()}
        title={`${CATEGORY_ICONS[selectedCategory]} ${selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)} Activities`}
      />

      {catalogItems.map((item) => {
        const tried = triedKeys.has(item.key);
        return (
          <GlassCard key={item.key} level={2} style={styles.activityCard}>
            <View style={styles.activityHeader}>
              <Text style={styles.activityIcon}>
                {SUGGESTION_ICONS[item.key] ?? CATEGORY_ICONS[item.category]}
              </Text>
              <View style={styles.activityInfo}>
                <Text style={styles.activityTitle}>{item.title}</Text>
                <Text style={styles.activityDesc}>{item.description}</Text>
              </View>
            </View>
            <View style={styles.activityMeta}>
              <Text style={styles.activityDuration}>
                ~{item.durationMinutes} min
              </Text>
              <Text style={styles.activityCorrelation}>
                Users who do this rate 1.2 points higher
              </Text>
            </View>
            <View style={styles.activityActions}>
              <Pressable
                style={[styles.tryBtn, tried && styles.tryBtnDone]}
                onPress={() => handleTriedToggle(item)}
              >
                <Text style={[styles.tryBtnText, tried && styles.tryBtnTextDone]}>
                  {tried ? '✓ Tried It' : 'Try It'}
                </Text>
              </Pressable>
            </View>
          </GlassCard>
        );
      })}

      {catalogItems.length === 0 && (
        <GlassCard level={1} style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={styles.emptyText}>
            No ideas found for "{searchQuery}"
          </Text>
        </GlassCard>
      )}
    </ScrollView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: MOOD_SURFACES.depth,
  },
  content: {
    paddingBottom: 100,
  },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerLabel: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    color: MOOD_ACCENT,
    marginBottom: 4,
  },
  headerTitle: {
    ...MOOD_TYPOGRAPHY.displayLg,
    color: colors.text,
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: MOOD_SURFACES.lift,
    borderRadius: 12,
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    ...MOOD_TYPOGRAPHY.bodyMd,
    color: colors.text,
    padding: 0,
  },

  // Category chips
  chipRow: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: MOOD_SURFACES.lift,
  },
  chipSelected: {
    backgroundColor: MOOD_ACCENT,
  },
  chipText: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
  },
  chipTextSelected: {
    color: '#1a1008',
    fontFamily: MOOD_TYPOGRAPHY.headlineMd.fontFamily,
  },

  // Featured recommendation card
  featuredCard: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 0,
    overflow: 'hidden',
  },
  featuredImagePlaceholder: {
    height: 160,
    backgroundColor: MOOD_SURFACES.focus,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featuredBoostBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(251, 146, 60, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  featuredBoostText: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.05 * 10,
    color: MOOD_ACCENT,
  },
  featuredEmoji: {
    fontSize: 48,
  },
  featuredTitle: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    color: colors.text,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  featuredDesc: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 14,
    lineHeight: 20,
  },
  featuredActions: {
    position: 'absolute',
    right: 16,
    bottom: 20,
  },
  featuredPlayBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: MOOD_ACCENT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featuredPlayIcon: {
    color: '#1a1008',
    fontSize: 18,
    marginLeft: 2,
  },

  // Recommendation cards
  recCard: {
    marginHorizontal: 20,
    marginBottom: 12,
    gap: 8,
  },
  recIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: MOOD_SURFACES.focus,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  recIcon: {
    fontSize: 22,
  },
  recTitle: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    fontSize: 18,
    color: colors.text,
  },
  recDesc: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 20,
  },
  recFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  recCategory: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.05 * 10,
    color: 'rgba(255,255,255,0.4)',
  },
  recArrow: {
    color: MOOD_ACCENT,
    fontSize: 18,
    fontWeight: '600',
  },

  // Quick actions grid
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 10,
    marginTop: 8,
    marginBottom: 16,
  },
  quickCard: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 6,
  },
  quickIcon: {
    fontSize: 24,
  },
  quickLabel: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },

  // Idea Catalog
  catalogCard: {
    marginHorizontal: 20,
    marginBottom: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  catalogRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  catalogIcon: {
    fontSize: 24,
  },
  catalogInfo: {
    flex: 1,
    gap: 2,
  },
  catalogTitle: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    fontSize: 16,
    color: colors.text,
  },
  catalogDesc: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    lineHeight: 18,
  },

  // Explore more
  exploreMore: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  exploreIcon: {
    fontSize: 20,
    color: 'rgba(255,255,255,0.3)',
  },
  exploreText: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    color: 'rgba(255,255,255,0.35)',
  },

  // Activity cards
  activityCard: {
    marginHorizontal: 20,
    marginBottom: 10,
    gap: 10,
  },
  activityHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  activityIcon: {
    fontSize: 28,
    marginTop: 2,
  },
  activityInfo: {
    flex: 1,
    gap: 2,
  },
  activityTitle: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    fontSize: 16,
    color: colors.text,
  },
  activityDesc: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 20,
  },
  activityMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activityDuration: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.05 * 10,
    color: 'rgba(255,255,255,0.4)',
  },
  activityCorrelation: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 11,
    color: MOOD_ACCENT_LIGHT,
    fontStyle: 'italic',
  },
  activityActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  tryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: MOOD_ACCENT,
  },
  tryBtnDone: {
    backgroundColor: 'rgba(251, 146, 60, 0.15)',
  },
  tryBtnText: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    fontSize: 13,
    color: '#1a1008',
  },
  tryBtnTextDone: {
    color: MOOD_ACCENT,
  },

  // Empty state
  emptyCard: {
    marginHorizontal: 20,
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyIcon: {
    fontSize: 32,
  },
  emptyText: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
  },
});
