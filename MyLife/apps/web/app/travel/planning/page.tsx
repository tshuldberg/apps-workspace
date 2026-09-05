import type { CSSProperties } from 'react';
import Link from 'next/link';
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
import { ensureModuleMigrations, getAdapter } from '@/lib/db';
import { TravelPanel } from '../_ui';

export const dynamic = 'force-dynamic';

type Mode = 'destination' | 'trip';

interface LoadedBase {
  destinations: DestinationRecord[];
  trips: TripRow[];
}

interface DestinationView {
  destination: DestinationRecord;
  tripLength: TripLengthSuggestion;
  timeToVisit: TimeToVisit;
  similar: DestinationRow[];
}

interface TripView {
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

function firstParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function loadBase(): LoadedBase | { error: string } {
  try {
    ensureModuleMigrations('travel');
    const db = getAdapter();
    return {
      destinations: listDestinations(db),
      trips: listTrips(db),
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to load planning' };
  }
}

function loadDestinationView(
  destination: DestinationRecord,
): DestinationView | null {
  try {
    const db = getAdapter();
    return {
      destination,
      tripLength: suggestTripLength(db, destination.id),
      timeToVisit: bestTimeToVisit(destination.country_code ?? null),
      similar: similarDestinations(db, destination.id, 5),
    };
  } catch {
    return null;
  }
}

function loadTripView(trip: TripRow): TripView | null {
  try {
    const db = getAdapter();
    return {
      trip,
      reminders: preTripReminders(db, trip.id),
      budget: budgetEstimate(db, trip.id),
      activities: recommendActivitiesForTrip(db, trip.id),
    };
  } catch {
    return null;
  }
}

export default async function TravelPlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string | string[]; id?: string | string[] }>;
}) {
  const sp = await searchParams;
  const modeParam = firstParam(sp.mode);
  const mode: Mode = modeParam === 'trip' ? 'trip' : 'destination';
  const idParam = firstParam(sp.id);

  const base = loadBase();

  if ('error' in base) {
    return (
      <div style={{ display: 'grid', gap: 16 }}>
        <TravelPanel
          eyebrow="Planning"
          title="Could not load planning"
          body={base.error}
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <TravelPanel
        eyebrow="Planning"
        title="Research"
        body="Trip length suggestions, best time to visit, budget estimates, and pre-trip reminders."
      />

      <ModeTabs mode={mode} />

      {mode === 'destination' ? (
        <DestinationSection
          destinations={base.destinations}
          selectedId={idParam ?? base.destinations[0]?.id ?? null}
        />
      ) : (
        <TripSection
          trips={base.trips}
          selectedId={idParam ?? base.trips[0]?.id ?? null}
        />
      )}
    </div>
  );
}

// ── Mode tabs ────────────────────────────────────────────────────────

function ModeTabs({ mode }: { mode: Mode }) {
  return (
    <nav style={styles.segment}>
      <ModeLink
        href="/travel/planning?mode=destination"
        label="Destination"
        active={mode === 'destination'}
      />
      <ModeLink
        href="/travel/planning?mode=trip"
        label="Trip preview"
        active={mode === 'trip'}
      />
    </nav>
  );
}

function ModeLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      style={{
        ...styles.segmentBtn,
        ...(active ? styles.segmentBtnActive : {}),
      }}
    >
      <span
        style={{
          ...styles.segmentText,
          ...(active ? styles.segmentTextActive : {}),
        }}
      >
        {label}
      </span>
    </Link>
  );
}

// ── Destination section ─────────────────────────────────────────────

