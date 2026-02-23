import React from 'react';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { Text, Card, colors, spacing } from '@mybooks/ui';

interface SettingsRowProps {
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
}

function SettingsRow({ label, value, onPress, danger }: SettingsRowProps) {
  return (
    <Pressable onPress={onPress} style={styles.row} disabled={!onPress}>
      <Text variant="body" color={danger ? colors.danger : colors.text}>
        {label}
      </Text>
      {value && (
        <Text variant="caption" color={colors.textSecondary}>
          {value}
        </Text>
      )}
    </Pressable>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="label" color={colors.textTertiary}>{title}</Text>
      <Card>{children}</Card>
    </View>
  );
}

export default function SettingsScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <SettingsSection title="Library">
        <SettingsRow label="Default shelf for new books" value="Want to Read" />
        <SettingsRow label="Cover image quality" value="Large" />
        <SettingsRow label="Default sort" value="Date Added" />
      </SettingsSection>

      <SettingsSection title="Goals">
        <SettingsRow label="2026 Reading Goal" value="30 books" />
        <SettingsRow label="Page goal" value="Not set" />
      </SettingsSection>

      <SettingsSection title="Import">
        <SettingsRow label="Import from Goodreads" onPress={() => {}} />
        <SettingsRow label="Import from StoryGraph" onPress={() => {}} />
      </SettingsSection>

      <SettingsSection title="Export">
        <SettingsRow label="Export library (CSV)" onPress={() => {}} />
        <SettingsRow label="Export library (JSON)" onPress={() => {}} />
        <SettingsRow label="Export library (Markdown)" onPress={() => {}} />
        <SettingsRow label="Export year-in-review image" onPress={() => {}} />
      </SettingsSection>

      <SettingsSection title="Appearance">
        <SettingsRow label="Theme" value="Dark Literary" />
        <SettingsRow label="Font size" value="Default" />
        <SettingsRow label="Cover grid size" value="Medium" />
      </SettingsSection>

      <SettingsSection title="Data">
        <SettingsRow label="Database size" value="2.4 MB" />
        <SettingsRow label="Cached covers" value="48.2 MB" />
        <SettingsRow label="Total books" value="62" />
        <SettingsRow label="Erase all data" danger onPress={() => {}} />
      </SettingsSection>

      <SettingsSection title="About">
        <SettingsRow label="Version" value="0.1.0" />
        <SettingsRow label="License" value="FSL-1.1-Apache-2.0" />
        <SettingsRow label="Source code" onPress={() => {}} />
        <SettingsRow label="Privacy" value="No data collected. Ever." />
        <SettingsRow label="Book data" value="Powered by Open Library" />
      </SettingsSection>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: spacing.xl,
  },
  section: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
