import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  View,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  GlassCard,
  MaterialSymbol,
  SectionHeader,
  MD_ACCENT_LIGHT,
  MD_FONTS,
  MD_SURFACES,
  MD_TEXT,
  MD_TEXT_SECONDARY,
  MD_TEXT_TERTIARY,
  MD_TYPOGRAPHY,
  withAlpha,
} from '@mylife/meds/ui';
import { ErrorState } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

type ExportFormat = 'pdf' | 'csv' | 'json';

type ExportSection =
  | 'medications'
  | 'bp'
  | 'glucose'
  | 'insulin'
  | 'mood'
  | 'symptoms';

type ExportHistoryItem = {
  id: string;
  format: ExportFormat;
  createdAt: string;
  periodDays: number;
  sectionCount: number;
  content: string;
  extension: string;
};

const EXPORT_HISTORY_KEY = 'meds.export_history';

const FORMAT_META: Record<ExportFormat, { label: string; accent: string; extension: string }> = {
  pdf: { label: 'PDF Style', accent: '#C9894D', extension: 'txt' },
  csv: { label: 'CSV', accent: MD_ACCENT_LIGHT, extension: 'csv' },
  json: { label: 'JSON', accent: '#8BCFF0', extension: 'json' },
};

const SECTION_META: Array<{
  key: ExportSection;
  label: string;
  description: string;
}> = [
  { key: 'medications', label: 'Medications + doses', description: 'Active meds and logged dosing.' },
  { key: 'bp', label: 'BP readings', description: 'Blood pressure and pulse history.' },
  { key: 'glucose', label: 'Glucose readings', description: 'Glucose trends and context.' },
  { key: 'insulin', label: 'Insulin entries', description: 'Insulin type, site, and units.' },
  { key: 'mood', label: 'Mood entries', description: 'Mood, pleasantness, and intensity.' },
  { key: 'symptoms', label: 'Symptoms', description: 'Symptoms and severity logs.' },
];

const PERIOD_OPTIONS = [7, 30, 90, 365];

