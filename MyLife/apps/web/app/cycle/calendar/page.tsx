'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchCalendarMonthView } from '../actions';
import { PHASE_COLORS, TOKENS, eyebrowStyle, ghostButtonStyle, gradientButtonStyle, panelStyle, subtitleStyle, titleStyle } from '../ui';
import { FEELING_OPTIONS, formatFlowLabel, formatLongDate, formatPhaseLabel, formatSymptomLabel } from '../utils';

type CalendarData = Awaited<ReturnType<typeof fetchCalendarMonthView>>;

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function CycleCalendarPage() {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState({
    year: today.getUTCFullYear(),
    month: today.getUTCMonth(),
  });
  const [data, setData] = useState<CalendarData | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (year: number, month: number) => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchCalendarMonthView(year, month);
      setData(next);
      setSelectedDate((current) => {
        if (current && next.cells.some((cell) => cell.date === current)) {
          return current;
        }
        return next.today;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load calendar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(cursor.year, cursor.month);
  }, [cursor.month, cursor.year, load]);

  const selectedCell = data?.cells.find((cell) => cell.date === selectedDate) ?? null;

  if (loading) {
    return (
      <div className="cy-calendar-grid">
        <div style={{ ...panelStyle('mid'), minHeight: 640, opacity: 0.5, animation: 'pulse 2s infinite' }} />
        <div style={{ ...panelStyle('low'), minHeight: 420, opacity: 0.4, animation: 'pulse 2s infinite' }} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ ...panelStyle('mid'), padding: 36, maxWidth: 520, margin: '48px auto', textAlign: 'center' }}>
        <p style={{ color: TOKENS.danger, fontWeight: 700, marginBottom: 18 }}>{error ?? 'Failed to load calendar'}</p>
        <button type="button" onClick={() => void load(cursor.year, cursor.month)} style={ghostButtonStyle}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="cy-calendar-grid">
      <section className="cy-section-stack">
        <div
          style={{
            ...panelStyle('mid'),
            padding: 26,
            background:
              'radial-gradient(circle at top left, rgba(244,114,182,0.14), transparent 32%), linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <p style={eyebrowStyle}>Month View</p>
              <h1 style={{ ...titleStyle, marginTop: 10 }}>{data.monthLabel}</h1>
              <p style={{ ...subtitleStyle, marginTop: 10, maxWidth: 520 }}>
                Cycle phases, forecasted fertile days, and logged symptoms in a single month map.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setCursor((value) => value.month === 0 ? { year: value.year - 1, month: 11 } : { year: value.year, month: value.month - 1 })}
                style={ghostButtonStyle}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => setCursor((value) => value.month === 11 ? { year: value.year + 1, month: 0 } : { year: value.year, month: value.month + 1 })}
                style={ghostButtonStyle}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 10, marginTop: 22 }}>
            {WEEKDAYS.map((label) => (
              <div key={label} style={{ ...eyebrowStyle, color: TOKENS.textTertiary, textAlign: 'center' }}>
                {label}
              </div>
            ))}
            {data.cells.map((cell) => {
              const active = cell.date === selectedDate;
              const tone = cell.mark ? getMarkBackground(cell.mark, active) : active ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.03)';
              const color =
                cell.mark === 'menstrual'
                  ? '#FFF6F6'
                  : active
                    ? TOKENS.text
                    : cell.inMonth
                      ? TOKENS.text
                      : TOKENS.textTertiary;

              return (
                <button
                  key={cell.date}
                  type="button"
                  onClick={() => setSelectedDate(cell.date)}
                  style={{
                    minHeight: 88,
                    border: 'none',
                    borderRadius: 20,
                    padding: 12,
                    background: tone,
                    color,
                    textAlign: 'left',
                    cursor: 'pointer',
                    boxShadow: active ? `0 0 0 1px ${getMarkOutline(cell.mark)}` : 'none',
                    opacity: cell.inMonth ? 1 : 0.56,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 16, fontWeight: 800 }}>{cell.day}</span>
                    {cell.mark ? <span style={{ width: 10, height: 10, borderRadius: '50%', background: getMarkSolid(cell.mark), display: 'inline-block' }} /> : null}
                  </div>

                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 28 }}>
                    {cell.log ? (
                      <>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: TOKENS.accentLight }} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: TOKENS.textSecondary }}>Logged</span>
                      </>
                    ) : cell.mark === 'predicted' ? (
                      <span style={{ fontSize: 11, fontWeight: 700, color: TOKENS.textSecondary }}>Predicted</span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <aside className="cy-card-stack">
        <div style={{ ...panelStyle('low'), padding: 24 }}>
          <p style={eyebrowStyle}>Legend</p>
          <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
            <LegendRow color={PHASE_COLORS.menstrual} label="Period days" />
            <LegendRow color={PHASE_COLORS.ovulation} label="Fertile window" />
            <LegendRow color={TOKENS.accentLight} label="Predicted next period" />
            <LegendRow color={TOKENS.textSecondary} label="Logged notes or symptoms" />
          </div>
        </div>

        <div style={{ ...panelStyle('mid'), padding: 24 }}>
          <p style={eyebrowStyle}>{selectedCell?.date === data.today ? "Today's Focus" : 'Selected Day'}</p>
          <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', marginTop: 12 }}>
            {selectedCell ? formatLongDate(selectedCell.date) : 'Select a day'}
          </h2>

          {selectedCell ? (
            <>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
                {selectedCell.mark ? (
                  <Tag label={selectedCell.mark === 'predicted' ? 'Predicted' : formatPhaseLikeMark(selectedCell.mark)} color={getMarkSolid(selectedCell.mark)} />
                ) : null}
                {selectedCell.log?.flowLevel ? (
                  <Tag label={formatFlowLabel(selectedCell.log.flowLevel)} color={PHASE_COLORS.menstrual} />
                ) : null}
                {selectedCell.log?.overallFeeling ? (
                  <Tag
                    label={`${FEELING_OPTIONS.find((option) => option.value === selectedCell.log?.overallFeeling)?.emoji ?? '🙂'} Feeling`}
                    color={PHASE_COLORS.follicular}
                  />
                ) : null}
              </div>

              {selectedCell.log ? (
                <div style={{ display: 'grid', gap: 18, marginTop: 20 }}>
                  {selectedCell.log.journal ? (
                    <div>
                      <p style={eyebrowStyle}>Journal</p>
                      <p style={{ ...subtitleStyle, marginTop: 8 }}>{selectedCell.log.journal}</p>
                    </div>
                  ) : null}

                  {selectedCell.log.symptoms.length > 0 ? (
                    <div>
                      <p style={eyebrowStyle}>Logged Symptoms</p>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                        {selectedCell.log.symptoms.map((symptom) => (
                          <Tag
                            key={symptom.id}
                            label={formatSymptomLabel(symptom.symptom)}
                            color={symptom.category === 'mood' ? PHASE_COLORS.follicular : PHASE_COLORS.luteal}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {!selectedCell.log.journal && selectedCell.log.symptoms.length === 0 ? (
                    <p style={subtitleStyle}>This day has a log entry but no notes or symptoms yet.</p>
                  ) : null}
                </div>
              ) : (
                <div style={{ marginTop: 20 }}>
                  <p style={subtitleStyle}>
                    No entry logged for this day yet. Capture flow, symptoms, and overall feeling to keep your cycle view sharp.
                  </p>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 24 }}>
                <Link href={`/cycle/log?date=${selectedCell.date}`} style={{ ...gradientButtonStyle, textDecoration: 'none' }}>
                  {selectedCell.log ? 'Edit entry' : 'Log this day'}
                </Link>
                <Link href="/cycle/history" style={{ ...ghostButtonStyle, textDecoration: 'none' }}>
                  Open history
                </Link>
              </div>
            </>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ width: 12, height: 12, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ color: TOKENS.textSecondary, fontSize: 14 }}>{label}</span>
    </div>
  );
}

function Tag({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        borderRadius: 999,
        background: `${color}20`,
        color,
        padding: '8px 12px',
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {label}
    </span>
  );
}

function formatPhaseLikeMark(mark: 'menstrual' | 'fertile' | 'ovulation' | 'predicted') {
  if (mark === 'fertile') return 'Fertile';
  if (mark === 'predicted') return 'Predicted';
  return formatPhaseLabel(mark);
}

function getMarkBackground(mark: 'menstrual' | 'fertile' | 'ovulation' | 'predicted', active: boolean) {
  if (mark === 'menstrual') {
    return active ? 'linear-gradient(180deg, rgba(239,68,68,0.65), rgba(239,68,68,0.45))' : 'rgba(239,68,68,0.36)';
  }
  if (mark === 'fertile') {
    return active ? 'linear-gradient(180deg, rgba(244,114,182,0.28), rgba(244,114,182,0.18))' : 'rgba(244,114,182,0.12)';
  }
  if (mark === 'ovulation') {
    return active ? 'linear-gradient(180deg, rgba(255,184,119,0.34), rgba(244,114,182,0.18))' : 'rgba(255,184,119,0.12)';
  }
  return active ? 'linear-gradient(180deg, rgba(201,137,77,0.24), rgba(201,137,77,0.14))' : 'rgba(201,137,77,0.10)';
}

function getMarkSolid(mark: 'menstrual' | 'fertile' | 'ovulation' | 'predicted') {
  if (mark === 'menstrual') return PHASE_COLORS.menstrual;
  if (mark === 'fertile') return PHASE_COLORS.ovulation;
  if (mark === 'ovulation') return TOKENS.accentLight;
  return TOKENS.accent;
}

function getMarkOutline(mark: 'menstrual' | 'fertile' | 'ovulation' | 'predicted' | null) {
  if (!mark) return 'rgba(255,255,255,0.06)';
  return `${getMarkSolid(mark)}55`;
}
