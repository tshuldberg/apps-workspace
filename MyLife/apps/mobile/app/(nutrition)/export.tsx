import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';
import {
  GlassCard,
  MaterialSymbol,
  NU_ACCENT,
  NU_ACCENT_DARK,
  NU_ACCENT_LIGHT,
  NU_FONT_BOLD,
  NU_FONT_MEDIUM,
  NU_FONT_REGULAR,
  NU_FONT_SEMIBOLD,
  NU_SURFACES,
  NU_TEXT,
  NU_TEXT_SECONDARY,
  NU_TEXT_TERTIARY,
  NU_TYPOGRAPHY,
  SectionHeader,
  exportFoodLogCSV,
} from '@mylife/nutrition';
import { useDatabase } from '../../components/DatabaseProvider';

type DatePresetKey = 'today' | '7d' | '30d' | '90d' | 'all' | 'custom';
type ExportFormat = 'csv' | 'json' | 'pdf';
type ExportSectionKey =
  | 'foodLog'
  | 'waterLog'
  | 'dailyNotes'
  | 'goalsHistory'
  | 'customFoods'
  | 'mealTemplates'
  | 'restaurants';

type ExportSection = {
  key: ExportSectionKey;
  label: string;
  description: string;
};

type ExportPreview = {
  content: string;
  fileName: string;
  mimeType: string;
  estimatedBytes: number;
  rowCount: number;
  description: string;
};

const DATE_PRESETS: Array<{ key: DatePresetKey; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: 'Last 7 Days' },
  { key: '30d', label: 'Last 30 Days' },
  { key: '90d', label: 'Last 90 Days' },
  { key: 'all', label: 'All Time' },
  { key: 'custom', label: 'Custom' },
];

const FORMAT_OPTIONS: Array<{ key: ExportFormat; label: string }> = [
  { key: 'csv', label: 'CSV' },
  { key: 'json', label: 'JSON' },
  { key: 'pdf', label: 'PDF' },
];

const SECTION_OPTIONS: ExportSection[] = [
  {
    key: 'foodLog',
    label: 'Food log',
    description: 'Diary entries, servings, and macro totals.',
  },
  {
    key: 'waterLog',
    label: 'Water log',
    description: 'Hydration entries with amount and source.',
  },
  {
    key: 'dailyNotes',
    label: 'Daily notes',
    description: 'Reflections and nutrition note tags.',
  },
  {
    key: 'goalsHistory',
    label: 'Goals history',
    description: 'Every saved calorie and macro target.',
  },
  {
    key: 'customFoods',
    label: 'Custom foods',
    description: 'Foods you created locally.',
  },
  {
    key: 'mealTemplates',
    label: 'Meal templates',
    description: 'Saved quick-log meals and counts.',
  },
  {
    key: 'restaurants',
    label: 'Restaurants',
    description: 'Saved chains and menu data.',
  },
];