function DestinationSection({
  destinations,
  selectedId,
}: {
  destinations: DestinationRecord[];
  selectedId: string | null;
}) {
  if (destinations.length === 0) {
    return (
      <section style={styles.panel}>
        <h3 style={styles.sectionTitle}>No destinations yet</h3>
        <p style={styles.muted}>Add some first on the Destinations tab.</p>
      </section>
    );
  }

  const selected = selectedId
    ? destinations.find((d) => d.id === selectedId) ?? destinations[0]
    : destinations[0];

  const view = loadDestinationView(selected);

  return (
    <>
      <section style={styles.panel}>
        <h3 style={styles.sectionTitle}>Pick a destination</h3>
        <div style={styles.chipRow}>
          {destinations.map((d) => (
            <Link
              key={d.id}
              href={`/travel/planning?mode=destination&id=${encodeURIComponent(d.id)}`}
              style={{
                ...styles.chip,
                ...(d.id === selected.id ? styles.chipActive : {}),
              }}
            >
              <span
                style={{
                  ...styles.chipText,
                  ...(d.id === selected.id ? styles.chipTextActive : {}),
                }}
              >
                {d.name}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {view ? (
        <>
          <MonthsCard timeToVisit={view.timeToVisit} />
          <TripLengthCard suggestion={view.tripLength} />
          <SimilarDestinationsCard rows={view.similar} />
        </>
      ) : (
        <section style={styles.panel}>
          <p style={styles.muted}>Select a destination to see research.</p>
        </section>
      )}
    </>
  );
}

function MonthsCard({ timeToVisit }: { timeToVisit: TimeToVisit }) {
  const set = new Set(timeToVisit.months);
  return (
    <section style={styles.panel}>
      <h3 style={styles.sectionTitle}>Best time to visit</h3>
      <div style={styles.monthRow}>
        {MONTH_LABELS.map((label, i) => {
          const month = i + 1;
          const active = set.has(month);
          return (
            <div
              key={label}
              style={{
                ...styles.monthChip,
                ...(active ? styles.monthChipActive : {}),
              }}
            >
              <span
                style={{
                  ...styles.monthText,
                  ...(active ? styles.monthTextActive : {}),
                }}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
      <p style={styles.muted}>{timeToVisit.reason}</p>
    </section>
  );
}

function TripLengthCard({ suggestion }: { suggestion: TripLengthSuggestion }) {
  return (
    <section style={styles.panel}>
      <h3 style={styles.sectionTitle}>Suggested trip length</h3>
      <div style={styles.metricsRow}>
        <MetricCard label="Min days" value={suggestion.minDays.toString()} />
        <MetricCard
          label="Typical"
          value={suggestion.typical.toString()}
          highlight
        />
        <MetricCard label="Max days" value={suggestion.maxDays.toString()} />
      </div>
      <p style={styles.muted}>
        Based on {suggestion.source === 'history' ? 'your trip history' : 'default presets'}.
      </p>
    </section>
  );
}

function SimilarDestinationsCard({ rows }: { rows: DestinationRow[] }) {
  return (
    <section style={styles.panel}>
      <h3 style={styles.sectionTitle}>Similar destinations</h3>
      {rows.length === 0 ? (
        <p style={styles.muted}>No similar destinations yet.</p>
      ) : (
        <ul style={styles.list}>
          {rows.map((row) => (
            <li key={row.id} style={styles.row}>
              <div style={styles.rowMain}>
                <span style={styles.rowTitle}>{row.name}</span>
                <span style={styles.rowSub}>{row.country ?? 'Unknown'}</span>
              </div>
              {row.visit_count > 0 ? (
                <span style={styles.rowValue}>
                  {row.visit_count} {row.visit_count === 1 ? 'visit' : 'visits'}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Trip section ────────────────────────────────────────────────────

function TripSection({
  trips,
  selectedId,
}: {
  trips: TripRow[];
  selectedId: string | null;
}) {
  if (trips.length === 0) {
    return (
      <section style={styles.panel}>
        <h3 style={styles.sectionTitle}>No trips yet</h3>
        <p style={styles.muted}>Create a trip to preview reminders and budget.</p>
      </section>
    );
  }

  const selected = selectedId
    ? trips.find((t) => t.id === selectedId) ?? trips[0]
    : trips[0];

  const view = loadTripView(selected);

  return (
    <>
      <section style={styles.panel}>
        <h3 style={styles.sectionTitle}>Pick a trip</h3>
        <div style={styles.chipRow}>
          {trips.map((t) => (
            <Link
              key={t.id}
              href={`/travel/planning?mode=trip&id=${encodeURIComponent(t.id)}`}
              style={{
                ...styles.chip,
                ...(t.id === selected.id ? styles.chipActive : {}),
              }}
            >
              <span
                style={{
                  ...styles.chipText,
                  ...(t.id === selected.id ? styles.chipTextActive : {}),
                }}
              >
                {t.name}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {view ? (
        <>
          <RemindersCard reminders={view.reminders} />
          <BudgetCard estimate={view.budget} />
          <ActivitiesCard activities={view.activities} />
        </>
      ) : (
        <section style={styles.panel}>
          <p style={styles.muted}>Select a trip to see the preview.</p>
        </section>
      )}
    </>
  );
}

function RemindersCard({ reminders }: { reminders: PreTripReminder[] }) {
  return (
    <section style={styles.panel}>
      <h3 style={styles.sectionTitle}>Pre-trip reminders</h3>
      {reminders.length === 0 ? (
        <p style={styles.muted}>All clear. No reminders at this time.</p>
      ) : (
        <ul style={styles.list}>
          {reminders.map((r, idx) => (
            <li
              key={`${r.kind}-${idx}`}
              style={{
                ...styles.reminderRow,
                borderLeft: `3px solid ${REMINDER_COLORS[r.severity]}`,
              }}
            >
              <span
                style={{
                  ...styles.reminderSeverity,
                  color: REMINDER_COLORS[r.severity],
                }}
              >
                {r.severity.toUpperCase()}
              </span>
              <span style={styles.reminderMessage}>{r.message}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function BudgetCard({ estimate }: { estimate: BudgetEstimate }) {
  const fmt = (cents: number) => {
    const whole = Math.round(cents / 100).toLocaleString();
    return `${estimate.currency} ${whole}`;
  };
  if (estimate.sampleSize === 0) {
    return (
      <section style={styles.panel}>
        <h3 style={styles.sectionTitle}>Budget estimate</h3>
        <p style={styles.muted}>
          Not enough trip history in this country yet. Log bookings on past trips to build the estimate.
        </p>
      </section>
    );
  }
  return (
    <section style={styles.panel}>
      <h3 style={styles.sectionTitle}>Budget estimate</h3>
      <div style={styles.metricsRow}>
        <MetricCard label="Per day" value={fmt(estimate.perDayCents)} />
        <MetricCard
          label="Total"
          value={estimate.totalCents > 0 ? fmt(estimate.totalCents) : '—'}
          highlight
        />
      </div>
      <p style={styles.muted}>
        Based on {estimate.sampleSize} past {estimate.sampleSize === 1 ? 'trip' : 'trips'} to the same country.
      </p>
    </section>
  );
}

function ActivitiesCard({ activities }: { activities: string[] }) {
  return (
    <section style={styles.panel}>
      <h3 style={styles.sectionTitle}>Recommended activities</h3>
      {activities.length === 0 ? (
        <p style={styles.muted}>No activity recommendations yet.</p>
      ) : (
        <ul style={styles.activityList}>
          {activities.map((a, idx) => (
            <li key={`${idx}-${a}`} style={styles.activityRow}>
              <span style={styles.activityBullet}>•</span>
              <span style={styles.activityText}>{a}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
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
    <div
      style={{
        ...styles.metricCard,
        ...(highlight ? styles.metricCardAccent : {}),
      }}
    >
      <span style={styles.metricLabel}>{label}</span>
      <span style={styles.metricValue}>{value}</span>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const styles: Record<string, CSSProperties> = {
  panel: {
    display: 'grid',
    gap: 10,
    padding: 18,
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
  },
  sectionTitle: {
    margin: 0,
    fontSize: 16,
    color: 'var(--text)',
  },
  muted: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.5,
    color: 'var(--text-secondary)',
  },
  segment: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    padding: 4,
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
    gap: 4,
  },
  segmentBtn: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '9px 0',
    borderRadius: 999,
    textDecoration: 'none',
  },
  segmentBtnActive: {
    background: 'rgba(14,165,233,0.22)',
  },
  segmentText: {
    color: 'var(--text-secondary)',
    fontSize: 13,
    fontWeight: 700,
  },
  segmentTextActive: {
    color: 'var(--text)',
  },
  chipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    padding: '8px 14px',
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    textDecoration: 'none',
  },
  chipActive: {
    background: 'rgba(14,165,233,0.18)',
    border: '1px solid rgba(14,165,233,0.48)',
  },
  chipText: {
    color: 'var(--text-secondary)',
    fontSize: 13,
    fontWeight: 600,
  },
  chipTextActive: {
    color: 'var(--text)',
  },
  monthRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  monthChip: {
    padding: '6px 10px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    minWidth: 48,
    textAlign: 'center',
  },
  monthChipActive: {
    background: 'rgba(14,165,233,0.22)',
    border: '1px solid rgba(14,165,233,0.52)',
  },
  monthText: {
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 700,
  },
  monthTextActive: {
    color: 'var(--text)',
  },
  metricsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 10,
  },
  metricCard: {
    display: 'grid',
    gap: 4,
    padding: 14,
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
  },
  metricCardAccent: {
    background: 'rgba(14,165,233,0.12)',
    border: '1px solid rgba(14,165,233,0.32)',
  },
  metricLabel: {
    color: 'var(--text-secondary)',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  metricValue: {
    color: 'var(--text)',
    fontSize: 18,
    fontWeight: 800,
  },
  list: {
    margin: 0,
    padding: 0,
    listStyle: 'none',
    display: 'grid',
    gap: 8,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '8px 0',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  rowMain: {
    flex: 1,
    display: 'grid',
    gap: 2,
  },
  rowTitle: {
    color: 'var(--text)',
    fontSize: 14,
    fontWeight: 600,
  },
  rowSub: {
    color: 'var(--text-secondary)',
    fontSize: 12,
  },
  rowValue: {
    color: 'var(--text)',
    fontSize: 13,
    fontWeight: 700,
  },
  reminderRow: {
    display: 'grid',
    gap: 4,
    padding: '8px 12px',
    borderRadius: 8,
    background: 'rgba(255,255,255,0.04)',
  },
  reminderSeverity: {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.08em',
  },
  reminderMessage: {
    color: 'var(--text)',
    fontSize: 13,
    lineHeight: 1.45,
  },
  activityList: {
    margin: 0,
    padding: 0,
    listStyle: 'none',
    display: 'grid',
    gap: 6,
  },
  activityRow: {
    display: 'flex',
    gap: 8,
  },
  activityBullet: {
    color: '#0EA5E9',
    fontSize: 14,
    fontWeight: 800,
    lineHeight: 1.45,
  },
  activityText: {
    flex: 1,
    color: 'var(--text)',
    fontSize: 13,
    lineHeight: 1.55,
  },
};
