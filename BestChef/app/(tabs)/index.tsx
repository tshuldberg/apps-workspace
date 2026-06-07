import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  ArrowRight,
  BookOpen,
  ChefHat,
  Plus,
  Trophy,
  TrendingUp,
} from 'lucide-react-native';
import {
  JAKARTA_FONTS,
  RECIPES_ACCENT,
  RECIPES_SECONDARY,
  RECIPES_SURFACES,
  RECIPES_TYPOGRAPHY,
} from '@mylife/bestchef';
import { Text, colors } from '@mylife/ui';

const ACCENT = '#22C55E';

/** Placeholder stat card used on the home feed. */
function StatCard({
  icon,
  value,
  label,
  iconBg,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  iconBg: string;
}) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconBox, { backgroundColor: iconBg }]}>
        {icon}
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/** Placeholder trending dish row. */
function TrendingDish({
  rank,
  name,
  cuisine,
  recipes,
}: {
  rank: number;
  name: string;
  cuisine: string;
  recipes: number;
}) {
  const isTop3 = rank <= 3;
  return (
    <View style={styles.trendingRow}>
      <View style={[styles.rankBadge, isTop3 && styles.rankBadgeTop]}>
        <Text style={[styles.rankText, isTop3 && styles.rankTextTop]}>
          {rank}
        </Text>
      </View>
      <View style={styles.trendingInfo}>
        <Text style={styles.trendingName}>{name}</Text>
        <Text style={styles.trendingMeta}>{cuisine}</Text>
      </View>
      <View style={styles.trendingCount}>
        <Text style={styles.trendingCountValue}>{recipes}</Text>
        <Text style={styles.trendingCountLabel}>
          {recipes === 1 ? 'RECIPE' : 'RECIPES'}
        </Text>
      </View>
    </View>
  );
}

const SAMPLE_TRENDING = [
  { name: 'Pad Thai', cuisine: 'Thai', recipes: 142 },
  { name: 'Carbonara', cuisine: 'Italian', recipes: 118 },
  { name: 'Tacos al Pastor', cuisine: 'Mexican', recipes: 97 },
  { name: 'Ramen', cuisine: 'Japanese', recipes: 89 },
  { name: 'Butter Chicken', cuisine: 'Indian', recipes: 76 },
];

export default function HomeScreen() {
  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero greeting */}
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>BestChef</Text>
          <Text style={styles.heroSubtitle}>
            Find the best recipe for every dish
          </Text>
        </View>

        {/* Quick stats */}
        <View style={styles.statsRow}>
          <StatCard
            icon={<BookOpen size={20} color={RECIPES_SECONDARY} strokeWidth={2} />}
            value="0"
            label="SUBMISSIONS"
            iconBg={`${RECIPES_SECONDARY}1A`}
          />
          <StatCard
            icon={<Trophy size={20} color={ACCENT} strokeWidth={2} />}
            value="0"
            label="VOTES CAST"
            iconBg={`${ACCENT}1A`}
          />
        </View>

        {/* Trending dishes */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <TrendingUp size={18} color={ACCENT} strokeWidth={2} />
              <Text style={styles.sectionTitle}>Trending Dishes</Text>
            </View>
            <Text style={styles.seeAll}>SEE ALL</Text>
          </View>
          <View style={styles.trendingCard}>
            {SAMPLE_TRENDING.map((dish, idx) => (
              <TrendingDish
                key={dish.name}
                rank={idx + 1}
                name={dish.name}
                cuisine={dish.cuisine}
                recipes={dish.recipes}
              />
            ))}
          </View>
        </View>

        {/* Submit CTA */}
        <Pressable
          style={({ pressed }) => [
            styles.ctaCard,
            pressed && styles.ctaCardPressed,
          ]}
        >
          <View style={styles.ctaDecoration} />
          <View style={[styles.ctaIconCircle]}>
            <ChefHat size={24} color={ACCENT} strokeWidth={2} />
          </View>
          <Text style={styles.ctaTitle}>Submit a Recipe</Text>
          <Text style={styles.ctaDescription}>
            Share your best dish with the world. Upload a photo, write your
            recipe, and let the community vote.
          </Text>
          <View style={styles.ctaButton}>
            <Text style={styles.ctaButtonText}>Get Started</Text>
            <ArrowRight size={16} color="#0E0E13" strokeWidth={2.5} />
          </View>
        </Pressable>
      </ScrollView>

      {/* Floating Action Button */}
      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        hitSlop={8}
      >
        <Plus size={28} color="#0E0E13" strokeWidth={3} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: RECIPES_SURFACES.base,
  },
  container: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 160,
    gap: 32,
  },

  // Hero
  hero: {
    gap: 6,
  },
  heroTitle: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 34,
    letterSpacing: -1,
    color: colors.text,
  },
  heroSubtitle: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 15,
    color: 'rgba(214, 195, 181, 0.6)',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 24,
    padding: 22,
    gap: 16,
  },
  statIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 28,
    color: colors.text,
  },
  statLabel: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: 'rgba(214, 195, 181, 0.5)',
  },

  // Section
  section: {
    gap: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    ...RECIPES_TYPOGRAPHY.headlineMd,
    fontSize: 18,
    color: colors.text,
  },
  seeAll: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 11,
    letterSpacing: 0.5,
    color: RECIPES_SECONDARY,
  },

  // Trending
  trendingCard: {
    backgroundColor: '#12121A',
    borderRadius: 24,
    padding: 20,
    gap: 0,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  trendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
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
  rankText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 14,
    color: colors.textSecondary,
  },
  rankTextTop: {
    color: RECIPES_SECONDARY,
  },
  trendingInfo: {
    flex: 1,
    gap: 2,
  },
  trendingName: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 15,
    color: colors.text,
  },
  trendingMeta: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 11,
    color: 'rgba(214, 195, 181, 0.5)',
  },
  trendingCount: {
    alignItems: 'center',
    gap: 2,
    minWidth: 40,
  },
  trendingCountValue: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 16,
    color: RECIPES_SECONDARY,
  },
  trendingCountLabel: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 7,
    letterSpacing: 0.8,
    color: 'rgba(214, 195, 181, 0.4)',
  },

  // CTA
  ctaCard: {
    backgroundColor: '#12121A',
    borderRadius: 24,
    padding: 28,
    gap: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  ctaCardPressed: {
    opacity: 0.9,
  },
  ctaDecoration: {
    position: 'absolute',
    right: -50,
    bottom: -50,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(34, 197, 94, 0.06)',
  },
  ctaIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${ACCENT}1A`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTitle: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 24,
    color: colors.text,
  },
  ctaDescription: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(214, 195, 181, 0.6)',
  },
  ctaButton: {
    marginTop: 8,
    backgroundColor: ACCENT,
    borderRadius: 999,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaButtonText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 15,
    color: '#0E0E13',
  },

  // FAB
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 100,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  fabPressed: {
    transform: [{ scale: 0.95 }],
  },
});
