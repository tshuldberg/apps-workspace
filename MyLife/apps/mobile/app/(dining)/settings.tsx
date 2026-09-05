import { StyleSheet, View, Pressable } from 'react-native';
import { Text } from '@mylife/ui';
import { useRouter } from 'expo-router';

export default function DiningSettingsScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.icon}>{'\u2699\uFE0F'}</Text>
        <Text style={styles.heading}>Settings</Text>
        <Text style={styles.subtext}>
          Theme, EXIF stripping, calendar sync, and more coming soon.
        </Text>
      </View>

      <Pressable
        onPress={() => router.push('/(dining)/year-review')}
        style={styles.yearReviewButton}
      >
        <Text style={styles.yearReviewIcon}>{'\uD83C\uDF1F'}</Text>
        <View style={styles.yearReviewTextWrap}>
          <Text style={styles.yearReviewTitle}>Year in Review</Text>
          <Text style={styles.yearReviewSub}>See your dining highlights for the year</Text>
        </View>
        <Text style={styles.yearReviewChevron}>{'>'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#0E0E13',
    gap: 20,
  },
  card: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 12,
    maxWidth: 340,
    width: '100%',
  },
  icon: {
    fontSize: 48,
    marginBottom: 4,
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
    color: '#E4E1E9',
    textAlign: 'center',
  },
  subtext: {
    fontSize: 14,
    color: '#D6C3B5',
    textAlign: 'center',
    lineHeight: 20,
  },
  yearReviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(220,38,38,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.25)',
    gap: 12,
    maxWidth: 340,
    width: '100%',
  },
  yearReviewIcon: {
    fontSize: 28,
  },
  yearReviewTextWrap: {
    flex: 1,
    gap: 2,
  },
  yearReviewTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E4E1E9',
  },
  yearReviewSub: {
    fontSize: 13,
    color: '#D6C3B5',
  },
  yearReviewChevron: {
    fontSize: 18,
    fontWeight: '700',
    color: '#DC2626',
  },
});
