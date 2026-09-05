import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, surfaceTiers } from '@mylife/ui';
import {
  listDestinations,
  listTrips,
  suggestTripLength,
  bestTimeToVisit,
  similarDestinations,
  recommendActivitiesForTrip,
  budgetEstimate,
  preTripReminders,
  type DestinationRecord,
  type DestinationRow,
  type TripRow,
  type TripLengthSuggestion,
  type TimeToVisit,
  type BudgetEstimate,
  type PreTripReminder,
  type ReminderSeverity,
} from '@mylife/travel';
import { useDatabase } from '../../components/DatabaseProvider';
import { TRAVEL_ACCENT } from './_ui';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';
type Mode = 'destination' | 'trip';

interface BaseData {
  destinations: DestinationRecord[];
  trips: TripRow[];
}

interface DestinationPayload {
  destination: DestinationRecord;
  tripLength: TripLengthSuggestion;
  timeToVisit: TimeToVisit;
  similar: DestinationRow[];
}

interface TripPayload {
  trip: TripRow;
  reminders: PreTripReminder[];
  budget: BudgetEstimate;
  activities: string[];
}

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const REMINDER_COLORS: Record<ReminderSeverity, string> = {
  info: '#8BCFF0',
  warning: '#C9894D',
  critical: '#FFB4AB',
};

