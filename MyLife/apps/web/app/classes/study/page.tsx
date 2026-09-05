import { loadStudyView } from '../data';
import {
  BORDER,
  CLASSES_ACCENT,
  CLASSES_ACCENT_BORDER,
  CLASSES_ACCENT_DIM,
  ClassesSection,
  SURFACE,
  SURFACE_ELEVATED,
  TEXT,
  TEXT_SECONDARY,
  TEXT_TERTIARY,
} from '../ui';
import { StudyTimer } from '@/components/classes/StudyTimer';

function relativeTimeFrom(iso: string, now: Date = new Date()): string {
  const t = new Date(iso).getTime();
  const diffMs = now.getTime() - t;
  if (Number.isNaN(diffMs)) return '';
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function renderStars(rating: number | null): string {
  if (rating === null) return '—';
  const r = Math.max(0, Math.min(5, rating));
  return '★'.repeat(r) + '☆'.repeat(5 - r);
}

export default function ClassesStudyPage() {
  const view = loadStudyView();
  const { classes, weeklySummary, recentSessions, settings } = view;

  const classMap = new Map(classes.map((c) => [c.id, c]));
  const topClassHours = weeklySummary.by_class.slice(0, 4);
  const maxHours = topClassHours.reduce((m, c) => Math.max(m, c.hours), 0);

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <header style={{ display: 'grid', gap: 6 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.8,
            textTransform: 'uppercase',
            color: CLASSES_ACCENT,
          }}
        >
          MyClasses
        </span>
        <h1 style={{ margin: 0, fontSize: 32, color: TEXT }}>Study</h1>
        <p style={{ margin: 0, color: TEXT_SECONDARY, fontSize: 14 }}>
          Focus blocks log automatically when a Pomodoro work phase ends. Pick
          a class or run an unattached session.
        </p>
      </header>

      <StudyTimer
        settings={settings}
        classes={classes.map((c) => ({
          id: c.id,
          name: c.name,
          color: c.color ?? null,
        }))}
      />

      <ClassesSection title="This week">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 12,
          }}
        >
          <SummaryCell label="Hours" value={weeklySummary.total_hours.toFixed(1)} />
          <SummaryCell label="Days" value={String(weeklySummary.study_days)} />
          <SummaryCell label="Streak" value={`${weeklySummary.streak}d`} />
          <SummaryCell
            label="Productivity"
            value={
              weeklySummary.avg_productivity === null
                ? '—'
                : renderStars(Math.round(weeklySummary.avg_productivity))
            }
          />
        </div>

        {topClassHours.length > 0 ? (
          <div
            style={{
              display: 'grid',
              gap: 8,
              padding: 18,
              borderRadius: 16,
              border: `1px solid ${BORDER}`,
              background: SURFACE,
            }}
          >
            {topClassHours.map((row) => {
              const cls = row.class_id ? classMap.get(row.class_id) : null;
              const name = cls?.name ?? 'Unattached';
              const color = cls?.color ?? CLASSES_ACCENT;
              const pct = maxHours > 0 ? (row.hours / maxHours) * 100 : 0;
              return (
                <div
                  key={row.class_id ?? 'unattached'}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '120px 1fr 60px',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <span
                    style={{
                      color: TEXT_SECONDARY,
                      fontSize: 12,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {name}
                  </span>
                  <div
                    style={{
                      height: 6,
                      borderRadius: 999,
                      background: SURFACE_ELEVATED,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: color,
                      }}
                    />
                  </div>
                  <span
                    style={{
                      color: TEXT_SECONDARY,
                      fontSize: 12,
                      textAlign: 'right',
                    }}
                  >
                    {row.hours.toFixed(1)}h
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ color: TEXT_TERTIARY, fontSize: 13 }}>
            No study sessions logged yet this week.
          </div>
        )}
      </ClassesSection>

      <ClassesSection title="Recent sessions">
        {recentSessions.length === 0 ? (
          <div style={{ color: TEXT_TERTIARY, fontSize: 13 }}>
            No sessions in the last 7 days.
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gap: 0,
              borderRadius: 16,
              border: `1px solid ${BORDER}`,
              background: SURFACE,
              overflow: 'hidden',
            }}
          >
            {recentSessions.map((s, i) => {
              const cls = s.class_id ? classMap.get(s.class_id) : null;
              const name = cls?.name ?? 'Unattached';
              const color = cls?.color ?? CLASSES_ACCENT;
              return (
                <div
                  key={s.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '4px 1fr auto',
                    gap: 12,
                    padding: 14,
                    alignItems: 'center',
                    borderTop: i === 0 ? 'none' : `1px solid ${BORDER}`,
                  }}
                >
                  <div
                    style={{
                      width: 4,
                      height: 36,
                      borderRadius: 999,
                      background: color,
                    }}
                  />
                  <div style={{ display: 'grid', gap: 2 }}>
                    <div style={{ color: TEXT, fontWeight: 600, fontSize: 14 }}>
                      {name}
                    </div>
                    <div style={{ color: TEXT_SECONDARY, fontSize: 12 }}>
                      {s.duration_minutes}m · {s.location ?? 'No location'} ·{' '}
                      {renderStars(s.productivity_rating)}
                    </div>
                  </div>
                  <div style={{ color: TEXT_TERTIARY, fontSize: 12 }}>
                    {relativeTimeFrom(s.started_at)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ClassesSection>
    </div>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        borderRadius: 14,
        border: `1px solid ${BORDER}`,
        background: SURFACE_ELEVATED,
        padding: 14,
        display: 'grid',
        gap: 6,
      }}
    >
      <div style={{ color: TEXT_SECONDARY, fontSize: 12 }}>{label}</div>
      <div style={{ color: CLASSES_ACCENT, fontSize: 18, fontWeight: 700 }}>
        {value}
      </div>
    </div>
  );
}
