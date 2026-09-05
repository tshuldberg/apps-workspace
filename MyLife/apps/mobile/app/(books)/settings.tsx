import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable, Alert, Share, Switch } from 'react-native';
import { Text, colors } from '@mylife/ui';
import * as FileSystem from 'expo-file-system/legacy';
import { icons } from 'lucide-react-native';
import { BOOKS_SURFACES, BOOKS_TYPOGRAPHY, JAKARTA_FONTS } from '@mylife/books';
import { GlassCard } from '@mylife/books/ui';
import { useGoal } from '../../hooks/books/use-goals';
import { useBooks } from '../../hooks/books/use-books';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  getBooksSettings,
  setBooksDefaultSort,
  type LibrarySortPreference,
} from '../../lib/books/settings';
import { buildLibraryExportPayload } from '../../lib/books/portability';

const BOOKS_ACCENT = colors.modules.books;
const DANGER_TINT = 'rgba(255, 180, 171, 0.06)';
const DANGER_BORDER = 'rgba(255, 180, 171, 0.12)';

const SORT_LABELS: Record<LibrarySortPreference, string> = {
  added: 'Recents',
  title: 'Title',
  author: 'Author',
  rating: 'Rating',
};

const SORT_OPTIONS: Array<{ label: string; value: LibrarySortPreference }> = [
  { label: 'Recents', value: 'added' },
  { label: 'Title', value: 'title' },
  { label: 'Author', value: 'author' },
  { label: 'Rating', value: 'rating' },
];

async function shareTextFile(filename: string, content: string): Promise<void> {
  const targetDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!targetDir) throw new Error('No writable filesystem directory available.');
  const uri = `${targetDir}${filename}`;
  await FileSystem.writeAsStringAsync(uri, content, { encoding: FileSystem.EncodingType.UTF8 });
  await Share.share({ title: filename, url: uri, message: content });
}

// --- Section label with horizontal rule ---
function SectionLabel({ text }: { text: string }) {
  return (
    <View style={sectionLabelStyles.row}>
      <Text
        variant="caption"
        style={sectionLabelStyles.text}
      >
        {text}
      </Text>
      <View style={sectionLabelStyles.line} />
    </View>
  );
}

const sectionLabelStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 28,
    paddingHorizontal: 20,
  },
  text: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 11,
    letterSpacing: 0.05 * 11,
    textTransform: 'uppercase',
    color: BOOKS_ACCENT,
    marginRight: 12,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
});

// --- Icon circle ---
function IconCircle({ icon: Icon, color = BOOKS_ACCENT, bg }: {
  icon: typeof icons.SlidersHorizontal;
  color?: string;
  bg?: string;
}) {
  return (
    <View style={[iconCircleStyles.circle, bg ? { backgroundColor: bg } : undefined]}>
      <Icon size={18} color={color} />
    </View>
  );
}

const iconCircleStyles = StyleSheet.create({
  circle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(201, 137, 77, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// --- Setting row inside a GlassCard ---
function SettingCard({
  icon: Icon,
  iconBg,
  title,
  description,
  right,
  onPress,
}: {
  icon: typeof icons.SlidersHorizontal;
  iconBg?: string;
  title: string;
  description: string;
  right?: React.ReactNode;
  onPress?: () => void;
}) {
  return (
    <GlassCard level={2} onPress={onPress} style={settingCardStyles.card}>
      <View style={settingCardStyles.row}>
        <IconCircle icon={Icon} bg={iconBg} />
        <View style={settingCardStyles.textGroup}>
          <Text variant="body" style={settingCardStyles.title}>{title}</Text>
          <Text variant="caption" style={settingCardStyles.desc}>{description}</Text>
        </View>
        {right}
      </View>
    </GlassCard>
  );
}

const settingCardStyles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  textGroup: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 15,
    color: colors.text,
  },
  desc: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    color: colors.textSecondary,
  },
});

// --- Sort picker chip ---
function SortChip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={sortChipStyles.chip}>
      <Text variant="caption" style={sortChipStyles.label}>{label}</Text>
      <icons.ChevronsUpDown size={12} color={colors.textSecondary} />
    </Pressable>
  );
}

const sortChipStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  label: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    color: colors.text,
  },
});

