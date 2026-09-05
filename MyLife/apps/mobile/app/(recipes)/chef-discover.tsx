import { useCallback, useEffect, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Search } from 'lucide-react-native';
import {
  type BestChefResult,
  JAKARTA_FONTS,
  RECIPES_ACCENT,
  RECIPES_SECONDARY,
  RECIPES_SURFACES,
  RECIPES_TYPOGRAPHY,
} from '@mylife/bestchef';
import { FilterChip, GlassCard } from '@mylife/bestchef/ui';
import { EmptyState, ErrorState, LoadingState, Text, colors } from '@mylife/ui';
import { type SocialProfile, useProfileSearch } from '@mylife/social';

// ── Types ────────────────────────────────────────────────────────────

interface ChefCard {
  profile: SocialProfile;
  topCuisine: string | null;
  dishesWon: number;
}

// ── Cuisine list ─────────────────────────────────────────────────────

const CUISINE_FILTERS = [
  'Italian',
  'Japanese',
  'Mexican',
  'Indian',
  'Chinese',
  'Thai',
  'French',
  'Korean',
  'American',
  'Mediterranean',
];

// ── Stubs (cloud functions not yet implemented) ──────────────────────

async function searchChefs(
  query: string,
  _opts?: { cuisine?: string },
): Promise<BestChefResult<ChefCard[]>> {
  // Stub: returns empty until cloud layer is wired
  void query;
  return { ok: true, data: [] };
}

async function getTopChefs(): Promise<BestChefResult<ChefCard[]>> {
  return { ok: true, data: [] };
}

// ── Screen ───────────────────────────────────────────────────────────

