import { Alert, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, colors } from '@mylife/ui';
import {
  GlassCard,
  GradientButton,
  SectionHeader,
  JAKARTA_FONTS,
  BOOKS_SURFACES,
  BOOKS_TYPOGRAPHY,
} from '@mylife/books/ui';
import { icons } from 'lucide-react-native';

const BOOKS_ACCENT = colors.modules.books;
const BellIcon = icons.Bell;
const LockIcon = icons.Lock;
const HeartIcon = icons.Heart;
const MessageSquareIcon = icons.MessageSquare;

// ── Mock social feed data (Supabase-like schema, wired later) ──────────

interface FeedItem {
  id: string;
  type: 'rating' | 'finished' | 'goal' | 'review';
  userName: string;
  avatarUrl?: string;
  action: string;
  bookTitle?: string;
  rating?: number;
  coverUrl?: string;
  coverAuthor?: string;
  badgeTitle?: string;
  badgeSubtitle?: string;
  reviewText?: string;
  likes: number;
  comments: number;
  timestamp: string;
}

const MOCK_FEED: FeedItem[] = [
  {
    id: '1',
    type: 'rating',
    userName: 'Elena Rossi',
    avatarUrl: 'https://i.pravatar.cc/80?img=1',
    action: 'rated',
    bookTitle: 'The Shadow of the Wind',
    rating: 4,
    likes: 12,
    comments: 2,
    timestamp: '2h ago',
  },
  {
    id: '2',
    type: 'finished',
    userName: 'Marcus Chen',
    avatarUrl: 'https://i.pravatar.cc/80?img=3',
    action: 'finished reading',
    bookTitle: 'Slaughterhouse-Five',
    coverAuthor: 'Kurt Vonnegut',
    coverUrl: 'https://covers.openlibrary.org/b/id/8814606-M.jpg',
    likes: 24,
    comments: 0,
    timestamp: '5h ago',
  },
  {
    id: '3',
    type: 'goal',
    userName: 'Julian Vane',
    avatarUrl: 'https://i.pravatar.cc/80?img=5',
    action: 'completed a goal',
    badgeTitle: '2024 Reading Challenge',
    badgeSubtitle: '12 of 12 books read',
    likes: 41,
    comments: 0,
    timestamp: 'Yesterday',
  },
  {
    id: '4',
    type: 'review',
    userName: 'Sarah Bloom',
    avatarUrl: 'https://i.pravatar.cc/80?img=9',
    action: 'reviewed',
    bookTitle: 'Dune',
    reviewText:
      '"A masterpiece of world-building that feels more relevant today than ever. Herbert\'s prose is dense but incredibly rewarding..."',
    likes: 8,
    comments: 5,
    timestamp: 'Nov 12',
  },
];

// ── Components ──────────────────────────────────────────────────────────

function Avatar({ uri, name, size = 40 }: { uri?: string; name: string; size?: number }) {
  if (uri) {
    return <Image source={{ uri }} style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]} />;
  }
  return (
    <View style={[styles.avatar, styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarInitial, { fontSize: size * 0.4 }]}>{name.charAt(0)}</Text>
    </View>
  );
}

function StarRow({ count }: { count: number }) {
  return (
    <View style={styles.starRow}>
      {Array.from({ length: 5 }, (_, i) => (
        <Text key={i} style={[styles.star, i < count && styles.starFilled]}>
          {'\u2605'}
        </Text>
      ))}
    </View>
  );
}

