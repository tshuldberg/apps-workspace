import { useCallback, useMemo, useState } from 'react';
import { ScrollView, View, Alert, Pressable, Share, Switch, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, Card, colors, spacing } from '@mylife/ui';
import { exportBudgetTransactionsCsv, getGoals, getSetting, resetBudgetData, serializeBudgetExportJson } from '@mylife/budget';
import { useDatabase } from '../../components/DatabaseProvider';

const BUDGET_ACCENT = colors.modules.budget;

interface SettingsRowProps {
  label: string;
  value?: string;
  onPress?: () => void;
  toggle?: boolean;
  onToggle?: (value: boolean) => void;
  destructive?: boolean;
}

function SettingsRow({ label, value, onPress, toggle, onToggle, destructive }: SettingsRowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.row}
      disabled={!onPress && !onToggle}
    >
      <Text variant="body" color={destructive ? colors.danger : colors.text}>
        {label}
      </Text>
      {toggle !== undefined && onToggle ? (
        <Switch
          value={toggle}
          onValueChange={onToggle}
          trackColor={{ true: BUDGET_ACCENT, false: colors.border }}
        />
      ) : value ? (
        <Text variant="caption" color={colors.textSecondary}>
          {value}
        </Text>
      ) : null}
    </Pressable>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <Text variant="caption" style={styles.sectionHeader}>
      {title}
    </Text>
  );
}

export default function BudgetSettingsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [appLockEnabled, setAppLockEnabled] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const refresh = useCallback(() => {
    setRefreshTick((value) => value + 1);
  }, []);

  const goalsCount = useMemo(() => {
    try {
      return getGoals(db).length;
    } catch {
      return 0;
    }
  }, [db, refreshTick]);

  const currencyCode = useMemo(() => {
    try {
      const val = getSetting(db, 'currency');
      return val ?? 'USD';
    } catch {
      return 'USD';
    }
  }, [db, refreshTick]);

  const handleCurrencyFormat = useCallback(() => {
    Alert.alert('Currency Format', 'Multi-currency support is planned for a future release.');
  }, []);

  const handleFirstDayOfWeek = useCallback(() => {
    Alert.alert('First Day of Week', 'Week start customization will be available soon.');
  }, []);

  const handleCsvProfiles = useCallback(() => {
    router.push('/(budget)/import-csv');
  }, [router]);

  const shareExport = useCallback(async (title: string, message: string) => {
    await Share.share({
      message,
      title,
    });
  }, []);

  const runJsonExport = useCallback(async () => {
    try {
      await shareExport('MyBudget Backup', serializeBudgetExportJson(db));
    } catch {
      Alert.alert('Export Failed', 'Failed to export the JSON backup.');
    }
  }, [db, shareExport]);

  const runTransactionsExport = useCallback(async () => {
    try {
      await shareExport('MyBudget Transactions Export', exportBudgetTransactionsCsv(db));
    } catch {
      Alert.alert('Export Failed', 'Failed to export transactions CSV.');
    }
  }, [db, shareExport]);

  const handleExportData = useCallback(() => {
    Alert.alert('Export Data', 'Choose the export format to share.', [
      {
        text: 'JSON Backup',
        onPress: () => {
          void runJsonExport();
        },
      },
      {
        text: 'Transactions CSV',
        onPress: () => {
          void runTransactionsExport();
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [runJsonExport, runTransactionsExport]);

  const handleLicenses = useCallback(() => {
    Alert.alert('Licenses', 'Open-source license details are being prepared.');
  }, []);

  const handlePrivacyStatement = useCallback(() => {
    Alert.alert('Privacy Statement', 'MyBudget keeps your data local on-device only. Full statement coming soon.');
  }, []);

  const handleResetData = useCallback(() => {
    Alert.alert(
      'Reset Budget Data',
      'This will delete all budget data (envelopes, transactions, accounts, subscriptions). This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            try {
              const result = resetBudgetData(db);
              refresh();
              Alert.alert(
                'Reset Complete',
                `Removed ${result.rowsDeleted} rows and restored default budget settings, accounts, and envelopes.`,
              );
            } catch {
              Alert.alert('Reset Failed', 'Budget data could not be reset.');
            }
          },
        },
      ],
    );
  }, [db, refresh]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <SectionHeader title="SECURITY" />
      <Card style={styles.section}>
        <SettingsRow
          label="App Lock (Face ID / Touch ID)"
          toggle={appLockEnabled}
          onToggle={setAppLockEnabled}
        />
      </Card>

      <SectionHeader title="PREFERENCES" />
      <Card style={styles.section}>
        <SettingsRow label="Currency Format" value={currencyCode} onPress={handleCurrencyFormat} />
        <View style={styles.divider} />
        <SettingsRow label="First Day of Week" value="Sunday" onPress={handleFirstDayOfWeek} />
      </Card>

      <SectionHeader title="FEATURES" />
      <Card style={styles.section}>
        <SettingsRow
          label="Goals"
          value={`${goalsCount} goal${goalsCount !== 1 ? 's' : ''}`}
          onPress={() => router.push('/(budget)/goals')}
        />
      </Card>

      <SectionHeader title="DATA" />
      <Card style={styles.section}>
        <SettingsRow label="CSV Import Profiles" onPress={handleCsvProfiles} />
        <View style={styles.divider} />
        <SettingsRow label="Export Data" value="JSON backup / transactions CSV" onPress={handleExportData} />
      </Card>

      <SectionHeader title="ADVANCED" />
      <Card style={styles.section}>
        <SettingsRow label="Family Sharing" onPress={() => router.push('/(budget)/family' as never)} />
        <View style={styles.divider} />
        <SettingsRow label="Currencies" onPress={() => router.push('/(budget)/currencies' as never)} />
        <View style={styles.divider} />
        <SettingsRow label="Budget Alerts" onPress={() => router.push('/(budget)/alerts' as never)} />
        <View style={styles.divider} />
        <SettingsRow label="Transaction Rules" onPress={() => router.push('/(budget)/rules' as never)} />
      </Card>

      <SectionHeader title="ABOUT" />
      <Card style={styles.section}>
        <SettingsRow label="Version" value="0.1.0" />
        <View style={styles.divider} />
        <SettingsRow label="Licenses" onPress={handleLicenses} />
        <View style={styles.divider} />
        <SettingsRow label="Privacy Statement" onPress={handlePrivacyStatement} />
      </Card>

      <SectionHeader title="DANGER ZONE" />
      <Card style={styles.section}>
        <SettingsRow label="Reset All Data" onPress={handleResetData} destructive />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: 80,
  },
  sectionHeader: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  section: {
    padding: 0,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: spacing.md,
  },
});
