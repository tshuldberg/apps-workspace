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
import {
  GlassCard,
  HB_ACCENT,
  HB_ACCENT_LIGHT,
  HB_FONTS,
  HB_SURFACES,
  HB_TEXT,
  HB_TEXT_SECONDARY,
  HB_TEXT_TERTIARY,
  HB_TYPOGRAPHY,
  MaterialSymbol,
  SectionHeader,
  StatTile,
  withAlpha,
} from '@mylife/habits';
import { useDatabase } from '../../components/DatabaseProvider';

type ExportFormat = 'csv' | 'json';
type DatePreset = '7d' | '30d' | '90d' | 'all' | 'custom';
type DatasetKey =
  | 'habits'
  | 'completions'
  | 'areas'
  | 'programs'
  | 'badges'
  | 'xp'
  | 'focus'
  | 'time'
  | 'sobriety'
  | 'cravings'
  | 'journal';

type ExportSection = {
  table: string;
  rows: Array<Record<string, unknown>>;
};

const DATASET_DEFS: Array<{
  key: DatasetKey;
  label: string;
  detail: string;
  tables: string[];
}> = [
  {
    key: 'habits',
    label: 'Habits',
    detail: 'Core habit definitions and settings',
    tables: ['hb_habits'],
  },
  {
    key: 'completions',
    label: 'Completions',
    detail: 'Completions, timed sessions, measurements, reminders',
    tables: ['hb_completions', 'hb_timed_sessions', 'hb_measurements', 'hb_reminders'],
  },
  {
    key: 'areas',
    label: 'Areas',
    detail: 'Custom areas and color chips',
    tables: ['hb_areas'],
  },
  {
    key: 'programs',
    label: 'Programs',
    detail: 'Programs and enrollments',
    tables: ['hb_programs', 'hb_program_enrollments'],
  },
  {
    key: 'badges',
    label: 'Badges',
    detail: 'Unlocked badges and milestone state',
    tables: ['hb_badges', 'hb_milestones'],
  },
  {
    key: 'xp',
    label: 'RPG XP',
    detail: 'Player profile and earned XP',
    tables: ['hb_player_profile', 'hb_xp_transactions'],
  },
  {
    key: 'focus',
    label: 'Focus sessions',
    detail: 'Focus timer history',
    tables: ['hb_focus_sessions'],
  },
  {
    key: 'time',
    label: 'Time tracking',
    detail: 'Tracked projects',
    tables: ['hb_projects'],
  },
  {
    key: 'sobriety',
    label: 'Sobriety log',
    detail: 'Profiles and pledges',
    tables: ['hb_sobriety_profiles', 'hb_sobriety_pledges'],
  },
  {
    key: 'cravings',
    label: 'Cravings',
    detail: 'Cravings and trigger tags',
    tables: ['hb_cravings', 'hb_craving_triggers'],
  },
  {
    key: 'journal',
    label: 'Journal entries',
    detail: 'No dedicated journal table exists in the current habits schema',
    tables: [],
  },
];

const DATE_PRESETS: Array<{ key: DatePreset; label: string }> = [
  { key: '7d', label: '7D' },
  { key: '30d', label: '30D' },
  { key: '90d', label: '90D' },
  { key: 'all', label: 'All time' },
  { key: 'custom', label: 'Custom' },
];

const TIMESTAMP_CANDIDATES = [
  'completed_at',
  'measured_at',
  'started_at',
  'logged_at',
  'earned_at',
  'pledged_on',
  'unlocked_at',
  'achieved_at',
  'updated_at',
  'created_at',
];

function buildInitialIncludedState() {
  return DATASET_DEFS.reduce<Record<DatasetKey, boolean>>((accumulator, dataset) => {
    accumulator[dataset.key] = true;
    return accumulator;
  }, {} as Record<DatasetKey, boolean>);
}

