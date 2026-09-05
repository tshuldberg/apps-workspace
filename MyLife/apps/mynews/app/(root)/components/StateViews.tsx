import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { tokens } from '../theme/tokens';

export function LoadingView({ label }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={tokens.accent} />
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

export function MessageView({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.center}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.bg,
    padding: 32,
    gap: 8,
  },
  label: {
    color: tokens.textSecondary,
    fontSize: 14,
    marginTop: 12,
  },
  title: {
    color: tokens.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    color: tokens.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
});