// --- Badge ---
function Badge({ text, color }: { text: string; color: string }) {
  return (
    <View style={[badgeStyles.badge, { backgroundColor: `${color}22` }]}>
      <Text variant="caption" style={[badgeStyles.text, { color }]}>{text}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  text: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 10,
    letterSpacing: 0.05 * 10,
    textTransform: 'uppercase',
  },
});

// ================================================================
// Main Screen
// ================================================================

export default function BooksSettingsScreen() {
  const db = useDatabase();
  const currentYear = new Date().getFullYear();
  const { refresh: refreshGoal } = useGoal(currentYear);
  const { refresh: refreshBooks } = useBooks();
  const [preferences, setPreferences] = useState(() => getBooksSettings(db));
  const [themeEnabled, setThemeEnabled] = useState(true);
  const [cloudSync, setCloudSync] = useState(false);

  const refreshPreferences = useCallback(() => {
    setPreferences(getBooksSettings(db));
  }, [db]);

  useEffect(() => {
    refreshPreferences();
  }, [refreshPreferences]);

  // --- Sort ---
  const handleSetDefaultSort = useCallback(() => {
    const options = [
      ...SORT_OPTIONS.map((option) => ({
        text: option.label,
        onPress: () => {
          setBooksDefaultSort(db, option.value);
          refreshPreferences();
        },
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ];
    Alert.alert('Default sort', 'Choose the default library sort order.', options);
  }, [db, refreshPreferences]);

  // --- Export ---
  const handleExport = useCallback(async () => {
    try {
      const payload = buildLibraryExportPayload(db);
      const timestamp = new Date().toISOString().slice(0, 10);
      const options = [
        {
          text: 'CSV',
          onPress: () => void shareTextFile(`mybooks-library-${timestamp}.csv`, payload.csv),
        },
        {
          text: 'JSON',
          onPress: () => void shareTextFile(`mybooks-library-${timestamp}.json`, payload.json),
        },
        {
          text: 'Markdown',
          onPress: () => void shareTextFile(`mybooks-library-${timestamp}.md`, payload.markdown),
        },
        { text: 'Cancel', style: 'cancel' as const },
      ];
      Alert.alert('Export format', 'Choose your export format.', options);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      Alert.alert('Export failed', message);
    }
  }, [db]);

  // --- Erase ---
  const handleEraseAll = useCallback(() => {
    Alert.alert(
      'Reset MyBooks Data',
      'This will permanently remove all your library data, reading progress, and saved annotations. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            db.transaction(() => {
              db.execute('DELETE FROM bk_book_tags');
              db.execute('DELETE FROM bk_book_shelves');
              db.execute('DELETE FROM bk_reading_sessions');
              db.execute('DELETE FROM bk_reviews');
              db.execute('DELETE FROM bk_reading_goals');
              db.execute('DELETE FROM bk_tags');
              db.execute('DELETE FROM bk_import_log');
              db.execute('DELETE FROM bk_ol_cache');
              db.execute('DELETE FROM bk_books');
            });
            refreshBooks();
            refreshGoal();
            Alert.alert('Done', 'All book data has been erased.');
          },
        },
      ],
    );
  }, [db, refreshBooks, refreshGoal]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.avatarRow}>
            <View style={styles.avatar}>
              <icons.User size={20} color={BOOKS_ACCENT} />
            </View>
            <Text variant="body" style={styles.avatarLabel}>MyBooks</Text>
          </View>
          <icons.BookOpen size={22} color={BOOKS_ACCENT} />
        </View>
        <Text variant="body" style={styles.displayTitle}>Settings</Text>
        <Text variant="caption" style={styles.subtitle}>Refine your library experience</Text>
      </View>

      {/* ── Preferences ── */}
      <SectionLabel text="Preferences" />

      <SettingCard
        icon={icons.SlidersHorizontal}
        title="Sort preference"
        description="Default sorting for your library"
        right={<SortChip label={SORT_LABELS[preferences.defaultSort]} onPress={handleSetDefaultSort} />}
        onPress={handleSetDefaultSort}
      />

      <SettingCard
        icon={icons.Palette}
        title="Theme toggle"
        description="Switch between Obsidian and Ivory"
        right={
          <Switch
            value={themeEnabled}
            onValueChange={setThemeEnabled}
            trackColor={{ false: '#3A3A3E', true: BOOKS_ACCENT }}
            thumbColor="#fff"
          />
        }
      />

      {/* ── Security & Sync ── */}
      <SectionLabel text="Security & Sync" />

      <SettingCard
        icon={icons.Shield}
        iconBg="rgba(139, 207, 240, 0.15)"
        title="Privacy controls"
        description="Manage visibility of your reading habits"
        right={<icons.ChevronRight size={20} color={colors.textSecondary} />}
      />

      <SettingCard
        icon={icons.CloudUpload}
        iconBg="rgba(139, 207, 240, 0.15)"
        title="Cloud sync"
        description="Sync progress across all devices"
        right={
          <Switch
            value={cloudSync}
            onValueChange={setCloudSync}
            trackColor={{ false: '#3A3A3E', true: BOOKS_ACCENT }}
            thumbColor="#fff"
          />
        }
      />

      {/* ── System ── */}
      <SectionLabel text="System" />

      <GlassCard level={2} style={systemCardStyles.card}>
        <IconCircle icon={icons.Bell} />
        <Text variant="body" style={systemCardStyles.title}>Notifications</Text>
        <Text variant="caption" style={systemCardStyles.desc}>Daily reminders and goals</Text>
        <Badge text="Active" color={BOOKS_ACCENT} />
      </GlassCard>

      <GlassCard level={2} onPress={() => void handleExport()} style={systemCardStyles.card}>
        <IconCircle icon={icons.Download} />
        <Text variant="body" style={systemCardStyles.title}>Export</Text>
        <Text variant="caption" style={systemCardStyles.desc}>Download annotations and data</Text>
        <Pressable onPress={() => void handleExport()} hitSlop={8}>
          <Text variant="caption" style={systemCardStyles.exportLink}>START EXPORT</Text>
        </Pressable>
      </GlassCard>

      {/* ── Danger Zone ── */}
      <View style={styles.dangerSection}>
        <GlassCard level={1} style={styles.dangerCard}>
          <View style={styles.dangerHeader}>
            <icons.TriangleAlert size={20} color={colors.danger} />
            <Text variant="body" style={styles.dangerTitle}>Danger Zone</Text>
          </View>
          <Text variant="caption" style={styles.dangerDesc}>
            Resetting will permanently remove all your library data, reading progress, and saved annotations. This action cannot be undone.
          </Text>
          <Pressable onPress={handleEraseAll} style={styles.dangerButton}>
            <Text variant="caption" style={styles.dangerButtonText}>RESET MYBOOKS DATA</Text>
          </Pressable>
        </GlassCard>
      </View>

      {/* ── Footer ── */}
      <View style={styles.footer}>
        <Text variant="caption" style={styles.footerText}>
          V2.4.0 OBSIDIAN{'  \u00B7  '}PRIVACY POLICY
        </Text>
      </View>
    </ScrollView>
  );
}

