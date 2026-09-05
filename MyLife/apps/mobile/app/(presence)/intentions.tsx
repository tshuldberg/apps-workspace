import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import type { AppCategory } from '@mylife/presence';
import {
  APP_LIBRARY,
  GlassPanel,
  MaterialSymbol,
  TrendBars,
  PR_ACCENT,
  PR_ACCENT_LIGHT,
  PR_FONTS,
  PR_SURFACES,
  PR_TEXT,
  PR_TEXT_SECONDARY,
  PR_TEXT_TERTIARY,
  PR_TYPOGRAPHY,
  deactivateIntention,
  deleteIntention,
  findAppLibraryEntry,
  getAllActiveIntentions,
  getAppUsageByDate,
  getAppUsageRange,
  countAppOpensForDate,
  upsertAppIntention,
  type AppIntention,
} from '@mylife/presence';
import { Text } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

interface DraftIntention {
  appId: string;
  appName: string;
  category: AppCategory;
  dailyOpenLimit: number;
  perOpenMinutes: number;
  breathingPause: boolean;
}

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function startDate(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function buildEmptyDraft(entry?: {
  appId: string;
  name: string;
  category: AppCategory;
}): DraftIntention {
  return {
    appId: entry?.appId ?? '',
    appName: entry?.name ?? '',
    category: entry?.category ?? 'other',
    dailyOpenLimit: 5,
    perOpenMinutes: 10,
    breathingPause: false,
  };
}

function toDraft(intention: AppIntention, category: AppCategory): DraftIntention {
  return {
    appId: intention.app_id,
    appName: intention.app_name,
    category,
    dailyOpenLimit: intention.daily_open_limit ?? 5,
    perOpenMinutes: intention.per_open_minutes ?? 10,
    breathingPause: intention.breathing_pause === 1,
  };
}

function buildTrendData(
  appId: string,
  usageRange: ReturnType<typeof getAppUsageRange>,
  endDate: string,
) {
  const totals = new Map<string, number>();
  for (const row of usageRange) {
    if (row.app_id !== appId) {
      continue;
    }

    totals.set(row.date, (totals.get(row.date) ?? 0) + row.minutes);
  }

  const data: Array<{ label: string; value: number; isToday: boolean }> = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(`${endDate}T12:00:00`);
    date.setDate(date.getDate() - offset);
    const key = date.toISOString().slice(0, 10);
    data.push({
      label: key.slice(5),
      value: totals.get(key) ?? 0,
      isToday: offset === 0,
    });
  }

  return data;
}

function categoryGradient(category: AppCategory) {
  switch (category) {
    case 'social':
      return ['#FB7185', '#F59E0B'] as const;
    case 'entertainment':
      return ['#F59E0B', '#EF4444'] as const;
    case 'productivity':
      return ['#22C55E', '#0F766E'] as const;
    case 'communication':
      return ['#60A5FA', '#2563EB'] as const;
    case 'gaming':
      return ['#818CF8', '#4F46E5'] as const;
    case 'news':
      return ['#64748B', '#334155'] as const;
    case 'shopping':
      return ['#FB923C', '#EA580C'] as const;
    case 'health':
      return ['#34D399', '#0F766E'] as const;
    case 'education':
      return ['#A78BFA', '#7C3AED'] as const;
    default:
      return ['#38BDF8', '#0284C7'] as const;
  }
}

function fallbackIconName(category: AppCategory) {
  switch (category) {
    case 'entertainment':
      return 'movie';
    case 'productivity':
      return 'insights';
    case 'gaming':
      return 'groups';
    case 'communication':
      return 'chat';
    default:
      return 'explore';
  }
}

