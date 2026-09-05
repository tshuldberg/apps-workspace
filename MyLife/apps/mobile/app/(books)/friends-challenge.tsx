import { Alert, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, colors } from '@mylife/ui';

const showInvitePreview = () => {
  Alert.alert(
    'Preview only',
    'Friend challenges are a design preview. Inviting friends is not yet wired in this build.',
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
import { icons } from 'lucide-react-native';

const BOOKS_ACCENT = colors.modules.books;
const BellIcon = icons.Bell;
const UserPlusIcon = icons.UserPlus;
const TrendingUpIcon = icons.TrendingUp;
const TrophyIcon = icons.Trophy;
const AwardIcon = icons.Award;

// ── Mock challenge data ─────────────────────────────────────────────────

interface LeaderboardEntry {
  rank: number;
  name: string;
  avatarUrl?: string;
  tag: string;
  pages: number;
  note: string;
  isYou?: boolean;
}

const LEADERBOARD: LeaderboardEntry[] = [
  {
    rank: 1,
    name: 'Julian V.',
    avatarUrl: 'https://i.pravatar.cc/80?img=5',
    tag: 'CURRENT CHAMP',
    pages: 884,
    note: 'Winning streak: 3',
  },
  {
    rank: 2,
    name: 'You',
    avatarUrl: 'https://i.pravatar.cc/80?img=12',
    tag: 'RISING FAST',
    pages: 842,
    note: 'Trailing by 42',
    isYou: true,
  },
  {
    rank: 3,
    name: 'Sarah K.',
    avatarUrl: 'https://i.pravatar.cc/80?img=9',
    tag: 'CONSISTENT',
    pages: 710,
    note: '-174 from top',
  },
  {
    rank: 4,
    name: 'Marcus L.',
    avatarUrl: 'https://i.pravatar.cc/80?img=3',
    tag: 'STEADY PACE',
    pages: 655,
    note: '-229 from top',
  },
];

// ── Components ──────────────────────────────────────────────────────────

function Avatar({ uri, name, size = 40 }: { uri?: string; name: string; size?: number }) {
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarInitial, { fontSize: size * 0.4 }]}>{name.charAt(0)}</Text>
    </View>
  );
}

// ── Main Screen ─────────────────────────────────────────────────────────

