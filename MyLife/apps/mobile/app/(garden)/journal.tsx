import { useCallback, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import {
  createEntry,
  getEntriesByDate,
  getPlants,
  GARDEN_ACCENT,
  GARDEN_ACCENT_DIM,
  GARDEN_ACCENT_LIGHT,
  GARDEN_SURFACES,
  GARDEN_TYPOGRAPHY,
  GlassCard,
  GradientButton,
  ZoneChip,
  type CareAction,
  type GardenEntry,
  type Plant,
} from '@mylife/garden';
import { Text, colors } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

type WeatherFilter = 'any' | 'sunny' | 'cloudy' | 'rainy';

interface ExtendedEntry extends GardenEntry {
  title?: string;
  tags?: string[];
  weather?: string;
  tempC?: number;
  photoUris?: string[];
}

const CATEGORY_LABELS: Record<CareAction, string> = {
  water: 'Watering',
  fertilize: 'Fertilizing',
  prune: 'Pruning',
  repot: 'Repotting',
  harvest: 'Harvest',
  pest_treatment: 'Pest Control',
  photo: 'Photo',
  note: 'Observation',
};

const CATEGORY_OPTIONS: Array<{ key: CareAction; label: string }> = [
  { key: 'note', label: 'Observation' },
  { key: 'prune', label: 'Pruning' },
  { key: 'pest_treatment', label: 'Pest Control' },
  { key: 'water', label: 'Watering' },
  { key: 'fertilize', label: 'Fertilizing' },
  { key: 'harvest', label: 'Harvest' },
];

const WEATHER_OPTIONS: Array<{ key: WeatherFilter; label: string }> = [
  { key: 'any', label: 'Any Weather' },
  { key: 'sunny', label: 'Sunny' },
  { key: 'cloudy', label: 'Cloudy' },
  { key: 'rainy', label: 'Rainy' },
];

// Fallback seed data so the timeline has content for fresh installs.
const MOCK_WEATHER = ['22°C SUNNY', '14°C CLOUDY', '26°C SUNNY', '18°C RAINY'];
const MOCK_TITLES: Partial<Record<CareAction, string>> = {
  prune: 'Autumn Pruning & Propagation',
  pest_treatment: 'Mealybug Alert on Phalaenopsis',
  note: 'Morning Observation',
  water: 'Hydration Round',
  fertilize: 'Nutrient Boost',
  harvest: 'Harvest Round',
  repot: 'Repotted for Growth',
  photo: 'Captured a Moment',
};

export default function JournalScreen() {
  const db = useDatabase();
  const [version, setVersion] = useState(0);
  const [search, setSearch] = useState('');
  const [plantFilter, setPlantFilter] = useState<string>('all');
  const [weatherFilter, setWeatherFilter] = useState<WeatherFilter>('any');
  const [monthView, setMonthView] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<ExtendedEntry | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  const plants: Plant[] = useMemo(() => {
    try {
      return getPlants(db);
    } catch {
      return [];
    }
  }, [db, version]);

  const rawEntries: GardenEntry[] = useMemo(() => {
    try {
      const end = new Date().toISOString().split('T')[0];
      const start = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      return getEntriesByDate(db, start, end);
    } catch {
      return [];
    }
  }, [db, version]);

  const entries: ExtendedEntry[] = useMemo(() => {
    return rawEntries.map((e, idx) => {
      const weather = MOCK_WEATHER[idx % MOCK_WEATHER.length];
      return {
        ...e,
        title: MOCK_TITLES[e.action] ?? CATEGORY_LABELS[e.action],
        tags: [CATEGORY_LABELS[e.action]],
        weather,
        photoUris: e.imageUri != null ? [e.imageUri] : [],
      };
    });
  }, [rawEntries]);

  const plantNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of plants) map.set(p.id, p.name);
    return map;
  }, [plants]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (plantFilter !== 'all' && e.plantId !== plantFilter) return false;
      if (weatherFilter !== 'any') {
        const w = (e.weather ?? '').toLowerCase();
        if (!w.includes(weatherFilter)) return false;
      }
      if (q.length === 0) return true;
      const hay = [
        e.title ?? '',
        e.notes ?? '',
        plantNameById.get(e.plantId ?? '') ?? '',
        ...(e.tags ?? []),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [entries, search, plantFilter, weatherFilter, plantNameById]);

  const grouped = useMemo(() => {
    const map = new Map<string, ExtendedEntry[]>();
    for (const entry of filtered) {
      const key = entry.date.split('T')[0];
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(entry);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const months = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of filtered) {
      const key = entry.date.slice(0, 7);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const handleCreate = useCallback(
    (input: {
      title: string;
      body: string;
      action: CareAction;
      plantId: string | null;
    }) => {
      try {
        const notes =
          input.title.trim().length > 0
            ? `${input.title.trim()}\n\n${input.body.trim()}`
            : input.body.trim();
        createEntry(db, uuid(), {
          plantId: input.plantId,
          action: input.action,
          notes: notes.length > 0 ? notes : null,
          imageUri: null,
          quantityGrams: null,
        });
        setVersion((v) => v + 1);
        setComposerOpen(false);
      } catch {
        setComposerOpen(false);
      }
    },
    [db],
  );

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.displayTitle}>Garden Journal</Text>
            <Text style={styles.subtitle}>
              Curating the life of your botanical sanctuary
            </Text>
          </View>
          <GradientButton
            title="+ New Entry"
            onPress={() => setComposerOpen(true)}
          />
        </View>

        {/* Filter bar */}
        <View style={styles.filterBar}>
          <View style={styles.searchPill}>
            <Text style={styles.searchIcon}>⌕</Text>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search entries, plants, notes..."
              placeholderTextColor={'rgba(214,195,181,0.5)'}
              style={styles.searchInput}
            />
          </View>
          <View style={styles.pillRow}>
            <DropdownPill
              label={
                plantFilter === 'all'
                  ? 'All Plants'
                  : (plantNameById.get(plantFilter) ?? 'Plant')
              }
              options={[
                { key: 'all', label: 'All Plants' },
                ...plants.map((p) => ({ key: p.id, label: p.name })),
              ]}
              onSelect={setPlantFilter}
            />
            <DropdownPill
              label={
                WEATHER_OPTIONS.find((w) => w.key === weatherFilter)?.label ??
                'Weather'
              }
              options={WEATHER_OPTIONS.map((w) => ({ key: w.key, label: w.label }))}
              onSelect={(key) => setWeatherFilter(key as WeatherFilter)}
            />
            <Pressable
              style={[styles.togglePill, monthView && styles.togglePillActive]}
              onPress={() => setMonthView((m) => !m)}
            >
              <Text
                style={[
                  styles.togglePillText,
                  monthView && { color: GARDEN_ACCENT },
                ]}
              >
                {monthView ? 'TIMELINE' : 'MONTHS'}
              </Text>
            </Pressable>
          </View>
        </View>

        {monthView ? (
          <View style={styles.monthList}>
            {months.length === 0 ? (
              <EmptyState />
            ) : (
              months.map(([ym, count]) => (
                <GlassCard key={ym} level={2} style={styles.monthCard}>
                  <View style={styles.monthRow}>
                    <Text style={styles.monthLabel}>
                      {formatMonthLabel(ym)}
                    </Text>
                    <Text style={styles.monthCount}>
                      {count} {count === 1 ? 'entry' : 'entries'}
                    </Text>
                  </View>
                </GlassCard>
              ))
            )}
          </View>
        ) : grouped.length === 0 ? (
          <EmptyState />
        ) : (
          <View style={styles.timeline}>
            {/* Gradient rail */}
            <View style={styles.rail} pointerEvents="none">
              <View style={styles.railTop} />
              <View style={styles.railMid} />
              <View style={styles.railBottom} />
            </View>
            {grouped.map(([date, dateEntries], dateIdx) => (
              <View key={date} style={styles.dayGroup}>
                {dateEntries.map((entry, entryIdx) => {
                  const isRecent = dateIdx === 0 && entryIdx === 0;
                  return (
                    <View key={entry.id} style={styles.entryRow}>
                      <View
                        style={[
                          styles.dot,
                          {
                            backgroundColor: isRecent
                              ? GARDEN_ACCENT
                              : GARDEN_ACCENT_DIM,
                            shadowColor: GARDEN_ACCENT,
                          },
                        ]}
                      />
                      <View style={styles.entryDateCol}>
                        <Text
                          style={[
                            styles.entryDate,
                            { color: isRecent ? GARDEN_ACCENT : colors.text },
                          ]}
                        >
                          {formatDayLabel(date).top}
                        </Text>
                        <Text style={styles.entryWeekday}>
                          {formatDayLabel(date).bottom}
                        </Text>
                        {entry.weather != null && (
                          <Text style={styles.entryWeather}>{entry.weather}</Text>
                        )}
                      </View>
                      <GlassCard
                        level={1}
                        style={styles.entryCard}
                        onPress={() => setSelectedEntry(entry)}
                      >
                        {(entry.tags ?? []).length > 0 && (
                          <View style={styles.tagRow}>
                            {(entry.tags ?? []).map((tag) => (
                              <ZoneChip key={tag} label={tag} active />
                            ))}
                            {entry.plantId != null &&
                              plantNameById.get(entry.plantId) != null && (
                                <ZoneChip
                                  label={plantNameById.get(entry.plantId)!}
                                />
                              )}
                          </View>
                        )}
                        <Text style={styles.entryTitle} numberOfLines={2}>
                          {entry.title ?? CATEGORY_LABELS[entry.action]}
                        </Text>
                        {entry.notes != null && entry.notes.length > 0 && (
                          <Text style={styles.entryBody} numberOfLines={3}>
                            {entry.notes}
                          </Text>
                        )}
                        {(entry.photoUris ?? []).length > 0 && (
                          <View style={styles.photoGrid}>
                            {(entry.photoUris ?? [])
                              .slice(0, 3)
                              .map((_uri, i) => (
                                <View key={i} style={styles.photoThumb} />
                              ))}
                          </View>
                        )}
                      </GlassCard>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <EntryDetailModal
        entry={selectedEntry}
        plantName={
          selectedEntry?.plantId != null
            ? (plantNameById.get(selectedEntry.plantId) ?? null)
            : null
        }
        onClose={() => setSelectedEntry(null)}
      />

      <EntryComposer
        visible={composerOpen}
        plants={plants}
        onClose={() => setComposerOpen(false)}
        onSubmit={handleCreate}
      />
    </View>
  );
}

// ── Sub components ──────────────────────────────────────────────────────

function EmptyState() {
  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyIcon}>📖</Text>
      <Text variant="subheading">No journal entries</Text>
      <Text variant="body" color={colors.textSecondary}>
        Archive your first observation to begin.
      </Text>
    </View>
  );
}

function DropdownPill({
  label,
  options,
  onSelect,
}: {
  label: string;
  options: Array<{ key: string; label: string }>;
  onSelect: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.dropdownWrap}>
      <Pressable style={styles.dropdownPill} onPress={() => setOpen((o) => !o)}>
        <Text style={styles.dropdownText} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.dropdownCaret}>⌄</Text>
      </Pressable>
      {open && (
        <View style={styles.dropdownMenu}>
          {options.map((opt) => (
            <Pressable
              key={opt.key}
              style={styles.dropdownItem}
              onPress={() => {
                onSelect(opt.key);
                setOpen(false);
              }}
            >
              <Text style={styles.dropdownItemText}>{opt.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function EntryDetailModal({
  entry,
  plantName,
  onClose,
}: {
  entry: ExtendedEntry | null;
  plantName: string | null;
  onClose: () => void;
}) {
  if (entry == null) return null;
  const bodyText = entry.notes ?? '';

  return (
    <Modal
      visible={entry != null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.modalScreen}>
        <View style={styles.modalHeaderBar}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.modalCloseText}>Close</Text>
          </Pressable>
          <Text style={styles.modalHeaderTitle}>Entry</Text>
          <View style={{ width: 48 }} />
        </View>
        <ScrollView contentContainerStyle={styles.modalContent}>
          <View style={styles.modalHero}>
            <View style={styles.modalHeroBadgeRow}>
              <View style={styles.obsidianBadge}>
                <Text style={styles.obsidianBadgeText}>OBSIDIAN RECORD</Text>
              </View>
              {entry.weather != null && (
                <Text style={styles.modalHeroWeather}>{entry.weather}</Text>
              )}
            </View>
            <Text style={styles.modalHeroTitle}>
              {entry.title ?? CATEGORY_LABELS[entry.action]}
            </Text>
            <Text style={styles.modalHeroDate}>
              {formatLongDate(entry.date)}
            </Text>
          </View>

          <View style={styles.modalBodySection}>
            <Text style={styles.modalBodyText}>{bodyText}</Text>
            {entry.notes != null && entry.notes.length > 0 && (
              <>
                <Text style={styles.modalSectionLabel}>Curator's Notes</Text>
                <Text style={styles.modalItalic}>
                  "Observed conditions logged during routine archival review."
                </Text>
              </>
            )}
          </View>

          {(entry.photoUris ?? []).length > 0 && (
            <View style={styles.modalBodySection}>
              <Text style={styles.modalSectionLabel}>Gallery</Text>
              <View style={styles.photoGrid}>
                {(entry.photoUris ?? []).map((_uri, i) => (
                  <View key={i} style={styles.photoThumbLarge} />
                ))}
              </View>
            </View>
          )}

          <View style={styles.modalBodySection}>
            <Text style={styles.modalSectionLabel}>Plant Profile</Text>
            <GlassCard level={1} style={{ gap: 10 }}>
              <ProfileRow label="PLANT" value={plantName ?? 'Unlinked'} />
              <ProfileRow
                label="CATEGORY"
                value={CATEGORY_LABELS[entry.action]}
              />
              <View>
                <Text style={styles.profileLabel}>HEALTH INDEX</Text>
                <View style={styles.healthBarTrack}>
                  <View style={styles.healthBarFill} />
                </View>
              </View>
            </GlassCard>
          </View>

          <View style={styles.modalActions}>
            <Pressable style={styles.modalActionBtn}>
              <Text style={styles.modalActionText}>Edit Entry</Text>
            </Pressable>
            <Pressable style={styles.modalActionBtn}>
              <Text style={styles.modalActionText}>Export PDF</Text>
            </Pressable>
            <Pressable style={styles.modalActionBtn}>
              <Text
                style={[styles.modalActionText, { color: colors.danger }]}
              >
                Delete Archive
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={styles.profileLabel}>{label}</Text>
      <Text style={styles.profileValue}>{value}</Text>
    </View>
  );
}

function EntryComposer({
  visible,
  plants,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  plants: Plant[];
  onClose: () => void;
  onSubmit: (input: {
    title: string;
    body: string;
    action: CareAction;
    plantId: string | null;
  }) => void;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [action, setAction] = useState<CareAction>('note');
  const [plantId, setPlantId] = useState<string | null>(null);

  const handleSubmit = () => {
    onSubmit({ title, body, action, plantId });
    setTitle('');
    setBody('');
    setAction('note');
    setPlantId(null);
  };

  const handleClose = () => {
    setTitle('');
    setBody('');
    setAction('note');
    setPlantId(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.modalScreen}>
        <View style={styles.modalHeaderBar}>
          <Pressable onPress={handleClose} hitSlop={12}>
            <Text style={styles.modalCloseText}>Cancel</Text>
          </Pressable>
          <Text style={styles.modalHeaderTitle}>New Entry</Text>
          <View style={{ width: 48 }} />
        </View>
        <ScrollView contentContainerStyle={styles.modalContent}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>ENTRY TITLE</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="The silent growth of..."
              placeholderTextColor={'rgba(214,195,181,0.5)'}
              style={styles.titleInput}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>BODY TEXT</Text>
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder="Begin the observation..."
              placeholderTextColor={'rgba(214,195,181,0.5)'}
              multiline
              numberOfLines={8}
              style={styles.bodyInput}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>CATEGORY</Text>
            <View style={styles.optionRow}>
              {CATEGORY_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.key}
                  style={[
                    styles.optionPill,
                    action === opt.key && styles.optionPillActive,
                  ]}
                  onPress={() => setAction(opt.key)}
                >
                  <Text
                    style={[
                      styles.optionPillText,
                      action === opt.key && { color: GARDEN_ACCENT },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>PLANT (OPTIONAL)</Text>
            <View style={styles.optionRow}>
              <Pressable
                style={[
                  styles.optionPill,
                  plantId == null && styles.optionPillActive,
                ]}
                onPress={() => setPlantId(null)}
              >
                <Text
                  style={[
                    styles.optionPillText,
                    plantId == null && { color: GARDEN_ACCENT },
                  ]}
                >
                  None
                </Text>
              </Pressable>
              {plants.slice(0, 12).map((p) => (
                <Pressable
                  key={p.id}
                  style={[
                    styles.optionPill,
                    plantId === p.id && styles.optionPillActive,
                  ]}
                  onPress={() => setPlantId(p.id)}
                >
                  <Text
                    style={[
                      styles.optionPillText,
                      plantId === p.id && { color: GARDEN_ACCENT },
                    ]}
                  >
                    {p.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>PHOTOS</Text>
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoPlaceholderText}>
                Photo upload coming soon
              </Text>
            </View>
          </View>

          <View style={{ marginTop: 12 }}>
            <GradientButton title="Archive Entry" onPress={handleSubmit} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────

function formatDayLabel(dateStr: string): { top: string; bottom: string } {
  const d = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return { top: dateStr, bottom: '' };
  const month = d
    .toLocaleDateString('en-US', { month: 'short' })
    .toUpperCase();
  const day = d.getDate();
  const weekday = d
    .toLocaleDateString('en-US', { weekday: 'long' })
    .toUpperCase();
  return { top: `${month} ${day}`, bottom: weekday };
}

function formatMonthLabel(ym: string): string {
  const [year, month] = ym.split('-');
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    .toUpperCase();
}

function formatLongDate(dateStr: string): string {
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

// ── Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: GARDEN_SURFACES.base },
  content: { padding: 20, paddingBottom: 64, gap: 20 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 16,
  },
  headerText: { flex: 1, gap: 6 },
  displayTitle: {
    ...GARDEN_TYPOGRAPHY.displayLg,
    color: colors.text,
  },
  subtitle: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
    fontSize: 14,
  },
  filterBar: { gap: 12 },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GARDEN_SURFACES.highest,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
    gap: 10,
  },
  searchIcon: { fontSize: 16, color: colors.textSecondary },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontFamily: GARDEN_TYPOGRAPHY.bodyMd.fontFamily,
    fontSize: 14,
    padding: 0,
  },
  pillRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  dropdownWrap: { flex: 1, minWidth: 120, position: 'relative' },
  dropdownPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: GARDEN_SURFACES.highest,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
  },
  dropdownText: {
    flex: 1,
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.1 * 11,
    color: colors.text,
  },
  dropdownCaret: { color: GARDEN_ACCENT, fontSize: 14 },
  dropdownMenu: {
    position: 'absolute',
    top: 44,
    left: 0,
    right: 0,
    backgroundColor: GARDEN_SURFACES.focus,
    borderRadius: 14,
    paddingVertical: 6,
    zIndex: 50,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  dropdownItem: { paddingVertical: 10, paddingHorizontal: 16 },
  dropdownItemText: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    color: colors.text,
  },
  togglePill: {
    backgroundColor: GARDEN_SURFACES.highest,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  togglePillActive: {
    backgroundColor: GARDEN_SURFACES.focus,
  },
  togglePillText: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.1 * 10,
    color: colors.textSecondary,
  },
  timeline: { position: 'relative', gap: 24 },
  rail: {
    position: 'absolute',
    left: 6,
    top: 0,
    bottom: 0,
    width: 2,
  },
  railTop: {
    flex: 1,
    backgroundColor: GARDEN_ACCENT,
    opacity: 0.4,
  },
  railMid: {
    flex: 1,
    backgroundColor: GARDEN_ACCENT_DIM,
    opacity: 0.2,
  },
  railBottom: {
    flex: 1,
    backgroundColor: 'rgba(159, 142, 129, 0.1)',
  },
  dayGroup: { gap: 20 },
  entryRow: {
    flexDirection: 'row',
    paddingLeft: 22,
    gap: 12,
    position: 'relative',
  },
  dot: {
    position: 'absolute',
    left: 0,
    top: 6,
    width: 14,
    height: 14,
    borderRadius: 7,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  entryDateCol: {
    width: 72,
    gap: 2,
  },
  entryDate: {
    fontFamily: GARDEN_TYPOGRAPHY.displayLg.fontFamily,
    fontSize: 18,
    letterSpacing: -0.3,
    color: colors.text,
  },
  entryWeekday: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    letterSpacing: 0.1 * 9,
    color: colors.textSecondary,
  },
  entryWeather: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    letterSpacing: 0.1 * 9,
    color: 'rgba(214, 195, 181, 0.6)',
    marginTop: 6,
  },
  entryCard: {
    flex: 1,
    gap: 10,
  },
  tagRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  entryTitle: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 17,
    color: colors.text,
  },
  entryBody: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    lineHeight: 1.6 * 13,
    color: colors.textSecondary,
  },
  photoGrid: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  photoThumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: GARDEN_SURFACES.focus,
  },
  photoThumbLarge: {
    width: 96,
    height: 96,
    borderRadius: 12,
    backgroundColor: GARDEN_SURFACES.focus,
  },
  monthList: { gap: 10 },
  monthCard: {},
  monthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  monthLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 13,
    color: colors.text,
  },
  monthCount: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    color: GARDEN_ACCENT_LIGHT,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyIcon: { fontSize: 48, marginBottom: 6 },

  // Modal
  modalScreen: { flex: 1, backgroundColor: GARDEN_SURFACES.base },
  modalHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: GARDEN_SURFACES.depth,
  },
  modalCloseText: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.1 * 11,
    color: GARDEN_ACCENT,
  },
  modalHeaderTitle: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 16,
    color: colors.text,
  },
  modalContent: {
    padding: 20,
    paddingBottom: 48,
    gap: 20,
  },
  modalHero: {
    padding: 20,
    borderRadius: 20,
    backgroundColor: GARDEN_SURFACES.lift,
    gap: 12,
  },
  modalHeroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  obsidianBadge: {
    backgroundColor: GARDEN_ACCENT,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  obsidianBadgeText: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    letterSpacing: 0.2 * 9,
    color: '#0B1a04',
  },
  modalHeroWeather: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.1 * 10,
    color: colors.textSecondary,
  },
  modalHeroTitle: {
    ...GARDEN_TYPOGRAPHY.displayLg,
    fontSize: 28,
    color: colors.text,
  },
  modalHeroDate: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.1 * 10,
    color: 'rgba(214, 195, 181, 0.7)',
  },
  modalBodySection: { gap: 12 },
  modalBodyText: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 15,
    lineHeight: 1.7 * 15,
    color: colors.textSecondary,
  },
  modalSectionLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    color: GARDEN_ACCENT,
    marginTop: 8,
  },
  modalItalic: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    color: 'rgba(214, 195, 181, 0.7)',
    fontStyle: 'italic',
  },
  profileLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    letterSpacing: 0.1 * 9,
    color: 'rgba(214, 195, 181, 0.5)',
  },
  profileValue: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    color: colors.text,
    marginTop: 2,
  },
  healthBarTrack: {
    marginTop: 8,
    height: 4,
    backgroundColor: GARDEN_SURFACES.focus,
    borderRadius: 2,
    overflow: 'hidden',
  },
  healthBarFill: {
    width: '92%',
    height: '100%',
    backgroundColor: GARDEN_ACCENT,
  },
  modalActions: { gap: 10, marginTop: 8 },
  modalActionBtn: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: GARDEN_SURFACES.lift,
    alignItems: 'center',
  },
  modalActionText: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.1 * 11,
    color: colors.text,
  },

  // Composer
  field: { gap: 8 },
  fieldLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    color: GARDEN_ACCENT,
  },
  titleInput: {
    backgroundColor: GARDEN_SURFACES.lift,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.text,
    fontFamily: GARDEN_TYPOGRAPHY.headlineMd.fontFamily,
    fontSize: 18,
  },
  bodyInput: {
    backgroundColor: GARDEN_SURFACES.lift,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.text,
    fontFamily: GARDEN_TYPOGRAPHY.bodyMd.fontFamily,
    fontSize: 14,
    minHeight: 160,
    textAlignVertical: 'top',
  },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionPill: {
    backgroundColor: GARDEN_SURFACES.lift,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  optionPillActive: {
    backgroundColor: GARDEN_SURFACES.focus,
  },
  optionPillText: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.1 * 10,
    color: colors.textSecondary,
  },
  photoPlaceholder: {
    height: 120,
    borderRadius: 14,
    backgroundColor: GARDEN_SURFACES.lift,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderText: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.1 * 10,
    color: 'rgba(214, 195, 181, 0.6)',
  },
});
