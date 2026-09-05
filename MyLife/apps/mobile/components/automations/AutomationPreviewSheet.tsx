/**
 * Shared bottom sheet for automation rule previews.
 *
 * Any rule shipped through @mylife/automations produces a preview card via
 * rule.previewCard(previewState); this sheet renders that card and exposes
 * Apply / Dismiss callbacks. The parent screen owns the side effects —
 * this component is purely presentational so it can be reused by every
 * future rule.
 */
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text, colors, spacing, surfaceTiers } from '@mylife/ui';
import type { AutomationRule } from '@mylife/automations';

export interface AutomationPreviewSheetProps {
  rule: AutomationRule | null;
  previewState: unknown;
  visible: boolean;
  onApply(): void;
  onDismiss(): void;
}

export function AutomationPreviewSheet({
  rule,
  previewState,
  visible,
  onApply,
  onDismiss,
}: AutomationPreviewSheetProps) {
  if (!rule || previewState == null) return null;

  const card = rule.previewCard(previewState);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title}>{card.title}</Text>
          <Text style={styles.subtitle}>{card.subtitle}</Text>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              style={[styles.button, styles.dismissButton]}
              onPress={onDismiss}
            >
              <Text style={styles.dismissLabel}>{card.cta.dismiss}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={[styles.button, styles.applyButton]}
              onPress={onApply}
            >
              <Text style={styles.applyLabel}>{card.cta.apply}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: surfaceTiers.high,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textSecondary,
    opacity: 0.4,
    marginBottom: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissButton: {
    backgroundColor: surfaceTiers.highest,
  },
  applyButton: {
    backgroundColor: colors.hubAccent,
  },
  dismissLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  applyLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
});
