import {
  Alert,
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  Image,
  Text as RNText,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  GlassCard,
  GradientButton,
  ReadingProgressBar,
  JAKARTA_FONTS,
  BOOKS_SURFACES,
  BOOKS_TYPOGRAPHY,
} from '@mylife/books/ui';

const showClubPreview = () => {
  Alert.alert(
    'Preview only',
    'Club discussions and settings are a design preview. They are not yet wired in this build.',
  );
};

// ── Mock Data ──────────────────────────────────────────────

const MOCK_CLUBS: Record<string, ClubDetail> = {
  'club-1': {
    id: 'club-1',
    name: 'The Ink & Quill Society',
    description:
      'A curated circle for enthusiasts of dark academia, gothic literature, and high-fantasy world-building. We meet weekly to dissect the prose of the masters.',
    memberCount: 12,
    currentBook: {
      title: 'The Secret History',
      author: 'Donna Tartt',
      coverUrl: 'https://covers.openlibrary.org/b/id/8380268-L.jpg',
      started: 'OCT 12, 2023',
      deadline: 'NOV 15, 2023',
      averageProgress: 0.64,
    },
    members: [
      { name: 'Aria Vance', pace: 'PACE MAKER', progress: 0.91, avatar: 'https://i.pravatar.cc/40?img=5' },
      { name: 'Marcus Thorne', pace: 'ON TRACK', progress: 0.64, avatar: 'https://i.pravatar.cc/40?img=8' },
      { name: 'Elena Rossi', pace: 'ON TRACK', progress: 0.56, avatar: 'https://i.pravatar.cc/40?img=9' },
      { name: 'Julian Chen', pace: 'FALLING BEHIND', progress: 0.25, avatar: 'https://i.pravatar.cc/40?img=12' },
    ],
    discussionPrompts: [
      '"How does the setting of Hampden College parallel the ancient Greek tragedies?"',
      '"Is Julian Morrow a mentor or a manipulator? Discuss the power dynamic."',
    ],
    readingHistory: [
      { title: 'The Picture of Dorian Gray', coverUrl: 'https://covers.openlibrary.org/b/id/12818044-M.jpg', date: 'FINISHED SEP 2023' },
      { title: 'Fahrenheit 451', coverUrl: 'https://covers.openlibrary.org/b/id/9324286-M.jpg', date: 'FINISHED AUG 2023' },
      { title: 'Pride and Prejudice', coverUrl: 'https://covers.openlibrary.org/b/id/12645114-M.jpg', date: 'FINISHED JUL 2023' },
    ],
  },
};

interface ClubDetail {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  currentBook: {
    title: string;
    author: string;
    coverUrl: string;
    started: string;
    deadline: string;
    averageProgress: number;
  };
  members: { name: string; pace: string; progress: number; avatar: string }[];
  discussionPrompts: string[];
  readingHistory: { title: string; coverUrl: string; date: string }[];
}

// ── Helpers ────────────────────────────────────────────────

function ProgressRing({ progress, size = 56 }: { progress: number; size?: number }) {
  const pct = Math.round(progress * 100);
  return (
    <View style={[ringStyles.container, { width: size, height: size, borderRadius: size / 2 }]}>
      <View style={[ringStyles.track, { width: size, height: size, borderRadius: size / 2 }]}>
        <View style={[ringStyles.inner, { width: size - 8, height: size - 8, borderRadius: (size - 8) / 2 }]}>
          <RNText style={ringStyles.text}>{pct}%</RNText>
        </View>
      </View>
    </View>
  );
}

const ringStyles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  track: { borderWidth: 4, borderColor: '#C9894D', alignItems: 'center', justifyContent: 'center' },
  inner: { backgroundColor: BOOKS_SURFACES.lift, alignItems: 'center', justifyContent: 'center' },
  text: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 14, color: '#E4E1E9' },
});

// ── Screen ─────────────────────────────────────────────────

