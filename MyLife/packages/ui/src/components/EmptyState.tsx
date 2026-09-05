import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { Button } from './Button';
import { colors } from '../tokens/colors';
import { spacing } from '../tokens/spacing';

interface EmptyStateProps {
  icon?: string;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  accentColor?: string;
}

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
  accentColor,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      {icon ? <Text style={styles.icon}>{icon}</Text> : null}
      <Text variant="subheading" color={colors.textSecondary}>
        {title}
      </Text>
      {message ? (
        <Text variant="body" color={colors.textTertiary} style={styles.message}>
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button
          variant="primary"
          label={actionLabel}
          onPress={onAction}
          style={accentColor ? { backgroundColor: accentColor } : undefined}
        />
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
    fontSize: 48,
    // Pair lineHeight with fontSize so emoji/glyph icons render without
    // ascender/descender clipping. Inheriting the default body variant's
    // lineHeight (26) caused 48pt emoji to render as severely clipped
    // doubled letterforms across every empty state in the app.
    lineHeight: 56,
    marginBottom: spacing.xs,
  },
  message: {
    textAlign: 'center',
    lineHeight: 20,
  },
});
