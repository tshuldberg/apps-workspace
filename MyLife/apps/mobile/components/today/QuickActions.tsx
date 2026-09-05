import React, { useCallback, useRef } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { QuickAction } from '@mylife/module-registry';
import { Text, colors, glassBorders, glassFills, spacing } from '@mylife/ui';

export interface QuickActionsProps {
  actions: readonly QuickAction[];
}

/**
 * Horizontal row of 3-5 cluster-derived CTAs. Each button routes to the
 * module's "new" screen via `router.push`. When no actions are provided the
 * whole row renders nothing so the parent never has to conditionally hide it.
 */
export function QuickActions({ actions }: QuickActionsProps) {
  if (actions.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.label}>QUICK</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {actions.map((action) => (
          <QuickActionButton key={action.route} action={action} />
        ))}
      </ScrollView>
    </View>
  );
}

function QuickActionButton({ action }: { action: QuickAction }) {
  const router = useRouter();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scale, { toValue: 0.94, useNativeDriver: true }).start();
  }, [scale]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
  }, [scale]);

  const handlePress = useCallback(() => {
    router.push(action.route as never);
  }, [action.route, router]);

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={action.label}
    >
      <Animated.View style={[styles.button, { transform: [{ scale }] }]}>
        <Text style={styles.buttonLabel}>{action.label}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  row: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingRight: spacing.md,
  },
  button: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: glassFills.subtle,
    borderWidth: 1,
    borderColor: glassBorders.subtle,
  },
  buttonLabel: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
