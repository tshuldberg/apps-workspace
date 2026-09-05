import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { Button } from './Button';
import { colors } from '../tokens/colors';
import { spacing } from '../tokens/spacing';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  message = 'Something went wrong',
  onRetry,
}: ErrorStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{'⚠️'}</Text>
      <Text variant="subheading" color={colors.danger}>
        {message}
      </Text>
      {onRetry ? (
        <Button variant="secondary" label="Try Again" onPress={onRetry} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  icon: {
    fontSize: 40,
    // Pair lineHeight with fontSize so emoji icons render without clipping;
    // inheriting body variant's smaller lineHeight clips ascenders/descenders.
    lineHeight: 48,
    marginBottom: spacing.xs,
  },
});
