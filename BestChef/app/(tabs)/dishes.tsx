import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Search } from 'lucide-react-native';
import {
  type CloudDish,
  type DishCategory as DishCategoryType,
  searchDishes,
  getCuisines,
  JAKARTA_FONTS,
  RECIPES_ACCENT,
  RECIPES_SURFACES,
} from '@mylife/bestchef';
import { Text, colors } from '@mylife/ui';

const ALL_CATEGORIES: DishCategoryType[] = [
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

export default function DishesScreen() {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] =
    useState<DishCategoryType | null>(null);
  const [selectedCuisine, setSelectedCuisine] = useState<string | null>(null);
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [dishes, setDishes] = useState<CloudDish[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCuisines, setShowCuisines] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dishResult, cuisineResult] = await Promise.all([
        searchDishes(query || '', {
          category: selectedCategory ?? undefined,
          cuisine: selectedCuisine ?? undefined,
          limit: 50,
        }),
        getCuisines(),
      ]);

      if (dishResult.ok) {
        setDishes(dishResult.data);
      } else {
        setError(dishResult.error);
      }

      if (cuisineResult.ok) {
        setCuisines(cuisineResult.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dishes');
    } finally {
      setLoading(false);
    }
  }, [query, selectedCategory, selectedCuisine]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void load();
    }, 300);
    return () => clearTimeout(timeout);
  }, [load]);

  const toggleCategory = (cat: DishCategoryType) => {
    setSelectedCategory((prev) => (prev === cat ? null : cat));
  };

  const toggleCuisine = (cuisine: string) => {
    setSelectedCuisine((prev) => (prev === cuisine ? null : cuisine));
    setShowCuisines(false);
  };

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Dishes</Text>
      </View>

      {/* Search bar */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Search size={18} color={colors.textSecondary} strokeWidth={2} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search dishes..."
            placeholderTextColor="rgba(214, 195, 181, 0.4)"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      {/* Category chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {ALL_CATEGORIES.map((cat) => (
          <FilterChip
            key={cat}
            label={capitalize(cat)}
            selected={selectedCategory === cat}
            onPress={() => toggleCategory(cat)}
          />
        ))}
      </ScrollView>

      {/* Cuisine filter */}
      <Pressable
        style={styles.cuisineToggle}
        onPress={() => setShowCuisines(!showCuisines)}
      >
        <Text style={styles.cuisineToggleText}>
          {selectedCuisine ?? 'All Cuisines'}
        </Text>
        <Text style={styles.cuisineArrow}>{showCuisines ? '\u25B2' : '\u25BC'}</Text>
      </Pressable>

      {showCuisines && cuisines.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          <FilterChip
            label="All"
            selected={selectedCuisine === null}
            onPress={() => {
              setSelectedCuisine(null);
              setShowCuisines(false);
            }}
          />
          {cuisines.map((c) => (
            <FilterChip
              key={c}
              label={c}
              selected={selectedCuisine === c}
              onPress={() => toggleCuisine(c)}
            />
          ))}
        </ScrollView>
      )}

      {/* Results */}
      {loading ? (
        <View style={styles.stateWrap}>
          <Text style={styles.stateText}>Loading dishes...</Text>
        </View>
      ) : error ? (
        <View style={styles.stateWrap}>
          <Text style={styles.stateText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => void load()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : dishes.length === 0 ? (
        <View style={styles.stateWrap}>
          <Text style={styles.emptyTitle}>No dishes found</Text>
          <Text style={styles.emptyMessage}>
            Try a different search or filter
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {dishes.map((dish) => (
            <View key={dish.id} style={styles.dishCard}>
              <View style={styles.dishHeader}>
                <View style={styles.dishInfo}>
                  <Text style={styles.dishName}>{dish.name}</Text>
                  {dish.nativeName != null && (
                    <Text style={styles.dishNativeName}>{dish.nativeName}</Text>
                  )}
                </View>
                <View style={styles.categoryPill}>
                  <Text style={styles.categoryPillText}>
                    {capitalize(dish.category)}
                  </Text>
                </View>
              </View>
              <View style={styles.dishMeta}>
                <Text style={styles.dishMetaText}>{dish.cuisine}</Text>
                <Text style={styles.dishMetaDot}>{'\u00B7'}</Text>
                <Text style={styles.dishMetaText}>
                  {dish.submissionCount}{' '}
                  {dish.submissionCount === 1 ? 'recipe' : 'recipes'}
                </Text>
              </View>
            </View>
          ))}
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
  searchWrap: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: RECIPES_SURFACES.lift,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 15,
    color: colors.text,
    padding: 0,
  },
  chipRow: {
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
  cuisineToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 24,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: RECIPES_SURFACES.lift,
    borderRadius: 12,
    marginBottom: 8,
  },
  cuisineToggleText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 13,
    color: colors.text,
  },
  cuisineArrow: {
    fontSize: 10,
    color: colors.textSecondary,
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
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 120,
    gap: 10,
  },
  dishCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 18,
    padding: 18,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  dishHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  dishInfo: {
    flex: 1,
    gap: 2,
  },
  dishName: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 16,
    color: colors.text,
  },
  dishNativeName: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  categoryPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
  },
  categoryPillText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 10,
    letterSpacing: 0.5,
    color: RECIPES_ACCENT,
  },
  dishMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dishMetaText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 12,
    color: 'rgba(214, 195, 181, 0.6)',
  },
  dishMetaDot: {
    fontSize: 12,
    color: 'rgba(214, 195, 181, 0.3)',
  },
});
