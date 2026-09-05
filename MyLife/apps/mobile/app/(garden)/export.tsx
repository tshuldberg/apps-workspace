import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  CalendarDays,
  Check,
  Clock3,
  Download,
  Leaf,
  Lock,
  Map,
  NotebookPen,
  Sprout,
  Trash2,
  Waves,
} from 'lucide-react-native';
import {
  getEntriesByDate,
  getHarvests,
  getPendingSeasonalTasks,
  getPlants,
  getSetting,
  getZones,
  setSetting,
  GARDEN_ACCENT,
  GARDEN_GOLD,
  GARDEN_SURFACES,
  GARDEN_TYPOGRAPHY,
  GlassCard,
  GradientButton,
  SectionHeader,
  ZoneChip,
} from '@mylife/garden';
import { colors } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

type EntityKey = 'plants' | 'harvests' | 'tasks' | 'watering' | 'journal' | 'zones';

type ExportHistoryItem = {
  id: string;
  fileName: string;
  uri: string;
  timestamp: string;
  sizeBytes: number;
  entities: EntityKey[];
  startDate: string;
  endDate: string;
};

const EXPORT_HISTORY_KEY = 'garden_export_history';
const EXPORT_DIR = `${FileSystem.documentDirectory ?? FileSystem.cacheDirectory}garden-exports`;

const ENTITY_META = {
  plants: { label: 'Plants', icon: Sprout },
  harvests: { label: 'Harvest', icon: Leaf },
  tasks: { label: 'Tasks', icon: NotebookPen },
  watering: { label: 'Watering', icon: Waves },
  journal: { label: 'Journal', icon: NotebookPen },
  zones: { label: 'Zones', icon: Map },
} as const;

const DEFAULT_SELECTION: Record<EntityKey, boolean> = {
  plants: true,
  harvests: true,
  tasks: false,
  watering: true,
  journal: false,
  zones: false,
};

function formatBytes(size: number) {
  if (size >= 1_000_000) return `${(size / 1_000_000).toFixed(1)} MB`;
  if (size >= 1_000) return `${Math.round(size / 1_000)} KB`;
  return `${size} B`;
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function createId() {
  return `export-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function csvEscape(value: unknown) {
  if (value == null) return '';
  const string = String(value);
  return `"${string.replace(/"/g, '""')}"`;
}