export default function ChefDiscoverScreen() {
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [selectedCuisine, setSelectedCuisine] = useState<string | null>(null);
  const [chefs, setChefs] = useState<ChefCard[]>([]);
  const [topChefs, setTopChefs] = useState<ChefCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Also search via social profile search for name/handle matching
  const { data: socialProfiles } = useProfileSearch(query);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [searchResult, topResult] = await Promise.all([
        searchChefs(query, {
          cuisine: selectedCuisine ?? undefined,
        }),
        query.length === 0 ? getTopChefs() : Promise.resolve({ ok: true as const, data: [] }),
      ]);

      if (!searchResult.ok) {
        setError(searchResult.error);
        return;
      }

      // Merge cloud chef search with social profile search
      const chefIds = new Set(searchResult.data.map((c) => c.profile.id));
      const merged = [...searchResult.data];
      if (socialProfiles) {
        for (const p of socialProfiles) {
          if (!chefIds.has(p.id)) {
            merged.push({ profile: p, topCuisine: null, dishesWon: 0 });
          }
        }
      }
      setChefs(merged);

      if (topResult.ok) {
        setTopChefs(topResult.data);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to search chefs',
      );
    } finally {
      setLoading(false);
    }
  }, [query, selectedCuisine, socialProfiles]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void load();
    }, 300);
    return () => clearTimeout(timeout);
  }, [load]);

  const toggleCuisine = (cuisine: string) => {
    setSelectedCuisine((prev) => (prev === cuisine ? null : cuisine));
  };

  const navigateToProfile = (profileId: string) => {
    router.push({
      pathname: '/(recipes)/chef-profile',
      params: { profileId },
    });
  };

  const displayChefs = query.length > 0 || selectedCuisine ? chefs : topChefs;
  const showTopLabel = query.length === 0 && !selectedCuisine;

  return (
    <View style={styles.screen}>
      {/* Search bar */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Search size={18} color={colors.textSecondary} strokeWidth={2} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search chefs by name or handle..."
            placeholderTextColor={colors.textTertiary}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      {/* Cuisine filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {CUISINE_FILTERS.map((cuisine) => (
          <FilterChip
            key={cuisine}
            label={cuisine}
            selected={selectedCuisine === cuisine}
            onPress={() => toggleCuisine(cuisine)}
          />
        ))}
      </ScrollView>

      {/* Results */}
      {loading ? (
        <View style={styles.stateWrap}>
          <LoadingState rows={5} />
        </View>
      ) : error ? (
        <View style={styles.stateWrap}>
          <ErrorState message={error} onRetry={() => void load()} />
        </View>
      ) : displayChefs.length === 0 ? (
        <View style={styles.stateWrap}>
          <EmptyState
            icon="person.2"
            title={showTopLabel ? 'No top chefs yet' : 'No chefs found'}
            message={
              showTopLabel
                ? 'Be the first to submit a recipe and start climbing the ranks'
                : 'Try a different search or cuisine filter'
            }
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {showTopLabel && (
            <Text style={styles.listTitle}>Top Chefs</Text>
          )}

          {displayChefs.map((chef) => (
            <GlassCard
              key={chef.profile.id}
              level={2}
              style={styles.chefCard}
              onPress={() => navigateToProfile(chef.profile.id)}
            >
              <View style={styles.chefRow}>
                {chef.profile.avatarUrl ? (
                  <Image
                    source={{ uri: chef.profile.avatarUrl }}
                    style={styles.chefAvatar}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={[styles.chefAvatar, styles.chefAvatarPlaceholder]}
                  >
                    <Text style={styles.chefAvatarInitial}>
                      {chef.profile.displayName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}

                <View style={styles.chefInfo}>
                  <Text style={styles.chefName} numberOfLines={1}>
                    {chef.profile.displayName}
                  </Text>
                  <Text style={styles.chefHandle}>
                    @{chef.profile.handle}
                  </Text>
                  {chef.topCuisine && (
                    <View style={styles.cuisinePill}>
                      <Text style={styles.cuisinePillText}>
                        {chef.topCuisine}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.chefStats}>
                  <View style={styles.chefStatItem}>
                    <Text style={styles.chefStatValue}>
                      {chef.dishesWon}
                    </Text>
                    <Text style={styles.chefStatLabel}>Wins</Text>
                  </View>
                  <View style={styles.chefStatItem}>
                    <Text style={styles.chefStatValue}>
                      {chef.profile.followerCount}
                    </Text>
                    <Text style={styles.chefStatLabel}>Followers</Text>
                  </View>
                </View>
              </View>
            </GlassCard>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: RECIPES_SURFACES.base,
  },

  // Search
  searchWrap: {
    paddingHorizontal: 24,
    paddingTop: 16,
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
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 15,
    color: colors.text,
    padding: 0,
  },

  // Chips
  chipRow: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 8,
  },

  // States
  stateWrap: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
  },

  // List
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 120,
    gap: 12,
  },
  listTitle: {
    ...RECIPES_TYPOGRAPHY.headlineMd,
    color: colors.text,
    marginBottom: 4,
  },

  // Chef card
  chefCard: {
    paddingVertical: 14,
  },
  chefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  chefAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: RECIPES_SURFACES.focus,
  },
  chefAvatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
  },
  chefAvatarInitial: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 20,
    color: RECIPES_ACCENT,
  },
  chefInfo: {
    flex: 1,
    gap: 2,
  },
  chefName: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 15,
    color: colors.text,
  },
  chefHandle: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 12,
    color: 'rgba(214, 195, 181, 0.6)',
  },
  cuisinePill: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  cuisinePillText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 10,
    letterSpacing: 0.5,
    color: RECIPES_ACCENT,
  },
  chefStats: {
    flexDirection: 'row',
    gap: 16,
  },
  chefStatItem: {
    alignItems: 'center',
    gap: 2,
  },
  chefStatValue: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 16,
    color: RECIPES_SECONDARY,
  },
  chefStatLabel: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 8,
    letterSpacing: 0.6,
    color: 'rgba(214, 195, 181, 0.5)',
    textTransform: 'uppercase',
  },
});
