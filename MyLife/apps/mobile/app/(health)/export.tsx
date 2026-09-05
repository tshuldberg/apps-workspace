import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, colors } from '@mylife/ui';
import {
  generateDoctorReport,
  generateTherapyReport,
  HEALTH_ACCENT,
  HEALTH_SURFACES,
  HEALTH_TYPOGRAPHY,
  JAKARTA_FONTS,
  SectionHeader,
  GlassCard,
  GradientButton,
} from '@mylife/health';
import { useDatabase } from '../../components/DatabaseProvider';

// ---------------------------------------------------------------------------
// Types & Constants
// ---------------------------------------------------------------------------

type ExportFormat = 'csv' | 'pdf';
type DatePreset = '7d' | '30d' | '3m' | 'all';
type DataType = 'vitals' | 'sleep' | 'activity' | 'mood' | 'medications' | 'goals' | 'documents';

interface DataTypeOption {
  id: DataType;
  label: string;
  icon: string;
}

const FORMAT_OPTIONS: { id: ExportFormat; label: string; desc: string }[] = [
  { id: 'csv', label: 'CSV', desc: 'Raw data' },
  { id: 'pdf', label: 'PDF Report', desc: 'Formatted report' },
];

const DATE_PRESETS: { id: DatePreset; label: string; days: number }[] = [
  { id: '7d', label: 'Last 7 Days', days: 7 },
  { id: '30d', label: 'Last 30 Days', days: 30 },
  { id: '3m', label: 'Last 3 Months', days: 90 },
  { id: 'all', label: 'All Time', days: 365 * 10 },
];