function loadHistory(db: ReturnType<typeof useDatabase>): ExportHistoryItem[] {
  const row = db.query<{ value: string }>(
    'SELECT value FROM md_settings WHERE key = ?',
    [EXPORT_HISTORY_KEY],
  )[0];
  if (!row?.value) {
    return [];
  }
  try {
    const parsed = JSON.parse(row.value) as ExportHistoryItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(db: ReturnType<typeof useDatabase>, items: ExportHistoryItem[]) {
  const updatedAt = new Date().toISOString();
  db.execute(
    `INSERT INTO md_settings (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [EXPORT_HISTORY_KEY, JSON.stringify(items.slice(0, 8)), updatedAt],
  );
}

function toCsvValue(value: unknown) {
  if (value == null) {
    return '';
  }
  const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
  return `"${stringValue.replace(/"/g, '""')}"`;
}

function buildExportPayload(
  db: ReturnType<typeof useDatabase>,
  from: string,
  to: string,
  sections: Record<ExportSection, boolean>,
) {
  const payload: Record<string, unknown> = {
    meta: {
      generatedAt: new Date().toISOString(),
      from,
      to,
    },
  };

  if (sections.medications) {
    payload.medications = {
      items: db.query(
        `SELECT id, name, dosage, frequency, is_active, created_at
         FROM md_medications
         ORDER BY is_active DESC, name ASC`,
      ),
      doses: db.query(
        `SELECT medication_id, scheduled_time, actual_time, status
         FROM md_dose_logs
         WHERE scheduled_time >= ? AND scheduled_time <= ?
         ORDER BY scheduled_time DESC
         LIMIT 250`,
        [from, to],
      ),
    };
  }

  if (sections.bp) {
    payload.bp = db.query(
      `SELECT measured_at, systolic, diastolic, pulse, category
       FROM md_bp_readings
       WHERE measured_at >= ? AND measured_at <= ?
       ORDER BY measured_at DESC`,
      [from, to],
    );
  }

  if (sections.glucose) {
    payload.glucose = db.query(
      `SELECT recorded_at, value, unit, context, range_status
       FROM md_glucose_readings
       WHERE recorded_at >= ? AND recorded_at <= ?
       ORDER BY recorded_at DESC`,
      [from, to],
    );
  }

  if (sections.insulin) {
    payload.insulin = db.query(
      `SELECT recorded_at, insulin_type, units, site_name, notes
       FROM md_insulin_entries
       WHERE recorded_at >= ? AND recorded_at <= ?
       ORDER BY recorded_at DESC`,
      [from, to],
    );
  }

  if (sections.mood) {
    payload.mood = db.query(
      `SELECT recorded_at, mood, pleasantness, energy_level, intensity
       FROM md_mood_entries
       WHERE recorded_at >= ? AND recorded_at <= ?
       ORDER BY recorded_at DESC`,
      [from, to],
    );
  }

  if (sections.symptoms) {
    payload.symptoms = db.query(
      `SELECT sl.logged_at, s.name, sl.severity, sl.notes
       FROM md_symptom_logs sl
       JOIN md_symptoms s ON s.id = sl.symptom_id
       WHERE sl.logged_at >= ? AND sl.logged_at <= ?
       ORDER BY sl.logged_at DESC`,
      [from, to],
    );
  }

  return payload;
}

function buildDocumentExport(payload: Record<string, unknown>) {
  const meta = payload.meta as { generatedAt: string; from: string; to: string };
  const lines = [
    'MyMeds Clinical Export',
    `Generated: ${meta.generatedAt}`,
    `Range: ${meta.from} to ${meta.to}`,
    '',
  ];

  if (payload.medications) {
    const meds = payload.medications as {
      items: Array<Record<string, unknown>>;
      doses: Array<Record<string, unknown>>;
    };
    lines.push(`Medications (${meds.items.length})`);
    meds.items.slice(0, 10).forEach((med) => {
      lines.push(`- ${(med.name as string) ?? 'Medication'} • ${(med.dosage as string) ?? 'dose n/a'} • ${(med.frequency as string) ?? 'custom'}`);
    });
    lines.push(`Dose logs: ${meds.doses.length}`);
    lines.push('');
  }

  if (payload.bp) {
    const bp = payload.bp as Array<Record<string, unknown>>;
    lines.push(`Blood Pressure (${bp.length})`);
    bp.slice(0, 8).forEach((entry) => {
      lines.push(`- ${entry.measured_at as string}: ${entry.systolic as number}/${entry.diastolic as number}`);
    });
    lines.push('');
  }

  if (payload.glucose) {
    const glucose = payload.glucose as Array<Record<string, unknown>>;
    lines.push(`Glucose (${glucose.length})`);
    glucose.slice(0, 8).forEach((entry) => {
      lines.push(`- ${entry.recorded_at as string}: ${entry.value as number} ${(entry.unit as string) ?? 'mg/dL'}`);
    });
    lines.push('');
  }

  if (payload.insulin) {
    const insulin = payload.insulin as Array<Record<string, unknown>>;
    lines.push(`Insulin (${insulin.length})`);
    insulin.slice(0, 8).forEach((entry) => {
      lines.push(`- ${entry.recorded_at as string}: ${entry.units as number}u ${(entry.insulin_type as string) ?? 'insulin'}`);
    });
    lines.push('');
  }

  if (payload.mood) {
    const mood = payload.mood as Array<Record<string, unknown>>;
    lines.push(`Mood (${mood.length})`);
    mood.slice(0, 8).forEach((entry) => {
      lines.push(`- ${entry.recorded_at as string}: ${entry.mood as string} • ${(entry.pleasantness as string) ?? 'neutral'}`);
    });
    lines.push('');
  }

  if (payload.symptoms) {
    const symptoms = payload.symptoms as Array<Record<string, unknown>>;
    lines.push(`Symptoms (${symptoms.length})`);
    symptoms.slice(0, 8).forEach((entry) => {
      lines.push(`- ${entry.logged_at as string}: ${entry.name as string} • severity ${entry.severity as number}`);
    });
  }

  return lines.join('\n').trim();
}

function buildCsvExport(payload: Record<string, unknown>) {
  const rows = ['section,payload'];
  for (const [key, value] of Object.entries(payload)) {
    rows.push([toCsvValue(key), toCsvValue(value)].join(','));
  }
  return rows.join('\n');
}

function Pill({
  label,
  active,
  color,
  onPress,
}: {
  label: string;
  active?: boolean;
  color: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.pill,
        { backgroundColor: active ? withAlpha(color, 0.18) : MD_SURFACES.high },
      ]}
    >
      <RNText style={[styles.pillText, { color: active ? color : MD_TEXT_SECONDARY }]}>
        {label}
      </RNText>
    </Pressable>
  );
}

