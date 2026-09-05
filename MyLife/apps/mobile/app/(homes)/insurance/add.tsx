import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { uuid } from '../../../lib/uuid';
import { createPolicy, getPolicy, updatePolicy, getProperties, type PolicyType } from '@mylife/homes';

const ACCENT = colors.modules.homes;
const TYPES: PolicyType[] = ['homeowners', 'renters', 'flood', 'earthquake', 'umbrella', 'other'];

export default function AddInsuranceScreen() {
  const { id, propertyId: paramPropId } = useLocalSearchParams<{ id?: string; propertyId?: string }>();
  const db = useDatabase();
  const router = useRouter();
  const isEdit = !!id;
  const properties = useMemo(() => getProperties(db), [db]);

  const [propId, setPropId] = useState(paramPropId ?? properties[0]?.id ?? '');
  const [provider, setProvider] = useState('');
  const [policyNumber, setPolicyNumber] = useState('');
  const [policyType, setPolicyType] = useState<PolicyType>('homeowners');
  const [coverage, setCoverage] = useState('');
  const [deductible, setDeductible] = useState('');
  const [premium, setPremium] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState('');
  const [autoRenew, setAutoRenew] = useState(true);
  const [agentName, setAgentName] = useState('');
  const [agentPhone, setAgentPhone] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (id) {
      const p = getPolicy(db, id);
      if (p) {
        setPropId(p.propertyId); setProvider(p.provider); setPolicyNumber(p.policyNumber);
        setPolicyType(p.policyType); setCoverage(String(p.coverageAmountCents / 100));
        setDeductible(String(p.deductibleCents / 100)); setPremium(String(p.annualPremiumCents / 100));
        setStartDate(p.startDate.slice(0, 10)); setEndDate(p.endDate.slice(0, 10));
        setAutoRenew(p.autoRenew); setAgentName(p.agentName ?? '');
        setAgentPhone(p.agentPhone ?? ''); setNotes(p.notes ?? '');
      }
    }
  }, [id, db]);

  const handleSave = () => {
    if (!provider.trim() || !policyNumber.trim()) { Alert.alert('Required', 'Provider and policy number are required.'); return; }
    const data = {
      propertyId: propId, provider: provider.trim(), policyNumber: policyNumber.trim(), policyType,
      coverageAmountCents: Math.round(Number(coverage) * 100),
      deductibleCents: Math.round(Number(deductible) * 100),
      annualPremiumCents: Math.round(Number(premium) * 100),
      startDate, endDate, autoRenew,
      agentName: agentName.trim() || undefined, agentPhone: agentPhone.trim() || undefined,
      notes: notes.trim() || undefined,
    };
    if (isEdit && id) { updatePolicy(db, id, data); }
    else { createPolicy(db, uuid(), data); }
    router.back();
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="heading">{isEdit ? 'Edit Policy' : 'Add Policy'}</Text>

      <Text variant="label" color={colors.textSecondary}>Provider *</Text>
      <TextInput style={styles.input} value={provider} onChangeText={setProvider} placeholderTextColor={colors.textTertiary} />

      <Text variant="label" color={colors.textSecondary}>Policy Number *</Text>
      <TextInput style={styles.input} value={policyNumber} onChangeText={setPolicyNumber} placeholderTextColor={colors.textTertiary} />

      <Text variant="label" color={colors.textSecondary}>Type</Text>
      <View style={styles.chipRow}>
        {TYPES.map((t) => (
          <Pressable key={t} style={[styles.chip, policyType === t && styles.chipActive]} onPress={() => setPolicyType(t)}>
            <Text variant="label" color={policyType === t ? colors.background : colors.textSecondary} style={{ fontSize: 11 }}>{t}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.row}>
        <View style={styles.flex1}>
          <Text variant="label" color={colors.textSecondary}>Coverage ($)</Text>
          <TextInput style={styles.input} value={coverage} onChangeText={setCoverage} keyboardType="decimal-pad" placeholderTextColor={colors.textTertiary} />
        </View>
        <View style={styles.flex1}>
          <Text variant="label" color={colors.textSecondary}>Deductible ($)</Text>
          <TextInput style={styles.input} value={deductible} onChangeText={setDeductible} keyboardType="decimal-pad" placeholderTextColor={colors.textTertiary} />
        </View>
      </View>

      <Text variant="label" color={colors.textSecondary}>Annual Premium ($)</Text>
      <TextInput style={styles.input} value={premium} onChangeText={setPremium} keyboardType="decimal-pad" placeholderTextColor={colors.textTertiary} />

      <View style={styles.row}>
        <View style={styles.flex1}>
          <Text variant="label" color={colors.textSecondary}>Start Date</Text>
          <TextInput style={styles.input} value={startDate} onChangeText={setStartDate} placeholderTextColor={colors.textTertiary} />
        </View>
        <View style={styles.flex1}>
          <Text variant="label" color={colors.textSecondary}>End Date</Text>
          <TextInput style={styles.input} value={endDate} onChangeText={setEndDate} placeholderTextColor={colors.textTertiary} />
        </View>
      </View>

      <View style={styles.toggleRow}>
        <Text variant="body">Auto-renew</Text>
        <Switch value={autoRenew} onValueChange={setAutoRenew} trackColor={{ true: ACCENT, false: colors.border }} />
      </View>

      <Text variant="label" color={colors.textSecondary}>Agent Name</Text>
      <TextInput style={styles.input} value={agentName} onChangeText={setAgentName} placeholderTextColor={colors.textTertiary} />

      <Text variant="label" color={colors.textSecondary}>Agent Phone</Text>
      <TextInput style={styles.input} value={agentPhone} onChangeText={setAgentPhone} keyboardType="phone-pad" placeholderTextColor={colors.textTertiary} />

      <Pressable style={styles.saveButton} onPress={handleSave}>
        <Text variant="label" color={colors.background}>{isEdit ? 'Save' : 'Add Policy'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  input: { borderWidth: 1, borderColor: colors.glassBorder, borderRadius: 8, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, color: colors.text, backgroundColor: 'rgba(255,255,255,0.06)' },
  chipRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  chip: { backgroundColor: colors.glassStrong, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  chipActive: { backgroundColor: ACCENT },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex1: { flex: 1 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  saveButton: { backgroundColor: ACCENT, borderRadius: 12, paddingVertical: spacing.sm, alignItems: 'center', marginTop: spacing.md },
});
