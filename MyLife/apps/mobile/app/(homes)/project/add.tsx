import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { uuid } from '../../../lib/uuid';
import {
  createProject, getProject, updateProject, getProperties,
  type ProjectStatus, type ProjectPriority, type ProjectCategory,
} from '@mylife/homes';

const ACCENT = colors.modules.homes;
const STATUSES: ProjectStatus[] = ['planning', 'in_progress', 'on_hold', 'completed', 'cancelled'];
const PRIORITIES: ProjectPriority[] = ['low', 'medium', 'high'];
const CATEGORIES: ProjectCategory[] = ['kitchen', 'bathroom', 'bedroom', 'exterior', 'landscaping', 'structural', 'electrical', 'plumbing', 'other'];

export default function AddProjectScreen() {
  const { id, propertyId: paramPropId } = useLocalSearchParams<{ id?: string; propertyId?: string }>();
  const db = useDatabase();
  const router = useRouter();
  const isEdit = !!id;
  const properties = useMemo(() => getProperties(db), [db]);

  const [propId, setPropId] = useState(paramPropId ?? properties[0]?.id ?? '');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('planning');
  const [budget, setBudget] = useState('');
  const [priority, setPriority] = useState<ProjectPriority>('medium');
  const [category, setCategory] = useState<ProjectCategory>('other');
  const [startDate, setStartDate] = useState('');
  const [targetEndDate, setTargetEndDate] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (id) {
      const p = getProject(db, id);
      if (p) {
        setPropId(p.propertyId); setName(p.name); setDescription(p.description ?? '');
        setStatus(p.status); setBudget(p.budgetCents ? String(p.budgetCents / 100) : '');
        setPriority(p.priority); setCategory(p.category);
        setStartDate(p.startDate ?? ''); setTargetEndDate(p.targetEndDate ?? '');
        setNotes(p.notes ?? '');
      }
    }
  }, [id, db]);

  const handleSave = () => {
    if (!name.trim()) { Alert.alert('Required', 'Name is required.'); return; }
    const data = {
      propertyId: propId, name: name.trim(), description: description.trim() || undefined,
      status, budgetCents: budget ? Math.round(Number(budget) * 100) : undefined,
      priority, category,
      startDate: startDate.trim() || undefined, targetEndDate: targetEndDate.trim() || undefined,
      notes: notes.trim() || undefined,
    };
    if (isEdit && id) { updateProject(db, id, data); }
    else { createProject(db, uuid(), data); }
    router.back();
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="heading">{isEdit ? 'Edit Project' : 'Add Project'}</Text>

      <Text variant="label" color={colors.textSecondary}>Name *</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Kitchen Renovation" placeholderTextColor={colors.textTertiary} />

      <Text variant="label" color={colors.textSecondary}>Description</Text>
      <TextInput style={[styles.input, { minHeight: 80 }]} value={description} onChangeText={setDescription} multiline placeholderTextColor={colors.textTertiary} />

      <Text variant="label" color={colors.textSecondary}>Status</Text>
      <View style={styles.chipRow}>
        {STATUSES.map((s) => (
          <Pressable key={s} style={[styles.chip, status === s && styles.chipActive]} onPress={() => setStatus(s)}>
            <Text variant="label" color={status === s ? colors.background : colors.textSecondary} style={{ fontSize: 11 }}>{s.replace(/_/g, ' ')}</Text>
          </Pressable>
        ))}
      </View>

      <Text variant="label" color={colors.textSecondary}>Priority</Text>
      <View style={styles.chipRow}>
        {PRIORITIES.map((p) => (
          <Pressable key={p} style={[styles.chip, priority === p && styles.chipActive]} onPress={() => setPriority(p)}>
            <Text variant="label" color={priority === p ? colors.background : colors.textSecondary}>{p}</Text>
          </Pressable>
        ))}
      </View>

      <Text variant="label" color={colors.textSecondary}>Category</Text>
      <View style={styles.chipRow}>
        {CATEGORIES.map((c) => (
          <Pressable key={c} style={[styles.chip, category === c && styles.chipActive]} onPress={() => setCategory(c)}>
            <Text variant="label" color={category === c ? colors.background : colors.textSecondary} style={{ fontSize: 11 }}>{c}</Text>
          </Pressable>
        ))}
      </View>

      <Text variant="label" color={colors.textSecondary}>Budget ($)</Text>
      <TextInput style={styles.input} value={budget} onChangeText={setBudget} keyboardType="decimal-pad" placeholderTextColor={colors.textTertiary} />

      <View style={styles.row}>
        <View style={styles.flex1}>
          <Text variant="label" color={colors.textSecondary}>Start Date</Text>
          <TextInput style={styles.input} value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textTertiary} />
        </View>
        <View style={styles.flex1}>
          <Text variant="label" color={colors.textSecondary}>Target End</Text>
          <TextInput style={styles.input} value={targetEndDate} onChangeText={setTargetEndDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textTertiary} />
        </View>
      </View>

      <Pressable style={styles.saveButton} onPress={handleSave}>
        <Text variant="label" color={colors.background}>{isEdit ? 'Save' : 'Add Project'}</Text>
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
  saveButton: { backgroundColor: ACCENT, borderRadius: 12, paddingVertical: spacing.sm, alignItems: 'center', marginTop: spacing.md },
});