export default function TravelPlanningScreen() {
  const db = useDatabase();
  const [mode, setMode] = useState<Mode>('destination');
  const [status, setStatus] = useState<LoadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [base, setBase] = useState<BaseData | null>(null);
  const [selectedDestId, setSelectedDestId] = useState<string | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

  const load = useCallback(() => {
    setStatus('loading');
    try {
      const destinations = listDestinations(db);
      const trips = listTrips(db);
      setBase({ destinations, trips });
      if (destinations.length > 0 && !selectedDestId) {
        setSelectedDestId(destinations[0].id);
      }
      if (trips.length > 0 && !selectedTripId) {
        setSelectedTripId(trips[0].id);
      }
      setError(null);
      setStatus('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load planning');
      setStatus('error');
    }
  }, [db, selectedDestId, selectedTripId]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const destPayload = useMemo<DestinationPayload | null>(() => {
    if (!base || !selectedDestId) return null;
    const destination = base.destinations.find((d) => d.id === selectedDestId);
    if (!destination) return null;
    try {
      return {
        destination,
        tripLength: suggestTripLength(db, destination.id),
        timeToVisit: bestTimeToVisit(destination.country_code ?? null),
        similar: similarDestinations(db, destination.id, 5),
      };
    } catch {
      return null;
    }
  }, [db, base, selectedDestId]);

  const tripPayload = useMemo<TripPayload | null>(() => {
    if (!base || !selectedTripId) return null;
    const trip = base.trips.find((t) => t.id === selectedTripId);
    if (!trip) return null;
    try {
      return {
        trip,
        reminders: preTripReminders(db, trip.id),
        budget: budgetEstimate(db, trip.id),
        activities: recommendActivitiesForTrip(db, trip.id),
      };
    } catch {
      return null;
    }
  }, [db, base, selectedTripId]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Planning</Text>
        <Text style={styles.title}>Research</Text>
        <Text style={styles.subtitle}>
          Trip length suggestions, best time to visit, budget estimates, and pre-trip reminders.
        </Text>
      </View>

      <View style={styles.segment}>
        <SegmentButton
          label="Destination"
          active={mode === 'destination'}
          onPress={() => setMode('destination')}
        />
        <SegmentButton
          label="Trip preview"
          active={mode === 'trip'}
          onPress={() => setMode('trip')}
        />
      </View>

      {status === 'loading' ? (
        <View style={styles.panel}>
          <ActivityIndicator color={TRAVEL_ACCENT} />
          <Text style={styles.muted}>Loading planning data...</Text>
        </View>
      ) : null}

      {status === 'error' ? (
        <View style={[styles.panel, styles.errorPanel]}>
          <Text style={styles.errorText}>{error ?? 'Something went wrong.'}</Text>
          <Pressable style={styles.retryButton} onPress={load}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {status === 'ready' && base && mode === 'destination' ? (
        <DestinationMode
          destinations={base.destinations}
          selectedId={selectedDestId}
          onSelect={setSelectedDestId}
          payload={destPayload}
        />
      ) : null}

      {status === 'ready' && base && mode === 'trip' ? (
        <TripMode
          trips={base.trips}
          selectedId={selectedTripId}
          onSelect={setSelectedTripId}
          payload={tripPayload}
        />
      ) : null}
    </ScrollView>
  );
}

// ── Segmented control ────────────────────────────────────────────────

function SegmentButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.segmentBtn, active ? styles.segmentBtnActive : null]}
      onPress={onPress}
    >
      <Text style={[styles.segmentText, active ? styles.segmentTextActive : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

// ── Destination mode ────────────────────────────────────────────────

function DestinationMode({
  destinations,
  selectedId,
  onSelect,
  payload,
}: {
  destinations: DestinationRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  payload: DestinationPayload | null;
}) {
  if (destinations.length === 0) {
    return (
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>No destinations yet</Text>
        <Text style={styles.muted}>Add some first on the Destinations tab.</Text>
      </View>
    );
  }

  return (
    <>
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Pick a destination</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {destinations.map((d) => (
            <Pressable
              key={d.id}
              style={[
                styles.chip,
                selectedId === d.id ? styles.chipActive : null,
              ]}
              onPress={() => onSelect(d.id)}
            >
              <Text
                style={[
                  styles.chipText,
                  selectedId === d.id ? styles.chipTextActive : null,
                ]}
                numberOfLines={1}
              >
                {d.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {payload ? (
        <>
          <MonthsCard timeToVisit={payload.timeToVisit} />
          <TripLengthCard suggestion={payload.tripLength} />
          <SimilarDestinationsCard rows={payload.similar} />
        </>
      ) : (
        <View style={styles.panel}>
          <Text style={styles.muted}>Select a destination to see research.</Text>
        </View>
      )}
    </>
  );
}

function MonthsCard({ timeToVisit }: { timeToVisit: TimeToVisit }) {
  const set = new Set(timeToVisit.months);
  return (
    <View style={styles.panel}>
      <Text style={styles.sectionTitle}>Best time to visit</Text>
      <View style={styles.monthRow}>
        {MONTH_LABELS.map((label, i) => {
          const month = i + 1;
          const active = set.has(month);
          return (
            <View
              key={label}
              style={[
                styles.monthChip,
                active ? styles.monthChipActive : null,
              ]}
            >
              <Text
                style={[
                  styles.monthText,
                  active ? styles.monthTextActive : null,
                ]}
              >
                {label}
              </Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.muted}>{timeToVisit.reason}</Text>
    </View>
  );
}

function TripLengthCard({ suggestion }: { suggestion: TripLengthSuggestion }) {
  return (
    <View style={styles.panel}>
      <Text style={styles.sectionTitle}>Suggested trip length</Text>
      <View style={styles.metricsRow}>
        <MetricCard label="Min days" value={suggestion.minDays.toString()} />
        <MetricCard
          label="Typical"
          value={suggestion.typical.toString()}
          highlight
        />
        <MetricCard label="Max days" value={suggestion.maxDays.toString()} />
      </View>
      <Text style={styles.muted}>
        Based on {suggestion.source === 'history' ? 'your trip history' : 'default presets'}.
      </Text>
    </View>
  );
}

function SimilarDestinationsCard({ rows }: { rows: DestinationRow[] }) {
  return (
    <View style={styles.panel}>
      <Text style={styles.sectionTitle}>Similar destinations</Text>
      {rows.length === 0 ? (
        <Text style={styles.muted}>No similar destinations yet.</Text>
      ) : (
        <View style={styles.list}>
          {rows.map((row) => (
            <View key={row.id} style={styles.row}>
              <View style={styles.rowMain}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {row.name}
                </Text>
                <Text style={styles.rowSub}>{row.country ?? 'Unknown'}</Text>
              </View>
              {row.visit_count > 0 ? (
                <Text style={styles.rowValue}>
                  {row.visit_count} {row.visit_count === 1 ? 'visit' : 'visits'}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Trip mode ────────────────────────────────────────────────────────

function TripMode({
  trips,
  selectedId,
  onSelect,
  payload,
}: {
  trips: TripRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  payload: TripPayload | null;
}) {
  if (trips.length === 0) {
    return (
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>No trips yet</Text>
        <Text style={styles.muted}>Create a trip to preview reminders and budget.</Text>
      </View>
    );
  }

  return (
    <>
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Pick a trip</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {trips.map((t) => (
            <Pressable
              key={t.id}
              style={[
                styles.chip,
                selectedId === t.id ? styles.chipActive : null,
              ]}
              onPress={() => onSelect(t.id)}
            >
              <Text
                style={[
                  styles.chipText,
                  selectedId === t.id ? styles.chipTextActive : null,
                ]}
                numberOfLines={1}
              >
                {t.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {payload ? (
        <>
          <RemindersCard reminders={payload.reminders} />
          <BudgetCard estimate={payload.budget} />
          <ActivitiesCard activities={payload.activities} />
        </>
      ) : (
        <View style={styles.panel}>
          <Text style={styles.muted}>Select a trip to see the preview.</Text>
        </View>
      )}
    </>
  );
}

function RemindersCard({ reminders }: { reminders: PreTripReminder[] }) {
  return (
    <View style={styles.panel}>
      <Text style={styles.sectionTitle}>Pre-trip reminders</Text>
      {reminders.length === 0 ? (
        <Text style={styles.muted}>All clear. No reminders at this time.</Text>
      ) : (
        <View style={styles.list}>
          {reminders.map((r, idx) => (
            <View
              key={`${r.kind}-${idx}`}
              style={[
                styles.reminderRow,
                { borderLeftColor: REMINDER_COLORS[r.severity] },
              ]}
            >
              <Text
                style={[
                  styles.reminderSeverity,
                  { color: REMINDER_COLORS[r.severity] },
                ]}
              >
                {r.severity.toUpperCase()}
              </Text>
              <Text style={styles.reminderMessage}>{r.message}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function BudgetCard({ estimate }: { estimate: BudgetEstimate }) {
  const fmt = (cents: number) => {
    const whole = Math.round(cents / 100).toLocaleString();
    return `${estimate.currency} ${whole}`;
  };
  if (estimate.sampleSize === 0) {
    return (
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Budget estimate</Text>
        <Text style={styles.muted}>
          Not enough trip history in this country yet. Log bookings on past trips to build the estimate.
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.panel}>
      <Text style={styles.sectionTitle}>Budget estimate</Text>
      <View style={styles.metricsRow}>
        <MetricCard label="Per day" value={fmt(estimate.perDayCents)} />
        <MetricCard
          label="Total"
          value={estimate.totalCents > 0 ? fmt(estimate.totalCents) : '—'}
          highlight
        />
      </View>
      <Text style={styles.muted}>
        Based on {estimate.sampleSize} past {estimate.sampleSize === 1 ? 'trip' : 'trips'} to the same country.
      </Text>
    </View>
  );
}

function ActivitiesCard({ activities }: { activities: string[] }) {
  return (
    <View style={styles.panel}>
      <Text style={styles.sectionTitle}>Recommended activities</Text>
      {activities.length === 0 ? (
        <Text style={styles.muted}>No activity recommendations yet.</Text>
      ) : (
        <View style={styles.activityList}>
          {activities.map((a, idx) => (
            <View key={`${idx}-${a}`} style={styles.activityRow}>
              <Text style={styles.activityBullet}>•</Text>
              <Text style={styles.activityText}>{a}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function MetricCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={[styles.metricCard, highlight ? styles.metricCardAccent : null]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: surfaceTiers.lowest,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 160,
    gap: 14,
  },
  hero: {
    gap: 8,
    padding: 20,
    borderRadius: 24,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eyebrow: {
    color: TRAVEL_ACCENT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  segment: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 999,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 999,
    alignItems: 'center',
  },
  segmentBtnActive: {
    backgroundColor: 'rgba(14,165,233,0.22)',
  },
  segmentText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: colors.text,
  },
  panel: {
    gap: 10,
    padding: 18,
    borderRadius: 20,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  errorPanel: {
    borderColor: '#93000A',
    backgroundColor: 'rgba(147,0,10,0.12)',
  },
  errorText: {
    color: '#FFB4AB',
    fontSize: 14,
    lineHeight: 20,
  },
  retryButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: surfaceTiers.container,
  },
  retryText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  muted: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  chipRow: {
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: surfaceTiers.container,
    maxWidth: 220,
  },
  chipActive: {
    backgroundColor: 'rgba(14,165,233,0.18)',
    borderColor: 'rgba(14,165,233,0.48)',
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.text,
  },
  monthRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  monthChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: surfaceTiers.container,
    minWidth: 48,
    alignItems: 'center',
  },
  monthChipActive: {
    backgroundColor: 'rgba(14,165,233,0.22)',
    borderColor: 'rgba(14,165,233,0.52)',
  },
  monthText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  monthTextActive: {
    color: colors.text,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    gap: 4,
    padding: 14,
    borderRadius: 16,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricCardAccent: {
    backgroundColor: 'rgba(14,165,233,0.12)',
    borderColor: 'rgba(14,165,233,0.32)',
  },
  metricLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  metricValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  list: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowMain: {
    flex: 1,
    gap: 3,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  rowSub: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  rowValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  reminderRow: {
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderLeftWidth: 3,
    borderRadius: 8,
    backgroundColor: surfaceTiers.container,
  },
  reminderSeverity: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  reminderMessage: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  activityList: {
    gap: 6,
  },
  activityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  activityBullet: {
    color: TRAVEL_ACCENT,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  activityText: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    lineHeight: 20,
  },
});