const DATA_TYPES: DataTypeOption[] = [
  { id: 'vitals', label: 'Vitals', icon: '\u2764\uFE0F' },
  { id: 'sleep', label: 'Sleep', icon: '\uD83D\uDE34' },
  { id: 'activity', label: 'Activity', icon: '\uD83C\uDFC3' },
  { id: 'mood', label: 'Mood', icon: '\uD83D\uDE0A' },
  { id: 'medications', label: 'Medications', icon: '\uD83D\uDC8A' },
  { id: 'goals', label: 'Goals', icon: '\uD83C\uDFAF' },
  { id: 'documents', label: 'Documents', icon: '\uD83D\uDCC4' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDateRange(preset: DatePreset): { from: string; to: string } {
  const to = new Date().toISOString().slice(0, 10);
  const entry = DATE_PRESETS.find((p) => p.id === preset);
  const days = entry?.days ?? 90;
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);
  return { from: fromDate.toISOString().slice(0, 10), to };
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ExportScreen() {
  const db = useDatabase();
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [datePreset, setDatePreset] = useState<DatePreset>('30d');
  const [selectedTypes, setSelectedTypes] = useState<Set<DataType>>(
    () => new Set(DATA_TYPES.map((d) => d.id)),
  );
  const [exporting, setExporting] = useState(false);
  const [lastExport, setLastExport] = useState<string | null>(null);

  const allSelected = selectedTypes.size === DATA_TYPES.length;

  const toggleType = useCallback((id: DataType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelectedTypes(new Set());
    } else {
      setSelectedTypes(new Set(DATA_TYPES.map((d) => d.id)));
    }
  }, [allSelected]);

  const dateRange = useMemo(() => getDateRange(datePreset), [datePreset]);

  const handleExport = useCallback(() => {
    if (selectedTypes.size === 0) {
      Alert.alert('No Data Selected', 'Please select at least one data type to export.');
      return;
    }

    setExporting(true);
    try {
      const { from, to } = dateRange;
      // PDF generates doctor or therapy report; CSV would generate raw data
      const report =
        format === 'pdf'
          ? generateDoctorReport(db, from, to)
          : generateTherapyReport(db, from, to);
      setLastExport(report);
      Alert.alert('Export Ready', 'Your report has been generated. You can copy the text below.');
    } catch {
      Alert.alert('Export Failed', 'Could not generate the report. Try logging more data first.');
    } finally {
      setExporting(false);
    }
  }, [db, format, dateRange, selectedTypes]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Export Data</Text>
        <Text style={styles.subtitle}>
          Generate reports to share with your healthcare providers.
        </Text>
      </View>

      {/* Format Picker */}
      <SectionHeader label="FORMAT" title="Export Format" />
      <View style={styles.formatRow}>
        {FORMAT_OPTIONS.map((opt) => (
          <Pressable
            key={opt.id}
            style={[styles.formatPill, format === opt.id && styles.formatPillActive]}
            onPress={() => setFormat(opt.id)}
          >
            <Text
              style={[
                styles.formatPillLabel,
                format === opt.id && styles.formatPillLabelActive,
              ]}
            >
              {opt.label}
            </Text>
            <Text
              style={[
                styles.formatPillDesc,
                format === opt.id && styles.formatPillDescActive,
              ]}
            >
              {opt.desc}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Date Range */}
      <SectionHeader label="DATE RANGE" title="Time Period" />
      <View style={styles.presetRow}>
        {DATE_PRESETS.map((preset) => (
          <Pressable
            key={preset.id}
            style={[styles.presetPill, datePreset === preset.id && styles.presetPillActive]}
            onPress={() => setDatePreset(preset.id)}
          >
            <Text
              style={[
                styles.presetPillText,
                datePreset === preset.id && styles.presetPillTextActive,
              ]}
            >
              {preset.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Date range display */}
      <GlassCard level={2} style={styles.dateCard}>
        <View style={styles.dateRow}>
          <View style={styles.dateCol}>
            <Text style={styles.dateLabel}>FROM</Text>
            <Text style={styles.dateValue}>{formatDate(dateRange.from)}</Text>
          </View>
          <View style={styles.dateDivider} />
          <View style={styles.dateCol}>
            <Text style={styles.dateLabel}>TO</Text>
            <Text style={styles.dateValue}>{formatDate(dateRange.to)}</Text>
          </View>
        </View>
      </GlassCard>

      {/* Data Types */}
      <SectionHeader label="DATA TYPES" title="What to Include" />
      <GlassCard level={2} style={styles.typesCard}>
        {/* Select All toggle */}
        <Pressable style={styles.typeRow} onPress={toggleAll}>
          <View style={styles.typeLeft}>
            <View style={[styles.checkbox, allSelected && styles.checkboxActive]}>
              {allSelected && <Text style={styles.checkmark}>{'\u2713'}</Text>}
            </View>
            <Text style={styles.typeLabel}>Select All</Text>
          </View>
        </Pressable>
        <View style={styles.typeDivider} />

        {DATA_TYPES.map((dt, i) => {
          const checked = selectedTypes.has(dt.id);
          return (
            <View key={dt.id}>
              <Pressable style={styles.typeRow} onPress={() => toggleType(dt.id)}>
                <View style={styles.typeLeft}>
                  <View style={[styles.checkbox, checked && styles.checkboxActive]}>
                    {checked && <Text style={styles.checkmark}>{'\u2713'}</Text>}
                  </View>
                  <Text style={styles.typeIcon}>{dt.icon}</Text>
                  <Text style={styles.typeLabel}>{dt.label}</Text>
                </View>
              </Pressable>
              {i < DATA_TYPES.length - 1 && <View style={styles.typeDivider} />}
            </View>
          );
        })}
      </GlassCard>

      {/* Preview */}
      <SectionHeader label="PREVIEW" title="Export Summary" />
      <GlassCard level={1} style={styles.previewCard}>
        <View style={styles.previewRow}>
          <Text style={styles.previewLabel}>Format</Text>
          <Text style={styles.previewValue}>{format === 'pdf' ? 'PDF Report' : 'CSV'}</Text>
        </View>
        <View style={styles.typeDivider} />
        <View style={styles.previewRow}>
          <Text style={styles.previewLabel}>Date Range</Text>
          <Text style={styles.previewValue}>
            {formatDate(dateRange.from)} - {formatDate(dateRange.to)}
          </Text>
        </View>
        <View style={styles.typeDivider} />
        <View style={styles.previewRow}>
          <Text style={styles.previewLabel}>Data Types</Text>
          <Text style={styles.previewValue}>
            {selectedTypes.size} of {DATA_TYPES.length} selected
          </Text>
        </View>
        <View style={styles.typeDivider} />
        <View style={styles.previewRow}>
          <Text style={styles.previewLabel}>Est. Size</Text>
          <Text style={styles.previewValue}>
            {selectedTypes.size === 0 ? '--' : `~${Math.max(1, selectedTypes.size * 2)} KB`}
          </Text>
        </View>
      </GlassCard>

      {/* Export Button */}
      <View style={styles.buttonContainer}>
        {exporting ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={HEALTH_ACCENT} size="small" />
            <Text style={styles.loadingText}>Generating export...</Text>
          </View>
        ) : (
          <GradientButton title="Generate Export" onPress={handleExport} />
        )}
      </View>

      {/* Generated Report Preview */}
      {lastExport != null && (
        <>
          <SectionHeader label="RESULT" title="Generated Report" />
          <GlassCard level={1} style={styles.reportCard}>
            <Text style={styles.reportText} selectable>
              {lastExport.slice(0, 2000)}
              {lastExport.length > 2000 ? '\n...(truncated)' : ''}
            </Text>
          </GlassCard>
        </>
      )}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: HEALTH_SURFACES.depth,
  },
  content: {
    paddingBottom: 100,
  },

  // Header
  header: {
    paddingHorizontal: 20,
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

  // Format picker
  formatRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 16,
  },
  formatPill: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: HEALTH_SURFACES.lift,
    alignItems: 'center',
    gap: 2,
  },
  formatPillActive: {
    backgroundColor: HEALTH_ACCENT,
  },
  formatPillLabel: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 13,
    color: colors.textSecondary,
  },
  formatPillLabelActive: {
    color: '#FFFFFF',
  },
  formatPillDesc: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
  },
  formatPillDescActive: {
    color: 'rgba(255,255,255,0.8)',
  },

  // Date presets
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 12,
  },
  presetPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: HEALTH_SURFACES.lift,
  },
  presetPillActive: {
    backgroundColor: HEALTH_ACCENT,
  },
  presetPillText: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.1 * 11,
    color: colors.textSecondary,
  },
  presetPillTextActive: {
    color: '#FFFFFF',
  },

  // Date range card
  dateCard: {
    marginHorizontal: 16,
    marginTop: 0,
    marginBottom: 16,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  dateLabel: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.1 * 10,
    color: colors.textSecondary,
  },
  dateValue: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 14,
    color: colors.text,
  },
  dateDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },

  // Data types card
  typesCard: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  typeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: HEALTH_ACCENT,
    borderColor: HEALTH_ACCENT,
  },
  checkmark: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  typeIcon: {
    fontSize: 18,
  },
  typeLabel: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 15,
    color: colors.text,
  },
  typeDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.04)',
    marginHorizontal: 16,
  },

  // Preview card
  previewCard: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 24,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  previewLabel: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  previewValue: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 13,
    color: colors.text,
  },

  // Export button
  buttonContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
  },
  loadingText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: colors.textSecondary,
  },

  // Report output
  reportCard: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
  },
  reportText: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.text,
  },
});
