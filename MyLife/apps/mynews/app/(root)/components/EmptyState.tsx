import { StyleSheet, Text, View } from 'react-native';
import { tokens } from '../theme/tokens';

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.bg,
    padding: 32,
  },
  title: {
    color: tokens.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  body: {
    color: tokens.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
});
