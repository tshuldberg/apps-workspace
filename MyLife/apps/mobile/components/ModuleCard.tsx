import React, { memo, useState } from 'react';
import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { ModuleDefinition } from '@mylife/module-registry';
import { Card, Text, colors, spacing, borderRadius } from '@mylife/ui';
import { useModuleUnlocked } from './EntitlementsProvider';
import { PurchaseGate } from './PurchaseGate';

interface ModuleCardProps {
  module: ModuleDefinition;
}

/**
 * Grid card for a single module on the hub dashboard.
 * Shows emoji icon, name, tagline, and accent-colored left border.
 *
 * Premium modules show a lock overlay and "PRO" badge when not purchased.
 * Tapping a locked card shows the PurchaseGate modal.
 * Tapping an unlocked card navigates to the module's route group.
 */
function ModuleCardBase({ module }: ModuleCardProps) {
  const router = useRouter();
  const unlocked = useModuleUnlocked(module.id);
  const isPremium = module.tier === 'premium';
  const [showGate, setShowGate] = useState(false);

  const handlePress = () => {
    if (!unlocked) {
      setShowGate(true);
      return;
    }
    router.push(`/(${module.id})` as never);
  };

  return (
    <>
      <TouchableOpacity
        style={styles.wrapper}
        activeOpacity={0.7}
        onPress={handlePress}
        accessibilityLabel={`${module.name}, ${module.tagline}`}
        accessibilityHint={isPremium && !unlocked ? 'Premium module, requires subscription' : undefined}
      >
        <Card style={[styles.card, { borderLeftColor: module.accentColor }]}>
          <View style={styles.topRow}>
            <View style={styles.iconContainer}>
              <Text style={styles.icon}>{module.icon}</Text>
            </View>
            {isPremium && (
              <View style={[styles.proBadge, unlocked && { borderColor: module.accentColor }]}>
                <Text style={[styles.proBadgeText, unlocked && { color: module.accentColor }]}>
                  PRO
                </Text>
              </View>
            )}
          </View>
          <Text variant="subheading" style={styles.name}>
            {module.name}
          </Text>
          <Text variant="caption" color={colors.textSecondary} numberOfLines={2}>
            {module.tagline}
          </Text>
          {!unlocked && (
            <View style={styles.lockOverlay}>
              <Text style={styles.lockIcon}>{'\u{1F512}'}</Text>
            </View>
          )}
        </Card>
      </TouchableOpacity>

      <Modal
        visible={showGate}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowGate(false)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setShowGate(false)}
          >
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
          <PurchaseGate
            moduleId={module.id}
            moduleName={module.name}
            moduleIcon={module.icon}
            accentColor={module.accentColor}
            onPurchaseComplete={() => {
              setShowGate(false);
              router.push(`/(${module.id})` as never);
            }}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    padding: spacing.xs,
  },
  card: {
    borderLeftWidth: 3,
    borderRadius: borderRadius.lg,
    minHeight: 130,
    position: 'relative',
    overflow: 'hidden',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  iconContainer: {},
  icon: {
    fontSize: 32,
  },
  proBadge: {
    borderWidth: 1,
    borderColor: colors.textTertiary,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 1,
  },
  proBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 0.5,
  },
  name: {
    marginBottom: spacing.xs,
  },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(14, 12, 9, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
  },
  lockIcon: {
    fontSize: 28,
    opacity: 0.7,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: spacing.md,
  },
  closeText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});

/**
 * Memoized export — ModuleCard only re-renders when the module definition
 * changes or its specific unlock status changes (via useModuleUnlocked).
 */
export const ModuleCard = memo(ModuleCardBase);
