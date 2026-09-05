import { useCallback, useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
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
import { FilterChip, GlassCard } from '@mylife/bestchef/ui';
import { EmptyState, ErrorState, LoadingState, Text, colors } from '@mylife/ui';

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
 * Stub: getTopDishes -- not yet implemented on cloud layer.
 * Returns dishes ordered by submission count as a proxy for "top".
 */
async function getTopDishes(): Promise<BestChefResult<CloudDish[]>> {
  return searchDishes('', { limit: 20 });
}

/**
 * Stub: getTrendingDishes -- not yet implemented.
 * Returns dishes ordered by submission count for now.
 */
async function getTrendingDishes(): Promise<BestChefResult<CloudDish[]>> {
  return searchDishes('', { limit: 20 });
}

export default function LeaderboardScreen() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<LeaderboardTab>('top');
  const [dishes, setDishes] = useState<CloudDish[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<DishCategoryType>('main');

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
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  }, [activeTab, selectedCategory]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.screen}>
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
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
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
          <LoadingState rows={6} />
        </View>
      ) : error ? (
        <View style={styles.stateWrap}>
          <ErrorState message={error} onRetry={() => void load()} />
        </View>
      ) : dishes.length === 0 ? (
        <View style={styles.stateWrap}>
          <EmptyState
            icon="trophy"
            title="No rankings yet"
            message="Submit recipes and vote to build the leaderboard"
          />
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
              <GlassCard
                key={dish.id}
                level={2}
                style={styles.leaderCard}
                onPress={() => router.push(`/(recipes)/dish/${dish.id}`)}
              >
                <View style={styles.leaderRow}>
                  {/* Rank */}
                  <View style={[styles.rankBadge, isTop3 && styles.rankBadgeTop]}>
                    <Text style={[styles.rankNumber, isTop3 && styles.rankNumberTop]}>
                      {rank}
                    </Text>
                  </View>

                  {/* Info */}
                  <View style={styles.leaderInfo}>
                    <Text style={styles.leaderDishName} numberOfLines={1}>
                      {dish.name}
                    </Text>
                    <View style={styles.leaderMeta}>
                      <Text style={styles.leaderCuisine}>{dish.cuisine}</Text>
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
                    <View style={[styles.leaderPhoto, styles.leaderPhotoPlaceholder]}>
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
              </GlassCard>
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

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingTop: 16,
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

  stateWrap: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 120,
    gap: 8,
  },

  // Leader card
  leaderCard: {
    paddingVertical: 14,
    paddingHorizontal: 14,
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
    color: colors.textTertiary,
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