const systemCardStyles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginBottom: 10,
    gap: 6,
  },
  title: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 15,
    color: colors.text,
    marginTop: 4,
  },
  desc: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  exportLink: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 12,
    letterSpacing: 0.05 * 12,
    color: BOOKS_ACCENT,
    marginTop: 4,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BOOKS_SURFACES.base,
  },
  content: {
    paddingBottom: 40,
  },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(201, 137, 77, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 15,
    color: colors.text,
  },
  displayTitle: {
    ...BOOKS_TYPOGRAPHY.displayLg,
    color: colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 15,
    color: colors.textSecondary,
  },

  // Danger zone
  dangerSection: {
    marginTop: 28,
    paddingHorizontal: 20,
  },
  dangerCard: {
    backgroundColor: DANGER_TINT,
    borderWidth: 1,
    borderColor: DANGER_BORDER,
    gap: 12,
  },
  dangerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dangerTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 16,
    color: colors.danger,
  },
  dangerDesc: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(255, 180, 171, 0.8)',
  },
  dangerButton: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: DANGER_BORDER,
    marginTop: 4,
  },
  dangerButtonText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 13,
    letterSpacing: 0.05 * 13,
    color: colors.danger,
  },

  // Footer
  footer: {
    alignItems: 'center',
    marginTop: 32,
    paddingBottom: 20,
  },
  footerText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 11,
    letterSpacing: 0.05 * 11,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.3)',
  },
});
