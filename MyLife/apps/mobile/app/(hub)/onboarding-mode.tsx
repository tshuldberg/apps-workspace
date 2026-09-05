import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Text, colors, spacing, borderRadius } from '@mylife/ui';
import type { HubPlanMode } from '@mylife/db';
import { incrementAggregateEventCounter } from '@mylife/db';
import { getSecurityPreference, upsertSecurityPreference } from '@mylife/sync';
import { useDatabase } from '../../components/DatabaseProvider';
import { saveModeConfig } from '../../lib/entitlements';

const DISAPPEAR_OPTIONS = [
  { label: '24h', seconds: 24 * 60 * 60 },
  { label: '7d', seconds: 7 * 24 * 60 * 60 },
  { label: '30d', seconds: 30 * 24 * 60 * 60 },
] as const;
const DEFAULT_DISAPPEAR_SECONDS = 7 * 24 * 60 * 60;

export default function OnboardingModeScreen() {
  const router = useRouter();
  const db = useDatabase();
  const [selfHostUrl, setSelfHostUrl] = useState('');
  const [encryptEverywhere, setEncryptEverywhere] = useState(false);
  const [disappearingMessagesEnabled, setDisappearingMessagesEnabled] = useState(false);
  const [disappearAfterSeconds, setDisappearAfterSeconds] = useState<number>(
    DEFAULT_DISAPPEAR_SECONDS,
  );

  useEffect(() => {
    const pref = getSecurityPreference(db, 'default', 'default');
    if (!pref) return;
    setEncryptEverywhere(pref.encryptionMode === 'required');
    setDisappearingMessagesEnabled(pref.disappearingMessagesEnabled);
    if (pref.disappearAfterSeconds) {
      setDisappearAfterSeconds(pref.disappearAfterSeconds);
    }
  }, [db]);

  const saveSecurityDefaults = () => {
    const now = new Date().toISOString();
    upsertSecurityPreference(db, {
      subjectType: 'default',
      subjectId: 'default',
      encryptionMode: encryptEverywhere ? 'required' : 'opportunistic',
      disappearingMessagesEnabled,
      disappearAfterSeconds: disappearingMessagesEnabled ? disappearAfterSeconds : null,
      updatedAt: now,
    });
    upsertSecurityPreference(db, {
      subjectType: 'direct',
      subjectId: 'default',
      encryptionMode: encryptEverywhere ? 'required' : 'opportunistic',
      disappearingMessagesEnabled,
      disappearAfterSeconds: disappearingMessagesEnabled ? disappearAfterSeconds : null,
      updatedAt: now,
    });
  };

  const chooseMode = (mode: HubPlanMode) => {
    saveSecurityDefaults();
    const serverUrl = mode === 'self_host' ? selfHostUrl || null : null;
    saveModeConfig(db, mode, serverUrl);
    incrementAggregateEventCounter(db, `mode_selected:${mode}`);
    router.replace('/(hub)/settings');
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text variant="heading">Choose Your Mode</Text>
      <Text variant="body" color={colors.textSecondary}>
        You can change this later in Settings.
      </Text>

      <Card style={styles.card}>
        <Text variant="subheading">Security Defaults</Text>
        <View style={styles.settingRow}>
          <View style={styles.settingCopy}>
            <Text variant="body">Require encryption</Text>
            <Text variant="caption" color={colors.textSecondary}>Both sides must confirm.</Text>
          </View>
          <Switch
            value={encryptEverywhere}
            onValueChange={setEncryptEverywhere}
            trackColor={{ false: colors.glassStrong, true: colors.accent }}
            thumbColor={colors.text}
          />
        </View>
        <View style={styles.settingRow}>
          <View style={styles.settingCopy}>
            <Text variant="body">Disappearing messages</Text>
            <Text variant="caption" color={colors.textSecondary}>Confirmed by both sides.</Text>
          </View>
          <Switch
            value={disappearingMessagesEnabled}
            onValueChange={setDisappearingMessagesEnabled}
            trackColor={{ false: colors.glassStrong, true: colors.accent }}
            thumbColor={colors.text}
          />
        </View>
        {disappearingMessagesEnabled ? (
          <View style={styles.optionRow}>
            {DISAPPEAR_OPTIONS.map((option) => {
              const active = option.seconds === disappearAfterSeconds;
              return (
                <Pressable
                  key={option.seconds}
                  style={[styles.optionChip, active && styles.optionChipActive]}
                  onPress={() => setDisappearAfterSeconds(option.seconds)}
                >
                  <Text variant="label" color={active ? colors.text : colors.textSecondary}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </Card>

      <Card style={styles.card}>
        <Text variant="subheading">Hosted</Text>
        <Text variant="caption" color={colors.textSecondary}>Use MyLife managed servers.</Text>
        <Pressable style={styles.button} onPress={() => chooseMode('hosted')}>
          <Text variant="label">Use Hosted</Text>
        </Pressable>
      </Card>

      <Card style={styles.card}>
        <Text variant="subheading">Self-Host</Text>
        <Text variant="caption" color={colors.textSecondary}>Connect to your own endpoint.</Text>
        <TextInput
          value={selfHostUrl}
          onChangeText={setSelfHostUrl}
          autoCapitalize="none"
          placeholder="https://home.example.com"
          placeholderTextColor={colors.textTertiary}
          style={styles.input}
        />
        <Pressable style={styles.button} onPress={() => chooseMode('self_host')}>
          <Text variant="label">Use Self-Host</Text>
        </Pressable>
      </Card>

      <Card style={styles.card}>
        <Text variant="subheading">Local-Only</Text>
        <Text variant="caption" color={colors.textSecondary}>Keep data only on this device.</Text>
        <Pressable style={styles.button} onPress={() => chooseMode('local_only')}>
          <Text variant="label">Use Local-Only</Text>
        </Pressable>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.md,
    gap: spacing.md,
  },
  card: {
    gap: spacing.sm,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  settingCopy: {
    flex: 1,
    gap: 2,
  },
  optionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  optionChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  optionChipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.glassStrong,
  },
  input: {
    backgroundColor: colors.surfaceElevated,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  button: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
