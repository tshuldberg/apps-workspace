import { Image, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { BOOKS_SURFACES } from './tokens';
import { JAKARTA_FONTS } from './typography';

export interface ActivityCardProps {
  avatarUrl?: string;
  userName: string;
  action: string;
  bookTitle?: string;
  timestamp: string;
  likes?: number;
  comments?: number;
  style?: ViewStyle;
}

export function ActivityCard({
  avatarUrl,
  userName,
  action,
  bookTitle,
  timestamp,
  likes,
  comments,
  style,
}: ActivityCardProps) {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.header}>
        {avatarUrl != null ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarInitial}>{userName.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.headerText}>
          <Text style={styles.actionText} numberOfLines={2}>
            <Text style={styles.userName}>{userName}</Text>
            {' '}{action}
            {bookTitle != null && <Text style={styles.bookTitle}>{` ${bookTitle}`}</Text>}
          </Text>
          <Text style={styles.timestamp}>{timestamp}</Text>
        </View>
      </View>

      {(likes != null || comments != null) && (
        <View style={styles.stats}>
          {likes != null && <Text style={styles.stat}>{`\u2661 ${likes}`}</Text>}
          {comments != null && <Text style={styles.stat}>{`\u{1F4AC} ${comments}`}</Text>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: BOOKS_SURFACES.lift,
    borderRadius: 16,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    backgroundColor: BOOKS_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 16,
    color: '#C9894D',
  },
  headerText: {
    flex: 1,
  },
  actionText: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: '#D6C3B5',
    lineHeight: 20,
  },
  userName: {
    fontFamily: JAKARTA_FONTS.semiBold,
    color: '#E4E1E9',
  },
  bookTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontStyle: 'italic',
    color: '#E4E1E9',
  },
  timestamp: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: 'rgba(228,225,233,0.35)',
    marginTop: 4,
  },
  stats: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
    paddingTop: 12,
    backgroundColor: BOOKS_SURFACES.lift,
  },
  stat: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    color: '#D6C3B5',
  },
});
