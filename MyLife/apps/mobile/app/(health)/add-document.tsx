import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, colors } from '@mylife/ui';
import {
  createDocument,
  type DocumentType,
  HEALTH_ACCENT,
  HEALTH_SURFACES,
  HEALTH_TYPOGRAPHY,
  JAKARTA_FONTS,
  GlassCard,
  GradientButton,
} from '@mylife/health';
import { useDatabase } from '../../components/DatabaseProvider';

interface DocTypeOption {
  id: DocumentType;
  label: string;
  icon: string;
}

const DOC_TYPES: DocTypeOption[] = [
  { id: 'lab_result', label: 'Lab Result', icon: '\u{1F9EA}' },
  { id: 'prescription', label: 'Prescription', icon: '\u{1F48A}' },
  { id: 'insurance', label: 'Insurance', icon: '\u{1F4CB}' },
  { id: 'imaging', label: 'Imaging', icon: '\u{1FA7B}' },
  { id: 'vaccination', label: 'Vaccination', icon: '\u{1F489}' },
  { id: 'referral', label: 'Referral', icon: '\u{1F4E8}' },
  { id: 'discharge', label: 'Discharge', icon: '\u{1F3E5}' },
  { id: 'other', label: 'Other', icon: '\u{1F4C4}' },
];

export default function AddDocumentScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState<DocumentType>('lab_result');
  const [notes, setNotes] = useState('');
  const [docDate, setDocDate] = useState('');

  const handleSave = () => {
    if (!title.trim()) {
      Alert.alert('Missing title', 'Please enter a document title.');
      return;
    }

    try {
      const placeholder = new Uint8Array([0x50, 0x4c, 0x41, 0x43, 0x45, 0x48, 0x4f, 0x4c, 0x44, 0x45, 0x52]);
      createDocument(db, {
        title: title.trim(),
        type: docType,
        mime_type: 'application/octet-stream',
        content: placeholder,
        notes: notes.trim() || undefined,
        document_date: docDate.trim() || undefined,
      });
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to save document.');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.title}>Add Document</Text>
        <Text style={styles.subtitle}>Store lab results, prescriptions, and health records</Text>
      </View>

      {/* ── Step 1: Document Type ── */}
      <Text style={styles.stepLabel}>DOCUMENT TYPE</Text>
      <View style={styles.typeGrid}>
        {DOC_TYPES.map((t) => {
          const isSelected = docType === t.id;
          return (
            <GlassCard
              key={t.id}
              level={2}
              style={[
                styles.typeCard,
                isSelected && { backgroundColor: HEALTH_SURFACES.focus },
              ]}
              onPress={() => setDocType(t.id)}
            >
              <View style={styles.typeCardInner}>
                <View style={[styles.typeIconWrap, isSelected && { backgroundColor: `${HEALTH_ACCENT}20` }]}>
                  <Text style={styles.typeIconText}>{t.icon}</Text>
                </View>
                <Text style={[styles.typeLabel, isSelected && { color: colors.text }]}>{t.label}</Text>
                {isSelected && <View style={styles.selectedDot} />}
              </View>
            </GlassCard>
          );
        })}
      </View>

      {/* ── Step 2: Details ── */}
      <Text style={[styles.stepLabel, { marginTop: 24 }]}>DETAILS</Text>

      {/* Title */}
      <View style={styles.fieldGroup}>
        <Text style={styles.inputLabel}>Document Name</Text>
        <TextInput
          style={styles.textInput}
          placeholder="e.g., Blood Work Results - Jan 2026"
          placeholderTextColor={colors.textTertiary}
          value={title}
          onChangeText={setTitle}
        />
      </View>

      {/* Date */}
      <View style={styles.fieldGroup}>
        <Text style={styles.inputLabel}>Document Date (optional)</Text>
        <TextInput
          style={styles.textInput}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textTertiary}
          value={docDate}
          onChangeText={setDocDate}
        />
      </View>

      {/* Notes */}
      <View style={styles.fieldGroup}>
        <Text style={styles.inputLabel}>Notes (optional)</Text>
        <TextInput
          style={[styles.textInput, styles.multilineInput]}
          placeholder="Additional notes about this document..."
          placeholderTextColor={colors.textTertiary}
          value={notes}
          onChangeText={setNotes}
          multiline
        />
      </View>

      {/* ── File Capture ── */}
      <Text style={[styles.stepLabel, { marginTop: 24 }]}>ATTACHMENT</Text>
      <GlassCard level={2} style={styles.attachCard}>
        <Pressable style={styles.attachArea}>
          <Text style={styles.attachIcon}>{'\u{1F4F7}'}</Text>
          <Text style={styles.attachTitle}>Capture or Upload</Text>
          <Text style={styles.attachSub}>
            Camera capture and file picker will be available in a future update.
            Documents created now are saved as metadata entries.
          </Text>
        </Pressable>
      </GlassCard>

      {/* ── Save Button ── */}
      <View style={styles.saveWrap}>
        <GradientButton title="Save Document" onPress={handleSave} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: HEALTH_SURFACES.depth,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },

  // Header
  header: {
    paddingTop: 16,
    paddingBottom: 4,
  },
  title: {
    ...HEALTH_TYPOGRAPHY.displayLg,
    color: colors.text,
  },
  subtitle: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },

  // Step labels
  stepLabel: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    color: HEALTH_ACCENT,
    marginTop: 20,
    marginBottom: 10,
  },

  // Type grid
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  typeCard: {
    width: '48%' as unknown as number,
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: '48%' as unknown as number,
    padding: 12,
  },
  typeCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  typeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: HEALTH_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeIconText: {
    fontSize: 16,
  },
  typeLabel: {
    flex: 1,
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: colors.textSecondary,
  },
  selectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: HEALTH_ACCENT,
  },

  // Fields
  fieldGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.1 * 11,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: HEALTH_SURFACES.lift,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.text,
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 15,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },

  // Attachment
  attachCard: {
    marginHorizontal: 0,
  },
  attachArea: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  attachIcon: {
    fontSize: 36,
  },
  attachTitle: {
    ...HEALTH_TYPOGRAPHY.headlineMd,
    fontSize: 16,
    color: colors.text,
  },
  attachSub: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },

  // Save
  saveWrap: {
    marginTop: 24,
  },
});