export default function ClubDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const club = MOCK_CLUBS[id ?? ''] ?? MOCK_CLUBS['club-1']!;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Badges */}
      <View style={styles.badgeRow}>
        <View style={styles.badgePill}>
          <RNText style={styles.badgePillText}>ACTIVE CLUB</RNText>
        </View>
        <View style={styles.memberPill}>
          <RNText style={styles.memberPillText}>{club.memberCount} MEMBERS</RNText>
        </View>
      </View>

      {/* Club Name + Description */}
      <RNText style={styles.clubName}>{club.name}</RNText>
      <RNText style={styles.clubDescription}>{club.description}</RNText>

      {/* Action Buttons */}
      <GradientButton
        label={'\uD83D\uDCAC  ENTER DISCUSSION'}
        onPress={showClubPreview}
        style={styles.discussionBtn}
      />
      <Pressable style={styles.settingsBtn} onPress={showClubPreview}>
        <RNText style={styles.settingsBtnText}>CLUB SETTINGS</RNText>
      </Pressable>

      {/* Currently Reading */}
      <GlassCard level={2} style={styles.currentBookCard}>
        <View style={styles.currentCoverWrap}>
          <Image
            source={{ uri: club.currentBook.coverUrl }}
            style={styles.currentCover}
            resizeMode="cover"
          />
        </View>

        <RNText style={styles.currentReadingLabel}>CURRENTLY READING</RNText>
        <RNText style={styles.currentBookTitle}>{club.currentBook.title}</RNText>
        <RNText style={styles.currentBookAuthor}>{club.currentBook.author}</RNText>

        <View style={styles.datesRow}>
          <View style={styles.dateCol}>
            <RNText style={styles.dateLabel}>STARTED</RNText>
            <RNText style={styles.dateValue}>{club.currentBook.started}</RNText>
          </View>
          <View style={styles.dateCol}>
            <RNText style={styles.dateLabel}>DEADLINE</RNText>
            <RNText style={styles.dateValue}>{club.currentBook.deadline}</RNText>
          </View>
        </View>

        <View style={styles.avgProgressRow}>
          <RNText style={styles.avgProgressLabel}>AVERAGE PROGRESS</RNText>
          <ProgressRing progress={club.currentBook.averageProgress} />
        </View>
      </GlassCard>

      {/* Management */}
      <View style={styles.sectionBlock}>
        <RNText style={styles.managementLabel}>MANAGEMENT</RNText>

        <Pressable style={styles.managementRow}>
          <RNText style={styles.managementIcon}>{'\u21BB'}</RNText>
          <RNText style={styles.managementText}>Change Current Book</RNText>
          <RNText style={styles.managementChevron}>{'\u203A'}</RNText>
        </Pressable>

        <Pressable style={styles.managementRow}>
          <RNText style={[styles.managementIcon, { color: '#FFB4AB' }]}>{'\u21A9'}</RNText>
          <RNText style={[styles.managementText, { color: '#FFB4AB' }]}>Leave Club</RNText>
        </Pressable>
      </View>

      {/* Discussion Prompts */}
      <GlassCard level={2} style={styles.promptsCard}>
        <View style={styles.promptsHeader}>
          <RNText style={styles.promptsTitle}>DISCUSSION PROMPTS</RNText>
          <Pressable>
            <RNText style={styles.promptsAdd}>+</RNText>
          </Pressable>
        </View>
        {club.discussionPrompts.map((prompt, i) => (
          <View key={i} style={styles.promptItem}>
            <View style={styles.promptQuoteLine} />
            <RNText style={styles.promptText}>{prompt}</RNText>
          </View>
        ))}
      </GlassCard>

      {/* Member Reading Pace */}
      <View style={styles.sectionBlock}>
        <View style={styles.paceHeader}>
          <RNText style={styles.paceTitle}>Member Reading{'\n'}Pace</RNText>
          <Pressable>
            <RNText style={styles.paceAction}>VIEW ALL{'\n'}ACTIVE</RNText>
          </Pressable>
        </View>

        {club.members.map((member) => (
          <View key={member.name} style={styles.memberRow}>
            <Image source={{ uri: member.avatar }} style={styles.memberAvatar} />
            <View style={styles.memberInfo}>
              <RNText style={styles.memberName}>{member.name}</RNText>
              <RNText style={styles.memberPace}>{member.pace}</RNText>
              <View style={styles.memberProgressRow}>
                <RNText style={styles.memberProgressLabel}>PROGRESS</RNText>
                <RNText style={styles.memberProgressPct}>
                  {Math.round(member.progress * 100)}%
                </RNText>
              </View>
              <ReadingProgressBar progress={member.progress} height={4} />
            </View>
          </View>
        ))}
      </View>

      {/* Reading History */}
      <View style={styles.sectionBlock}>
        <View style={styles.historyHeader}>
          <RNText style={styles.historyTitle}>Reading History</RNText>
          <RNText style={styles.historyAction}>COMPLETED ARCHIVE</RNText>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.historyScroll}
        >
          {club.readingHistory.map((book) => (
            <View key={book.title} style={styles.historyItem}>
              <Image
                source={{ uri: book.coverUrl }}
                style={styles.historyCover}
                resizeMode="cover"
              />
              <RNText style={styles.historyBookTitle} numberOfLines={2}>
                {book.title}
              </RNText>
              <RNText style={styles.historyDate}>{book.date}</RNText>
            </View>
          ))}
          <Pressable style={styles.historyViewMore}>
            <RNText style={styles.historyViewMoreText}>View More</RNText>
            <RNText style={styles.historyViewMoreSub}>+4 PREVIOUS BOOKS</RNText>
          </Pressable>
        </ScrollView>
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

  // Badges
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 16,
    marginBottom: 12,
  },
  badgePill: {
    backgroundColor: '#C9894D',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  badgePillText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 10,
    color: '#1a1008',
    letterSpacing: 0.5,
  },
  memberPill: {
    backgroundColor: BOOKS_SURFACES.focus,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  memberPillText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 10,
    color: '#D6C3B5',
    letterSpacing: 0.5,
  },

  // Club Name + Description
  clubName: {
    ...BOOKS_TYPOGRAPHY.displayLg,
    color: '#E4E1E9',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  clubDescription: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 15,
    color: '#D6C3B5',
    lineHeight: 24,
    paddingHorizontal: 20,
    marginBottom: 24,
  },

  // Action Buttons
  discussionBtn: {
    marginHorizontal: 20,
    marginBottom: 12,
  },
  settingsBtn: {
    marginHorizontal: 20,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  settingsBtnText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 14,
    color: '#E4E1E9',
    letterSpacing: 0.5,
  },

  // Currently Reading
  currentBookCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  currentCoverWrap: {
    marginBottom: 24,
  },
  currentCover: {
    width: 200,
    height: 290,
    borderRadius: 12,
  },
  currentReadingLabel: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: '#C9894D',
    marginBottom: 8,
  },
  currentBookTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 24,
    color: '#E4E1E9',
    textAlign: 'center',
    marginBottom: 4,
  },
  currentBookAuthor: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 16,
    color: '#C9894D',
    marginBottom: 20,
  },
  datesRow: {
    flexDirection: 'row',
    gap: 40,
    marginBottom: 20,
  },
  dateCol: {
    alignItems: 'center',
  },
  dateLabel: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: '#9F8E81',
    fontSize: 10,
    marginBottom: 4,
  },
  dateValue: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    color: '#E4E1E9',
  },
  avgProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'space-between',
  },
  avgProgressLabel: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: '#D6C3B5',
    fontSize: 11,
  },

  // Management
  sectionBlock: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  managementLabel: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: '#9F8E81',
    marginBottom: 16,
  },
  managementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  managementIcon: {
    fontSize: 18,
    color: '#C9894D',
  },
  managementText: {
    flex: 1,
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 15,
    color: '#E4E1E9',
  },
  managementChevron: {
    fontSize: 22,
    color: '#9F8E81',
  },

  // Discussion Prompts
  promptsCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    gap: 14,
  },
  promptsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  promptsTitle: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: '#9F8E81',
  },
  promptsAdd: {
    fontSize: 24,
    color: '#C9894D',
    fontWeight: '600',
  },
  promptItem: {
    flexDirection: 'row',
    gap: 12,
  },
  promptQuoteLine: {
    width: 3,
    borderRadius: 2,
    backgroundColor: '#C9894D',
  },
  promptText: {
    flex: 1,
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    fontStyle: 'italic',
    color: '#D6C3B5',
    lineHeight: 22,
  },

  // Member Reading Pace
  paceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  paceTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 24,
    color: '#E4E1E9',
    lineHeight: 30,
  },
  paceAction: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 12,
    color: '#C9894D',
    textAlign: 'right',
    lineHeight: 18,
  },
  memberRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 24,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginTop: 2,
  },
  memberInfo: {
    flex: 1,
    gap: 2,
  },
  memberName: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 15,
    color: '#E4E1E9',
  },
  memberPace: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 11,
    color: '#C9894D',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  memberProgressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  memberProgressLabel: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: '#9F8E81',
    fontSize: 10,
  },
  memberProgressPct: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 12,
    color: '#D6C3B5',
  },

  // Reading History
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  historyTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 24,
    color: '#C9894D',
  },
  historyAction: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 11,
    color: '#9F8E81',
    letterSpacing: 0.5,
  },
  historyScroll: {
    paddingLeft: 0,
    gap: 14,
    paddingRight: 20,
  },
  historyItem: {
    width: 120,
    gap: 6,
  },
  historyCover: {
    width: 120,
    height: 170,
    borderRadius: 10,
  },
  historyBookTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 13,
    color: '#E4E1E9',
  },
  historyDate: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 11,
    color: '#9F8E81',
  },
  historyViewMore: {
    width: 120,
    height: 170,
    borderRadius: 10,
    backgroundColor: BOOKS_SURFACES.lift,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  historyViewMoreText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: '#C9894D',
  },
  historyViewMoreSub: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 10,
    color: '#9F8E81',
    letterSpacing: 0.5,
  },
});
