import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, Card, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { getProperties } from '@mylife/homes';
import { useHomeSettings } from '../../hooks/homes/use-settings';

const ACCENT = colors.modules.homes;

export default function HomesSettings() {
  const db = useDatabase();
  const router = useRouter();
  const settings = useHomeSettings();

  const properties = useMemo(() => getProperties(db), [db]);
  const defaultPropertyId = settings.get('default_property_id');
  const remindersEnabled = settings.get('reminders_enabled', 'true') === 'true';
  const offerDefaults = settings.get('offer_default_schedules', 'true') === 'true';
  const insuranceRenewals = settings.get('insurance_renewal_alerts', 'true') === 'true';
  const costAlerts = settings.get('cost_alerts', 'false') === 'true';
  const defaultCurrency = settings.get('default_currency', 'USD');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <Text variant="caption" color={colors.textSecondary}>MyHomes Control Center</Text>
        <Text variant="heading" style={styles.heading}>Settings</Text>
        <Text variant="body" color={colors.textSecondary}>
          Tune default property behavior, alerting, export preferences, and reach every homes view from one place.
        </Text>
      </View>

      {/* Notifications */}
      <Card style={styles.sectionCard}>
        <Text variant="subheading">Notifications</Text>
        <View style={styles.toggleRow}>
          <Text variant="body">Maintenance reminders</Text>
          <Switch
            value={remindersEnabled}
            onValueChange={(v) => settings.set('reminders_enabled', String(v))}
            trackColor={{ true: ACCENT, false: colors.border }}
          />
        </View>
        <View style={styles.toggleRow}>
          <Text variant="body">Insurance renewal alerts</Text>
          <Switch
            value={insuranceRenewals}
            onValueChange={(v) => settings.set('insurance_renewal_alerts', String(v))}
            trackColor={{ true: ACCENT, false: colors.border }}
          />
        </View>
        <View style={styles.toggleRow}>
          <Text variant="body">Cost alerts</Text>
          <Switch
            value={costAlerts}
            onValueChange={(v) => settings.set('cost_alerts', String(v))}
            trackColor={{ true: ACCENT, false: colors.border }}
          />
        </View>
        <View style={styles.toggleRow}>
          <Text variant="body">Offer defaults on new property</Text>
          <Switch
            value={offerDefaults}
            onValueChange={(v) => settings.set('offer_default_schedules', String(v))}
            trackColor={{ true: ACCENT, false: colors.border }}
          />
        </View>
      </Card>

      {/* Defaults */}
      {properties.length > 0 && (
        <Card style={styles.sectionCard}>
          <Text variant="subheading">Default Property</Text>
          <Text variant="caption" color={colors.textSecondary} style={{ marginBottom: spacing.sm }}>
            Used for the dashboard view
          </Text>
          {properties.map((p) => (
            <Pressable
              key={p.id}
              style={[styles.propertyOption, defaultPropertyId === p.id && styles.propertyOptionActive]}
              onPress={() => settings.set('default_property_id', p.id)}
            >
              <Text variant="body" color={defaultPropertyId === p.id ? colors.background : colors.text}>
                {p.name}
              </Text>
            </Pressable>
          ))}
        </Card>
      )}

      <Card style={styles.sectionCard}>
        <Text variant="subheading">Preferences</Text>
        <View style={styles.preferenceRow}>
          <Text variant="body">Default currency</Text>
          <View style={styles.preferencePill}>
            <Text variant="label" color={ACCENT}>{defaultCurrency}</Text>
          </View>
        </View>
        <View style={styles.currencyRow}>
          {['USD', 'EUR', 'GBP', 'CAD'].map((currency) => {
            const active = defaultCurrency === currency;
            return (
              <Pressable
                key={currency}
                style={[styles.currencyChip, active && styles.currencyChipActive]}
                onPress={() => settings.set('default_currency', currency)}
              >
                <Text variant="label" color={active ? colors.background : colors.textSecondary}>
                  {currency}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      {/* Data */}
      <Card style={styles.sectionCard}>
        <Text variant="subheading">Data</Text>
        <Pressable style={styles.linkRow}>
          <Text variant="body" color={ACCENT}>Export all MyHomes data as CSV</Text>
        </Pressable>
        <Pressable style={styles.linkRow}>
          <Text variant="body" color={ACCENT}>Export inventory CSV</Text>
        </Pressable>
      </Card>

      <Card style={styles.sectionCard}>
        <Text variant="subheading">More Views</Text>
        {[
          { label: 'Insights', route: '/(homes)/insights' },
          { label: 'Cost Predictor', route: '/(homes)/cost-predictor' },
          { label: 'Forecasting', route: '/(homes)/forecasting' },
          { label: 'Warranties', route: '/(homes)/warranties' },
          { label: 'Project Timeline', route: '/(homes)/project/dependencies' },
        ].map((item) => (
          <Pressable key={item.label} style={styles.linkRow} onPress={() => router.push(item.route as never)}>
            <Text variant="body" color={ACCENT}>{item.label}</Text>
          </Pressable>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  heroCard: {
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.20)',
    borderRadius: 22,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  heading: { marginBottom: spacing.xs },
  sectionCard: { gap: spacing.sm },
  toggleRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  propertyOption: {
    backgroundColor: colors.glass, borderRadius: 8,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  propertyOptionActive: { backgroundColor: ACCENT },
  preferenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  preferencePill: {
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.20)',
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  currencyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  currencyChip: {
    backgroundColor: colors.glassStrong,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  currencyChipActive: {
    backgroundColor: ACCENT,
  },
  linkRow: { paddingVertical: spacing.xs },
});
