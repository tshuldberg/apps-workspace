import {
  Alert,
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  Image,
  Text as RNText,
} from 'react-native';
import { useRouter } from 'expo-router';

const showClubsComingSoon = () => {
  Alert.alert(
    'Preview only',
    'Book clubs are a design preview. Joining and creating clubs is not yet wired in this build.',
  );
};
import {
  GlassCard,
  GradientButton,
  ReadingProgressBar,
  JAKARTA_FONTS,
  BOOKS_SURFACES,
  BOOKS_TYPOGRAPHY,
} from '@mylife/books/ui';

// ── Mock Data ──────────────────────────────────────────────

const FEATURED_CLUB = {
  id: 'club-1',
  name: 'The Midnight Readers',
  coverUrl: 'https://covers.openlibrary.org/b/id/14845842-L.jpg',
  description:
    'Currently exploring "The Philosophy of Time" by Marcus Thorne. Discussion starts this Friday.',
  memberCount: 12,
  memberAvatars: [
    'https://i.pravatar.cc/40?img=1',
    'https://i.pravatar.cc/40?img=2',
  ],
  groupProgress: 0.68,
  badge: 'MOST ACTIVE',
};

const OTHER_CLUBS = [
  {
    id: 'club-2',
    name: 'Classics Revived',
    coverUrl: 'https://covers.openlibrary.org/b/id/8231856-S.jpg',
    memberCount: 8,
    pageProgress: '112 / 450',
    status: 'active' as const,
  },
  {
    id: 'club-3',
    name: 'Sci-Fi Nexus',
    coverUrl: 'https://covers.openlibrary.org/b/id/12547191-S.jpg',
    memberCount: 24,
    pageProgress: '',
    status: 'completing soon' as const,
  },
];

// ── Screen ─────────────────────────────────────────────────

export default function ClubsScreen() {
  const router = useRouter();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <RNText style={styles.headerLabel}>COMMUNITY</RNText>
        <RNText style={styles.headerTitle}>Reading Circles</RNText>
        <RNText style={styles.headerSubtitle}>
          Connect with fellow readers, track shared progress, and discuss your
          favorite titles.
        </RNText>
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonRow}>
        <Pressable style={styles.outlineButton} onPress={showClubsComingSoon}>
          <RNText style={styles.outlineButtonIcon}>{'\u221E'}</RNText>
          <RNText style={styles.outlineButtonLabel}>Join with Code</RNText>
        </Pressable>
        <GradientButton
          label="+ Create Club"
          onPress={showClubsComingSoon}
          style={styles.createButton}
        />
      </View>

      {/* Featured Club Card */}
      <GlassCard
        level={2}
        style={styles.featuredCard}
        onPress={() => router.push(`/(books)/club/${FEATURED_CLUB.id}`)}
      >
        {/* Large Cover */}
        <View style={styles.featuredCoverWrap}>
          <Image
            source={{ uri: FEATURED_CLUB.coverUrl }}
            style={styles.featuredCover}
            resizeMode="cover"
          />
        </View>

        {/* Badge + Members */}
        <View style={styles.featuredMeta}>
          <View style={styles.badge}>
            <RNText style={styles.badgeText}>{FEATURED_CLUB.badge}</RNText>
          </View>
          <View style={styles.memberAvatars}>
            {FEATURED_CLUB.memberAvatars.map((uri, i) => (
              <Image
                key={i}
                source={{ uri }}
                style={[styles.avatar, i > 0 && { marginLeft: -8 }]}
              />
            ))}
            <View style={[styles.avatarCount, { marginLeft: -8 }]}>
              <RNText style={styles.avatarCountText}>
                +{FEATURED_CLUB.memberCount}
              </RNText>
            </View>
          </View>
        </View>

        {/* Club Info */}
        <RNText style={styles.featuredName}>{FEATURED_CLUB.name}</RNText>
        <RNText style={styles.featuredDescription}>
          {FEATURED_CLUB.description}
        </RNText>

        {/* Group Progress */}
        <View style={styles.progressRow}>
          <RNText style={styles.progressLabel}>GROUP PROGRESS</RNText>
          <RNText style={styles.progressPct}>
            {Math.round(FEATURED_CLUB.groupProgress * 100)}%
          </RNText>
        </View>
        <ReadingProgressBar progress={FEATURED_CLUB.groupProgress} height={6} />

        {/* Go to Discussion */}
        <Pressable
          style={styles.discussionLink}
          onPress={() => router.push(`/(books)/club/${FEATURED_CLUB.id}`)}
        >
          <RNText style={styles.discussionText}>Go to Discussion</RNText>
          <RNText style={styles.discussionArrow}>{'\u2192'}</RNText>
        </Pressable>
      </GlassCard>

      {/* Other Clubs */}
      {OTHER_CLUBS.map((club) => (
        <GlassCard
          key={club.id}
          level={2}
          style={styles.clubRow}
          onPress={() => router.push(`/(books)/club/${club.id}`)}
        >
          <Image
            source={{ uri: club.coverUrl }}
            style={styles.clubRowCover}
            resizeMode="cover"
          />
          <View style={styles.clubRowInfo}>
            <RNText style={styles.clubRowName}>{club.name}</RNText>
            <RNText style={styles.clubRowMembers}>
              {club.memberCount} members active
            </RNText>
            {club.pageProgress ? (
              <RNText style={styles.clubRowPage}>
                PAGE {club.pageProgress}
              </RNText>
            ) : (
              <RNText style={styles.clubRowStatus}>
                {club.status.toUpperCase()}
              </RNText>
            )}
          </View>
        </GlassCard>
      ))}

      {/* Empty State / Explore */}
      <View style={styles.emptySection}>
        <View style={styles.emptyIconWrap}>
          <RNText style={styles.emptyIcon}>{'\uD83D\uDCD6'}</RNText>
        </View>
        <RNText style={styles.emptyTitle}>No more circles?</RNText>
        <RNText style={styles.emptyMessage}>
          Start a book club with your friends or search for community circles
          matching your favorite genres.
        </RNText>
        <Pressable style={styles.explorePill}>
          <RNText style={styles.explorePillText}>Explore Public Clubs</RNText>
        </Pressable>
      </View>
    </ScrollView>
  );
}

