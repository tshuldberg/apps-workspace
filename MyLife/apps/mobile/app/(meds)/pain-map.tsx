import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  BODY_ZONE_LABELS,
  calculateHeatmap,
  createPainEntry,
  getPainEntries,
  getPainInsights,
  getPainByRegion,
  type BodyZone,
  type PainEntry,
  type PainType,
} from '@mylife/meds';
import {
  BodyDiagram,
  type BodyRegionId,
  GlassCard,
  MaterialSymbol,
  MD_ACCENT,
  MD_ACCENT_LIGHT,
  MD_SURFACES,
  MD_TEXT,
  MD_TEXT_SECONDARY,
  MD_TEXT_TERTIARY,
  MD_TYPOGRAPHY,
  PainScale,
  SectionHeader,
  resolvePainLevel,
  withAlpha,
} from '@mylife/meds/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

const FRONT_REGION_TO_ZONE: Record<Exclude<BodyRegionId, 'back'>, BodyZone> = {
  head: 'head_front',
  chest: 'chest_center',
  abdomen: 'abdomen_upper',
  left_arm: 'shoulder_left',
  right_arm: 'shoulder_right',
  left_leg: 'knee_left',
  right_leg: 'knee_right',
};

const BACK_REGION_TO_ZONE: Record<BodyRegionId, BodyZone> = {
  head: 'head_back',
  chest: 'upper_back',
  abdomen: 'mid_back',
  left_arm: 'shoulder_left',
  right_arm: 'shoulder_right',
  left_leg: 'knee_left',
  right_leg: 'knee_right',
  back: 'lower_back',
};

const PAIN_TYPES: PainType[] = ['sharp', 'dull', 'throbbing', 'burning', 'aching', 'stabbing'];

const DURATION_OPTIONS = [
  { label: 'Moments', minutes: 5 },
  { label: 'Minutes', minutes: 30 },
  { label: 'Hours', minutes: 180 },
  { label: 'Days', minutes: 1440 },
  { label: 'Chronic', minutes: 10080 },
] as const;

function zoneFromRegion(regionId: BodyRegionId, view: 'front' | 'back'): BodyZone {
  return view === 'front'
    ? FRONT_REGION_TO_ZONE[regionId as Exclude<BodyRegionId, 'back'>] ?? 'chest_center'
    : BACK_REGION_TO_ZONE[regionId];
}

function groupEntriesByDate(entries: PainEntry[]) {
  const groups = new Map<string, PainEntry[]>();
  for (const entry of entries) {
    const dateKey = entry.startedAt.slice(0, 10);
    const bucket = groups.get(dateKey) ?? [];
    bucket.push(entry);
    groups.set(dateKey, bucket);
  }

  return [...groups.entries()];
}

