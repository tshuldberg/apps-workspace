'use client';

import { useCallback } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import type { AuthMode } from '@mylife/auth/types';
import { Text } from './Text';
import { Card } from './Card';
import { colors } from '../tokens/colors';
import { spacing } from '../tokens/spacing';

interface ModuleOption {
  id: string;
  name: string;
  icon: string;
  requiresNetwork: boolean;
}

interface ModuleAuthPickerProps {
  modules: ModuleOption[];
  selections: Record<string, AuthMode>;
  onToggle: (moduleId: string, mode: AuthMode) => void;
}

export function ModuleAuthPicker({
  modules,
  selections,
  onToggle,
}: ModuleAuthPickerProps) {
  return (
    <Card style={styles.card}>
      <Text variant="subheading" style={styles.heading}>
        Module privacy settings
      </Text>
      <Text variant="body" color={colors.textSecondary} style={styles.body}>
        Choose which modules stay fully local and which connect to the cloud.
      </Text>
      <View style={styles.list}>
        {modules.map((mod) => (
          <ModuleRow
            key={mod.id}
            module={mod}
            mode={selections[mod.id] ?? 'local'}
            onToggle={onToggle}
          />
        ))}
      </View>
    </Card>
  );
}

function ModuleRow({
  module,
  mode,
  onToggle,
}: {
  module: ModuleOption;
  mode: AuthMode;
  onToggle: (moduleId: string, mode: AuthMode) => void;
}) {
  const isCloud = mode === 'cloud';

  const handlePress = useCallback(() => {
    onToggle(module.id, isCloud ? 'local' : 'cloud');
  }, [module.id, isCloud, onToggle]);

  return (
    <View style={styles.row}>
      <View style={styles.rowInfo}>
        <Text variant="body" style={styles.icon}>
          {module.icon}
        </Text>
        <View style={styles.rowText}>
          <Text variant="body">{module.name}</Text>
          {module.requiresNetwork ? (
            <Text variant="caption" color={colors.textTertiary}>
              Cloud recommended for full features
            </Text>
          ) : null}
        </View>
      </View>
      <Pressable onPress={handlePress} style={styles.toggle} hitSlop={8}>
        <View
          style={[
            styles.toggleTrack,
            isCloud ? styles.toggleTrackCloud : styles.toggleTrackLocal,
          ]}
        >
          <View
            style={[
              styles.toggleThumb,
              isCloud ? styles.toggleThumbCloud : styles.toggleThumbLocal,
            ]}
          />
        </View>
        <Text
          variant="caption"
          color={isCloud ? colors.success : colors.textTertiary}
          style={styles.toggleLabel}
        >
          {isCloud ? 'Cloud' : 'Local'}
        </Text>
      </Pressable>
    </View>
  );
}

const TRACK_WIDTH = 40;
const TRACK_HEIGHT = 22;
const THUMB_SIZE = 18;
const THUMB_OFFSET = 2;

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  heading: {
    marginBottom: spacing.xs,
  },
  body: {
    marginBottom: spacing.xs,
  },
  list: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  icon: {
    fontSize: 24,
    width: 32,
    textAlign: 'center',
  },
  toggle: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  toggleTrack: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    justifyContent: 'center',
    paddingHorizontal: THUMB_OFFSET,
  },
  toggleTrackLocal: {
    backgroundColor: colors.surfaceElevated,
  },
  toggleTrackCloud: {
    backgroundColor: colors.success,
  },
  toggleThumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: colors.text,
  },
  toggleThumbLocal: {
    alignSelf: 'flex-start',
  },
  toggleThumbCloud: {
    alignSelf: 'flex-end',
  },
  toggleLabel: {
    textAlign: 'center',
  },
});