export default function GardenExportScreen() {
  const db = useDatabase();
  const [tick, setTick] = useState(0);
  const [selection, setSelection] = useState(DEFAULT_SELECTION);
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [exporting, setExporting] = useState(false);

  const plants = useMemo(() => getPlants(db), [db, tick]);
  const harvests = useMemo(() => getHarvests(db), [db, tick]);
  const seasonalTasks = useMemo(() => getPendingSeasonalTasks(db), [db, tick]);
  const entries = useMemo(() => getEntriesByDate(db, '1900-01-01', '2999-12-31'), [db, tick]);
  const zones = useMemo(() => getZones(db), [db, tick]);
  const avatar = useMemo(() => (getSetting(db, 'display_name') ?? 'G').slice(0, 1).toUpperCase(), [db, tick]);

  const counts = useMemo(
    () => ({
      plants: plants.length,
      harvests: harvests.length,
      tasks: seasonalTasks.length,
      watering: entries.filter((entry) => entry.action === 'water').length,
      journal: entries.filter((entry) => entry.action !== 'water').length,
      zones: zones.length,
    }),
    [entries, harvests.length, plants.length, seasonalTasks.length, zones.length],
  );

  const history = useMemo<ExportHistoryItem[]>(() => {
    const raw = getSetting(db, EXPORT_HISTORY_KEY);
    if (raw == null) return [];
    try {
      return JSON.parse(raw) as ExportHistoryItem[];
    } catch {
      return [];
    }
  }, [db, tick]);

  const selectedEntities = useMemo(
    () => (Object.keys(selection) as EntityKey[]).filter((key) => selection[key]),
    [selection],
  );

  const toggleEntity = (key: EntityKey) => {
    setSelection((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const applyRange = (range: '30d' | '90d' | 'all') => {
    const today = new Date();
    if (range === 'all') {
      setStartDate('1900-01-01');
      setEndDate(today.toISOString().slice(0, 10));
      return;
    }
    const next = new Date(today);
    next.setDate(next.getDate() - (range === '30d' ? 30 : 90));
    setStartDate(next.toISOString().slice(0, 10));
    setEndDate(today.toISOString().slice(0, 10));
  };

  const buildRows = () => {
    const rows: string[] = ['entity,id,date,title,details_json'];

    if (selection.plants) {
      for (const plant of plants) {
        rows.push([
          csvEscape('plant'),
          csvEscape(plant.id),
          csvEscape(plant.acquiredDate ?? plant.createdAt.slice(0, 10)),
          csvEscape(plant.name),
          csvEscape(JSON.stringify(plant)),
        ].join(','));
      }
    }

    if (selection.harvests) {
      for (const harvest of harvests.filter((item) => item.date >= startDate && item.date <= endDate)) {
        rows.push([
          csvEscape('harvest'),
          csvEscape(harvest.id),
          csvEscape(harvest.date),
          csvEscape(harvest.cropType ?? 'Harvest'),
          csvEscape(JSON.stringify(harvest)),
        ].join(','));
      }
    }

    if (selection.tasks) {
      for (const task of seasonalTasks) {
        rows.push([
          csvEscape('task'),
          csvEscape(task.id),
          csvEscape(task.createdAt.slice(0, 10)),
          csvEscape(task.description ?? task.taskType),
          csvEscape(JSON.stringify(task)),
        ].join(','));
      }
    }

    if (selection.watering) {
      for (const entry of entries.filter((item) => item.action === 'water' && item.date >= startDate && item.date <= endDate)) {
        rows.push([
          csvEscape('watering'),
          csvEscape(entry.id),
          csvEscape(entry.date),
          csvEscape('Water log'),
          csvEscape(JSON.stringify(entry)),
        ].join(','));
      }
    }

    if (selection.journal) {
      for (const entry of entries.filter((item) => item.action !== 'water' && item.date >= startDate && item.date <= endDate)) {
        rows.push([
          csvEscape('journal'),
          csvEscape(entry.id),
          csvEscape(entry.date),
          csvEscape(entry.action),
          csvEscape(JSON.stringify(entry)),
        ].join(','));
      }
    }

    if (selection.zones) {
      for (const zone of zones) {
        rows.push([
          csvEscape('zone'),
          csvEscape(zone.id),
          csvEscape(zone.createdAt.slice(0, 10)),
          csvEscape(zone.name),
          csvEscape(JSON.stringify(zone)),
        ].join(','));
      }
    }

    return rows.join('\n');
  };

  const persistHistory = (nextHistory: ExportHistoryItem[]) => {
    setSetting(db, EXPORT_HISTORY_KEY, JSON.stringify(nextHistory.slice(0, 10)));
    setTick((value) => value + 1);
  };

  const handleExport = async () => {
    if (selectedEntities.length === 0) {
      Alert.alert('Select data', 'Choose at least one archive segment to export.');
      return;
    }
    if (!isIsoDate(startDate) || !isIsoDate(endDate) || startDate > endDate) {
      Alert.alert('Invalid timeframe', 'Use YYYY-MM-DD dates and make sure the start date comes first.');
      return;
    }

    setExporting(true);
    try {
      await FileSystem.makeDirectoryAsync(EXPORT_DIR, { intermediates: true });
      const csv = buildRows();
      const timestamp = new Date().toISOString();
      const fileName = `mygarden-archive-${timestamp.slice(0, 10)}.csv`;
      const uri = `${EXPORT_DIR}/${fileName}`;
      await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });

      const info = await FileSystem.getInfoAsync(uri);
      const sizeBytes =
        'size' in info && typeof info.size === 'number' ? info.size : csv.length;
      const item: ExportHistoryItem = {
        id: createId(),
        fileName,
        uri,
        timestamp,
        sizeBytes,
        entities: selectedEntities,
        startDate,
        endDate,
      };
      persistHistory([item, ...history]);

      const sharingAvailable = await Sharing.isAvailableAsync();
      if (sharingAvailable) {
        await Sharing.shareAsync(uri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export Garden Archive',
        });
      }
    } finally {
      setExporting(false);
    }
  };

  const handleReshare = async (item: ExportHistoryItem) => {
    const info = await FileSystem.getInfoAsync(item.uri);
    if (!info.exists) {
      Alert.alert('Archive not found', 'That export file is no longer stored locally.');
      return;
    }
    await Sharing.shareAsync(item.uri, {
      mimeType: 'text/csv',
      dialogTitle: item.fileName,
    });
  };

  const handleDeleteHistory = async (id: string) => {
    const next = history.filter((item) => item.id !== id);
    persistHistory(next);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View>
          <RNText style={styles.headerTitle}>Export Data</RNText>
          <RNText style={styles.headerSubtitle}>Curate your archive</RNText>
        </View>
        <View style={styles.avatar}>
          <RNText style={styles.avatarText}>{avatar}</RNText>
        </View>
      </View>

      <GlassCard level={2} style={styles.heroCard}>
        <RNText style={styles.heroLabel}>Curate Your Archive</RNText>
        <RNText style={styles.heroBody}>
          Select the botanical data segments you wish to generate into a portable archive format.
        </RNText>
      </GlassCard>

      <View style={styles.entityGrid}>
        {(Object.keys(ENTITY_META) as EntityKey[]).map((key) => {
          const meta = ENTITY_META[key];
          const Icon = meta.icon;
          const active = selection[key];
          return (
            <Pressable key={key} onPress={() => toggleEntity(key)}>
              <GlassCard
                level={1}
                style={[styles.entityCard, active && styles.entityCardActive]}
              >
                <View style={styles.entityIconWrap}>
                  <Icon size={18} color={active ? colors.background : GARDEN_GOLD} strokeWidth={1.8} />
                </View>
                <View style={styles.entityCopy}>
                  <RNText style={styles.entityTitle}>{meta.label}</RNText>
                  <RNText style={styles.entityCount}>{counts[key]} records</RNText>
                </View>
                <View style={[styles.entityCheck, active && styles.entityCheckActive]}>
                  {active && <Check size={14} color={colors.background} strokeWidth={2} />}
                </View>
              </GlassCard>
            </Pressable>
          );
        })}
      </View>

      <SectionHeader label="Timeframe" title="Date range" />
      <View style={styles.dateRow}>
        <GlassCard level={1} style={styles.dateCard}>
          <CalendarDays size={16} color={GARDEN_GOLD} strokeWidth={1.8} />
          <View style={styles.dateCopy}>
            <RNText style={styles.dateLabel}>Start Date</RNText>
            <TextInput
              value={startDate}
              onChangeText={setStartDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textTertiary}
              style={styles.dateInput}
              autoCapitalize="none"
            />
          </View>
        </GlassCard>
        <GlassCard level={1} style={styles.dateCard}>
          <CalendarDays size={16} color={GARDEN_GOLD} strokeWidth={1.8} />
          <View style={styles.dateCopy}>
            <RNText style={styles.dateLabel}>End Date</RNText>
            <TextInput
              value={endDate}
              onChangeText={setEndDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textTertiary}
              style={styles.dateInput}
              autoCapitalize="none"
            />
          </View>
        </GlassCard>
      </View>

      <View style={styles.quickChipRow}>
        <ZoneChip label="Last 30 days" active={false} onPress={() => applyRange('30d')} />
        <ZoneChip label="Last 90 days" active={false} onPress={() => applyRange('90d')} />
        <ZoneChip label="All Time" active={false} onPress={() => applyRange('all')} />
      </View>

      <SectionHeader label="File Format" title="Portable archive" />
      <GlassCard level={1} style={styles.formatStack}>
        <View style={[styles.formatRow, styles.formatRowActive]}>
          <View style={styles.formatBadge}>
            <RNText style={styles.formatBadgeText}>CSV</RNText>
          </View>
          <View style={styles.formatCopy}>
            <RNText style={styles.formatTitle}>CSV Spreadsheet</RNText>
            <RNText style={styles.formatBody}>Standardized data export</RNText>
          </View>
        </View>
        <View style={styles.formatDivider} />
        <View style={styles.formatRow}>
          <View style={[styles.formatBadge, styles.formatBadgeDisabled]}>
            <RNText style={[styles.formatBadgeText, styles.formatBadgeTextDisabled]}>JSON</RNText>
          </View>
          <View style={styles.formatCopy}>
            <RNText style={styles.formatTitleDisabled}>JSON Archive</RNText>
            <RNText style={styles.formatBody}>Future structured bundle</RNText>
          </View>
          <Lock size={16} color={colors.textTertiary} strokeWidth={1.8} />
        </View>
        <View style={styles.formatDivider} />
        <View style={styles.formatRow}>
          <View style={[styles.formatBadge, styles.formatBadgeDisabled]}>
            <RNText style={[styles.formatBadgeText, styles.formatBadgeTextDisabled]}>PDF</RNText>
          </View>
          <View style={styles.formatCopy}>
            <RNText style={styles.formatTitleDisabled}>PDF Snapshot</RNText>
            <RNText style={styles.formatBody}>Future printable report</RNText>
          </View>
          <Lock size={16} color={colors.textTertiary} strokeWidth={1.8} />
        </View>
      </GlassCard>

      <GradientButton
        title={exporting ? 'Exporting...' : 'Export Archive'}
        onPress={handleExport}
      />

      <SectionHeader label="Export History" title="Archival log" />
      <View style={styles.historyStack}>
        {history.length === 0 ? (
          <GlassCard level={1} style={styles.emptyHistoryCard}>
            <Clock3 size={16} color={GARDEN_GOLD} strokeWidth={1.8} />
            <RNText style={styles.emptyHistoryTitle}>No exports yet</RNText>
            <RNText style={styles.emptyHistoryBody}>Your generated archives will appear here.</RNText>
          </GlassCard>
        ) : (
          history.map((item) => (
            <GlassCard key={item.id} level={1} style={styles.historyCard}>
              <View style={styles.historyCopy}>
                <RNText style={styles.historyTitle}>{item.fileName}</RNText>
                <RNText style={styles.historyMeta}>
                  {item.entities.join(', ')} · {formatBytes(item.sizeBytes)}
                </RNText>
                <RNText style={styles.historyMeta}>
                  {item.startDate} → {item.endDate}
                </RNText>
              </View>
              <View style={styles.historyActions}>
                <Pressable onPress={() => handleReshare(item)} style={styles.historyIconButton}>
                  <Download size={16} color={GARDEN_GOLD} strokeWidth={1.8} />
                </Pressable>
                <Pressable onPress={() => handleDeleteHistory(item.id)} style={styles.historyIconButton}>
                  <Trash2 size={16} color={colors.textSecondary} strokeWidth={1.8} />
                </Pressable>
              </View>
            </GlassCard>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: GARDEN_SURFACES.base,
  },
  content: {
    paddingTop: 104,
    paddingHorizontal: 16,
    paddingBottom: 140,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    ...GARDEN_TYPOGRAPHY.displayLg,
    color: colors.text,
  },
  headerSubtitle: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GARDEN_SURFACES.depth,
  },
  avatarText: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    color: GARDEN_GOLD,
  },
  heroCard: {
    padding: 18,
    gap: 8,
  },
  heroLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    color: GARDEN_GOLD,
  },
  heroBody: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
  },
  entityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  entityCard: {
    width: 164,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  entityCardActive: {
    borderWidth: 1,
    borderColor: 'rgba(132, 204, 22, 0.3)',
    backgroundColor: 'rgba(132, 204, 22, 0.08)',
  },
  entityIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GARDEN_SURFACES.depth,
  },
  entityCopy: {
    flex: 1,
    gap: 2,
  },
  entityTitle: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 15,
    color: colors.text,
  },
  entityCount: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 12,
    color: colors.textSecondary,
  },
  entityCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  entityCheckActive: {
    backgroundColor: GARDEN_ACCENT,
    borderColor: GARDEN_ACCENT,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateCard: {
    flex: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dateCopy: {
    flex: 1,
    gap: 2,
  },
  dateLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    color: colors.textSecondary,
  },
  dateInput: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 0,
  },
  quickChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  formatStack: {
    padding: 0,
    overflow: 'hidden',
  },
  formatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  formatRowActive: {
    backgroundColor: 'rgba(255, 184, 119, 0.08)',
  },
  formatDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  formatBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: GARDEN_GOLD,
  },
  formatBadgeDisabled: {
    backgroundColor: GARDEN_SURFACES.depth,
  },
  formatBadgeText: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    color: colors.background,
  },
  formatBadgeTextDisabled: {
    color: colors.textSecondary,
  },
  formatCopy: {
    flex: 1,
    gap: 2,
  },
  formatTitleDisabled: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 15,
    color: colors.textSecondary,
  },
  formatTitle: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 15,
    color: colors.text,
  },
  formatBody: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 12,
    color: colors.textSecondary,
  },
  historyStack: {
    gap: 12,
  },
  emptyHistoryCard: {
    padding: 18,
    gap: 8,
  },
  emptyHistoryTitle: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  emptyHistoryBody: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
  },
  historyCard: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  historyCopy: {
    flex: 1,
    gap: 4,
  },
  historyTitle: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 15,
    color: colors.text,
  },
  historyMeta: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 12,
    color: colors.textSecondary,
  },
  historyActions: {
    flexDirection: 'row',
    gap: 8,
  },
  historyIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GARDEN_SURFACES.depth,
  },
});
