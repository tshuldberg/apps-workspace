import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  Award,
  ChefHat,
  Star,
  ThumbsUp,
  Trophy,
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

function StatItem({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function BadgePlaceholder({
  icon,
  name,
  description,
  earned,
}: {
  icon: string;
  name: string;
  description: string;
  earned: boolean;
}) {
  return (
    <View style={[styles.badgeCard, !earned && styles.badgeLocked]}>
      <View
        style={[
          styles.badgeCircle,
          earned && styles.badgeCircleEarned,
        ]}
      >
        <Text style={styles.badgeIcon}>{icon}</Text>
      </View>
      <Text
        style={[styles.badgeName, !earned && styles.badgeNameLocked]}
        numberOfLines={2}
      >
        {name}
      </Text>
      <Text style={styles.badgeDescription} numberOfLines={2}>
        {description}
      </Text>
      {earned && (
        <View style={styles.earnedTag}>
          <Text style={styles.earnedTagText}>Earned</Text>
        </View>
      )}
    </View>
  );
}

const SAMPLE_BADGES = [
  {
    icon: '\u{1F373}',
    name: 'First Submission',
    description: 'Submit your first recipe',
    earned: false,
  },
  {
    icon: '\u{1F3C6}',
    name: 'Top Chef',
    description: 'Win #1 ranking for any dish',
    earned: false,
  },
  {
    icon: '\u2B50',
    name: 'Community Star',
    description: 'Receive 100+ votes on a recipe',
    earned: false,
  },
  {
    icon: '\u{1F31F}',
    name: 'Globetrotter',
    description: 'Submit recipes from 5 cuisines',
    earned: false,
  },
];

export default function ProfileScreen() {
  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile header */}
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            <View style={styles.avatar}>
              <ChefHat size={32} color={ACCENT} strokeWidth={2} />
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.displayName}>Chef</Text>
              <Text style={styles.handle}>Sign in to set up your profile</Text>
            </View>
          </View>
        </View>

        {/* Stats bar */}
        <View style={styles.statsCard}>
          <View style={styles.statsRow}>
            <StatItem value="0" label="Submissions" />
            <StatItem value="0" label="Votes" />
            <StatItem value="0" label="Wins" />
            <StatItem value="0" label="Followers" />
          </View>
        </View>

        {/* Signature Dishes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Signature Dishes</Text>
          <View style={styles.emptyCard}>
            <Trophy size={32} color="rgba(214, 195, 181, 0.3)" strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>No signature dishes yet</Text>
            <Text style={styles.emptyMessage}>
              Your top-ranked submissions will appear here
            </Text>
          </View>
        </View>

        {/* Badge collection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Badge Collection</Text>
          <View style={styles.badgeGrid}>
            {SAMPLE_BADGES.map((badge) => (
              <BadgePlaceholder
                key={badge.name}
                icon={badge.icon}
                name={badge.name}
                description={badge.description}
                earned={badge.earned}
              />
            ))}
          </View>
        </View>

        {/* Creator program link */}
        <View style={styles.creatorCard}>
          <Text style={styles.creatorTitle}>Creator Program</Text>
          <Text style={styles.creatorDescription}>
            Apply to become a verified creator. Unlock tipping, subscriber
            tiers, and exclusive content tools.
          </Text>
          <View style={styles.creatorButton}>
            <Text style={styles.creatorButtonText}>Coming Soon</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: RECIPES_SURFACES.base,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 120,
    gap: 24,
  },

  // Header
  headerCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: `${ACCENT}1A`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
    gap: 4,
  },
  displayName: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 22,
    letterSpacing: -0.5,
    color: colors.text,
  },
  handle: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: 'rgba(214, 195, 181, 0.6)',
  },

  // Stats
  statsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 24,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 20,
    color: colors.text,
  },
  statLabel: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 10,
    letterSpacing: 0.8,
    color: 'rgba(214, 195, 181, 0.5)',
    textTransform: 'uppercase',
  },

  // Sections
  section: {
    gap: 12,
  },
  sectionTitle: {
    ...RECIPES_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },

  // Empty
  emptyCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  emptyTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 16,
    color: colors.text,
    marginTop: 4,
  },
  emptyMessage: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Badges
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  badgeCard: {
    width: '47%' as unknown as number,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 20,
    padding: 18,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  badgeLocked: {
    opacity: 0.5,
  },
  badgeCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: RECIPES_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  badgeCircleEarned: {
    borderColor: '#FFD700',
  },
  badgeIcon: {
    fontSize: 24,
  },
  badgeName: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 13,
    color: colors.text,
    textAlign: 'center',
  },
  badgeNameLocked: {
    color: colors.textSecondary,
  },
  badgeDescription: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 11,
    lineHeight: 15,
    color: 'rgba(214, 195, 181, 0.5)',
    textAlign: 'center',
  },
  earnedTag: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
  },
  earnedTagText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 9,
    letterSpacing: 0.5,
    color: RECIPES_ACCENT,
    textTransform: 'uppercase',
  },

  // Creator program
  creatorCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  creatorTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 16,
    color: colors.text,
  },
  creatorDescription: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  creatorButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: RECIPES_SURFACES.focus,
    opacity: 0.6,
  },
  creatorButtonText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 13,
    color: colors.textSecondary,
  },
});
