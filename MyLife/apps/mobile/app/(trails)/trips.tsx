import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  createTrip,
  createTripActivity,
  createTripDay,
  deleteTrip,
  getPackingTemplates,
  getTrail,
  getTrails,
  getTripActivities,
  getTripDays,
  getTrips,
  MaterialSymbol,
  TrailCard,
  TR_ACCENT_LIGHT,
  TR_FONTS,
  updateTrip,
  WeatherChip,
  type Trail,
  type Trip,
} from '@mylife/trails';
import { Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';
import {
  TrailsChip,
  TrailsEmptyState,
  TrailsGlassCard,
  TrailsHero,
  TrailsPrimaryButton,
  TrailsScreen,
  TrailsSection,
} from './_ui';
import {
  buildRegionChoices,
  buildTripWeather,
  composeTripNotes,
  deriveTripStatus,
  formatTripDateRange,
  getDayDate,
  getTripDurationDays,
} from './phase6-utils';

type TripTab = 'upcoming' | 'past' | 'draft';

interface PlannerDraft {
  name: string;
  startDate: string;
  endDate: string;
  region: string | null;
  selectedTrailIds: string[];
  packingTemplateId: string | null;
  notes: string;
}

export default function TripsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [tick, setTick] = useState(0);
  const [activeTab, setActiveTab] = useState<TripTab>('upcoming');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [tripSearch, setTripSearch] = useState('');
  const [trailSearch, setTrailSearch] = useState('');
  const [draft, setDraft] = useState<PlannerDraft>({
    name: '',
    startDate: '',
    endDate: '',
    region: null,
    selectedTrailIds: [],
    packingTemplateId: null,
    notes: '',
  });

  const trips = useMemo(() => getTrips(db), [db, tick]);
  const trails = useMemo(() => getTrails(db), [db]);
  const packingTemplates = useMemo(() => getPackingTemplates(db), [db, tick]);
  const regionChoices = useMemo(() => buildRegionChoices(trails), [trails]);

  const tripMeta = useMemo(() => {
    return trips.map((trip) => {
      const days = getTripDays(db, trip.id);
      const trailIds = new Set<string>();
      days.forEach((day) => {
        getTripActivities(db, day.id).forEach((activity) => {
          if (activity.trailId) {
            trailIds.add(activity.trailId);
          }
        });
      });

      const linkedTrails = Array.from(trailIds)
        .map((trailId) => getTrail(db, trailId))
        .filter((trail): trail is Trail => Boolean(trail));

      return {
        trip,
        dayCount: days.length || getTripDurationDays(trip),
        linkedTrails,
        weather: buildTripWeather(trip.id, trip.startDate, days.length || getTripDurationDays(trip)),
      };
    });
  }, [db, trips]);

  const filteredTrips = useMemo(() => {
    const visible = tripMeta.filter(({ trip }) => deriveTripStatus(trip) === activeTab);
    if (!tripSearch.trim()) {
      return visible;
    }

    const term = tripSearch.trim().toLowerCase();
    return visible.filter(({ trip, linkedTrails }) =>
      trip.name.toLowerCase().includes(term)
      || linkedTrails.some((trail) => trail.name.toLowerCase().includes(term)),
    );
  }, [activeTab, tripMeta, tripSearch]);

  const selectedRegion = useMemo(
    () => regionChoices.find((region) => region.name === draft.region) ?? regionChoices[0] ?? null,
    [draft.region, regionChoices],
  );

  const filteredTrailChoices = useMemo(() => {
    return trails.filter((trail) => {
      if (draft.region && trail.region !== draft.region) {
        return false;
      }
      if (!trailSearch.trim()) {
        return true;
      }
      return trail.name.toLowerCase().includes(trailSearch.trim().toLowerCase());
    });
  }, [draft.region, trailSearch, trails]);

  const refresh = useCallback(() => setTick((current) => current + 1), []);

  const resetWizard = useCallback(() => {
    setWizardOpen(false);
    setWizardStep(0);
    setTrailSearch('');
    setDraft({
      name: '',
      startDate: '',
      endDate: '',
      region: null,
      selectedTrailIds: [],
      packingTemplateId: null,
      notes: '',
    });
  }, []);

  const handleCreate = useCallback(() => {
    if (!draft.name.trim()) {
      Alert.alert('Trip title required', 'Give the expedition a name before saving.');
      return;
    }

    try {
      const trip = createTrip(db, uuid(), {
        name: draft.name.trim(),
        startDate: draft.startDate || null,
        endDate: draft.endDate || null,
        notes: composeTripNotes(draft.region, draft.notes),
      });

      if (draft.packingTemplateId) {
        updateTrip(db, trip.id, { packingTemplateId: draft.packingTemplateId });
      }

      const totalDays = Math.max(
        getTripDurationDays({
          startDate: draft.startDate || null,
          endDate: draft.endDate || null,
        }),
        draft.selectedTrailIds.length > 0 ? 1 : 0,
      );

      const dayIds = Array.from({ length: totalDays }, (_, index) => {
        const dayId = uuid();
        createTripDay(db, dayId, {
          tripId: trip.id,
          dayNumber: index + 1,
          date: getDayDate(draft.startDate || null, index),
          title: draft.selectedTrailIds[index]
            ? trails.find((trail) => trail.id === draft.selectedTrailIds[index])?.name ?? `Day ${index + 1}`
            : null,
        });
        return dayId;
      });

      draft.selectedTrailIds.forEach((trailId, index) => {
        const trail = trails.find((candidate) => candidate.id === trailId);
        if (!trail || dayIds.length === 0) {
          return;
        }
        createTripActivity(db, uuid(), {
          dayId: dayIds[Math.min(index, dayIds.length - 1)],
          trailId,
          type: 'hike',
          name: trail.name,
          description: trail.region ?? null,
          sortOrder: index,
        });
      });

      resetWizard();
      refresh();
      router.push(`/(trails)/trip/${trip.id}` as `/${string}`);
    } catch {
      Alert.alert('Error', 'Failed to create the trip.');
    }
  }, [db, draft, refresh, resetWizard, router, trails]);

  const handleDelete = useCallback(
    (trip: Trip) => {
      Alert.alert('Delete Trip', `Delete "${trip.name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            try {
              deleteTrip(db, trip.id);
              refresh();
            } catch {
              Alert.alert('Error', 'Failed to delete the trip.');
            }
          },
        },
      ]);
    },
    [db, refresh],
  );

  return (
    <TrailsScreen contentContainerStyle={styles.content}>
      <TrailsHero
        title="Trips"
        subtitle={`${tripMeta.length} expeditions across upcoming plans, completed journeys, and flexible drafts.`}
        action={(
          <Pressable onPress={() => setWizardOpen((current) => !current)} style={styles.heroAction}>
            <MaterialSymbol name="add" size={16} color="#102108" />
            <Text variant="caption" style={styles.heroActionText}>
              {wizardOpen ? 'Close Planner' : 'New Trip'}
            </Text>
          </Pressable>
        )}
      />

      {wizardOpen ? (
        <TrailsGlassCard style={styles.wizardCard}>
          <View style={styles.wizardHeader}>
            <View>
              <Text variant="label" color={colors.textTertiary}>
                ADVENTURE PLANNER
              </Text>
              <Text variant="subheading">Step {wizardStep + 1} of 5</Text>
            </View>
            <Text variant="caption" color={colors.textSecondary}>
              Multi-day setup
            </Text>
          </View>

          <View style={styles.stepTabs}>
            {['Basics', 'Region', 'Trails', 'Packing', 'Review'].map((label, index) => (
              <Pressable
                key={label}
                onPress={() => setWizardStep(index)}
                style={[styles.stepTab, wizardStep === index && styles.stepTabActive]}
              >
                <Text
                  variant="caption"
                  style={[
                    styles.stepTabText,
                    wizardStep === index && styles.stepTabTextActive,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          {wizardStep === 0 ? (
            <View style={styles.stepContent}>
              <TextInput
                autoFocus
                placeholder="High Sierra Traverse"
                placeholderTextColor={colors.textTertiary}
                style={styles.input}
                value={draft.name}
                onChangeText={(value) => setDraft((current) => ({ ...current, name: value }))}
              />
              <View style={styles.dateRow}>
                <TextInput
                  placeholder="2026-05-12"
                  placeholderTextColor={colors.textTertiary}
                  style={[styles.input, styles.dateInput]}
                  value={draft.startDate}
                  onChangeText={(value) => setDraft((current) => ({ ...current, startDate: value }))}
                />
                <TextInput
                  placeholder="2026-05-16"
                  placeholderTextColor={colors.textTertiary}
                  style={[styles.input, styles.dateInput]}
                  value={draft.endDate}
                  onChangeText={(value) => setDraft((current) => ({ ...current, endDate: value }))}
                />
              </View>
              <TextInput
                placeholder="Trip notes, campsite goals, weather plan..."
                placeholderTextColor={colors.textTertiary}
                style={[styles.input, styles.notesInput]}
                multiline
                value={draft.notes}
                onChangeText={(value) => setDraft((current) => ({ ...current, notes: value }))}
              />
            </View>
          ) : null}

          {wizardStep === 1 && selectedRegion ? (
            <View style={styles.stepContent}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.regionRow}>
                {regionChoices.map((region) => (
                  <TrailsChip
                    key={region.name}
                    label={region.name}
                    active={draft.region === region.name}
                    onPress={() => setDraft((current) => ({ ...current, region: region.name }))}
                  />
                ))}
              </ScrollView>
              <View style={styles.regionPreview}>
                <LinearGradient
                  colors={['rgba(132,204,22,0.22)', 'rgba(101,163,13,0.08)', 'rgba(19,19,24,0.92)']}
                  style={StyleSheet.absoluteFillObject}
                />
                <View style={styles.regionPulse} />
                <Text variant="label" color={colors.textTertiary}>
                  REGION FOCUS
                </Text>
                <Text variant="subheading">{selectedRegion.name}</Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {selectedRegion.lat.toFixed(2)}, {selectedRegion.lng.toFixed(2)} · {selectedRegion.count} saved trail matches
                </Text>
              </View>
            </View>
          ) : null}

          {wizardStep === 2 ? (
            <View style={styles.stepContent}>
              <TextInput
                placeholder="Search trails..."
                placeholderTextColor={colors.textTertiary}
                style={styles.input}
                value={trailSearch}
                onChangeText={setTrailSearch}
              />
              <View style={styles.selectedTrailsWrap}>
                {draft.selectedTrailIds.map((trailId) => {
                  const trail = trails.find((candidate) => candidate.id === trailId);
                  if (!trail) {
                    return null;
                  }
                  return (
                    <View key={trail.id} style={styles.selectedTrailPill}>
                      <Text variant="caption" style={styles.selectedTrailText}>
                        {trail.name}
                      </Text>
                    </View>
                  );
                })}
              </View>
              <View style={styles.trailChoiceList}>
                {filteredTrailChoices.slice(0, 6).map((trail) => {
                  const selected = draft.selectedTrailIds.includes(trail.id);
                  return (
                    <Pressable
                      key={trail.id}
                      onPress={() => setDraft((current) => ({
                        ...current,
                        selectedTrailIds: selected
                          ? current.selectedTrailIds.filter((trailId) => trailId !== trail.id)
                          : [...current.selectedTrailIds, trail.id],
                      }))}
                    >
                      <TrailCard trail={trail} variant="row" />
                      {selected ? (
                        <View style={styles.selectedOverlay}>
                          <Text variant="caption" style={styles.selectedOverlayText}>
                            Selected
                          </Text>
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {wizardStep === 3 ? (
            <View style={styles.stepContent}>
              <View style={styles.packingOptions}>
                {packingTemplates.length > 0 ? packingTemplates.map((template) => (
                  <Pressable
                    key={template.id}
                    onPress={() => setDraft((current) => ({
                      ...current,
                      packingTemplateId: current.packingTemplateId === template.id ? null : template.id,
                    }))}
                    style={[
                      styles.packingChoice,
                      draft.packingTemplateId === template.id && styles.packingChoiceActive,
                    ]}
                  >
                    <Text variant="body" style={styles.packingChoiceTitle}>
                      {template.name}
                    </Text>
                    <Text variant="caption" color={colors.textSecondary}>
                      {template.type.replace(/_/g, ' ')}
                    </Text>
                  </Pressable>
                )) : (
                  <TrailsEmptyState
                    icon="🎒"
                    title="Create a packing list first"
                    copy="The planner can link any existing MyTrails packing checklist."
                    action={<TrailsPrimaryButton label="Open Packing" onPress={() => router.push('/(trails)/packing')} />}
                  />
                )}
              </View>
            </View>
          ) : null}

          {wizardStep === 4 ? (
            <View style={styles.stepContent}>
              <ReviewRow label="Trip" value={draft.name || 'Untitled expedition'} />
              <ReviewRow
                label="Dates"
                value={draft.startDate ? `${draft.startDate}${draft.endDate ? ` - ${draft.endDate}` : ''}` : 'Flexible'}
              />
              <ReviewRow label="Region" value={draft.region ?? 'Choose a focus area'} />
              <ReviewRow label="Trails" value={draft.selectedTrailIds.length > 0 ? `${draft.selectedTrailIds.length} linked` : 'No linked trails yet'} />
              <ReviewRow
                label="Packing"
                value={packingTemplates.find((template) => template.id === draft.packingTemplateId)?.name ?? 'Not linked'}
              />
              {draft.region ? (
                <View style={styles.weatherPreviewRow}>
                  {buildTripWeather(draft.name || draft.region, draft.startDate || null, Math.max(3, draft.selectedTrailIds.length || 1)).map((day) => (
                    <View key={day.key} style={styles.weatherPreviewCard}>
                      <Text variant="caption" color={colors.textSecondary}>
                        {day.label}
                      </Text>
                      <WeatherChip condition={day.condition} temperature={day.temperature} />
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={styles.wizardFooter}>
            <Pressable
              onPress={() => setWizardStep((current) => Math.max(0, current - 1))}
              style={[styles.footerButton, wizardStep === 0 && styles.footerButtonMuted]}
              disabled={wizardStep === 0}
            >
              <Text variant="caption" style={styles.footerButtonText}>
                Back
              </Text>
            </Pressable>
            {wizardStep < 4 ? (
              <TrailsPrimaryButton
                label="Next"
                onPress={() => setWizardStep((current) => Math.min(4, current + 1))}
                style={styles.primaryFooterButton}
              />
            ) : (
              <TrailsPrimaryButton
                label="Save Trip"
                onPress={handleCreate}
                style={styles.primaryFooterButton}
              />
            )}
          </View>
        </TrailsGlassCard>
      ) : null}

      <TrailsSection eyebrow="Trip Views" title="Planner Modes">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
          {(['upcoming', 'past', 'draft'] as TripTab[]).map((tab) => (
            <TrailsChip
              key={tab}
              label={tab === 'draft' ? 'Drafts' : tab === 'past' ? 'Past' : 'Upcoming'}
              active={activeTab === tab}
              onPress={() => setActiveTab(tab)}
            />
          ))}
        </ScrollView>

        <TextInput
          placeholder="Search expeditions or linked trails..."
          placeholderTextColor={colors.textTertiary}
          style={styles.input}
          value={tripSearch}
          onChangeText={setTripSearch}
        />

        {filteredTrips.length === 0 ? (
          <TrailsEmptyState
            icon="🏕️"
            title="No trips in this lane"
            copy="Open the planner to create a new expedition, pick trails, and connect a packing list."
            action={<TrailsPrimaryButton label="Plan a Trip" onPress={() => setWizardOpen(true)} />}
          />
        ) : (
          <View style={styles.tripList}>
            {filteredTrips.map(({ trip, linkedTrails, dayCount, weather }) => (
              <Pressable
                key={trip.id}
                onPress={() => router.push(`/(trails)/trip/${trip.id}` as `/${string}`)}
                onLongPress={() => handleDelete(trip)}
              >
                <TrailsGlassCard style={styles.tripCard}>
                  <LinearGradient
                    colors={['rgba(132,204,22,0.28)', 'rgba(101,163,13,0.1)', 'rgba(19,19,24,0.96)']}
                    style={styles.tripHero}
                  >
                    <View style={styles.tripHeader}>
                      <View style={{ flex: 1 }}>
                        <Text variant="label" color={colors.textTertiary}>
                          {trip.startDate ? formatTripDateRange(trip) : 'Draft itinerary'}
                        </Text>
                        <Text variant="subheading">{trip.name}</Text>
                        <Text variant="caption" color={colors.textSecondary}>
                          {linkedTrails[0]?.region ?? 'Flexible region'} · {dayCount} day{dayCount === 1 ? '' : 's'}
                        </Text>
                      </View>
                      <WeatherChip condition={weather[0]?.condition ?? 'Clear sky'} temperature={weather[0]?.temperature ?? 12} />
                    </View>
                    <View style={styles.tripMetaRow}>
                      {linkedTrails.slice(0, 3).map((trail) => (
                        <View key={trail.id} style={styles.tripMetaPill}>
                          <Text variant="caption" color={colors.textSecondary}>
                            {trail.name}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </LinearGradient>
                </TrailsGlassCard>
              </Pressable>
            ))}
          </View>
        )}
      </TrailsSection>
    </TrailsScreen>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewRow}>
      <Text variant="caption" color={colors.textTertiary}>
        {label}
      </Text>
      <Text variant="caption" style={styles.reviewValue}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.sm,
  },
  heroAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: TR_ACCENT_LIGHT,
  },
  heroActionText: {
    color: '#102108',
    fontWeight: '700',
  },
  wizardCard: {
    gap: spacing.md,
  },
  wizardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  stepTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  stepTab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  stepTabActive: {
    backgroundColor: TR_ACCENT_LIGHT,
  },
  stepTabText: {
    color: colors.textSecondary,
    fontWeight: '700',
  },
  stepTabTextActive: {
    color: '#102108',
  },
  stepContent: {
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
  regionRow: {
    gap: spacing.sm,
  },
  regionPreview: {
    minHeight: 160,
    overflow: 'hidden',
    borderRadius: 24,
    padding: spacing.lg,
    justifyContent: 'flex-end',
    gap: 4,
    backgroundColor: colors.surface,
  },
  regionPulse: {
    position: 'absolute',
    top: 34,
    right: 34,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: TR_ACCENT_LIGHT,
    shadowColor: TR_ACCENT_LIGHT,
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  selectedTrailsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  selectedTrailPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(132,204,22,0.16)',
  },
  selectedTrailText: {
    color: TR_ACCENT_LIGHT,
    fontWeight: '700',
  },
  trailChoiceList: {
    gap: spacing.sm,
  },
  selectedOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(132,204,22,0.92)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 999,
  },
  selectedOverlayText: {
    color: '#102108',
    fontWeight: '700',
  },
  packingOptions: {
    gap: spacing.sm,
  },
  packingChoice: {
    padding: spacing.md,
    borderRadius: 20,
    backgroundColor: colors.surface,
    gap: 4,
  },
  packingChoiceActive: {
    backgroundColor: 'rgba(132,204,22,0.16)',
  },
  packingChoiceTitle: {
    fontWeight: '700',
  },
  weatherPreviewRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  weatherPreviewCard: {
    gap: 8,
    padding: spacing.sm,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  wizardFooter: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  footerButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  footerButtonMuted: {
    opacity: 0.5,
  },
  footerButtonText: {
    color: colors.text,
    fontWeight: '700',
  },
  primaryFooterButton: {
    flex: 1,
  },
  tabRow: {
    gap: spacing.sm,
    paddingVertical: 2,
  },
  tripList: {
    gap: spacing.sm,
  },
  tripCard: {
    padding: 0,
    overflow: 'hidden',
  },
  tripHero: {
    gap: spacing.md,
    padding: spacing.lg,
    minHeight: 172,
    justifyContent: 'space-between',
  },
  tripHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  tripMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tripMetaPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  reviewValue: {
    color: colors.text,
    fontWeight: '700',
  },
});
