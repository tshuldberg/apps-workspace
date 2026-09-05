import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  createTrip,
  createTripActivity,
  createTripDay,
  deleteTrip,
  deleteTripActivity,
  deleteTripDay,
  getPackingProgress,
  getPackingTemplate,
  getTrail,
  getTrip,
  getTripActivities,
  getTripDays,
  MaterialSymbol,
  TrailCard,
  TR_ACCENT_LIGHT,
  TR_FONTS,
  updateTrip,
  updateTripDay,
  WeatherChip,
  type Trip,
  type TripActivity,
  type TripDay,
} from '@mylife/trails';
import { Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { uuid } from '../../../lib/uuid';
import { TrailsGlassCard, TrailsPrimaryButton, TrailsScreen } from '../_ui';
import {
  buildTripMetrics,
  buildTripWeather,
  extractTripRegion,
  formatDisplayDate,
  formatTripDateRange,
  getDayDate,
  getTripDurationDays,
  stripTripMetadata,
} from '../phase6-utils';

const ACCENT = colors.modules.trails;

function activityTypeIcon(type: string): string {
  switch (type) {
    case 'hike': return '🥾';
    case 'drive': return '🚗';
    case 'camp': return '🏕️';
    case 'rest': return '😴';
    default: return '📍';
  }
}

export default function TripDetailScreen() {
  const db = useDatabase();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tick, setTick] = useState(0);
  const [showAddDay, setShowAddDay] = useState(false);
  const [dayTitle, setDayTitle] = useState('');
  const [editingTrip, setEditingTrip] = useState(false);
  const [editingName, setEditingName] = useState('');
  const [editingStartDate, setEditingStartDate] = useState('');
  const [editingEndDate, setEditingEndDate] = useState('');
  const [editingNotes, setEditingNotes] = useState('');
  const [activeActivityDayId, setActiveActivityDayId] = useState<string | null>(null);
  const [newActivityName, setNewActivityName] = useState('');
  const [newActivityType, setNewActivityType] = useState<TripActivity['type']>('hike');
  const [newActivityTrailId, setNewActivityTrailId] = useState<string | null>(null);
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

  const tripState = useMemo(() => {
    try {
      return {
        trip: id ? getTrip(db, id) : null,
        error: null,
      };
    } catch {
      return {
        trip: null,
        error: 'Failed to load trip.',
      };
    }
  }, [db, id, tick]);

  const trip = tripState.trip as Trip | null;
  const error = tripState.error;

  const days = useMemo(() => (id ? getTripDays(db, id) : []), [db, id, tick]);

  const activitiesByDay = useMemo(() => {
    const byDay = new Map<string, TripActivity[]>();
    days.forEach((day) => {
      byDay.set(day.id, getTripActivities(db, day.id));
    });
    return byDay;
  }, [db, days]);

  const refresh = useCallback(() => setTick((current) => current + 1), []);

  const linkedTrailIds = useMemo(() => {
    const ids = new Set<string>();
    activitiesByDay.forEach((activities) => {
      activities.forEach((activity) => {
        if (activity.trailId) {
          ids.add(activity.trailId);
        }
      });
    });
    return Array.from(ids);
  }, [activitiesByDay]);

  const linkedTrails = useMemo(
    () => linkedTrailIds
      .map((trailId) => getTrail(db, trailId))
      .filter((trail): trail is NonNullable<ReturnType<typeof getTrail>> => Boolean(trail)),
    [db, linkedTrailIds],
  );

  const tripMetrics = useMemo(
    () => buildTripMetrics(linkedTrails, days.length || getTripDurationDays(trip ?? { startDate: null, endDate: null })),
    [days.length, linkedTrails, trip],
  );

  const weatherDays = useMemo(
    () => buildTripWeather(id ?? trip?.name ?? 'trip', trip?.startDate ?? null, Math.max(days.length, 3)),
    [days.length, id, trip?.name, trip?.startDate],
  );

  const packingSummary = useMemo(() => {
    if (!trip?.packingTemplateId) {
      return null;
    }

    const template = getPackingTemplate(db, trip.packingTemplateId);
    if (!template) {
      return null;
    }

    const progress = getPackingProgress(db, template.id);
    return { template, progress };
  }, [db, trip?.packingTemplateId, tick]);

  const region = extractTripRegion(trip?.notes) ?? linkedTrails[0]?.region ?? 'Flexible route';
  const freeformNotes = stripTripMetadata(trip?.notes);

  const beginEditing = useCallback(() => {
    if (!trip) {
      return;
    }
    setEditingName(trip.name);
    setEditingStartDate(trip.startDate ?? '');
    setEditingEndDate(trip.endDate ?? '');
    setEditingNotes(freeformNotes ?? '');
    setEditingTrip(true);
  }, [freeformNotes, trip]);

  const saveTripEdits = useCallback(() => {
    if (!trip) {
      return;
    }

    try {
      const notes = [region ? `Region: ${region}` : null, editingNotes.trim() || null]
        .filter(Boolean)
        .join('\n');
      updateTrip(db, trip.id, {
        name: editingName.trim() || trip.name,
        startDate: editingStartDate || null,
        endDate: editingEndDate || null,
        notes: notes || null,
      });
      setEditingTrip(false);
      refresh();
    } catch {
      Alert.alert('Error', 'Could not save the trip details.');
    }
  }, [db, editingEndDate, editingName, editingNotes, editingStartDate, refresh, region, trip]);

  const handleAddDay = useCallback(() => {
    if (!id) {
      return;
    }

    try {
      createTripDay(db, uuid(), {
        tripId: id,
        dayNumber: days.length + 1,
        date: getDayDate(trip?.startDate ?? null, days.length),
        title: dayTitle.trim() || null,
      });
      setDayTitle('');
      setShowAddDay(false);
      refresh();
    } catch {
      Alert.alert('Error', 'Failed to add the itinerary day.');
    }
  }, [db, dayTitle, days.length, id, refresh, trip?.startDate]);

  const handleMoveDay = useCallback(
    (day: TripDay, direction: -1 | 1) => {
      const swapWith = days.find((candidate) => candidate.dayNumber === day.dayNumber + direction);
      if (!swapWith) {
        return;
      }

      try {
        updateTripDay(db, day.id, { dayNumber: swapWith.dayNumber });
        updateTripDay(db, swapWith.id, { dayNumber: day.dayNumber });
        refresh();
      } catch {
        Alert.alert('Error', 'Could not reorder the itinerary.');
      }
    },
    [db, days, refresh],
  );

  const handleDeleteDay = useCallback(
    (day: TripDay) => {
      Alert.alert('Delete Day', `Remove Day ${day.dayNumber}?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            try {
              deleteTripDay(db, day.id);
              refresh();
            } catch {
              Alert.alert('Error', 'Could not remove the day.');
            }
          },
        },
      ]);
    },
    [db, refresh],
  );

  const handleAddActivity = useCallback(
    (dayId: string) => {
      if (!newActivityName.trim()) {
        Alert.alert('Activity name required', 'Name the activity before adding it.');
        return;
      }

      try {
        const existing = getTripActivities(db, dayId);
        createTripActivity(db, uuid(), {
          dayId,
          trailId: newActivityTrailId,
          type: newActivityType,
          name: newActivityName.trim(),
          description: null,
          sortOrder: existing.length,
        });
        setNewActivityName('');
        setNewActivityType('hike');
        setNewActivityTrailId(null);
        setActiveActivityDayId(null);
        refresh();
      } catch {
        Alert.alert('Error', 'Could not add the activity.');
      }
    },
    [db, newActivityName, newActivityTrailId, newActivityType, refresh],
  );

  const handleDeleteActivity = useCallback(
    (activity: TripActivity) => {
      Alert.alert('Delete Activity', `Remove "${activity.name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            try {
              deleteTripActivity(db, activity.id);
              refresh();
            } catch {
              Alert.alert('Error', 'Could not remove the activity.');
            }
          },
        },
      ]);
    },
    [db, refresh],
  );

  const duplicateTrip = useCallback(() => {
    if (!trip) {
      return;
    }

    try {
      const duplicate = createTrip(db, uuid(), {
        name: `${trip.name} Copy`,
        startDate: trip.startDate,
        endDate: trip.endDate,
        notes: trip.notes,
      });

      if (trip.packingTemplateId) {
        updateTrip(db, duplicate.id, { packingTemplateId: trip.packingTemplateId });
      }

      days.forEach((day) => {
        const nextDayId = uuid();
        createTripDay(db, nextDayId, {
          tripId: duplicate.id,
          dayNumber: day.dayNumber,
          date: day.date,
          title: day.title,
          notes: day.notes,
        });
        const activities = activitiesByDay.get(day.id) ?? [];
        activities.forEach((activity) => {
          createTripActivity(db, uuid(), {
            dayId: nextDayId,
            trailId: activity.trailId,
            type: activity.type,
            name: activity.name,
            description: activity.description,
            sortOrder: activity.sortOrder,
          });
        });
      });

      refresh();
      router.push(`/(trails)/trip/${duplicate.id}` as `/${string}`);
    } catch {
      Alert.alert('Error', 'Could not duplicate this trip.');
    }
  }, [activitiesByDay, db, days, refresh, router, trip]);

  const shareTrip = useCallback(async () => {
    if (!trip) {
      return;
    }
    const lines = [
      trip.name,
      `${formatTripDateRange(trip)} · ${region}`,
      `${tripMetrics.trailCount} linked trails · ${tripMetrics.totalDays} days`,
    ];
    await Clipboard.setStringAsync(lines.join('\n'));
    Alert.alert('Copied', 'Trip summary copied to the clipboard.');
  }, [region, trip, tripMetrics.totalDays, tripMetrics.trailCount]);

  const handleDeleteTrip = useCallback(() => {
    if (!id) {
      return;
    }
    Alert.alert('Delete Trip', 'This will delete the trip and all its days.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          try {
            deleteTrip(db, id);
            router.back();
          } catch {
            Alert.alert('Error', 'Failed to delete the trip.');
          }
        },
      },
    ]);
  }, [db, id, router]);

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={{ fontSize: 40 }}>⚠️</Text>
        <Text variant="subheading" color={colors.danger}>{error}</Text>
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={styles.centered}>
        <Text style={{ fontSize: 40 }}>🔍</Text>
        <Text variant="subheading" color={colors.textSecondary}>Trip not found</Text>
      </View>
    );
  }

  return (
    <TrailsScreen contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          headerTransparent: true,
          headerTitle: '',
          headerShadowVisible: false,
        }}
      />

      <View style={styles.heroShell}>
        <LinearGradient
          colors={['rgba(132,204,22,0.34)', 'rgba(101,163,13,0.12)', 'rgba(19,19,24,0.96)']}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.heroTopRow}>
          <Pressable onPress={shareTrip} style={styles.heroIconButton}>
            <MaterialSymbol name="route" size={16} color={TR_ACCENT_LIGHT} />
          </Pressable>
          <View style={styles.heroActions}>
            <Pressable onPress={beginEditing} style={styles.heroIconButton}>
              <MaterialSymbol name="settings" size={16} color={TR_ACCENT_LIGHT} />
            </Pressable>
            <Pressable
              onPress={() => Alert.alert('Trip actions', 'Choose an action for this expedition.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Duplicate', onPress: duplicateTrip },
                { text: 'Delete', style: 'destructive', onPress: handleDeleteTrip },
              ])}
              style={styles.heroIconButton}
            >
              <MaterialSymbol name="more_vert" size={16} color={TR_ACCENT_LIGHT} />
            </Pressable>
          </View>
        </View>
        <View style={styles.heroFooter}>
          <Text variant="label" color={colors.textTertiary}>
            EXPEDITION
          </Text>
          <Text variant="heading" style={styles.heroTitle}>
            {trip.name}
          </Text>
          <Text variant="caption" color={colors.textSecondary}>
            {formatTripDateRange(trip)} · {region}
          </Text>
        </View>
      </View>

      <View style={styles.metricsGrid}>
        <MetricCard label="Days" value={tripMetrics.totalDays.toString()} />
        <MetricCard label="Trails" value={tripMetrics.trailCount.toString()} />
        <MetricCard label="Distance" value={`${(tripMetrics.distanceMeters / 1000).toFixed(1)} km`} />
        <MetricCard label="Elevation" value={`${Math.round(tripMetrics.elevationMeters)} m`} />
      </View>

      {editingTrip ? (
        <TrailsGlassCard style={styles.editorCard}>
          <Text variant="label" color={colors.textTertiary}>
            EDIT TRIP
          </Text>
          <TextInput
            placeholder="Trip name"
            placeholderTextColor={colors.textTertiary}
            style={styles.input}
            value={editingName}
            onChangeText={setEditingName}
          />
          <View style={styles.dateRow}>
            <TextInput
              placeholder="2026-05-12"
              placeholderTextColor={colors.textTertiary}
              style={[styles.input, styles.dateInput]}
              value={editingStartDate}
              onChangeText={setEditingStartDate}
            />
            <TextInput
              placeholder="2026-05-16"
              placeholderTextColor={colors.textTertiary}
              style={[styles.input, styles.dateInput]}
              value={editingEndDate}
              onChangeText={setEditingEndDate}
            />
          </View>
          <TextInput
            placeholder="Trip notes"
            placeholderTextColor={colors.textTertiary}
            style={[styles.input, styles.notesInput]}
            multiline
            value={editingNotes}
            onChangeText={setEditingNotes}
          />
          <View style={styles.editorActions}>
            <Pressable onPress={() => setEditingTrip(false)} style={styles.secondaryButton}>
              <Text variant="caption" style={styles.secondaryButtonText}>
                Cancel
              </Text>
            </Pressable>
            <TrailsPrimaryButton label="Save" onPress={saveTripEdits} style={styles.primaryEditorButton} />
          </View>
        </TrailsGlassCard>
      ) : null}

      <TrailsGlassCard style={styles.weatherStripCard}>
        <View style={styles.sectionHeader}>
          <Text variant="subheading">Weather Forecast</Text>
          <Text variant="caption" color={colors.textSecondary}>
            Trail-specific planner view
          </Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weatherRow}>
          {weatherDays.map((day) => (
            <View key={day.key} style={styles.weatherDayCard}>
              <Text variant="caption" color={colors.textSecondary}>
                {day.label}
              </Text>
              <WeatherChip condition={day.condition} temperature={day.temperature} />
            </View>
          ))}
        </ScrollView>
      </TrailsGlassCard>

      <TrailsGlassCard style={styles.itineraryCard}>
        <View style={styles.sectionHeader}>
          <Text variant="subheading">Itinerary</Text>
          <Pressable onPress={() => setShowAddDay((current) => !current)}>
            <Text variant="caption" style={styles.linkText}>
              {showAddDay ? 'Close' : 'Add Day'}
            </Text>
          </Pressable>
        </View>

        {showAddDay ? (
          <View style={styles.addDayComposer}>
            <TextInput
              autoFocus
              placeholder="Summit push, base camp, recovery day..."
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
              value={dayTitle}
              onChangeText={setDayTitle}
              onSubmitEditing={handleAddDay}
            />
            <TrailsPrimaryButton label="Add Day" onPress={handleAddDay} />
          </View>
        ) : null}

        {days.length === 0 ? (
          <Text variant="caption" color={colors.textSecondary}>
            No itinerary yet. Add a day to start structuring the route.
          </Text>
        ) : (
          <View style={styles.dayList}>
            {days.map((day) => {
              const activities = activitiesByDay.get(day.id) ?? [];
              const isExpanded = expandedDays[day.id] ?? true;
              return (
                <TrailsGlassCard key={day.id} style={styles.dayCard}>
                  <View style={styles.dayHeader}>
                    <View style={styles.dayBadge}>
                      <Text variant="caption" style={styles.dayBadgeText}>
                        {day.dayNumber}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text variant="body" style={styles.dayTitle}>
                        {day.title || `Day ${day.dayNumber}`}
                      </Text>
                      <Text variant="caption" color={colors.textSecondary}>
                        {day.date ? formatDisplayDate(day.date) : 'Flexible day'} · {activities.length} activities
                      </Text>
                    </View>
                    <View style={styles.dayHeaderActions}>
                      <Pressable onPress={() => handleMoveDay(day, -1)} style={styles.dayActionButton}>
                        <Text variant="caption" style={styles.dayActionText}>↑</Text>
                      </Pressable>
                      <Pressable onPress={() => handleMoveDay(day, 1)} style={styles.dayActionButton}>
                        <Text variant="caption" style={styles.dayActionText}>↓</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setExpandedDays((current) => ({ ...current, [day.id]: !isExpanded }))}
                        style={styles.dayActionButton}
                      >
                        <Text variant="caption" style={styles.dayActionText}>{isExpanded ? '−' : '+'}</Text>
                      </Pressable>
                    </View>
                  </View>

                  {isExpanded ? (
                    <View style={styles.activitiesList}>
                      {activities.map((activity) => (
                        <Pressable key={activity.id} onLongPress={() => handleDeleteActivity(activity)} style={styles.activityRow}>
                          <Text style={styles.activityIcon}>{activityTypeIcon(activity.type)}</Text>
                          <View style={{ flex: 1 }}>
                            <Text variant="caption" style={styles.activityName}>
                              {activity.name}
                            </Text>
                            <Text variant="caption" color={colors.textSecondary}>
                              {activity.trailId ? getTrail(db, activity.trailId)?.region ?? 'Linked trail' : activity.type}
                            </Text>
                          </View>
                        </Pressable>
                      ))}

                      {activeActivityDayId === day.id ? (
                        <View style={styles.activityComposer}>
                          <TextInput
                            placeholder="Sunrise ridge hike"
                            placeholderTextColor={colors.textTertiary}
                            style={styles.input}
                            value={newActivityName}
                            onChangeText={setNewActivityName}
                          />
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activityTypeRow}>
                            {(['hike', 'drive', 'camp', 'rest', 'other'] as TripActivity['type'][]).map((type) => (
                              <Pressable
                                key={type}
                                onPress={() => setNewActivityType(type)}
                                style={[
                                  styles.activityTypeChip,
                                  newActivityType === type && styles.activityTypeChipActive,
                                ]}
                              >
                                <Text
                                  variant="caption"
                                  style={[
                                    styles.activityTypeText,
                                    newActivityType === type && styles.activityTypeTextActive,
                                  ]}
                                >
                                  {type}
                                </Text>
                              </Pressable>
                            ))}
                          </ScrollView>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.linkedTrailRow}>
                            <Pressable
                              onPress={() => setNewActivityTrailId(null)}
                              style={[
                                styles.activityTypeChip,
                                newActivityTrailId === null && styles.activityTypeChipActive,
                              ]}
                            >
                              <Text
                                variant="caption"
                                style={[
                                  styles.activityTypeText,
                                  newActivityTrailId === null && styles.activityTypeTextActive,
                                ]}
                              >
                                Unlinked
                              </Text>
                            </Pressable>
                            {linkedTrails.slice(0, 6).map((trail) => (
                              <Pressable
                                key={trail.id}
                                onPress={() => setNewActivityTrailId(trail.id)}
                                style={[
                                  styles.activityTypeChip,
                                  newActivityTrailId === trail.id && styles.activityTypeChipActive,
                                ]}
                              >
                                <Text
                                  variant="caption"
                                  style={[
                                    styles.activityTypeText,
                                    newActivityTrailId === trail.id && styles.activityTypeTextActive,
                                  ]}
                                >
                                  {trail.name}
                                </Text>
                              </Pressable>
                            ))}
                          </ScrollView>
                          <View style={styles.editorActions}>
                            <Pressable onPress={() => setActiveActivityDayId(null)} style={styles.secondaryButton}>
                              <Text variant="caption" style={styles.secondaryButtonText}>
                                Cancel
                              </Text>
                            </Pressable>
                            <TrailsPrimaryButton
                              label="Add Activity"
                              onPress={() => handleAddActivity(day.id)}
                              style={styles.primaryEditorButton}
                            />
                          </View>
                        </View>
                      ) : (
                        <Pressable onPress={() => setActiveActivityDayId(day.id)} style={styles.addActivityButton}>
                          <Text variant="caption" style={styles.linkText}>
                            Add Activity
                          </Text>
                        </Pressable>
                      )}

                      <Pressable onLongPress={() => handleDeleteDay(day)} style={styles.deleteDayHint}>
                        <Text variant="caption" color={colors.textTertiary}>
                          Long-press this day to delete it
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
                </TrailsGlassCard>
              );
            })}
          </View>
        )}
      </TrailsGlassCard>

      <TrailsGlassCard style={styles.trailsCard}>
        <View style={styles.sectionHeader}>
          <Text variant="subheading">Linked Trails</Text>
          <Text variant="caption" color={colors.textSecondary}>
            {linkedTrails.length} connected
          </Text>
        </View>
        {linkedTrails.length === 0 ? (
          <Text variant="caption" color={colors.textSecondary}>
            Add linked trails from each itinerary day to build the route plan.
          </Text>
        ) : (
          <View style={styles.linkedTrailsList}>
            {linkedTrails.map((trail) => (
              <Pressable key={trail.id} onPress={() => router.push(`/(trails)/trail/${trail.id}` as `/${string}`)}>
                <TrailCard trail={trail} variant="row" />
              </Pressable>
            ))}
          </View>
        )}
      </TrailsGlassCard>

      <TrailsGlassCard style={styles.packingCard}>
        <View style={styles.sectionHeader}>
          <Text variant="subheading">Packing Link</Text>
          <Pressable onPress={() => router.push('/(trails)/packing')}>
            <Text variant="caption" style={styles.linkText}>
              Open Lists
            </Text>
          </Pressable>
        </View>
        {packingSummary ? (
          <View style={styles.packingSummary}>
            <View>
              <Text variant="body" style={styles.dayTitle}>
                {packingSummary.template.name}
              </Text>
              <Text variant="caption" color={colors.textSecondary}>
                {packingSummary.progress.checked}/{packingSummary.progress.total} packed
              </Text>
            </View>
            <TrailsPrimaryButton
              label="Open Checklist"
              onPress={() => router.push(`/(trails)/packing-checklist/${packingSummary.template.id}` as `/${string}`)}
            />
          </View>
        ) : (
          <Text variant="caption" color={colors.textSecondary}>
            No packing list linked yet. Open packing lists to connect one to this expedition.
          </Text>
        )}
      </TrailsGlassCard>

      {freeformNotes ? (
        <TrailsGlassCard style={styles.notesCard}>
          <Text variant="label" color={colors.textTertiary}>
            NOTES
          </Text>
          <Text variant="body" color={colors.textSecondary}>
            {freeformNotes}
          </Text>
        </TrailsGlassCard>
      ) : null}
    </TrailsScreen>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <TrailsGlassCard style={styles.metricCard}>
      <Text variant="caption" color={colors.textTertiary}>
        {label}
      </Text>
      <Text variant="body" style={styles.metricValue}>
        {value}
      </Text>
    </TrailsGlassCard>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.sm,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  heroShell: {
    minHeight: 260,
    borderRadius: 28,
    overflow: 'hidden',
    padding: spacing.lg,
    justifyContent: 'space-between',
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  heroIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(19,19,24,0.46)',
  },
  heroFooter: {
    gap: 6,
  },
  heroTitle: {
    fontFamily: TR_FONTS.extraBold,
    fontSize: 34,
    lineHeight: 40,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metricCard: {
    width: '48%',
    gap: 6,
  },
  metricValue: {
    fontWeight: '700',
  },
  editorCard: {
    gap: spacing.sm,
  },
  input: {
    color: colors.text,
    fontFamily: TR_FONTS.regular,
    fontSize: 15,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  dateRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dateInput: {
    flex: 1,
  },
  notesInput: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  editorActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  secondaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  secondaryButtonText: {
    color: colors.text,
    fontWeight: '700',
  },
  primaryEditorButton: {
    flex: 1,
  },
  weatherStripCard: {
    gap: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  weatherRow: {
    gap: spacing.sm,
  },
  weatherDayCard: {
    gap: 8,
    padding: spacing.sm,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  itineraryCard: {
    gap: spacing.sm,
  },
  addDayComposer: {
    gap: spacing.sm,
  },
  dayList: {
    gap: spacing.sm,
  },
  dayCard: {
    gap: spacing.sm,
  },
  dayHeader: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  dayBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(132,204,22,0.16)',
  },
  dayBadgeText: {
    color: TR_ACCENT_LIGHT,
    fontWeight: '700',
  },
  dayTitle: {
    fontWeight: '700',
  },
  dayHeaderActions: {
    flexDirection: 'row',
    gap: 6,
  },
  dayActionButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  dayActionText: {
    color: colors.text,
    fontWeight: '700',
  },
  activitiesList: {
    gap: spacing.sm,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  activityIcon: {
    fontSize: 18,
  },
  activityName: {
    color: colors.text,
    fontWeight: '700',
  },
  activityComposer: {
    gap: spacing.sm,
  },
  activityTypeRow: {
    gap: spacing.sm,
  },
  linkedTrailRow: {
    gap: spacing.sm,
  },
  activityTypeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  activityTypeChipActive: {
    backgroundColor: TR_ACCENT_LIGHT,
  },
  activityTypeText: {
    color: colors.textSecondary,
    fontWeight: '700',
  },
  activityTypeTextActive: {
    color: '#102108',
  },
  addActivityButton: {
    alignSelf: 'flex-start',
  },
  deleteDayHint: {
    alignSelf: 'flex-start',
  },
  linkText: {
    color: ACCENT,
    fontWeight: '700',
  },
  trailsCard: {
    gap: spacing.sm,
  },
  linkedTrailsList: {
    gap: spacing.sm,
  },
  packingCard: {
    gap: spacing.sm,
  },
  packingSummary: {
    gap: spacing.sm,
  },
  notesCard: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
});