function FeedCard({ item }: { item: FeedItem }) {
  return (
    <GlassCard level={2} style={styles.feedCard}>
      <View style={styles.feedHeader}>
        <Avatar uri={item.avatarUrl} name={item.userName} />
        <View style={styles.feedHeaderText}>
          <Text style={styles.feedAction} numberOfLines={2}>
            <Text style={styles.feedUserName}>{item.userName}</Text>
            {' '}{item.action}
            {item.bookTitle != null && item.type === 'rating' && (
              <>
                {'  '}
                <StarRow count={item.rating ?? 0} />
              </>
            )}
          </Text>
          {item.type === 'rating' && (
            <View style={styles.ratingRow}>
              <StarRow count={item.rating ?? 0} />
              <Text style={styles.ratingBookTitle}>{item.bookTitle}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Finished reading: book cover card */}
      {item.type === 'finished' && item.coverUrl && (
        <View style={styles.bookCoverCard}>
          <Image source={{ uri: item.coverUrl }} style={styles.bookCoverImage} />
          <View style={styles.bookCoverInfo}>
            <Text style={styles.bookCoverTitle}>{item.bookTitle}</Text>
            {item.coverAuthor && <Text style={styles.bookCoverAuthor}>{item.coverAuthor}</Text>}
          </View>
        </View>
      )}

      {/* Goal completed: badge card */}
      {item.type === 'goal' && (
        <GlassCard level={3} style={styles.badgeCard}>
          <View style={styles.badgeIcon}>
            <Text style={styles.badgeEmoji}>{'\uD83C\uDFC6'}</Text>
          </View>
          <View>
            <Text style={styles.badgeTitle}>{item.badgeTitle}</Text>
            <Text style={styles.badgeSubtitle}>{item.badgeSubtitle}</Text>
          </View>
        </GlassCard>
      )}

      {/* Review: quoted text */}
      {item.type === 'review' && item.reviewText && (
        <View style={styles.reviewBlock}>
          <Text style={styles.reviewQuoteMark}>{'\u201C\u201C'}</Text>
          <Text style={styles.reviewText}>{item.reviewText}</Text>
        </View>
      )}

      {/* Footer: likes, comments, timestamp */}
      <View style={styles.feedFooter}>
        <View style={styles.feedStats}>
          <View style={styles.feedStat}>
            <HeartIcon size={14} color="#D6C3B5" />
            <Text style={styles.feedStatText}>{item.likes}</Text>
          </View>
          {item.comments > 0 && (
            <View style={styles.feedStat}>
              <MessageSquareIcon size={14} color="#D6C3B5" />
              <Text style={styles.feedStatText}>{item.comments}</Text>
            </View>
          )}
        </View>
        <Text style={styles.feedTimestamp}>{item.timestamp}</Text>
      </View>
    </GlassCard>
  );
}

const showSocialComingSoon = () => {
  Alert.alert(
    'Preview only',
    'Social features are a design preview. Friend connections and feed activity are not yet wired in this build.',
  );
};

// ── Main Screen ─────────────────────────────────────────────────────────

export default function SocialScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoEmoji}>{'\uD83D\uDCDA'}</Text>
          </View>
          <Text style={styles.headerTitle}>MyBooks</Text>
        </View>
        <Pressable hitSlop={8} onPress={showSocialComingSoon}>
          <BellIcon size={22} color={colors.text} />
        </Pressable>
      </View>

      {/* Hero Card */}
      <GlassCard level={2} style={styles.heroCard}>
        <Text style={styles.heroTitle}>Connect with friends</Text>
        <Text style={styles.heroBody}>
          See what your circle is reading and find your next obsession together.
        </Text>
        <GradientButton
          label="Find Friends"
          onPress={showSocialComingSoon}
          style={styles.heroButton}
        />
      </GlassCard>

      {/* Recent Activity */}
      <SectionHeader
        label="RECENT ACTIVITY"
        title=""
        action={{ text: 'Add Friend', onPress: showSocialComingSoon }}
        style={styles.sectionHeader}
      />

      {MOCK_FEED.map((item) => (
        <FeedCard key={item.id} item={item} />
      ))}

      {/* Privacy Reminder */}
      <View style={styles.privacyCard}>
        <LockIcon size={18} color="#D6C3B5" />
        <Text style={styles.privacyLabel}>PRIVACY REMINDER</Text>
        <Text style={styles.privacyText}>
          Your reading progress and library visibility can be managed in Account Settings. Only friends can see your detailed activity.
        </Text>
      </View>
    </ScrollView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BOOKS_SURFACES.depth },
  content: { paddingBottom: 100 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BOOKS_ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoEmoji: { fontSize: 18 },
  headerTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 20,
    color: BOOKS_ACCENT,
  },

  // Hero
  heroCard: { marginHorizontal: 20, marginBottom: 24, padding: 24 },
  heroTitle: {
    ...BOOKS_TYPOGRAPHY.headlineMd,
    fontSize: 24,
    color: '#E4E1E9',
    marginBottom: 8,
  },
  heroBody: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 15,
    color: '#D6C3B5',
    lineHeight: 22,
    marginBottom: 20,
  },
  heroButton: { alignSelf: 'flex-start' },

  // Section
  sectionHeader: { marginBottom: 8 },

  // Feed cards
  feedCard: { marginHorizontal: 20, marginBottom: 12, padding: 16 },
  feedHeader: { flexDirection: 'row', gap: 12 },
  feedHeaderText: { flex: 1 },
  feedAction: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: '#D6C3B5',
    lineHeight: 20,
  },
  feedUserName: {
    fontFamily: JAKARTA_FONTS.semiBold,
    color: '#E4E1E9',
  },

  // Rating row
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  starRow: { flexDirection: 'row', gap: 2 },
  star: { fontSize: 14, color: 'rgba(255,255,255,0.2)' },
  starFilled: { color: BOOKS_ACCENT },
  ratingBookTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 14,
    color: BOOKS_ACCENT,
    flex: 1,
  },

  // Book cover card (finished reading)
  bookCoverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: BOOKS_SURFACES.focus,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  bookCoverImage: { width: 44, height: 64, borderRadius: 4 },
  bookCoverInfo: { flex: 1 },
  bookCoverTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 14,
    color: '#E4E1E9',
  },
  bookCoverAuthor: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: '#D6C3B5',
    marginTop: 2,
  },

  // Badge card (goal completed)
  badgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    padding: 14,
  },
  badgeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BOOKS_ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeEmoji: { fontSize: 18 },
  badgeTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 14,
    color: '#E4E1E9',
  },
  badgeSubtitle: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: BOOKS_ACCENT,
    marginTop: 2,
  },

  // Review block
  reviewBlock: { marginTop: 12, paddingLeft: 4 },
  reviewQuoteMark: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 28,
    color: BOOKS_ACCENT,
    lineHeight: 28,
    marginBottom: -4,
  },
  reviewText: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    fontStyle: 'italic',
    color: '#D6C3B5',
    lineHeight: 22,
  },

  // Feed footer
  feedFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
  },
  feedStats: { flexDirection: 'row', gap: 14 },
  feedStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  feedStatText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    color: '#D6C3B5',
  },
  feedTimestamp: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: 'rgba(228,225,233,0.35)',
  },

  // Avatar
  avatar: {},
  avatarFallback: {
    backgroundColor: BOOKS_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: JAKARTA_FONTS.semiBold,
    color: BOOKS_ACCENT,
  },

  // Privacy reminder
  privacyCard: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 24,
    marginTop: 12,
    gap: 8,
  },
  privacyLabel: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: '#D6C3B5',
  },
  privacyText: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    color: 'rgba(228,225,233,0.5)',
    textAlign: 'center',
    lineHeight: 20,
  },
});