export default function FriendsChallengeScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Avatar uri="https://i.pravatar.cc/80?img=12" name="You" size={36} />
          <Text style={styles.headerTitle}>MyBooks</Text>
        </View>
        <Pressable hitSlop={8} onPress={showInvitePreview}>
          <BellIcon size={22} color={colors.text} />
        </Pressable>
      </View>

      {/* Active Challenge Badge + Days Remaining */}
      <View style={styles.challengeMeta}>
        <View style={styles.activeBadge}>
          <Text style={styles.activeBadgeText}>ACTIVE CHALLENGE</Text>
        </View>
        <Text style={styles.daysRemaining}>4 Days Remaining</Text>
      </View>

      {/* Challenge Title */}
      <Text style={styles.challengeTitle}>The Winter Marathon</Text>
      <Text style={styles.challengeSubtitle}>
        Reach 1,500 pages before the weekend.{'\n'}You're currently neck-and-neck with Julian.
      </Text>

      {/* Your Progress Card */}
      <GlassCard level={2} style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>YOUR PROGRESS</Text>
          <View style={styles.trendBubble}>
            <TrendingUpIcon size={18} color="#1a1008" />
          </View>
        </View>
        <View style={styles.progressNumbers}>
          <Text style={styles.progressBig}>842</Text>
          <Text style={styles.progressTotal}> / 1500 pg</Text>
        </View>
        <ReadingProgressBar progress={842 / 1500} height={6} />
        <View style={styles.progressFooter}>
          <Text style={styles.progressPct}>56% Completed</Text>
          <Text style={styles.progressToday}>+120 today</Text>
        </View>
      </GlassCard>

      {/* Opponent Card */}
      <GlassCard level={2} style={styles.opponentCard}>
        <View style={styles.opponentHeader}>
          <Avatar uri="https://i.pravatar.cc/80?img=5" name="Julian" size={28} />
          <Text style={styles.opponentLabel}>JULIAN LEADS BY 42 PG</Text>
          <TrophyIcon size={16} color={BOOKS_ACCENT} />
        </View>
        <View style={styles.progressNumbers}>
          <Avatar uri="https://i.pravatar.cc/80?img=5" name="Julian" size={32} />
          <View style={{ marginLeft: 8 }}>
            <View style={styles.opponentRow}>
              <Text style={styles.opponentBig}>884</Text>
              <Text style={styles.progressTotal}> / 1500 pg</Text>
            </View>
          </View>
        </View>
        <ReadingProgressBar progress={884 / 1500} height={6} />
        <View style={styles.progressFooter}>
          <Text style={styles.progressPct}>59% Completed</Text>
          <Text style={styles.opponentPace}>Beating your pace</Text>
        </View>
      </GlassCard>

      {/* Circle Leaderboard */}
      <View style={styles.leaderboardHeader}>
        <Text style={styles.leaderboardTitle}>The Circle Leaderboard</Text>
        <Pressable hitSlop={8} onPress={showInvitePreview}>
          <Text style={styles.viewFullRank}>VIEW FULL RANK</Text>
        </Pressable>
      </View>

      {LEADERBOARD.map((entry) => (
        <View
          key={entry.rank}
          style={[styles.leaderRow, entry.isYou && styles.leaderRowYou]}
        >
          <Text style={[styles.leaderRank, entry.isYou && styles.leaderRankYou]}>
            {String(entry.rank).padStart(2, '0')}
          </Text>
          <Avatar uri={entry.avatarUrl} name={entry.name} size={36} />
          <View style={styles.leaderInfo}>
            <Text style={styles.leaderName}>{entry.name}</Text>
            <Text style={styles.leaderTag}>{entry.tag}</Text>
          </View>
          <View style={styles.leaderStats}>
            <Text style={styles.leaderPages}>{entry.pages} pg</Text>
            <Text style={styles.leaderNote}>{entry.note}</Text>
          </View>
        </View>
      ))}

      {/* Expand The Circle */}
      <GlassCard level={1} style={styles.inviteCard}>
        <View style={styles.inviteIconCircle}>
          <UserPlusIcon size={24} color={BOOKS_ACCENT} />
        </View>
        <Text style={styles.inviteTitle}>Expand The Circle</Text>
        <Text style={styles.inviteBody}>
          Reading is better with competition. Invite new friends to this challenge.
        </Text>
        <GradientButton
          label="Invite Friends  \u27A4"
          onPress={showInvitePreview}
          style={styles.inviteButton}
        />
      </GlassCard>

      {/* Challenge Reward */}
      <GlassCard level={1} style={styles.rewardCard}>
        <Text style={styles.rewardLabel}>CHALLENGE REWARD</Text>
        <View style={styles.rewardRow}>
          <View style={styles.rewardIconCircle}>
            <AwardIcon size={20} color={BOOKS_ACCENT} />
          </View>
          <View>
            <Text style={styles.rewardTitle}>Winter Curator Badge</Text>
            <Text style={styles.rewardXp}>+500 CURATOR XP</Text>
          </View>
        </View>
      </GlassCard>
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
    paddingBottom: 8,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 20,
    color: BOOKS_ACCENT,
  },

  // Challenge meta
  challengeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 8,
  },
  activeBadge: {
    backgroundColor: BOOKS_ACCENT,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  activeBadgeText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 11,
    color: '#1a1008',
    letterSpacing: 0.5,
  },
  daysRemaining: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: '#D6C3B5',
  },

  // Challenge title
  challengeTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 30,
    color: '#E4E1E9',
    paddingHorizontal: 20,
    lineHeight: 36,
    marginBottom: 6,
  },
  challengeSubtitle: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 15,
    color: '#D6C3B5',
    lineHeight: 22,
    paddingHorizontal: 20,
    marginBottom: 20,
  },

  // Progress card
  progressCard: { marginHorizontal: 20, marginBottom: 12, padding: 20 },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: '#D6C3B5',
  },
  trendBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BOOKS_ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressNumbers: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 12 },
  progressBig: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 40,
    color: '#E4E1E9',
    lineHeight: 48,
  },
  progressTotal: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 16,
    color: '#D6C3B5',
  },
  progressFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  progressPct: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    color: '#D6C3B5',
  },
  progressToday: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    color: '#8BCFF0',
  },

  // Opponent card
  opponentCard: { marginHorizontal: 20, marginBottom: 24, padding: 20 },
  opponentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  opponentLabel: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: '#D6C3B5',
    flex: 1,
  },
  opponentRow: { flexDirection: 'row', alignItems: 'baseline' },
  opponentBig: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 34,
    color: '#E4E1E9',
    lineHeight: 42,
  },
  opponentPace: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    color: BOOKS_ACCENT,
  },

  // Leaderboard
  leaderboardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  leaderboardTitle: {
    ...BOOKS_TYPOGRAPHY.headlineMd,
    color: '#E4E1E9',
  },
  viewFullRank: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    color: BOOKS_ACCENT,
    letterSpacing: 0.3,
  },

  // Leaderboard rows
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  leaderRowYou: {
    backgroundColor: BOOKS_SURFACES.lift,
    borderRadius: 16,
    marginHorizontal: 12,
    paddingHorizontal: 16,
  },
  leaderRank: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 16,
    color: BOOKS_ACCENT,
    width: 28,
  },
  leaderRankYou: { color: BOOKS_ACCENT },
  leaderInfo: { flex: 1 },
  leaderName: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 15,
    color: '#E4E1E9',
  },
  leaderTag: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 11,
    color: '#D6C3B5',
    letterSpacing: 0.3,
    marginTop: 2,
  },
  leaderStats: { alignItems: 'flex-end' },
  leaderPages: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 16,
    color: '#E4E1E9',
  },
  leaderNote: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: 'rgba(228,225,233,0.4)',
    marginTop: 2,
  },

  // Invite card
  inviteCard: {
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 16,
    padding: 24,
    alignItems: 'center',
  },
  inviteIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: BOOKS_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  inviteTitle: {
    ...BOOKS_TYPOGRAPHY.headlineMd,
    color: '#E4E1E9',
    marginBottom: 8,
  },
  inviteBody: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: '#D6C3B5',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
  },
  inviteButton: { width: '100%' },

  // Reward card
  rewardCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 20,
  },
  rewardLabel: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: '#D6C3B5',
    marginBottom: 12,
  },
  rewardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rewardIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: BOOKS_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 16,
    color: '#E4E1E9',
  },
  rewardXp: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: BOOKS_ACCENT,
    fontSize: 11,
    marginTop: 2,
  },

  // Avatar fallback
  avatarFallback: {
    backgroundColor: BOOKS_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: JAKARTA_FONTS.semiBold,
    color: BOOKS_ACCENT,
  },
});
