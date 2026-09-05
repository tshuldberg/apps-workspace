import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import {
  validateVin,
  isValidCheckDigit,
  getModelYear,
  getVehicles,
  getRecallsByVehicle,
} from '@mylife/car';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.car;

export default function VinDecoderScreen() {
  const db = useDatabase();
  const [vin, setVin] = useState('');
  const [decoded, setDecoded] = useState(false);

  const vehicles = useMemo(() => {
    try { return getVehicles(db); } catch { return []; }
  }, [db]);

  const isValid = useMemo(() => {
    if (vin.length !== 17) return null;
    return validateVin(vin);
  }, [vin]);

  const checkDigitValid = useMemo(() => {
    if (vin.length !== 17) return null;
    return isValidCheckDigit(vin);
  }, [vin]);

  const modelYear = useMemo(() => {
    if (vin.length !== 17 || !isValid) return null;
    return getModelYear(vin);
  }, [vin, isValid]);

  // Find recalls for vehicles that match VIN
  const matchingRecalls = useMemo(() => {
    if (!decoded || !isValid) return [];
    try {
      const matching = vehicles.find((v) => v.vin?.toUpperCase() === vin.toUpperCase());
      if (matching) return getRecallsByVehicle(db, matching.id);
      return [];
    } catch { return []; }
  }, [db, vehicles, vin, decoded, isValid]);

  const handleDecode = () => setDecoded(true);

  const vinUpper = vin.toUpperCase();
  // Basic VIN parsing (WMI, VDS, VIS)
  const wmi = vinUpper.slice(0, 3);
  const vds = vinUpper.slice(3, 9);
  const vis = vinUpper.slice(9, 17);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="heading" style={{ color: ACCENT }}>VIN Decoder</Text>

      <Card>
        <Text variant="label" color={colors.textTertiary}>ENTER VIN</Text>
        <TextInput
          style={styles.input}
          value={vin}
          onChangeText={(t) => { setVin(t.toUpperCase()); setDecoded(false); }}
          placeholder="17-character VIN"
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="characters"
          maxLength={17}
        />

        {vin.length > 0 && vin.length < 17 && (
          <Text variant="caption" color={colors.textTertiary}>
            {17 - vin.length} more character{17 - vin.length !== 1 ? 's' : ''} needed
          </Text>
        )}

        {vin.length === 17 && isValid !== null && (
          <View style={styles.validationRow}>
            <View style={[styles.validationDot, { backgroundColor: isValid ? colors.success : colors.danger }]} />
            <Text variant="caption" color={isValid ? colors.success : colors.danger}>
              {isValid ? 'Valid VIN format' : 'Invalid VIN format'}
            </Text>
          </View>
        )}

        {vin.length === 17 && checkDigitValid !== null && (
          <View style={styles.validationRow}>
            <View style={[styles.validationDot, { backgroundColor: checkDigitValid ? colors.success : '#FF9F0A' }]} />
            <Text variant="caption" color={checkDigitValid ? colors.success : '#FF9F0A'}>
              {checkDigitValid ? 'Check digit valid' : 'Check digit mismatch'}
            </Text>
          </View>
        )}
      </Card>

      <Pressable
        style={[styles.decodeButton, { backgroundColor: isValid ? ACCENT : colors.surfaceElevated }]}
        onPress={handleDecode}
        disabled={!isValid}
      >
        <Text variant="label" color={isValid ? colors.background : colors.textTertiary}>
          Decode VIN
        </Text>
      </Pressable>

      {decoded && isValid && (
        <>
          <Card>
            <Text variant="label" color={colors.textTertiary}>DECODED ATTRIBUTES</Text>
            <View style={styles.attributeList}>
              <AttributeRow label="WMI (Manufacturer)" value={wmi} />
              <AttributeRow label="VDS (Descriptor)" value={vds} />
              <AttributeRow label="VIS (Identifier)" value={vis} />
              {modelYear && <AttributeRow label="Model Year" value={String(modelYear)} />}
              <AttributeRow label="Assembly Plant" value={vinUpper[10]} />
              <AttributeRow label="Sequence" value={vinUpper.slice(11)} />
            </View>
          </Card>

          <Card>
            <Text variant="label" color={colors.textTertiary}>NHTSA RECALLS</Text>
            {matchingRecalls.length === 0 ? (
              <View style={styles.emptyState}>
                <Text variant="body" color={colors.textSecondary}>
                  No matching recalls found locally.
                </Text>
                <Text variant="caption" color={colors.textTertiary}>
                  Connect to network to check NHTSA recall database.
                </Text>
              </View>
            ) : (
              matchingRecalls.map((recall) => (
                <View key={recall.id} style={styles.recallCard}>
                  <Text variant="body">{recall.component ?? 'Unknown Component'}</Text>
                  <Text variant="caption" color={colors.textSecondary}>
                    {recall.summary ?? 'No summary available'}
                  </Text>
                  {recall.remedy && (
                    <Text variant="caption" color={colors.success}>
                      Remedy: {recall.remedy}
                    </Text>
                  )}
                </View>
              ))
            )}
          </Card>
        </>
      )}
    </ScrollView>
  );
}

function AttributeRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.attributeRow}>
      <Text variant="caption" color={colors.textSecondary}>{label}</Text>
      <Text variant="body" style={{ color: ACCENT }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  input: {
    backgroundColor: colors.surfaceElevated, borderRadius: 8,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    color: colors.text, fontFamily: 'Inter', fontSize: 18, letterSpacing: 2,
    borderWidth: 1, borderColor: colors.border, marginTop: spacing.sm,
    minHeight: 44, textAlign: 'center',
  },
  validationRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs,
  },
  validationDot: { width: 8, height: 8, borderRadius: 4 },
  decodeButton: {
    borderRadius: 8, paddingVertical: 12, alignItems: 'center',
    minHeight: 44, justifyContent: 'center',
  },
  attributeList: { marginTop: spacing.sm, gap: spacing.xs },
  attributeRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.glass,
  },
  emptyState: { paddingVertical: spacing.md, alignItems: 'center', gap: spacing.xs },
  recallCard: {
    paddingVertical: spacing.sm, gap: 4,
    borderBottomWidth: 1, borderBottomColor: colors.glass,
  },
});