export default function PainMapScreen() {
  const db = useDatabase();
  const [refreshTick, setRefreshTick] = useState(0);
  const [bodyView, setBodyView] = useState<'front' | 'back'>('front');
  const [selectedRegion, setSelectedRegion] = useState<BodyRegionId | null>(null);
  const [selectedZone, setSelectedZone] = useState<BodyZone | null>(null);
  const [severity, setSeverity] = useState(6);
  const [painType, setPainType] = useState<PainType>('aching');
  const [durationMinutes, setDurationMinutes] = useState<number>(180);
  const [notes, setNotes] = useState('');
  const [sheetVisible, setSheetVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  useFocusEffect(useCallback(() => {
    setRefreshTick((value) => value + 1);
  }, []));

  const data = useMemo(() => {
    try {
      const entries = getPainEntries(db);
      const last30Days = new Date();
      last30Days.setDate(last30Days.getDate() - 30);
      const insights = getPainInsights(db, last30Days.toISOString(), new Date().toISOString());
      const regions = getPainByRegion(db, last30Days.toISOString(), new Date().toISOString());
      return {
        entries,
        insights,
        regions,
        error: null as string | null,
      };
    } catch {
      return {
        entries: [] as PainEntry[],
        insights: null,
        regions: [],
        error: 'Pain data could not be loaded.',
      };
    }
  }, [db, refreshTick]);

  const entriesByDate = useMemo(() => groupEntriesByDate(data.entries), [data.entries]);
  const heatmap = useMemo(() => calculateHeatmap(data.entries), [data.entries]);

  const diagramRegions = useMemo(() => {
    const regionToneMap = new Map<BodyRegionId, string>();
    for (const summary of data.regions) {
      const region =
        summary.zone.includes('head') ? 'head' :
        summary.zone.includes('back') ? 'back' :
        summary.zone.includes('chest') ? 'chest' :
        summary.zone.includes('abdomen') ? 'abdomen' :
        summary.zone.includes('arm') || summary.zone.includes('shoulder') || summary.zone.includes('wrist') || summary.zone.includes('hand') || summary.zone.includes('elbow') ? (summary.zone.includes('left') ? 'left_arm' : 'right_arm') :
        summary.zone.includes('hip') || summary.zone.includes('thigh') || summary.zone.includes('knee') || summary.zone.includes('shin') || summary.zone.includes('ankle') || summary.zone.includes('foot') ? (summary.zone.includes('left') ? 'left_leg' : 'right_leg') :
        'abdomen';
      regionToneMap.set(region as BodyRegionId, resolvePainLevel(summary.averageSeverity).color);
    }

    return [...regionToneMap.entries()].map(([id, tone]) => ({
      id,
      tone,
      side: bodyView,
    }));
  }, [bodyView, data.regions]);

  const openRegionSheet = (regionId: BodyRegionId) => {
    const zone = zoneFromRegion(regionId, bodyView);
    const lastRegionEntry = data.entries.find((entry) => entry.bodyZone === zone);
    setSelectedRegion(regionId);
    setSelectedZone(zone);
    setSeverity(lastRegionEntry?.severity ?? 6);
    setPainType(lastRegionEntry?.painType ?? 'aching');
    setDurationMinutes(lastRegionEntry?.durationMinutes ?? 180);
    setNotes(lastRegionEntry?.notes ?? '');
    setSheetVisible(true);
  };

  const handleSave = () => {
    if (!selectedZone || saving) {
      return;
    }

    setSaving(true);
    try {
      createPainEntry(db, uuid(), {
        bodyZone: selectedZone,
        severity,
        painType,
        durationMinutes,
        notes: notes.trim() || undefined,
      });
      setSheetVisible(false);
      setNotes('');
      setSaving(false);
      setRefreshTick((value) => value + 1);
    } catch {
      Alert.alert('Unable to save', 'The pain entry could not be saved. Try again.');
      setSaving(false);
    }
  };

  return (
    <>
      <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Pain Tracking</Text>
          <Text style={styles.title}>Pain Map</Text>
          <Text style={styles.subtitle}>
            Tap the body to log pain intensity, then use the history and heatmap to spot repeat flare-up zones.
          </Text>
        </View>

        {data.error ? (
          <GlassCard padding={20}>
            <Text style={styles.emptyTitle}>{data.error}</Text>
          </GlassCard>
        ) : null}

        <GlassCard padding={20}>
          <SectionHeader
            action={(
              <View style={styles.toggleRow}>
                <Pressable
                  onPress={() => setBodyView('front')}
                  style={[styles.toggleChip, bodyView === 'front' ? styles.toggleChipActive : null]}
                >
                  <Text style={[styles.toggleLabel, { color: bodyView === 'front' ? MD_SURFACES.lowest : MD_TEXT_SECONDARY }]}>
                    Front
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setBodyView('back')}
                  style={[styles.toggleChip, bodyView === 'back' ? styles.toggleChipActive : null]}
                >
                  <Text style={[styles.toggleLabel, { color: bodyView === 'back' ? MD_SURFACES.lowest : MD_TEXT_SECONDARY }]}>
                    Back
                  </Text>
                </Pressable>
              </View>
            )}
            title="Tap A Region"
          />
          <Text style={styles.helperText}>
            Current highlights reflect average severity across the past 30 days.
          </Text>
          <View style={styles.diagramWrap}>
            <BodyDiagram
              mode={bodyView}
              onPress={openRegionSheet}
              regions={diagramRegions}
              selected={selectedRegion ? [selectedRegion] : []}
            />
          </View>
          {selectedZone ? (
            <View style={styles.selectionCard}>
              <Text style={styles.selectionLabel}>Selected Region</Text>
              <Text style={styles.selectionValue}>{BODY_ZONE_LABELS[selectedZone]}</Text>
            </View>
          ) : null}
        </GlassCard>

        <GlassCard padding={20}>
          <SectionHeader
            action={<Text style={styles.sectionMeta}>30 days</Text>}
            title="Pain Heatmap"
          />
          <View style={styles.heatmapContent}>
            <BodyDiagram
              regions={diagramRegions.map((region) => ({ ...region, side: 'front' }))}
              mode="dual"
            />
            <View style={styles.regionList}>
              {data.regions.slice(0, 4).map((region) => (
                <View key={region.zone} style={styles.regionRow}>
                  <View style={[styles.regionDot, { backgroundColor: resolvePainLevel(region.averageSeverity).color }]} />
                  <View style={styles.regionCopy}>
                    <Text style={styles.regionTitle}>{region.label}</Text>
                    <Text style={styles.regionMeta}>
                      Avg {region.averageSeverity.toFixed(1)}/10 • {region.entryCount} entries
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
          {heatmap.length === 0 ? (
            <Text style={styles.emptyBody}>Log a few pain entries to build a usable heatmap.</Text>
          ) : null}
        </GlassCard>

        <GlassCard padding={20}>
          <SectionHeader
            action={<Text style={styles.sectionMeta}>Insights</Text>}
            title="Patterns"
          />
          <View style={styles.listGap}>
            <View style={styles.insightCard}>
              <MaterialSymbol color={MD_ACCENT_LIGHT} name="neurology" size={20} />
              <View style={styles.insightCopy}>
                <Text style={styles.insightTitle}>Most Painful Region</Text>
                <Text style={styles.insightBody}>
                  {data.insights?.mostPainfulRegion?.label ?? 'Not enough data yet'}
                </Text>
              </View>
            </View>
            <View style={styles.insightCard}>
              <MaterialSymbol color={MD_ACCENT_LIGHT} name="schedule" size={20} />
              <View style={styles.insightCopy}>
                <Text style={styles.insightTitle}>Peak Time of Day</Text>
                <Text style={styles.insightBody}>
                  {data.insights?.peakWindow ?? 'Still learning your timing patterns'}
                </Text>
              </View>
            </View>
            <View style={styles.insightCard}>
              <MaterialSymbol color={MD_ACCENT_LIGHT} name="medication" size={20} />
              <View style={styles.insightCopy}>
                <Text style={styles.insightTitle}>Medication Correlation</Text>
                <Text style={styles.insightBody}>
                  {data.insights?.topMedicationCorrelation
                    ? `${data.insights.topMedicationCorrelation.medName} changed average severity by ${data.insights.topMedicationCorrelation.severityDelta.toFixed(1)} points`
                    : 'No strong medication pattern yet'}
                </Text>
              </View>
            </View>
          </View>
        </GlassCard>

        <GlassCard padding={20}>
          <SectionHeader
            action={<Text style={styles.sectionMeta}>History</Text>}
            title="Recent Entries"
          />
          <View style={styles.listGap}>
            {entriesByDate.length > 0 ? (
              entriesByDate.slice(0, 6).map(([date, entries]) => (
                <View key={date} style={styles.historyGroup}>
                  <Text style={styles.historyDate}>
                    {new Date(`${date}T00:00:00.000Z`).toLocaleDateString()}
                  </Text>
                  {entries.map((entry) => (
                    <View key={entry.id} style={styles.historyRow}>
                      <View style={[styles.regionDot, { backgroundColor: resolvePainLevel(entry.severity).color }]} />
                      <View style={styles.historyCopy}>
                        <Text style={styles.regionTitle}>{BODY_ZONE_LABELS[entry.bodyZone]}</Text>
                        <Text style={styles.regionMeta}>
                          {entry.painType ?? 'pain'} • {entry.durationMinutes ?? 0} min
                        </Text>
                      </View>
                      <Text style={styles.historySeverity}>{entry.severity}/10</Text>
                    </View>
                  ))}
                </View>
              ))
            ) : (
              <Text style={styles.emptyBody}>
                No pain history yet. Tap a region above to log your first flare-up.
              </Text>
            )}
          </View>
        </GlassCard>
      </ScrollView>

      <Modal
        animationType="slide"
        onRequestClose={() => setSheetVisible(false)}
        transparent
        visible={sheetVisible}
      >
        <Pressable onPress={() => setSheetVisible(false)} style={styles.sheetOverlay}>
          <Pressable onPress={(event) => event.stopPropagation()} style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>
              {selectedZone ? BODY_ZONE_LABELS[selectedZone] : 'Pain Detail'}
            </Text>
            <PainScale level={severity} size="lg" />

            <Text style={styles.sheetLabel}>Intensity</Text>
            <View style={styles.severitySteps}>
              {Array.from({ length: 10 }, (_, index) => {
                const value = index + 1;
                const active = value <= severity;
                return (
                  <Pressable
                    key={value}
                    onPress={() => setSeverity(value)}
                    style={[
                      styles.severityStep,
                      {
                        backgroundColor: active ? resolvePainLevel(value).color : withAlpha(resolvePainLevel(value).color, 0.18),
                      },
                    ]}
                  >
                    <Text style={[styles.severityLabel, { color: active ? MD_SURFACES.lowest : MD_TEXT_TERTIARY }]}>
                      {value}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.sheetLabel}>Pain Type</Text>
            <View style={styles.sheetChipWrap}>
              {PAIN_TYPES.map((type) => (
                <Pressable
                  key={type}
                  onPress={() => setPainType(type)}
                  style={[
                    styles.sheetChip,
                    painType === type ? styles.sheetChipActive : null,
                  ]}
                >
                  <Text style={[styles.sheetChipLabel, { color: painType === type ? MD_SURFACES.lowest : MD_TEXT_SECONDARY }]}>
                    {type}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.sheetLabel}>Duration</Text>
            <View style={styles.sheetChipWrap}>
              {DURATION_OPTIONS.map((option) => (
                <Pressable
                  key={option.label}
                  onPress={() => setDurationMinutes(option.minutes)}
                  style={[
                    styles.sheetChip,
                    durationMinutes === option.minutes ? styles.sheetChipActive : null,
                  ]}
                >
                  <Text style={[styles.sheetChipLabel, { color: durationMinutes === option.minutes ? MD_SURFACES.lowest : MD_TEXT_SECONDARY }]}>
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.sheetLabel}>Notes</Text>
            <TextInput
              multiline
              onChangeText={setNotes}
              placeholder="Describe the pain, radiation, or anything that improved it."
              placeholderTextColor={MD_TEXT_TERTIARY}
              style={styles.notesInput}
              textAlignVertical="top"
              value={notes}
            />

            <Pressable onPress={handleSave} style={styles.primaryButton}>
              <Text style={styles.primaryButtonLabel}>{saving ? 'Saving...' : 'Save Pain Entry'}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: MD_SURFACES.base,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 18,
  },
  hero: {
    gap: 8,
    paddingTop: 4,
  },
  eyebrow: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_ACCENT_LIGHT,
  },
  title: {
    ...MD_TYPOGRAPHY.displayLg,
    color: MD_TEXT,
    fontSize: 38,
    lineHeight: 42,
  },
  subtitle: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  helperText: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
    marginTop: 10,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleChip: {
    backgroundColor: MD_SURFACES.low,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  toggleChipActive: {
    backgroundColor: MD_ACCENT,
  },
  toggleLabel: {
    ...MD_TYPOGRAPHY.titleMd,
  },
  diagramWrap: {
    alignItems: 'center',
    marginTop: 18,
  },
  selectionCard: {
    backgroundColor: withAlpha(MD_ACCENT, 0.08),
    borderRadius: 18,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  selectionLabel: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_ACCENT_LIGHT,
  },
  selectionValue: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT,
    marginTop: 6,
  },
  heatmapContent: {
    alignItems: 'center',
    gap: 18,
    marginTop: 18,
  },
  regionList: {
    gap: 12,
    width: '100%',
  },
  regionRow: {
    alignItems: 'center',
    backgroundColor: MD_SURFACES.low,
    borderRadius: 18,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  regionDot: {
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  regionCopy: {
    flex: 1,
    gap: 4,
  },
  regionTitle: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT,
  },
  regionMeta: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
    fontSize: 13,
    lineHeight: 18,
  },
  sectionMeta: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_TERTIARY,
  },
  listGap: {
    gap: 12,
    marginTop: 18,
  },
  insightCard: {
    alignItems: 'flex-start',
    backgroundColor: withAlpha(MD_ACCENT, 0.08),
    borderRadius: 18,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  insightCopy: {
    flex: 1,
    gap: 4,
  },
  insightTitle: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT,
  },
  insightBody: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  historyGroup: {
    gap: 10,
  },
  historyDate: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_ACCENT_LIGHT,
  },
  historyRow: {
    alignItems: 'center',
    backgroundColor: MD_SURFACES.low,
    borderRadius: 18,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  historyCopy: {
    flex: 1,
    gap: 4,
  },
  historySeverity: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT,
  },
  emptyTitle: {
    ...MD_TYPOGRAPHY.headlineMd,
    color: MD_TEXT,
  },
  emptyBody: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  sheetOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: MD_SURFACES.base,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    gap: 16,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
  },
  sheetHandle: {
    alignSelf: 'center',
    backgroundColor: withAlpha(MD_TEXT_TERTIARY, 0.4),
    borderRadius: 999,
    height: 5,
    width: 48,
  },
  sheetTitle: {
    ...MD_TYPOGRAPHY.headlineMd,
    color: MD_TEXT,
    marginTop: 4,
  },
  sheetLabel: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_TERTIARY,
    marginTop: 8,
  },
  severitySteps: {
    flexDirection: 'row',
    gap: 8,
  },
  severityStep: {
    alignItems: 'center',
    borderRadius: 999,
    flex: 1,
    minHeight: 40,
    justifyContent: 'center',
  },
  severityLabel: {
    ...MD_TYPOGRAPHY.labelUpper,
  },
  sheetChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sheetChip: {
    backgroundColor: MD_SURFACES.low,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sheetChipActive: {
    backgroundColor: MD_ACCENT,
  },
  sheetChipLabel: {
    ...MD_TYPOGRAPHY.titleMd,
    textTransform: 'capitalize',
  },
  notesInput: {
    ...MD_TYPOGRAPHY.bodyMd,
    backgroundColor: MD_SURFACES.high,
    borderRadius: 20,
    color: MD_TEXT,
    minHeight: 120,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: MD_ACCENT,
    borderRadius: 999,
    marginTop: 8,
    minHeight: 54,
    justifyContent: 'center',
  },
  primaryButtonLabel: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_SURFACES.lowest,
  },
});
