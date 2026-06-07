import { useCallback, useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  type CloudDish,
  type DishCategory as DishCategoryType,
  type BestChefResult,
  searchDishes,
  JAKARTA_FONTS,
  RECIPES_ACCENT,
  RECIPES_SECONDARY,
  RECIPES_SURFACES,
} from '@mylife/bestchef';
import { Text, colors } from '@mylife/ui';

type LeaderboardTab = 'top' | 'trending' | 'category';

const CATEGORY_LIST: DishCategoryType[] = [
  'appetizer',
  'soup',
  'salad',
  'main',
  'side',
  'dessert',
  'bread',
  'beverage',
  'condiment',
  'snack',
  'breakfast',
];

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Stub: getTopDishes. Returns dishes ordered by submission count as a proxy.
 */
async function getTopDishes(): Promise<BestChefResult<CloudDish[]>> {
  return searchDishes('', { limit: 20 });
}

/**
 * Stub: getTrendingDishes. Returns dishes ordered by submission count for now.
 */
async function getTrendingDishes(): Promise<BestChefResult<CloudDish[]>> {
  return searchDishes('', { limit: 20 });
}

function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function LeaderboardScreen() {
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('top');
  const [dishes, setDishes] = useState<CloudDish[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] =
    useState<DishCategoryType>('main');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let result: BestChefResult<CloudDish[]>;
      if (activeTab === 'top') {
        result = await getTopDishes();
      } else if (activeTab === 'trending') {
        result = await getTrendingDishes();
      } else {
        result = await searchDishes('', {
          category: selectedCategory,
          limit: 20,
        });
      }

      if (result.ok) {
        setDishes(result.data);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load leaderboard',
      );
    } finally {
      setLoading(false);
    }
  }, [activeTab, selectedCategory]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Leaderboard</Text>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {(['top', 'trending', 'category'] as const).map((tab) => {
          const isActive = activeTab === tab;
          const labels: Record<LeaderboardTab, string> = {
            top: 'Top Dishes',
            trending: 'Trending',
            category: 'By Category',
          };
          return (
            <Pressable
              key={tab}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                style={[styles.tabText, isActive && styles.tabTextActive]}
              >
                {labels[tab]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Category picker (only for category tab) */}
      {activeTab === 'category' && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
        >
          {CATEGORY_LIST.map((cat) => (
            <FilterChip
              key={cat}
              label={capitalize(cat)}
              selected={selectedCategory === cat}
              onPress={() => setSelectedCategory(cat)}
            />
          ))}
        </ScrollView>
      )}

      {/* Content */}
      {loading ? (
        <View style={styles.stateWrap}>
          <Text style={styles.stateText}>Loading rankings...</Text>
        </View>
      ) : error ? (
        <View style={styles.stateWrap}>
          <Text style={styles.stateText}>{error}</Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => void load()}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : dishes.length === 0 ? (
        <View style={styles.stateWrap}>
          <Text style={styles.emptyTitle}>No rankings yet</Text>
          <Text style={styles.emptyMessage}>
            Submit recipes and vote to build the leaderboard
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {dishes.map((dish, idx) => {
            const rank = idx + 1;
            const isTop3 = rank <= 3;
            return (
              <View key={dish.id} style={styles.leaderCard}>
                <View style={styles.leaderRow}>
                  {/* Rank */}
                  <View
                    style={[
                      styles.rankBadge,
                      isTop3 && styles.rankBadgeTop,
                    ]}
                  >
                    <Text
                      style={[
                        styles.rankNumber,
                        isTop3 && styles.rankNumberTop,
                      ]}
                    >
                      {rank}
                    </Text>
                  </View>

                  {/* Info */}
                  <View style={styles.leaderInfo}>
                    <Text style={styles.leaderDishName} numberOfLines={1}>
                      {dish.name}
                    </Text>
                    <View style={styles.leaderMeta}>
                      <Text style={styles.leaderCuisine}>
                        {dish.cuisine}
                      </Text>
                      <Text style={styles.leaderDot}>{'\u00B7'}</Text>
                      <Text style={styles.leaderCuisine}>
                        {capitalize(dish.category)}
                      </Text>
                    </View>
                  </View>

                  {/* Photo placeholder */}
                  {dish.photoUrl != null ? (
                    <Image
                      source={{ uri: dish.photoUrl }}
                      style={styles.leaderPhoto}
                      resizeMode="cover"
                    />
                  ) : (
                    <View
                      style={[
                        styles.leaderPhoto,
                        styles.leaderPhotoPlaceholder,
                      ]}
                    >
                      <Text style={styles.leaderPhotoGlyph}>
                        {dish.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}

                  {/* Score */}
                  <View style={styles.leaderScore}>
                    <Text style={styles.leaderScoreValue}>
                      {dish.submissionCount}
                    </Text>
                    <Text style={styles.leaderScoreLabel}>
                      {dish.submissionCount === 1 ? 'RECIPE' : 'RECIPES'}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: RECIPES_SURFACES.base,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 8,
  },
  headerTitle: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 30,
    letterSpacing: -0.8,
    color: colors.text,
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: RECIPES_SURFACES.lift,
  },
  tabActive: {
    backgroundColor: 'rgba(34, 197, 94, 0.14)',
  },
  tabText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 12,
    letterSpacing: 0.3,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: RECIPES_ACCENT,
  },

  // Category
  categoryRow: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: RECIPES_SURFACES.lift,
  },
  chipSelected: {
    backgroundColor: 'rgba(34, 197, 94, 0.14)',
  },
  chipText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 12,
    color: colors.textSecondary,
  },
  chipTextSelected: {
    color: RECIPES_ACCENT,
  },

  stateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
    gap: 12,
  },
  stateText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: colors.textSecondary,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: RECIPES_ACCENT,
  },
  retryButtonText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 13,
    color: '#0E0E13',
  },
  emptyTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 16,
    color: colors.text,
  },
  emptyMessage: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 120,
    gap: 8,
  },

  // Leader card
  leaderCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: RECIPES_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeTop: {
    backgroundColor: 'rgba(201, 137, 77, 0.2)',
  },
  rankNumber: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 14,
    color: colors.textSecondary,
  },
  rankNumberTop: {
    color: RECIPES_SECONDARY,
  },
  leaderInfo: {
    flex: 1,
    gap: 2,
  },
  leaderDishName: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 15,
    color: colors.text,
  },
  leaderMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  leaderCuisine: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 11,
    color: 'rgba(214, 195, 181, 0.5)',
  },
  leaderDot: {
    fontSize: 11,
    color: 'rgba(214, 195, 181, 0.3)',
  },
  leaderPhoto: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: RECIPES_SURFACES.focus,
  },
  leaderPhotoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaderPhotoGlyph: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 18,
    color: 'rgba(214, 195, 181, 0.4)',
  },
  leaderScore: {
    alignItems: 'center',
    gap: 2,
    minWidth: 40,
  },
  leaderScoreValue: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 16,
    color: RECIPES_SECONDARY,
  },
  leaderScoreLabel: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 7,
    letterSpacing: 0.8,
    color: 'rgba(214, 195, 181, 0.4)',
  },
});