export default function ExportScreen() {
  const db = useDatabase();
  const [tick, setTick] = useState(0);
  const [periodDays, setPeriodDays] = useState(30);
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [sections, setSections] = useState<Record<ExportSection, boolean>>({
    medications: true,
    bp: true,
    glucose: true,
    insulin: true,
    mood: false,
    symptoms: false,
  });
  const [sharingId, setSharingId] = useState<string | null>(null);

  const data = useMemo(() => {
    try {
      const toDate = new Date();
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - periodDays);
      const from = fromDate.toISOString().slice(0, 10);
      const to = toDate.toISOString().slice(0, 10);
      const payload = buildExportPayload(db, from, to, sections);
      const content = format === 'json'
        ? JSON.stringify(payload, null, 2)
        : format === 'csv'
          ? buildCsvExport(payload)
          : buildDocumentExport(payload);
      return {
        content,
        error: null,
        from,
        history: loadHistory(db),
        selectedCount: Object.values(sections).filter(Boolean).length,
        to,
      };
    } catch {
      return {
        content: '',
        error: 'Failed to prepare the export payload.',
        from: '',
        history: [] as ExportHistoryItem[],
        selectedCount: 0,
        to: '',
      };
    }
  }, [db, format, periodDays, sections, tick]);

  const refresh = () => setTick((value) => value + 1);

  const shareItem = async (item: ExportHistoryItem) => {
    setSharingId(item.id);
    try {
      const filePath = `${FileSystem.cacheDirectory}${item.id}.${item.extension}`;
      await FileSystem.writeAsStringAsync(filePath, item.content);
      await Sharing.shareAsync(filePath, {
        dialogTitle: `MyMeds ${item.format.toUpperCase()} export`,
        mimeType: item.format === 'json' ? 'application/json' : item.format === 'csv' ? 'text/csv' : 'text/plain',
      });
    } catch {
      Alert.alert('Unable to share export', 'Please try again.');
    } finally {
      setSharingId(null);
    }
  };

  const generateExport = async () => {
    try {
      const meta = FORMAT_META[format];
      const item: ExportHistoryItem = {
        id: uuid(),
        format,
        createdAt: new Date().toISOString(),
        periodDays,
        sectionCount: data.selectedCount,
        content: data.content,
        extension: meta.extension,
      };
      saveHistory(db, [item, ...data.history]);
      await shareItem(item);
      refresh();
    } catch {
      Alert.alert('Unable to generate export', 'Please try again.');
    }
  };

  if (data.error) {
    return (
      <View style={styles.errorShell}>
        <ErrorState message={data.error} onRetry={refresh} />
      </View>
    );
  }

  const previewLines = data.content.split('\n').slice(0, 10);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.heroCopy}>
        <RNText style={styles.eyebrow}>Report Generator</RNText>
        <RNText style={styles.heroTitle}>Export Data</RNText>
        <RNText style={styles.heroBody}>
          Compile the exact slices of your health record you need and share them
          in a clinician-friendly document, CSV, or structured JSON export.
        </RNText>
      </View>

      <GlassCard padding={20}>
        <SectionHeader title="Format" />
        <View style={styles.pillRow}>
          {(Object.keys(FORMAT_META) as ExportFormat[]).map((value) => {
            const meta = FORMAT_META[value];
            return (
              <Pill
                key={value}
                active={format === value}
                color={meta.accent}
                label={meta.label}
                onPress={() => setFormat(value)}
              />
            );
          })}
        </View>
      </GlassCard>

      <GlassCard padding={20}>
        <SectionHeader title="Date Range" />
        <View style={styles.dateRow}>
          <View style={styles.dateCard}>
            <RNText style={styles.dateLabel}>Start</RNText>
            <RNText style={styles.dateValue}>{data.from}</RNText>
          </View>
          <View style={styles.dateCard}>
            <RNText style={styles.dateLabel}>End</RNText>
            <RNText style={styles.dateValue}>{data.to}</RNText>
          </View>
        </View>
        <View style={styles.pillRow}>
          {PERIOD_OPTIONS.map((value) => (
            <Pill
              key={value}
              active={periodDays === value}
              color={MD_ACCENT_LIGHT}
              label={`${value} days`}
              onPress={() => setPeriodDays(value)}
            />
          ))}
        </View>
      </GlassCard>

      <GlassCard padding={20}>
        <SectionHeader title="Included Data" />
        <View style={styles.sectionList}>
          {SECTION_META.map((section) => (
            <Pressable
              key={section.key}
              onPress={() => setSections((current) => ({
                ...current,
                [section.key]: !current[section.key],
              }))}
              style={styles.checkRow}
            >
              <View
                style={[
                  styles.checkIcon,
                  {
                    backgroundColor: sections[section.key]
                      ? withAlpha(MD_ACCENT_LIGHT, 0.18)
                      : MD_SURFACES.high,
                  },
                ]}
              >
                <MaterialSymbol
                  color={sections[section.key] ? MD_ACCENT_LIGHT : MD_TEXT_TERTIARY}
                  filled={sections[section.key]}
                  name="check_circle"
                  size={18}
                />
              </View>
              <View style={styles.checkCopy}>
                <RNText style={styles.checkTitle}>{section.label}</RNText>
                <RNText style={styles.checkDescription}>{section.description}</RNText>
              </View>
            </Pressable>
          ))}
        </View>
      </GlassCard>

      <GlassCard padding={20}>
        <SectionHeader title="Preview" />
        <View style={styles.previewCard}>
          <View style={styles.previewHeader}>
            <RNText style={styles.previewLabel}>
              {FORMAT_META[format].label}
            </RNText>
            <RNText style={styles.previewMeta}>
              {data.selectedCount} sections selected
            </RNText>
          </View>
          <View style={styles.previewSheet}>
            {previewLines.map((line, index) => (
              <RNText
                key={`${line}-${index}`}
                numberOfLines={1}
                style={index === 0 ? styles.previewHeading : styles.previewLine}
              >
                {line || ' '}
              </RNText>
            ))}
          </View>
        </View>

        <Pressable onPress={generateExport} style={styles.generateButton}>
          <MaterialSymbol color="#001F2A" name="description" size={20} />
          <RNText style={styles.generateButtonText}>
            {sharingId ? 'Preparing…' : 'Generate Export'}
          </RNText>
        </Pressable>

        {format === 'pdf' ? (
          <RNText style={styles.disclaimer}>
            PDF mode currently exports a polished document-style summary file in
            this repo because native PDF generation is not wired yet.
          </RNText>
        ) : null}
      </GlassCard>

      <GlassCard padding={20}>
        <SectionHeader title="Recent Exports" />
        <View style={styles.historyList}>
          {data.history.length === 0 ? (
            <RNText style={styles.emptyCopy}>
              No exports saved yet. Generate one to keep a local history.
            </RNText>
          ) : (
            data.history.map((item) => (
              <View key={item.id} style={styles.historyCard}>
                <View style={styles.historyCopy}>
                  <RNText style={styles.historyTitle}>
                    {FORMAT_META[item.format].label} • {item.sectionCount} sections
                  </RNText>
                  <RNText style={styles.historyMeta}>
                    {new Date(item.createdAt).toLocaleString()} • {item.periodDays} days
                  </RNText>
                </View>
                <Pressable onPress={() => shareItem(item)} style={styles.shareButton}>
                  <MaterialSymbol color={MD_ACCENT_LIGHT} name="share" size={18} />
                </Pressable>
              </View>
            ))
          )}
        </View>
      </GlassCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: MD_SURFACES.base,
    flex: 1,
  },
  content: {
    gap: 16,
    padding: 20,
    paddingBottom: 140,
  },
  errorShell: {
    backgroundColor: MD_SURFACES.base,
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  heroCopy: {
    gap: 6,
  },
  eyebrow: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_ACCENT_LIGHT,
  },
  heroTitle: {
    ...MD_TYPOGRAPHY.displayLg,
    color: MD_TEXT,
    fontSize: 40,
    lineHeight: 44,
  },
  heroBody: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 18,
  },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pillText: {
    fontFamily: MD_FONTS.medium,
    fontSize: 12,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  dateCard: {
    backgroundColor: MD_SURFACES.low,
    borderRadius: 18,
    flex: 1,
    gap: 4,
    padding: 14,
  },
  dateLabel: {
    color: MD_TEXT_TERTIARY,
    fontFamily: MD_FONTS.medium,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  dateValue: {
    color: MD_TEXT,
    fontFamily: MD_FONTS.semiBold,
    fontSize: 14,
  },
  sectionList: {
    gap: 10,
    marginTop: 18,
  },
  checkRow: {
    alignItems: 'center',
    backgroundColor: MD_SURFACES.low,
    borderRadius: 18,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  checkIcon: {
    alignItems: 'center',
    borderRadius: 16,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  checkCopy: {
    flex: 1,
    gap: 2,
  },
  checkTitle: {
    color: MD_TEXT,
    fontFamily: MD_FONTS.semiBold,
    fontSize: 14,
  },
  checkDescription: {
    color: MD_TEXT_SECONDARY,
    fontFamily: MD_FONTS.regular,
    fontSize: 12,
  },
  previewCard: {
    gap: 12,
    marginTop: 18,
  },
  previewHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  previewLabel: {
    color: MD_ACCENT_LIGHT,
    fontFamily: MD_FONTS.bold,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  previewMeta: {
    color: MD_TEXT_TERTIARY,
    fontFamily: MD_FONTS.medium,
    fontSize: 12,
  },
  previewSheet: {
    backgroundColor: MD_SURFACES.low,
    borderRadius: 24,
    gap: 8,
    minHeight: 220,
    padding: 18,
  },
  previewHeading: {
    color: MD_TEXT,
    fontFamily: MD_FONTS.bold,
    fontSize: 16,
  },
  previewLine: {
    color: MD_TEXT_SECONDARY,
    fontFamily: MD_FONTS.regular,
    fontSize: 12,
  },
  generateButton: {
    alignItems: 'center',
    backgroundColor: MD_ACCENT_LIGHT,
    borderRadius: 20,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 18,
    paddingVertical: 15,
  },
  generateButtonText: {
    color: '#001F2A',
    fontFamily: MD_FONTS.bold,
    fontSize: 14,
  },
  disclaimer: {
    color: MD_TEXT_TERTIARY,
    fontFamily: MD_FONTS.regular,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
    textAlign: 'center',
  },
  historyList: {
    gap: 10,
    marginTop: 18,
  },
  emptyCopy: {
    color: MD_TEXT_SECONDARY,
    fontFamily: MD_FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
  },
  historyCard: {
    alignItems: 'center',
    backgroundColor: MD_SURFACES.low,
    borderRadius: 20,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    padding: 14,
  },
  historyCopy: {
    flex: 1,
    gap: 2,
  },
  historyTitle: {
    color: MD_TEXT,
    fontFamily: MD_FONTS.semiBold,
    fontSize: 14,
  },
  historyMeta: {
    color: MD_TEXT_SECONDARY,
    fontFamily: MD_FONTS.regular,
    fontSize: 12,
  },
  shareButton: {
    alignItems: 'center',
    backgroundColor: MD_SURFACES.high,
    borderRadius: 999,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
});