export default function IntentionsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const today = todayString();
  const [tick, setTick] = useState(0);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [editorVisible, setEditorVisible] = useState(false);
  const [detailAppId, setDetailAppId] = useState<string | null>(null);
  const [pickerQuery, setPickerQuery] = useState('');
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [draft, setDraft] = useState<DraftIntention>(buildEmptyDraft());
  const breathScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathScale, {
          toValue: 1.14,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(breathScale, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();

    return () => {
      loop.stop();
    };
  }, [breathScale]);

  const intentions = useMemo(() => getAllActiveIntentions(db), [db, tick]);
  const usageToday = useMemo(() => getAppUsageByDate(db, today), [db, tick, today]);
  const usageRange = useMemo(
    () => getAppUsageRange(db, startDate(6), today),
    [db, tick, today],
  );

  const usageMap = useMemo(() => {
    const map = new Map<string, (typeof usageToday)[number]>();
    for (const row of usageToday) {
      map.set(row.app_id, row);
    }
    return map;
  }, [usageToday]);

  const activeIntentionsCount = intentions.length;
  const overages = intentions.map((intention) => {
    const usage = usageMap.get(intention.app_id);
    const opens = countAppOpensForDate(db, today, intention.app_id);
    const minutes = usage?.minutes ?? 0;
    const averageMinutes = opens > 0 ? minutes / opens : 0;
    const openOverage = Math.max(opens - (intention.daily_open_limit ?? opens), 0);
    const minuteOverage = Math.max(
      averageMinutes - (intention.per_open_minutes ?? averageMinutes),
      0,
    );

    return {
      appId: intention.app_id,
      appName: intention.app_name,
      opens,
      minutes,
      averageMinutes,
      openOverage,
      minuteOverage,
      isOver: openOverage > 0 || minuteOverage > 0,
    };
  });
  const appsOverLimit = overages.filter((entry) => entry.isOver).length;
  const preventedToday = overages.reduce((sum, entry) => sum + entry.openOverage, 0);
  const filteredLibrary = APP_LIBRARY.filter((entry) => {
    const query = pickerQuery.trim().toLowerCase();
    if (query.length === 0) {
      return true;
    }

    return (
      entry.name.toLowerCase().includes(query) ||
      entry.category.toLowerCase().includes(query) ||
      entry.description.toLowerCase().includes(query)
    );
  });

  const openEditorForEntry = (entry: {
    appId: string;
    name: string;
    category: AppCategory;
  }) => {
    const existing = intentions.find((item) => item.app_id === entry.appId);
    setDraft(existing == null ? buildEmptyDraft(entry) : toDraft(existing, entry.category));
    setPickerVisible(false);
    setEditorVisible(true);
  };

  const handleSaveDraft = () => {
    if (!draft.appId || !draft.appName.trim()) {
      Alert.alert('Missing app', 'Choose an app before saving the intention.');
      return;
    }

    try {
      upsertAppIntention(db, {
        app_id: draft.appId,
        app_name: draft.appName.trim(),
        daily_open_limit: draft.dailyOpenLimit,
        per_open_minutes: draft.perOpenMinutes,
        breathing_pause: draft.breathingPause,
      });
      setEditorVisible(false);
      setTick((value) => value + 1);
    } catch {
      Alert.alert('Unable to save', 'This intention could not be updated.');
    }
  };

  const handleToggleActive = (intention: AppIntention, value: boolean) => {
    if (value) {
      return;
    }

    try {
      deactivateIntention(db, intention.app_id);
      setTick((current) => current + 1);
    } catch {
      Alert.alert('Unable to deactivate', 'This intention could not be turned off.');
    }
  };

  const handleMenuAction = (intention: AppIntention) => {
    const libraryEntry = findAppLibraryEntry(intention.app_id);
    Alert.alert(
      intention.app_name,
      'Choose an action for this intention.',
      [
        {
          text: 'Edit',
          onPress: () => {
            setDraft(toDraft(intention, libraryEntry?.category ?? 'other'));
            setEditorVisible(true);
          },
        },
        {
          text: 'Deactivate',
          onPress: () => handleToggleActive(intention, false),
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            try {
              deleteIntention(db, intention.app_id);
              setTick((current) => current + 1);
            } catch {
              Alert.alert('Unable to delete', 'The intention could not be removed.');
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const detailTrend = useMemo(() => {
    if (detailAppId == null) {
      return [];
    }

    return buildTrendData(detailAppId, usageRange, today);
  }, [detailAppId, today, usageRange]);

  const detailIntention = detailAppId == null
    ? null
    : intentions.find((item) => item.app_id === detailAppId) ?? null;
  const detailUsage = detailAppId == null
    ? null
    : overages.find((item) => item.appId === detailAppId) ?? null;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.heroSection}>
          <Text style={styles.heroEyebrow}>MINDFUL FRICTION</Text>
          <Text style={styles.heroTitle}>App Intentions</Text>
          <Text style={styles.heroBody}>
            Build a little friction around the apps most likely to steal your attention before you even notice it happening.
          </Text>
        </View>

        <GlassPanel padding={18} style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <SummaryStat label="Active" value={String(activeIntentionsCount)} />
            <SummaryStat
              label="Over limit"
              value={String(appsOverLimit)}
              tone={appsOverLimit > 0 ? '#FFB4AB' : PR_TEXT}
            />
            <SummaryStat label="Prevented" value={String(preventedToday)} />
          </View>
        </GlassPanel>

        <Pressable style={styles.addAppButton} onPress={() => setPickerVisible(true)}>
          <MaterialSymbol name="add" size={20} color={PR_ACCENT_LIGHT} />
          <Text style={styles.addAppText}>Add App Intention</Text>
        </Pressable>

        <GlassPanel padding={18} style={styles.previewCard}>
          <Pressable
            style={styles.previewHeader}
            onPress={() => setPreviewExpanded((current) => !current)}
          >
            <View style={styles.previewMeta}>
              <MaterialSymbol name="lightbulb" size={22} color={PR_ACCENT_LIGHT} />
              <View style={{ flex: 1 }}>
                <Text style={styles.previewTitle}>What is a breathing pause?</Text>
                <Text style={styles.previewCopy}>
                  A short breathing beat before a weak-spot app opens.
                </Text>
              </View>
            </View>
            <MaterialSymbol
              name={previewExpanded ? 'close' : 'chevron_right'}
              size={18}
              color={PR_TEXT_TERTIARY}
            />
          </Pressable>

          {previewExpanded ? (
            <View style={styles.previewExpanded}>
              <Animated.View style={[styles.breathCircle, { transform: [{ scale: breathScale }] }]} />
              <Text style={styles.previewExpandedCopy}>
                Three slow breaths create just enough space to choose the app on purpose instead of on autopilot.
              </Text>
              <Pressable
                style={styles.previewTestButton}
                onPress={() => {
                  const sampleApp = APP_LIBRARY[0];
                  router.push({
                    pathname: '/(presence)/breathing-pause',
                    params: {
                      appId: sampleApp.appId,
                      appName: sampleApp.name,
                    },
                  } as never);
                }}
              >
                <Text style={styles.previewTestButtonText}>Test breathing pause</Text>
              </Pressable>
            </View>
          ) : null}
        </GlassPanel>

        <View style={styles.listSection}>
          {intentions.length === 0 ? (
            <GlassPanel padding={24} style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No intentions yet</Text>
              <Text style={styles.emptyCopy}>
                Start with one distracting app. A single clear limit is easier to keep than ten vague promises.
              </Text>
            </GlassPanel>
          ) : (
            intentions.map((intention) => {
              const libraryEntry = findAppLibraryEntry(intention.app_id);
              const gradients = libraryEntry == null
                ? categoryGradient('other')
                : [libraryEntry.gradientFrom, libraryEntry.gradientTo] as const;
              const usage = overages.find((item) => item.appId === intention.app_id);
              const progressRatio = intention.daily_open_limit != null && intention.daily_open_limit > 0
                ? Math.min((usage?.opens ?? 0) / intention.daily_open_limit, 1)
                : 0;
              const overLimit = usage?.isOver === true;

              return (
                <GlassPanel key={intention.id} padding={18} style={styles.intentionCard}>
                  <View style={styles.intentionTopRow}>
                    <View style={styles.appMeta}>
                      <LinearGradient
                        colors={gradients}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.appTile}
                      >
                        <MaterialSymbol
                          name={libraryEntry?.iconName ?? fallbackIconName(libraryEntry?.category ?? 'other')}
                          size={22}
                          color="#FFFFFF"
                          filled
                        />
                      </LinearGradient>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.appName}>{intention.app_name}</Text>
                        <Text style={styles.appSubhead}>
                          {libraryEntry?.description ?? 'Intentional use boundary'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.topActions}>
                      <Switch
                        value
                        onValueChange={(value) => handleToggleActive(intention, value)}
                        trackColor={{ false: 'rgba(255,255,255,0.16)', true: PR_ACCENT }}
                        thumbColor="#FFFFFF"
                      />
                      <Pressable onPress={() => handleMenuAction(intention)}>
                        <MaterialSymbol name="more_horiz" size={20} color={PR_TEXT_TERTIARY} />
                      </Pressable>
                    </View>
                  </View>

                  <Pressable
                    style={styles.progressSection}
                    onPress={() => setDetailAppId(intention.app_id)}
                  >
                    <View style={styles.progressMeta}>
                      <Text style={styles.progressLabel}>
                        {(usage?.opens ?? 0)} / {intention.daily_open_limit ?? '∞'} opens today
                      </Text>
                      <Text style={[styles.progressLabel, overLimit && styles.overLimitText]}>
                        {overLimit ? 'Over plan' : 'Within plan'}
                      </Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressValue,
                          {
                            width: `${Math.max(progressRatio * 100, 6)}%`,
                            backgroundColor: overLimit ? '#FF6B6B' : PR_ACCENT_LIGHT,
                          },
                        ]}
                      />
                    </View>
                  </Pressable>

                  <View style={styles.controlsRow}>
                    <Stepper
                      label="Daily opens"
                      value={draft.appId === intention.app_id ? draft.dailyOpenLimit : intention.daily_open_limit ?? 5}
                      onDecrement={() => {
                        const currentValue = intention.daily_open_limit ?? 5;
                        const next = Math.max(1, currentValue - 1);
                        try {
                          upsertAppIntention(db, {
                            app_id: intention.app_id,
                            app_name: intention.app_name,
                            daily_open_limit: next,
                            per_open_minutes: intention.per_open_minutes ?? 10,
                            breathing_pause: intention.breathing_pause === 1,
                          });
                          setTick((current) => current + 1);
                        } catch {
                          Alert.alert('Unable to update', 'The daily limit could not be changed.');
                        }
                      }}
                      onIncrement={() => {
                        const currentValue = intention.daily_open_limit ?? 5;
                        try {
                          upsertAppIntention(db, {
                            app_id: intention.app_id,
                            app_name: intention.app_name,
                            daily_open_limit: currentValue + 1,
                            per_open_minutes: intention.per_open_minutes ?? 10,
                            breathing_pause: intention.breathing_pause === 1,
                          });
                          setTick((current) => current + 1);
                        } catch {
                          Alert.alert('Unable to update', 'The daily limit could not be changed.');
                        }
                      }}
                    />

                    <Stepper
                      label="Per-open minutes"
                      value={intention.per_open_minutes ?? 10}
                      onDecrement={() => {
                        const currentValue = intention.per_open_minutes ?? 10;
                        const next = Math.max(1, currentValue - 1);
                        try {
                          upsertAppIntention(db, {
                            app_id: intention.app_id,
                            app_name: intention.app_name,
                            daily_open_limit: intention.daily_open_limit ?? 5,
                            per_open_minutes: next,
                            breathing_pause: intention.breathing_pause === 1,
                          });
                          setTick((current) => current + 1);
                        } catch {
                          Alert.alert('Unable to update', 'The per-open limit could not be changed.');
                        }
                      }}
                      onIncrement={() => {
                        const currentValue = intention.per_open_minutes ?? 10;
                        try {
                          upsertAppIntention(db, {
                            app_id: intention.app_id,
                            app_name: intention.app_name,
                            daily_open_limit: intention.daily_open_limit ?? 5,
                            per_open_minutes: currentValue + 1,
                            breathing_pause: intention.breathing_pause === 1,
                          });
                          setTick((current) => current + 1);
                        } catch {
                          Alert.alert('Unable to update', 'The per-open limit could not be changed.');
                        }
                      }}
                    />
                  </View>

                  <View style={styles.breathingRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.breathingTitle}>Breathing pause</Text>
                      <Text style={styles.breathingCaption}>5 deep breaths before the app opens</Text>
                    </View>
                    <Switch
                      value={intention.breathing_pause === 1}
                      onValueChange={(value) => {
                        try {
                          upsertAppIntention(db, {
                            app_id: intention.app_id,
                            app_name: intention.app_name,
                            daily_open_limit: intention.daily_open_limit ?? 5,
                            per_open_minutes: intention.per_open_minutes ?? 10,
                            breathing_pause: value,
                          });
                          setTick((current) => current + 1);
                        } catch {
                          Alert.alert('Unable to update', 'The breathing pause setting could not be changed.');
                        }
                      }}
                      trackColor={{ false: 'rgba(255,255,255,0.16)', true: PR_ACCENT }}
                      thumbColor="#FFFFFF"
                    />
                  </View>
                </GlassPanel>
              );
            })
          )}
        </View>
      </ScrollView>

      <Modal visible={pickerVisible} transparent animationType="slide" onRequestClose={() => setPickerVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setPickerVisible(false)}>
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Add App Intention</Text>
            <TextInput
              value={pickerQuery}
              onChangeText={setPickerQuery}
              placeholder="Search apps"
              placeholderTextColor={PR_TEXT_TERTIARY}
              style={styles.searchInput}
            />
            <ScrollView contentContainerStyle={styles.sheetList}>
              {filteredLibrary.map((entry) => (
                <Pressable
                  key={entry.appId}
                  style={styles.libraryRow}
                  onPress={() => openEditorForEntry(entry)}
                >
                  <LinearGradient
                    colors={[entry.gradientFrom, entry.gradientTo]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.libraryTile}
                  >
                    <MaterialSymbol name={entry.iconName} size={22} color="#FFFFFF" filled />
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.libraryName}>{entry.name}</Text>
                    <Text style={styles.libraryDescription}>{entry.description}</Text>
                  </View>
                  <Text style={styles.libraryCategory}>{entry.category}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={editorVisible} transparent animationType="slide" onRequestClose={() => setEditorVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setEditorVisible(false)}>
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{draft.appName || 'App intention'}</Text>

            <View style={styles.editorSection}>
              <Text style={styles.editorLabel}>Daily opens limit</Text>
              <Stepper
                label="Daily opens"
                value={draft.dailyOpenLimit}
                onDecrement={() => setDraft((current) => ({ ...current, dailyOpenLimit: Math.max(1, current.dailyOpenLimit - 1) }))}
                onIncrement={() => setDraft((current) => ({ ...current, dailyOpenLimit: current.dailyOpenLimit + 1 }))}
                compact
              />
            </View>

            <View style={styles.editorSection}>
              <Text style={styles.editorLabel}>Per-open minutes</Text>
              <Stepper
                label="Per-open minutes"
                value={draft.perOpenMinutes}
                onDecrement={() => setDraft((current) => ({ ...current, perOpenMinutes: Math.max(1, current.perOpenMinutes - 1) }))}
                onIncrement={() => setDraft((current) => ({ ...current, perOpenMinutes: current.perOpenMinutes + 1 }))}
                compact
              />
            </View>

            <View style={styles.editorSwitchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.breathingTitle}>Breathing pause</Text>
                <Text style={styles.breathingCaption}>Pause for three intentional breaths</Text>
              </View>
              <Switch
                value={draft.breathingPause}
                onValueChange={(value) => setDraft((current) => ({ ...current, breathingPause: value }))}
                trackColor={{ false: 'rgba(255,255,255,0.16)', true: PR_ACCENT }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.editorActions}>
              <Pressable style={styles.sheetSecondaryButton} onPress={() => setEditorVisible(false)}>
                <Text style={styles.sheetSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.sheetPrimaryButton} onPress={handleSaveDraft}>
                <Text style={styles.sheetPrimaryText}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={detailAppId != null} transparent animationType="slide" onRequestClose={() => setDetailAppId(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setDetailAppId(null)}>
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{detailIntention?.app_name ?? 'Usage detail'}</Text>
            <Text style={styles.detailSubtitle}>
              {(detailUsage?.opens ?? 0)} opens today · {Math.round(detailUsage?.minutes ?? 0)} minutes total
            </Text>
            <GlassPanel padding={16} style={styles.detailChartCard}>
              <TrendBars data={detailTrend} height={90} goalValue={detailIntention?.per_open_minutes ?? undefined} />
            </GlassPanel>
            <Text style={styles.detailFootnote}>
              The chart shows the last 7 days of app minutes with today highlighted.
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function SummaryStat({
  label,
  value,
  tone = PR_TEXT,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <View style={styles.summaryStat}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, { color: tone }]}>{value}</Text>
    </View>
  );
}

function Stepper({
  label,
  value,
  onDecrement,
  onIncrement,
  compact = false,
}: {
  label: string;
  value: number;
  onDecrement: () => void;
  onIncrement: () => void;
  compact?: boolean;
}) {
  return (
    <View style={[styles.stepper, compact && styles.stepperCompact]}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <Pressable style={styles.stepperButton} onPress={onDecrement}>
          <MaterialSymbol name="remove" size={16} color={PR_TEXT_SECONDARY} />
        </Pressable>
        <Text style={styles.stepperValue}>{value}</Text>
        <Pressable style={styles.stepperButton} onPress={onIncrement}>
          <MaterialSymbol name="add" size={16} color={PR_TEXT_SECONDARY} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PR_SURFACES.base,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 14,
  },
  heroSection: {
    gap: 6,
    paddingTop: 6,
  },
  heroEyebrow: {
    ...PR_TYPOGRAPHY.labelUpper,
    color: PR_ACCENT_LIGHT,
  },
  heroTitle: {
    fontFamily: PR_FONTS.extraBold,
    fontSize: 42,
    lineHeight: 46,
    color: PR_TEXT,
    letterSpacing: -1.4,
  },
  heroBody: {
    ...PR_TYPOGRAPHY.bodyMd,
    color: PR_TEXT_SECONDARY,
    maxWidth: 340,
  },
  summaryCard: {
    gap: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryStat: {
    flex: 1,
    gap: 6,
  },
  summaryLabel: {
    ...PR_TYPOGRAPHY.bodySm,
    color: PR_TEXT_TERTIARY,
  },
  summaryValue: {
    fontFamily: PR_FONTS.bold,
    fontSize: 24,
    lineHeight: 28,
  },
  addAppButton: {
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  addAppText: {
    ...PR_TYPOGRAPHY.titleMd,
    color: PR_TEXT,
  },
  previewCard: {
    gap: 14,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  previewMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  previewTitle: {
    ...PR_TYPOGRAPHY.titleMd,
    color: PR_TEXT,
  },
  previewCopy: {
    ...PR_TYPOGRAPHY.bodySm,
    color: PR_TEXT_SECONDARY,
    marginTop: 4,
  },
  previewExpanded: {
    alignItems: 'center',
    gap: 12,
    paddingTop: 4,
  },
  breathCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(34, 211, 238, 0.16)',
    shadowColor: PR_ACCENT_LIGHT,
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  previewExpandedCopy: {
    ...PR_TYPOGRAPHY.bodyMd,
    color: PR_TEXT_SECONDARY,
    textAlign: 'center',
  },
  previewTestButton: {
    alignSelf: 'center',
    borderRadius: 999,
    backgroundColor: `${PR_ACCENT_LIGHT}22`,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  previewTestButtonText: {
    ...PR_TYPOGRAPHY.labelUpper,
    color: PR_ACCENT_LIGHT,
  },
  listSection: {
    gap: 12,
  },
  emptyCard: {
    gap: 8,
    alignItems: 'center',
  },
  emptyTitle: {
    ...PR_TYPOGRAPHY.headlineMd,
    color: PR_TEXT,
  },
  emptyCopy: {
    ...PR_TYPOGRAPHY.bodyMd,
    color: PR_TEXT_SECONDARY,
    textAlign: 'center',
  },
  intentionCard: {
    gap: 16,
  },
  intentionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  appMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  appTile: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    ...PR_TYPOGRAPHY.titleMd,
    color: PR_TEXT,
  },
  appSubhead: {
    ...PR_TYPOGRAPHY.bodySm,
    color: PR_TEXT_SECONDARY,
    marginTop: 4,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressSection: {
    gap: 8,
  },
  progressMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  progressLabel: {
    ...PR_TYPOGRAPHY.bodySm,
    color: PR_TEXT_SECONDARY,
  },
  overLimitText: {
    color: '#FFB4AB',
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  progressValue: {
    height: 8,
    borderRadius: 999,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  stepper: {
    flex: 1,
    gap: 8,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  stepperCompact: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  stepperLabel: {
    ...PR_TYPOGRAPHY.bodySm,
    color: PR_TEXT_TERTIARY,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepperButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  stepperValue: {
    ...PR_TYPOGRAPHY.titleMd,
    color: PR_TEXT,
  },
  breathingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  breathingTitle: {
    ...PR_TYPOGRAPHY.titleMd,
    color: PR_TEXT,
  },
  breathingCaption: {
    ...PR_TYPOGRAPHY.bodySm,
    color: PR_TEXT_SECONDARY,
    marginTop: 3,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    maxHeight: '78%',
    backgroundColor: PR_SURFACES.low,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 26,
    gap: 14,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  sheetTitle: {
    ...PR_TYPOGRAPHY.headlineMd,
    color: PR_TEXT,
  },
  searchInput: {
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: PR_TEXT,
    fontFamily: PR_FONTS.regular,
    fontSize: 15,
  },
  sheetList: {
    gap: 10,
    paddingBottom: 24,
  },
  libraryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  libraryTile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  libraryName: {
    ...PR_TYPOGRAPHY.titleMd,
    color: PR_TEXT,
  },
  libraryDescription: {
    ...PR_TYPOGRAPHY.bodySm,
    color: PR_TEXT_SECONDARY,
    marginTop: 4,
  },
  libraryCategory: {
    ...PR_TYPOGRAPHY.bodySm,
    color: PR_ACCENT_LIGHT,
    textTransform: 'capitalize',
  },
  editorSection: {
    gap: 8,
  },
  editorLabel: {
    ...PR_TYPOGRAPHY.bodySm,
    color: PR_TEXT_TERTIARY,
  },
  editorSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  editorActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  sheetPrimaryButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PR_ACCENT,
  },
  sheetPrimaryText: {
    ...PR_TYPOGRAPHY.titleMd,
    color: '#041015',
  },
  sheetSecondaryButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  sheetSecondaryText: {
    ...PR_TYPOGRAPHY.titleMd,
    color: PR_TEXT,
  },
  detailSubtitle: {
    ...PR_TYPOGRAPHY.bodyMd,
    color: PR_TEXT_SECONDARY,
  },
  detailChartCard: {
    marginTop: 2,
  },
  detailFootnote: {
    ...PR_TYPOGRAPHY.bodySm,
    color: PR_TEXT_TERTIARY,
  },
});