function escapeCsv(value: unknown) {
  const stringValue = String(value ?? '');
  if (
    stringValue.includes(',') ||
    stringValue.includes('"') ||
    stringValue.includes('\n')
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round((size / 1024) * 10) / 10} KB`;
  return `${Math.round((size / (1024 * 1024)) * 10) / 10} MB`;
}

function buildRange(preset: DatePreset, customFrom: string, customTo: string) {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  if (preset === 'all') {
    return { from: null, to: null, label: 'All time' };
  }

  if (preset === 'custom') {
    return {
      from: customFrom ? `${customFrom}T00:00:00.000Z` : null,
      to: customTo ? `${customTo}T23:59:59.999Z` : null,
      label: customFrom && customTo ? `${customFrom} to ${customTo}` : 'Custom',
    };
  }

  const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90;
  const start = new Date(now);
  start.setDate(start.getDate() - days + 1);
  start.setHours(0, 0, 0, 0);

  return {
    from: start.toISOString(),
    to: end.toISOString(),
    label: `Last ${days} days`,
  };
}

export default function ExportScreen() {
  const db = useDatabase();
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [datePreset, setDatePreset] = useState<DatePreset>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [included, setIncluded] = useState<Record<DatasetKey, boolean>>(buildInitialIncludedState);
  const [exporting, setExporting] = useState(false);

  const range = useMemo(
    () => buildRange(datePreset, customFrom, customTo),
    [customFrom, customTo, datePreset],
  );

  const prepared = useMemo(() => {
    const queryTableRows = (table: string): ExportSection => {
      try {
        const columns = db
          .query<{ name: string }>(`PRAGMA table_info(${table})`)
          .map((column) => column.name);

        const timestampColumn = TIMESTAMP_CANDIDATES.find((candidate) => columns.includes(candidate)) ?? null;

        let sql = `SELECT * FROM ${table}`;
        const params: string[] = [];

        if (timestampColumn && range.from) {
          sql += ` WHERE ${timestampColumn} >= ?`;
          params.push(range.from);
        }

        if (timestampColumn && range.to) {
          sql += range.from ? ` AND ${timestampColumn} <= ?` : ` WHERE ${timestampColumn} <= ?`;
          params.push(range.to);
        }

        if (timestampColumn) {
          sql += ` ORDER BY ${timestampColumn} DESC`;
        }

        return {
          table,
          rows: db.query<Record<string, unknown>>(sql, params),
        };
      } catch {
        return {
          table,
          rows: [],
        };
      }
    };

    const datasets = DATASET_DEFS.filter((dataset) => included[dataset.key]).map((dataset) => {
      const sections = dataset.tables.map(queryTableRows);
      return {
        ...dataset,
        sections,
        totalRows: sections.reduce((sum, section) => sum + section.rows.length, 0),
      };
    });

    const csvParts: string[] = [];

    for (const dataset of datasets) {
      if (dataset.tables.length === 0) {
        csvParts.push(`# ${dataset.label}`);
        csvParts.push('note');
        csvParts.push('No dedicated journal table exists in the current habits schema.');
        csvParts.push('');
        continue;
      }

      for (const section of dataset.sections) {
        const headers = section.rows[0] ? Object.keys(section.rows[0]) : [];
        csvParts.push(`# ${dataset.label} / ${section.table}`);

        if (headers.length === 0) {
          csvParts.push('note');
          csvParts.push('No matching rows for the selected range.');
          csvParts.push('');
          continue;
        }

        csvParts.push(headers.join(','));
        for (const row of section.rows) {
          csvParts.push(headers.map((header) => escapeCsv(row[header])).join(','));
        }
        csvParts.push('');
      }
    }

    const jsonPayload = {
      exportedAt: new Date().toISOString(),
      range: range.label,
      datasets: Object.fromEntries(
        datasets.map((dataset) => [
          dataset.key,
          dataset.tables.length === 0
            ? { note: dataset.detail }
            : Object.fromEntries(
              dataset.sections.map((section) => [section.table, section.rows]),
            ),
        ]),
      ),
    };

    const csvContent = csvParts.join('\n').trim();
    const jsonContent = JSON.stringify(jsonPayload, null, 2);
    const content = format === 'csv' ? csvContent : jsonContent;
    const estimatedBytes = content.length;
    const totalRows = datasets.reduce((sum, dataset) => sum + dataset.totalRows, 0);

    return {
      datasets,
      totalRows,
      content,
      estimatedBytes,
    };
  }, [db, format, included, range.from, range.label, range.to]);

  const handleExport = async () => {
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert('Sharing Unavailable', 'This build cannot open the share sheet.');
      return;
    }

    const targetDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
    if (!targetDir) {
      Alert.alert('Storage Unavailable', 'MyHabits could not access a writable export folder.');
      return;
    }

    try {
      setExporting(true);
      const extension = format === 'csv' ? 'csv' : 'json';
      const uri = `${targetDir}myhabits-export-${new Date().toISOString().slice(0, 10)}.${extension}`;
      await FileSystem.writeAsStringAsync(uri, prepared.content, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await Sharing.shareAsync(uri, {
        mimeType: format === 'csv' ? 'text/csv' : 'application/json',
        dialogTitle: 'Share MyHabits Export',
      });
    } catch (error) {
      Alert.alert(
        'Export Failed',
        `MyHabits could not generate the export file. ${String(error)}`,
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.heroRow}>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>Portable backup</Text>
          <Text style={styles.title}>Export Data</Text>
          <Text style={styles.subtitle}>
            Package the slices of MyHabits you want, choose a format, and share a portable backup.
          </Text>
        </View>
        <View style={styles.heroGlyph}>
          <MaterialSymbol name="share" size={34} color={HB_ACCENT_LIGHT} filled />
        </View>
      </View>

      <GlassCard level={4} style={styles.heroCard} contentStyle={styles.heroCardContent}>
        <View style={styles.statsColumn}>
          <StatTile
            label="Rows"
            value={prepared.totalRows}
            delta={range.label}
            icon="list_alt"
            color={HB_ACCENT_LIGHT}
          />
          <StatTile
            label="Size"
            value={formatBytes(prepared.estimatedBytes)}
            delta={`${format.toUpperCase()} preview`}
            icon="share"
            color="#8BCFF0"
          />
        </View>

        <Pressable
          style={[styles.primaryButton, exporting ? styles.primaryButtonDisabled : null]}
          onPress={() => void handleExport()}
          disabled={exporting}
        >
          <Text style={styles.primaryButtonText}>
            {exporting ? 'Generating...' : `Share ${format.toUpperCase()}`}
          </Text>
        </Pressable>
      </GlassCard>

      <GlassCard level={2} contentStyle={styles.sectionCard}>
        <SectionHeader title="Date Range" />
        <View style={styles.choiceRow}>
          {DATE_PRESETS.map((preset) => {
            const selected = datePreset === preset.key;
            return (
              <Pressable
                key={preset.key}
                style={[
                  styles.choiceChip,
                  selected ? styles.choiceChipSelected : null,
                ]}
                onPress={() => setDatePreset(preset.key)}
              >
                <Text style={styles.choiceChipText}>{preset.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {datePreset === 'custom' ? (
          <View style={styles.customDateRow}>
            <TextInput
              placeholder="From YYYY-MM-DD"
              placeholderTextColor={HB_TEXT_TERTIARY}
              style={[styles.input, styles.customDateInput]}
              value={customFrom}
              onChangeText={setCustomFrom}
            />
            <TextInput
              placeholder="To YYYY-MM-DD"
              placeholderTextColor={HB_TEXT_TERTIARY}
              style={[styles.input, styles.customDateInput]}
              value={customTo}
              onChangeText={setCustomTo}
            />
          </View>
        ) : null}
      </GlassCard>

      <GlassCard level={2} contentStyle={styles.sectionCard}>
        <SectionHeader title="Format" />
        <View style={styles.choiceRow}>
          {(['csv', 'json'] as ExportFormat[]).map((option) => {
            const selected = format === option;
            return (
              <Pressable
                key={option}
                style={[
                  styles.choiceChip,
                  selected ? styles.choiceChipSelected : null,
                ]}
                onPress={() => setFormat(option)}
              >
                <Text style={styles.choiceChipText}>{option.toUpperCase()}</Text>
              </Pressable>
            );
          })}
        </View>
      </GlassCard>

      <GlassCard level={2} contentStyle={styles.sectionCard}>
        <SectionHeader title="Included Data" />
        <View style={styles.datasetList}>
          {DATASET_DEFS.map((dataset) => {
            const preparedDataset = prepared.datasets.find((item) => item.key === dataset.key);
            return (
              <Pressable
                key={dataset.key}
                style={[
                  styles.datasetRow,
                  included[dataset.key] ? styles.datasetRowSelected : null,
                ]}
                onPress={() =>
                  setIncluded((current) => ({
                    ...current,
                    [dataset.key]: !current[dataset.key],
                  }))
                }
              >
                <View style={styles.datasetCheckbox}>
                  {included[dataset.key] ? (
                    <MaterialSymbol name="check" size={16} color={HB_TEXT} filled />
                  ) : null}
                </View>
                <View style={styles.datasetCopy}>
                  <Text style={styles.datasetTitle}>{dataset.label}</Text>
                  <Text style={styles.datasetDetail}>{dataset.detail}</Text>
                </View>
                <Text style={styles.datasetCount}>
                  {preparedDataset?.totalRows ?? 0}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </GlassCard>

      <GlassCard level={2} contentStyle={styles.sectionCard}>
        <SectionHeader title="Preview" />
        <View style={styles.previewList}>
          {prepared.datasets.map((dataset) => (
            <View key={dataset.key} style={styles.previewRow}>
              <View style={styles.previewCopy}>
                <Text style={styles.previewTitle}>{dataset.label}</Text>
                <Text style={styles.previewSubtitle}>
                  {dataset.tables.length === 0
                    ? dataset.detail
                    : `${dataset.totalRows} row${dataset.totalRows === 1 ? '' : 's'} across ${dataset.tables.length} table${dataset.tables.length === 1 ? '' : 's'}`}
                </Text>
              </View>
              <Text style={styles.previewCount}>{dataset.totalRows}</Text>
            </View>
          ))}
        </View>
      </GlassCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: HB_SURFACES.lowest,
  },
  content: {
    padding: 20,
    paddingBottom: 44,
    gap: 18,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  heroCopy: {
    flex: 1,
    gap: 6,
  },
  eyebrow: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_ACCENT_LIGHT,
  },
  title: {
    ...HB_TYPOGRAPHY.displayLg,
    color: HB_TEXT,
  },
  subtitle: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
  heroGlyph: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: withAlpha(HB_ACCENT, 0.18),
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCard: {
    backgroundColor: withAlpha(HB_ACCENT, 0.08),
  },
  heroCardContent: {
    gap: 18,
  },
  statsColumn: {
    gap: 12,
  },
  primaryButton: {
    borderRadius: 20,
    backgroundColor: HB_ACCENT,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontFamily: HB_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
    color: HB_TEXT,
  },
  sectionCard: {
    gap: 16,
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  choiceChip: {
    borderRadius: 999,
    backgroundColor: HB_SURFACES.high,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  choiceChipSelected: {
    backgroundColor: withAlpha(HB_ACCENT, 0.24),
  },
  choiceChipText: {
    fontFamily: HB_FONTS.medium,
    fontSize: 13,
    lineHeight: 16,
    color: HB_TEXT,
  },
  customDateRow: {
    flexDirection: 'row',
    gap: 10,
  },
  customDateInput: {
    flex: 1,
  },
  input: {
    borderRadius: 16,
    backgroundColor: HB_SURFACES.high,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: HB_FONTS.medium,
    fontSize: 15,
    lineHeight: 20,
    color: HB_TEXT,
  },
  datasetList: {
    gap: 12,
  },
  datasetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    backgroundColor: HB_SURFACES.high,
    padding: 14,
  },
  datasetRowSelected: {
    backgroundColor: withAlpha(HB_ACCENT, 0.16),
  },
  datasetCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: withAlpha(HB_ACCENT, 0.18),
    alignItems: 'center',
    justifyContent: 'center',
  },
  datasetCopy: {
    flex: 1,
    gap: 4,
  },
  datasetTitle: {
    fontFamily: HB_FONTS.bold,
    fontSize: 15,
    lineHeight: 20,
    color: HB_TEXT,
  },
  datasetDetail: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
  datasetCount: {
    fontFamily: HB_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
    color: HB_ACCENT_LIGHT,
  },
  previewList: {
    gap: 12,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  previewCopy: {
    flex: 1,
    gap: 4,
  },
  previewTitle: {
    fontFamily: HB_FONTS.bold,
    fontSize: 15,
    lineHeight: 20,
    color: HB_TEXT,
  },
  previewSubtitle: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
  previewCount: {
    fontFamily: HB_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
    color: HB_TEXT_TERTIARY,
  },
});
