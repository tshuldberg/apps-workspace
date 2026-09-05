import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  getVehicles,
  getPoliciesByVehicle,
  getRegistrationByVehicle,
  getExpirationStatus,
  annualizePremium,
  maskPolicyNumber,
  getRegExpirationStatus,
  getInspectionExpirationStatus,
  type InsurancePolicy,
  type Registration,
  type ExpirationStatus,
} from '@mylife/car';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.car;

function statusColor(status: ExpirationStatus | string): string {
  switch (status) {
    case 'valid': return colors.success;
    case 'expiring_soon': return '#FF9F0A';
    case 'expired': return colors.danger;
    default: return colors.textSecondary;
  }
}

function statusLabel(status: ExpirationStatus | string): string {
  switch (status) {
    case 'valid': return 'Valid';
    case 'expiring_soon': return 'Expiring Soon';
    case 'expired': return 'Expired';
    default: return 'Unknown';
  }
}

function formatCurrency(cents: number | null | undefined): string {
  return `$${(((cents ?? 0) as number) / 100).toFixed(2)}`;
}

export default function DocumentsScreen() {
  const db = useDatabase();
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  const vehicles = useMemo(() => {
    try { return getVehicles(db); } catch { return []; }
  }, [db]);

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === selectedVehicleId) ?? vehicles[0] ?? null,
    [selectedVehicleId, vehicles],
  );

  const policies: InsurancePolicy[] = useMemo(() => {
    if (!selectedVehicle) return [];
    try { return getPoliciesByVehicle(db, selectedVehicle.id); } catch { return []; }
  }, [db, selectedVehicle]);

  const registrations: Registration[] = useMemo(() => {
    if (!selectedVehicle) return [];
    try {
      const reg = getRegistrationByVehicle(db, selectedVehicle.id);
      return reg ? [reg] : [];
    } catch { return []; }
  }, [db, selectedVehicle]);

  if (vehicles.length === 0) {
    return (
      <View style={styles.emptyScreen}>
        <Text style={styles.emptyIcon}>📄</Text>
        <Text variant="subheading" color={colors.textSecondary}>Documents & Alerts</Text>
        <Text variant="caption" color={colors.textTertiary}>
          Add a vehicle in the Garage tab first.
        </Text>
      </View>
    );
  }

  const today = new Date().toISOString().split('T')[0];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="heading" style={{ color: ACCENT }}>Documents</Text>

      <Card>
        <Text variant="label" color={colors.textTertiary}>VEHICLE</Text>
        <View style={styles.chipRow}>
          {vehicles.map((v) => {
            const selected = selectedVehicle?.id === v.id;
            return (
              <Pressable
                key={v.id}
                style={[styles.chip, selected && { backgroundColor: ACCENT }]}
                onPress={() => setSelectedVehicleId(v.id)}
              >
                <Text variant="caption" color={selected ? colors.background : colors.textSecondary}>
                  {v.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      {/* Insurance Section */}
      <Text variant="label" color={colors.textTertiary} style={styles.sectionHeader}>
        INSURANCE
      </Text>
      {policies.length === 0 ? (
        <Card>
          <View style={styles.emptyState}>
            <Text variant="body" color={colors.textSecondary}>No insurance policies.</Text>
          </View>
        </Card>
      ) : (
        policies.map((policy) => {
          const status = policy.endDate ? getExpirationStatus(policy.endDate, today) : 'valid';
          const sColor = statusColor(status);
          const premCents: number = policy.premiumCents ?? 0;
          const premFreq: string = policy.premiumFrequency ?? 'annual';
          const annualized = annualizePremium(premCents, premFreq);
          const masked = policy.policyNumber ? maskPolicyNumber(policy.policyNumber) : null;
          return (
            <Card key={policy.id} style={styles.docCard}>
              <View style={styles.docHeader}>
                <Text variant="subheading">{policy.provider}</Text>
                <View style={[styles.statusBadge, { backgroundColor: sColor }]}>
                  <Text variant="iconCaption" color={colors.background}>
                    {statusLabel(status)}
                  </Text>
                </View>
              </View>
              {masked && (
                <Text variant="caption" color={colors.textSecondary}>
                  Policy: {masked}
                </Text>
              )}
              <Text variant="caption" color={colors.textSecondary}>
                Coverage: {policy.coverageType}
              </Text>
              {policy.endDate && (
                <Text variant="caption" color={colors.textSecondary}>
                  Expires: {policy.endDate}
                </Text>
              )}
              {annualized > 0 && (
                <Text variant="body" style={{ color: ACCENT }}>
                  {formatCurrency(annualized)}/year
                </Text>
              )}
            </Card>
          );
        })
      )}

      {/* Registration Section */}
      <Text variant="label" color={colors.textTertiary} style={styles.sectionHeader}>
        REGISTRATION
      </Text>
      {registrations.length === 0 ? (
        <Card>
          <View style={styles.emptyState}>
            <Text variant="body" color={colors.textSecondary}>No registration on file.</Text>
          </View>
        </Card>
      ) : (
        registrations.map((reg) => {
          const regStatus = reg.regExpirationDate ? getRegExpirationStatus(reg.regExpirationDate, today) : 'valid';
          const inspStatus = reg.inspectionExpirationDate ? getInspectionExpirationStatus(reg.inspectionExpirationDate, today) : 'valid';
          return (
            <Card key={reg.id} style={styles.docCard}>
              <View style={styles.docHeader}>
                <Text variant="subheading">Registration</Text>
                <View style={[styles.statusBadge, { backgroundColor: statusColor(regStatus) }]}>
                  <Text variant="iconCaption" color={colors.background}>
                    {statusLabel(regStatus)}
                  </Text>
                </View>
              </View>
              {reg.regState && (
                <Text variant="caption" color={colors.textSecondary}>
                  State: {reg.regState}
                </Text>
              )}
              {reg.regExpirationDate && (
                <Text variant="caption" color={colors.textSecondary}>
                  Reg Expires: {reg.regExpirationDate}
                </Text>
              )}
              <Text variant="caption" color={colors.textSecondary}>
                Inspection: {reg.inspectionType}
              </Text>
              {reg.inspectionExpirationDate && (
                <View style={styles.inspectionRow}>
                  <Text variant="caption" color={colors.textSecondary}>
                    Inspection Expires: {reg.inspectionExpirationDate}
                  </Text>
                  <View style={[styles.statusDot, { backgroundColor: statusColor(inspStatus) }]} />
                </View>
              )}
            </Card>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  emptyScreen: {
    flex: 1, backgroundColor: colors.background, justifyContent: 'center',
    alignItems: 'center', padding: spacing.xl,
  },
  emptyIcon: { fontSize: 48, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  chip: {
    backgroundColor: colors.surfaceElevated, borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  sectionHeader: { marginTop: spacing.lg, marginBottom: spacing.xs },
  emptyState: { paddingVertical: spacing.md, alignItems: 'center' },
  docCard: { backgroundColor: colors.surfaceElevated, gap: 4 },
  docHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  inspectionRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
});