// ── Styles ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BOOKS_SURFACES.base,
  },
  content: {
    paddingBottom: 40,
  },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  headerLabel: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: '#C9894D',
    marginBottom: 6,
  },
  headerTitle: {
    ...BOOKS_TYPOGRAPHY.displayLg,
    color: '#E4E1E9',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 15,
    color: '#D6C3B5',
    lineHeight: 22,
  },

  // Buttons
  buttonRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  outlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  outlineButtonIcon: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 16,
    color: '#E4E1E9',
  },
  outlineButtonLabel: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: '#E4E1E9',
  },
  createButton: {
    flex: 0,
  },

  // Featured Club
  featuredCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  featuredCoverWrap: {
    alignItems: 'center',
    marginBottom: 20,
  },
  featuredCover: {
    width: 180,
    height: 260,
    borderRadius: 12,
  },
  featuredMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  badge: {
    backgroundColor: '#C9894D',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  badgeText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 10,
    color: '#1a1008',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  memberAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: BOOKS_SURFACES.lift,
  },
  avatarCount: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: BOOKS_SURFACES.focus,
    borderWidth: 2,
    borderColor: BOOKS_SURFACES.lift,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCountText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 9,
    color: '#D6C3B5',
  },
  featuredName: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 26,
    color: '#E4E1E9',
    marginBottom: 8,
  },
  featuredDescription: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 15,
    color: '#D6C3B5',
    lineHeight: 22,
    marginBottom: 20,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: '#D6C3B5',
    fontSize: 11,
  },
  progressPct: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    color: '#D6C3B5',
  },
  discussionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
  },
  discussionText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 15,
    color: '#C9894D',
  },
  discussionArrow: {
    fontSize: 16,
    color: '#C9894D',
  },

  // Other Clubs Row
  clubRow: {
    marginHorizontal: 20,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  clubRowCover: {
    width: 60,
    height: 80,
    borderRadius: 8,
  },
  clubRowInfo: {
    flex: 1,
    gap: 2,
  },
  clubRowName: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 16,
    color: '#E4E1E9',
  },
  clubRowMembers: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    color: '#D6C3B5',
  },
  clubRowPage: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 11,
    color: '#9F8E81',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  clubRowStatus: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 11,
    color: '#C9894D',
    letterSpacing: 0.5,
    marginTop: 2,
  },

  // Empty / Explore Section
  emptySection: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 40,
    paddingBottom: 20,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: BOOKS_SURFACES.lift,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyIcon: {
    fontSize: 32,
  },
  emptyTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 20,
    color: '#E4E1E9',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyMessage: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: '#D6C3B5',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  explorePill: {
    borderWidth: 1,
    borderColor: '#C9894D',
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  explorePillText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 15,
    color: '#C9894D',
  },
});