const DEFAULT_SELECTION: Record<ExportSectionKey, boolean> = {
  foodLog: true,
  waterLog: true,
  dailyNotes: false,
  goalsHistory: true,
  customFoods: true,
  mealTemplates: false,
  restaurants: false,
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function shiftDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function escapeCsvCell(value: unknown) {
  if (value == null) {
    return '';
  }

  const text = String(value).replace(/"/g, '""');
  return `"${text}"`;
}

function formatBytes(size: number) {
  if (size >= 1_000_000) {
    return `${(size / 1_000_000).toFixed(1)} MB`;
  }
  if (size >= 1_000) {
    return `${Math.round(size / 1_000)} KB`;
  }
  return `${size} B`;
}

function getDateRange(preset: DatePresetKey, customStart: string, customEnd: string) {
  const end = today();
  switch (preset) {
    case 'today':
      return { start: end, end };
    case '7d':
      return { start: shiftDays(7), end };
    case '30d':
      return { start: shiftDays(30), end };
    case '90d':
      return { start: shiftDays(90), end };
    case 'all':
      return { start: '1900-01-01', end };
    case 'custom':
    default:
      return { start: customStart, end: customEnd };
  }
}

function querySectionRows(
  db: ReturnType<typeof useDatabase>,
  key: ExportSectionKey,
  startDate: string,
  endDate: string,
) {
  switch (key) {
    case 'foodLog':
      return db.query<Record<string, unknown>>(
        `SELECT
           l.date,
           l.meal_type,
           f.name AS food_name,
           i.serving_count,
           f.serving_unit,
           i.calories,
           i.protein_g,
           i.carbs_g,
           i.fat_g
         FROM nu_food_log_items i
         JOIN nu_food_log l ON l.id = i.log_id
         JOIN nu_foods f ON f.id = i.food_id
         WHERE l.date >= ? AND l.date <= ?
         ORDER BY l.date ASC, l.meal_type ASC`,
        [startDate, endDate],
      );
    case 'waterLog':
      return db.query<Record<string, unknown>>(
        `SELECT date, amount_ml, source, created_at
         FROM nu_water_log
         WHERE date >= ? AND date <= ?
         ORDER BY date ASC, created_at ASC`,
        [startDate, endDate],
      );
    case 'dailyNotes':
      return db.query<Record<string, unknown>>(
        `SELECT date, content, tags, updated_at
         FROM nu_daily_notes
         WHERE date >= ? AND date <= ?
         ORDER BY date ASC`,
        [startDate, endDate],
      );
    case 'goalsHistory':
      return db.query<Record<string, unknown>>(
        `SELECT effective_date, calories, protein_g, carbs_g, fat_g
         FROM nu_daily_goals
         WHERE effective_date >= ? AND effective_date <= ?
         ORDER BY effective_date ASC`,
        [startDate, endDate],
      );
    case 'customFoods':
      return db.query<Record<string, unknown>>(
        `SELECT name, brand, serving_size, serving_unit, calories, protein_g, carbs_g, fat_g, created_at
         FROM nu_foods
         WHERE source = 'custom' AND date(created_at) >= ? AND date(created_at) <= ?
         ORDER BY created_at ASC`,
        [startDate, endDate],
      );
    case 'mealTemplates':
      return db.query<Record<string, unknown>>(
        `SELECT
           t.name,
           t.meal_type,
           COUNT(i.id) AS item_count,
           t.created_at,
           t.updated_at
         FROM nu_meal_templates t
         LEFT JOIN nu_meal_template_items i ON i.template_id = t.id
         WHERE date(t.created_at) >= ? AND date(t.created_at) <= ?
         GROUP BY t.id
         ORDER BY t.updated_at DESC`,
        [startDate, endDate],
      );
    case 'restaurants':
      return db.query<Record<string, unknown>>(
        `SELECT
           r.name,
           r.category,
           r.source,
           r.verified,
           COUNT(m.id) AS menu_count,
           r.created_at
         FROM nu_restaurants r
         LEFT JOIN nu_menu_items m ON m.restaurant_id = r.id
         WHERE date(r.created_at) >= ? AND date(r.created_at) <= ?
         GROUP BY r.id
         ORDER BY r.name ASC`,
        [startDate, endDate],
      );
    default:
      return [];
  }
}

function buildCsvContent(
  db: ReturnType<typeof useDatabase>,
  selectedKeys: ExportSectionKey[],
  startDate: string,
  endDate: string,
) {
  const sections: string[] = [];
  let rowCount = 0;

  selectedKeys.forEach((key) => {
    if (key === 'foodLog') {
      const csv = exportFoodLogCSV(db, startDate, endDate);
      const rows = csv.split('\n').filter(Boolean);
      rowCount += Math.max(0, rows.length - 1);
      sections.push(`# FOOD LOG\n${csv}`);
      return;
    }

    const rows = querySectionRows(db, key, startDate, endDate);
    rowCount += rows.length;
    const header = rows[0] ? Object.keys(rows[0]) : ['empty'];
    const body =
      rows.length === 0
        ? `${header.join(',')}\n`
        : [
            header.join(','),
            ...rows.map((row) => header.map((column) => escapeCsvCell(row[column])).join(',')),
          ].join('\n');

    sections.push(`# ${key.toUpperCase()}\n${body}`);
  });

  return {
    content: sections.join('\n\n'),
    rowCount,
    description: 'Sectioned CSV bundle with one block per selected data type.',
  };
}

function buildJsonContent(
  db: ReturnType<typeof useDatabase>,
  selectedKeys: ExportSectionKey[],
  startDate: string,
  endDate: string,
) {
  const payload: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    range: { startDate, endDate },
  };
  let rowCount = 0;

  selectedKeys.forEach((key) => {
    const rows = querySectionRows(db, key, startDate, endDate);
    payload[key] = rows;
    rowCount += rows.length;
  });

  return {
    content: JSON.stringify(payload, null, 2),
    rowCount,
    description: 'Structured JSON export that keeps each selected section as its own array.',
  };
}

function buildPrintableHtml(
  db: ReturnType<typeof useDatabase>,
  selectedKeys: ExportSectionKey[],
  startDate: string,
  endDate: string,
) {
  let rowCount = 0;
  const sections = selectedKeys
    .map((key) => {
      const rows = querySectionRows(db, key, startDate, endDate);
      rowCount += rows.length;
      const headers = rows[0] ? Object.keys(rows[0]) : [];
      const tableRows =
        rows.length === 0
          ? '<tr><td colspan="6">No rows in the selected range.</td></tr>'
          : rows
              .map(
                (row) =>
                  `<tr>${headers
                    .map((column) => `<td>${String(row[column] ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`)
                    .join('')}</tr>`,
              )
              .join('');

      return `
        <section>
          <h2>${key}</h2>
          <table>
            <thead>
              <tr>${headers.map((header) => `<th>${header}</th>`).join('')}</tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
        </section>
      `;
    })
    .join('');

  const content = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>MyNutrition Export</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 24px; color: #131318; }
    h1 { margin-bottom: 6px; }
    p { color: #5b5661; margin-top: 0; }
    section { margin-top: 28px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { text-align: left; padding: 8px; border-bottom: 1px solid #ddd; vertical-align: top; }
    th { background: #f4efe9; }
  </style>
</head>
<body>
  <h1>MyNutrition Export</h1>
  <p>Range ${startDate} to ${endDate}. Shared as printable HTML in this build.</p>
  ${sections}
</body>
</html>`;

  return {
    content,
    rowCount,
    description: 'Printable export report shared as HTML in this build.',
  };
}

function buildExportPreview(
  db: ReturnType<typeof useDatabase>,
  format: ExportFormat,
  selectedKeys: ExportSectionKey[],
  startDate: string,
  endDate: string,
): ExportPreview {
  const baseName = `mynutrition-export-${startDate}-to-${endDate}`;
  let content = '';
  let rowCount = 0;
  let description = '';
  let fileName = `${baseName}.csv`;
  let mimeType = 'text/csv';

  if (format === 'csv') {
    const bundle = buildCsvContent(db, selectedKeys, startDate, endDate);
    content = bundle.content;
    rowCount = bundle.rowCount;
    description = bundle.description;
    fileName = `${baseName}.csv`;
    mimeType = 'text/csv';
  } else if (format === 'json') {
    const bundle = buildJsonContent(db, selectedKeys, startDate, endDate);
    content = bundle.content;
    rowCount = bundle.rowCount;
    description = bundle.description;
    fileName = `${baseName}.json`;
    mimeType = 'application/json';
  } else {
    const bundle = buildPrintableHtml(db, selectedKeys, startDate, endDate);
    content = bundle.content;
    rowCount = bundle.rowCount;
    description = bundle.description;
    fileName = `${baseName}.html`;
    mimeType = 'text/html';
  }

  return {
    content,
    fileName,
    mimeType,
    estimatedBytes: content.length,
    rowCount,
    description,
  };
}

export default function ExportScreen() {
  const db = useDatabase();
  const [preset, setPreset] = useState<DatePresetKey>('30d');
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [customStart, setCustomStart] = useState(shiftDays(30));
  const [customEnd, setCustomEnd] = useState(today());
  const [selection, setSelection] = useState(DEFAULT_SELECTION);
  const [exporting, setExporting] = useState(false);

  const range = useMemo(() => getDateRange(preset, customStart, customEnd), [customEnd, customStart, preset]);
  const selectedKeys = useMemo(
    () => SECTION_OPTIONS.filter((section) => selection[section.key]).map((section) => section.key),
    [selection],
  );

  const preview = useMemo(
    () => buildExportPreview(db, format, selectedKeys, range.start, range.end),
    [db, format, range.end, range.start, selectedKeys],
  );

  const toggleSection = (key: ExportSectionKey) => {
    setSelection((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const handleExport = async () => {
    if (selectedKeys.length === 0) {
      Alert.alert('Select data', 'Choose at least one nutrition data section before exporting.');
      return;
    }

    if (!isIsoDate(range.start) || !isIsoDate(range.end) || range.start > range.end) {
      Alert.alert('Invalid dates', 'Use valid YYYY-MM-DD dates and keep the start date before the end date.');
      return;
    }

    setExporting(true);
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        throw new Error('Sharing is not available on this device.');
      }

      const targetDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!targetDir) {
        throw new Error('Export storage is not available.');
      }

      const uri = `${targetDir}${preview.fileName}`;
      await FileSystem.writeAsStringAsync(uri, preview.content, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      await Sharing.shareAsync(uri, {
        mimeType: preview.mimeType,
        dialogTitle: 'Export MyNutrition Data',
      });
    } catch (error) {
      Alert.alert(
        'Export failed',
        error instanceof Error ? error.message : 'MyNutrition could not create the export file.',
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>DATA</Text>
        <Text style={styles.title}>Export</Text>
        <Text style={styles.subtitle}>Choose a time range, select included sections, preview the bundle, and share it as a real file.</Text>
      </View>

      <GlassCard elevated style={styles.card}>
        <SectionHeader title="Date Range" accent={NU_TEXT} />
        <View style={styles.inlineOptions}>
          {DATE_PRESETS.map((option) => {
            const active = preset === option.key;
            return (
              <Pressable
                key={option.key}
                onPress={() => setPreset(option.key)}
                style={[styles.optionChip, active ? styles.optionChipActive : null]}
              >
                <Text style={[styles.optionLabel, active ? styles.optionLabelActive : null]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {preset === 'custom' ? (
          <View style={styles.customDates}>
            <DateInput label="Start" value={customStart} onChangeText={setCustomStart} />
            <DateInput label="End" value={customEnd} onChangeText={setCustomEnd} />
          </View>
        ) : (
          <View style={styles.rangeBadge}>
            <MaterialSymbol name="schedule" size={16} color={NU_ACCENT_LIGHT} />
            <Text style={styles.rangeBadgeText}>{range.start} to {range.end}</Text>
          </View>
        )}
      </GlassCard>

      <GlassCard style={styles.card}>
        <SectionHeader title="Format" accent={NU_TEXT} />
        <View style={styles.inlineOptions}>
          {FORMAT_OPTIONS.map((option) => {
            const active = format === option.key;
            return (
              <Pressable
                key={option.key}
                onPress={() => setFormat(option.key)}
                style={[styles.optionChip, active ? styles.optionChipActive : null]}
              >
                <Text style={[styles.optionLabel, active ? styles.optionLabelActive : null]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </GlassCard>

      <GlassCard style={styles.card}>
        <SectionHeader
          title="Included Data"
          accent={NU_TEXT}
          action={<MetricPill label="Selected" value={`${selectedKeys.length} sections`} />}
        />
        <View style={styles.sectionList}>
          {SECTION_OPTIONS.map((section) => (
            <Pressable key={section.key} onPress={() => toggleSection(section.key)} style={styles.sectionRow}>
              <View style={styles.sectionCopy}>
                <Text style={styles.sectionTitle}>{section.label}</Text>
                <Text style={styles.sectionSubtitle}>{section.description}</Text>
              </View>
              <View style={[styles.checkbox, selection[section.key] ? styles.checkboxActive : null]}>
                {selection[section.key] ? <MaterialSymbol name="check_circle" size={16} color={NU_ACCENT_DARK} /> : null}
              </View>
            </Pressable>
          ))}
        </View>
      </GlassCard>

      <GlassCard style={styles.card}>
        <SectionHeader
          title="Preview"
          accent={NU_TEXT}
          action={<MetricPill label="Rows" value={String(preview.rowCount)} />}
        />
        <View style={styles.previewStats}>
          <PreviewStat label="Format" value={format.toUpperCase()} />
          <PreviewStat label="Size" value={formatBytes(preview.estimatedBytes)} />
          <PreviewStat label="File" value={preview.fileName.split('.').pop()?.toUpperCase() ?? 'FILE'} />
        </View>
        <Text style={styles.previewDescription}>{preview.description}</Text>
      </GlassCard>

      <Pressable onPress={handleExport} disabled={exporting}>
        <LinearGradient colors={[NU_ACCENT_LIGHT, NU_ACCENT]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.primaryButton, exporting ? styles.buttonDisabled : null]}>
          <MaterialSymbol name="download" size={18} color={NU_ACCENT_DARK} />
          <Text style={styles.primaryButtonLabel}>{exporting ? 'Preparing export' : 'Export Data'}</Text>
        </LinearGradient>
      </Pressable>
    </ScrollView>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricPill}>
      <Text style={styles.metricPillLabel}>{label}</Text>
      <Text style={styles.metricPillValue}>{value}</Text>
    </View>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.previewStat}>
      <Text style={styles.previewStatLabel}>{label}</Text>
      <Text style={styles.previewStatValue}>{value}</Text>
    </View>
  );
}

function DateInput({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.dateInputCell}>
      <Text style={styles.dateInputLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={NU_TEXT_TERTIARY}
        style={styles.dateInput}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: NU_SURFACES.lowest,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 18,
  },
  hero: {
    gap: 6,
    paddingTop: 8,
  },
  eyebrow: {
    ...NU_TYPOGRAPHY.labelUpper,
    color: NU_ACCENT_LIGHT,
  },
  title: {
    ...NU_TYPOGRAPHY.displayLg,
    fontSize: 40,
    lineHeight: 44,
    color: NU_TEXT,
  },
  subtitle: {
    ...NU_TYPOGRAPHY.bodyMd,
    color: NU_TEXT_SECONDARY,
  },
  card: {
    gap: 16,
  },
  inlineOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: NU_SURFACES.high,
  },
  optionChipActive: {
    backgroundColor: 'rgba(201, 137, 77, 0.22)',
  },
  optionLabel: {
    fontFamily: NU_FONT_MEDIUM,
    fontSize: 12,
    color: NU_TEXT_SECONDARY,
  },
  optionLabelActive: {
    color: NU_ACCENT_LIGHT,
  },
  customDates: {
    flexDirection: 'row',
    gap: 12,
  },
  dateInputCell: {
    flex: 1,
    gap: 8,
  },
  dateInputLabel: {
    ...NU_TYPOGRAPHY.labelUpper,
    color: NU_TEXT_TERTIARY,
  },
  dateInput: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: NU_SURFACES.high,
    paddingHorizontal: 14,
    color: NU_TEXT,
    fontFamily: NU_FONT_SEMIBOLD,
    fontSize: 14,
  },
  rangeBadge: {
    borderRadius: 999,
    backgroundColor: 'rgba(255, 184, 119, 0.16)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
  },
  rangeBadgeText: {
    fontFamily: NU_FONT_MEDIUM,
    fontSize: 12,
    color: NU_ACCENT_LIGHT,
  },
  sectionList: {
    gap: 12,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionCopy: {
    flex: 1,
    gap: 4,
  },
  sectionTitle: {
    fontFamily: NU_FONT_SEMIBOLD,
    fontSize: 14,
    color: NU_TEXT,
  },
  sectionSubtitle: {
    fontFamily: NU_FONT_REGULAR,
    fontSize: 12,
    lineHeight: 18,
    color: NU_TEXT_SECONDARY,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: NU_SURFACES.high,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: NU_ACCENT_LIGHT,
  },
  previewStats: {
    flexDirection: 'row',
    gap: 12,
  },
  previewStat: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: NU_SURFACES.low,
    padding: 14,
    gap: 6,
  },
  previewStatLabel: {
    ...NU_TYPOGRAPHY.labelUpper,
    color: NU_TEXT_TERTIARY,
  },
  previewStatValue: {
    fontFamily: NU_FONT_BOLD,
    fontSize: 16,
    color: NU_TEXT,
  },
  previewDescription: {
    ...NU_TYPOGRAPHY.bodyMd,
    color: NU_TEXT_SECONDARY,
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  primaryButtonLabel: {
    fontFamily: NU_FONT_BOLD,
    fontSize: 14,
    color: NU_ACCENT_DARK,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  metricPill: {
    borderRadius: 999,
    backgroundColor: NU_SURFACES.high,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 2,
  },
  metricPillLabel: {
    ...NU_TYPOGRAPHY.labelUpper,
    color: NU_TEXT_TERTIARY,
  },
  metricPillValue: {
    fontFamily: NU_FONT_SEMIBOLD,
    fontSize: 12,
    color: NU_TEXT,
  },
});
