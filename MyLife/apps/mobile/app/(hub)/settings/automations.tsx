/**
 * Settings → Automations.
 *
 * Lists every automation rule registered in the @mylife/automations registry
 * and lets the user flip each one on/off. The flag is persisted in the
 * hub_automation_rules table; module code reads readRuleEnabled() before
 * firing the preview sheet.
 *
 * Phase 5-core ships a single rule (receipt-to-budget); any future rule that
 * calls registerRule() in apps/mobile/lib/automations-setup.ts will appear
 * here automatically — no change to this screen required.
 */
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Text, colors, spacing, surfaceTiers } from '@mylife/ui';
import { listRules } from '@mylife/automations';
import { useDatabase } from '../../../components/DatabaseProvider';
import {
  readRuleEnabled,
  setRuleEnabled,
} from '../../../lib/automation-settings';

export default function AutomationsSettingsScreen() {
  const db = useDatabase();
  const rules = listRules();
  const [enabledMap, setEnabledMap] = useState<Record<string, boolean>>({});

  const refresh = useCallback(() => {
    const next: Record<string, boolean> = {};
    for (const rule of rules) {
      next[rule.id] = readRuleEnabled(db, rule.id);
    }
    setEnabledMap(next);
  }, [db, rules]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleToggle = useCallback(
    (ruleId: string, value: boolean) => {
      setRuleEnabled(db, ruleId, value);
      setEnabledMap((current) => ({ ...current, [ruleId]: value }));
    },
    [db],
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Automations</Text>
        <Text style={styles.subtitle}>
          Small, explicit shortcuts between modules. Every automation asks for
          confirmation before it runs — nothing happens in the background.
        </Text>
      </View>

      {rules.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.emptyTitle}>No automations yet</Text>
          <Text style={styles.emptyBody}>
            As more rules ship, they will appear here ready to enable.
          </Text>
        </View>
      ) : null}

      {rules.map((rule) => {
        const enabled = enabledMap[rule.id] ?? false;
        return (
          <View
            key={rule.id}
            style={styles.card}
            accessibilityLabel={`automation-row-${rule.id}`}
          >
            <View style={styles.row}>
              <View style={styles.copy}>
                <Text style={styles.ruleTitle}>{rule.label}</Text>
                <Text style={styles.ruleDescription}>{rule.description}</Text>
              </View>
              <Switch
                value={enabled}
                onValueChange={(value) => handleToggle(rule.id, value)}
                trackColor={{
                  false: surfaceTiers.highest,
                  true: colors.hubAccent,
                }}
                thumbColor={colors.text}
                accessibilityLabel={`toggle-${rule.id}`}
              />
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    backgroundColor: surfaceTiers.high,
    borderRadius: 16,
    padding: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  copy: {
    flex: 1,
    gap: spacing.xs,
  },
  ruleTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  ruleDescription: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  emptyBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
});
