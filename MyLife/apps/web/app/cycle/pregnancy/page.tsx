'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  doCompleteAppointment,
  doCreateAppointment,
  doCreatePregnancy,
  doDeleteAppointment,
  doEndPregnancy,
  doUpdateDueDate,
  fetchCyclePregnancyDashboard,
} from '../actions';
import {
  PHASE_COLORS,
  TOKENS,
  chipStyle,
  eyebrowStyle,
  ghostButtonStyle,
  gradientButtonStyle,
  inputStyle,
  panelStyle,
  subtitleStyle,
  textareaStyle,
  titleStyle,
} from '../ui';
import { formatMonthDayYear } from '../utils';

type PregnancyData = Awaited<ReturnType<typeof fetchCyclePregnancyDashboard>>;

const START_METHOD_OPTIONS = [
  { key: 'last_period', label: 'Last period' },
  { key: 'conception_date', label: 'Conception date' },
  { key: 'due_date', label: 'Known due date' },
  { key: 'transfer_date', label: 'IVF transfer' },
] as const;

const MILESTONES = [
  { week: 8, label: 'Heartbeat' },
  { week: 12, label: 'Placenta' },
  { week: 20, label: 'Anatomy scan' },
  { week: 28, label: 'Third trimester' },
  { week: 36, label: 'Full term near' },
  { week: 40, label: 'Due window' },
];

function AppointmentCard({
  appointment,
  onComplete,
  onDelete,
}: {
  appointment: NonNullable<PregnancyData>['appointments'][number];
  onComplete: () => void;
  onDelete: () => void;
}) {
  return (
    <div style={{ ...panelStyle('base'), padding: 18, opacity: appointment.completed ? 0.72 : 1 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 16,
          alignItems: 'flex-start',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 800 }}>{appointment.title}</h3>
          <p style={{ ...subtitleStyle, marginTop: 8 }}>
            {formatMonthDayYear(appointment.date)}
            {appointment.time ? ` at ${appointment.time}` : ''}
            {appointment.location ? ` • ${appointment.location}` : ''}
          </p>
          {appointment.notes ? (
            <p style={{ ...subtitleStyle, marginTop: 10 }}>{appointment.notes}</p>
          ) : null}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!appointment.completed ? (
            <button type="button" onClick={onComplete} style={ghostButtonStyle}>
              Mark complete
            </button>
          ) : (
            <span
              style={{
                padding: '9px 14px',
                borderRadius: 999,
                background: 'rgba(48,209,88,0.12)',
                color: TOKENS.success,
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              Done
            </span>
          )}
          <button
            type="button"
            onClick={onDelete}
            style={{ ...ghostButtonStyle, color: TOKENS.danger }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CyclePregnancyPage() {
  const [data, setData] = useState<PregnancyData>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [startMethod, setStartMethod] = useState<
    (typeof START_METHOD_OPTIONS)[number]['key']
  >('last_period');
  const [dateInput, setDateInput] = useState('');
  const [showSetup, setShowSetup] = useState(false);
  const [showDueDateEditor, setShowDueDateEditor] = useState(false);
  const [dueDateInput, setDueDateInput] = useState('');
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [appointmentTitle, setAppointmentTitle] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [appointmentLocation, setAppointmentLocation] = useState('');
  const [appointmentNotes, setAppointmentNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextData = await fetchCyclePregnancyDashboard();
      setData(nextData);
      setDueDateInput(nextData?.pregnancy.dueDate ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pregnancy mode');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const trimesterProgress = useMemo(() => {
    if (!data) return 0;
    return Math.min(100, Math.round((data.week / 40) * 100));
  }, [data]);

  const handleCreatePregnancy = useCallback(async () => {
    if (!dateInput) return;
    setBusy(true);
    setError(null);
    try {
      const payload: Parameters<typeof doCreatePregnancy>[0] = { startMethod };
      if (startMethod === 'last_period') payload.lastPeriodDate = dateInput;
      if (startMethod === 'conception_date') payload.conceptionDate = dateInput;
      if (startMethod === 'due_date') payload.dueDate = dateInput;
      if (startMethod === 'transfer_date') payload.transferDate = dateInput;
      await doCreatePregnancy(payload);
      setShowSetup(false);
      setDateInput('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start pregnancy mode');
    } finally {
      setBusy(false);
    }
  }, [dateInput, load, startMethod]);

  const handleSaveDueDate = useCallback(async () => {
    if (!data || !dueDateInput) return;
    setBusy(true);
    setError(null);
    try {
      await doUpdateDueDate(data.pregnancy.id, dueDateInput);
      setShowDueDateEditor(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update due date');
    } finally {
      setBusy(false);
    }
  }, [data, dueDateInput, load]);

  const handleEndPregnancy = useCallback(
    async (status: 'completed' | 'loss') => {
      if (!data) return;
      const confirmed = window.confirm(
        status === 'completed'
          ? 'End pregnancy tracking as completed?'
          : 'End pregnancy tracking as loss?',
      );
      if (!confirmed) return;
      setBusy(true);
      setError(null);
      try {
        await doEndPregnancy(data.pregnancy.id, status);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to end pregnancy');
      } finally {
        setBusy(false);
      }
    },
    [data, load],
  );

  const handleAddAppointment = useCallback(async () => {
    if (!data || !appointmentTitle || !appointmentDate) return;
    setBusy(true);
    setError(null);
    try {
      await doCreateAppointment({
        pregnancyId: data.pregnancy.id,
        title: appointmentTitle,
        date: appointmentDate,
        time: appointmentTime || undefined,
        location: appointmentLocation || undefined,
        notes: appointmentNotes || undefined,
      });
      setAppointmentTitle('');
      setAppointmentDate('');
      setAppointmentTime('');
      setAppointmentLocation('');
      setAppointmentNotes('');
      setShowAppointmentForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add appointment');
    } finally {
      setBusy(false);
    }
  }, [
    appointmentDate,
    appointmentLocation,
    appointmentNotes,
    appointmentTime,
    appointmentTitle,
    data,
    load,
  ]);

  const handleCompleteAppointment = useCallback(
    async (appointmentId: string) => {
      setBusy(true);
      setError(null);
      try {
        await doCompleteAppointment(appointmentId);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to complete appointment');
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  const handleDeleteAppointment = useCallback(
    async (appointmentId: string) => {
      if (!window.confirm('Delete this appointment?')) return;
      setBusy(true);
      setError(null);
      try {
        await doDeleteAppointment(appointmentId);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete appointment');
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  if (loading) {
    return (
      <div className="cy-section-stack">
        <div
          style={{
            ...panelStyle('mid'),
            minHeight: 220,
            opacity: 0.5,
            animation: 'pulse 2s infinite',
          }}
        />
        <div className="cy-grid-2">
          <div
            style={{
              ...panelStyle('low'),
              minHeight: 240,
              opacity: 0.45,
              animation: 'pulse 2s infinite',
            }}
          />
          <div
            style={{
              ...panelStyle('low'),
              minHeight: 240,
              opacity: 0.45,
              animation: 'pulse 2s infinite',
            }}
          />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ maxWidth: 760, margin: '0 auto', display: 'grid', gap: 24 }}>
        <section
          style={{
            ...panelStyle('mid'),
            padding: '52px 32px',
            textAlign: 'center',
            background:
              'radial-gradient(circle at center, rgba(244,114,182,0.18), transparent 38%), linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))',
          }}
        >
          <p style={{ ...eyebrowStyle, color: PHASE_COLORS.ovulation }}>
            Pregnancy Mode
          </p>
          <h1 style={{ ...titleStyle, marginTop: 12 }}>
            Track the pregnancy journey week by week
          </h1>
          <p style={{ ...subtitleStyle, maxWidth: 520, margin: '14px auto 0' }}>
            Switch from cycle forecasting to development milestones, due-date
            planning, and appointment tracking in one focused space.
          </p>
          <button
            type="button"
            onClick={() => setShowSetup((value) => !value)}
            style={{ ...gradientButtonStyle, marginTop: 28 }}
          >
            {showSetup ? 'Hide setup' : 'Enter Pregnancy Mode'}
          </button>
        </section>

        {error ? (
          <section style={{ ...panelStyle('low'), padding: 22 }}>
            <p style={{ color: TOKENS.danger, fontWeight: 700 }}>{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              style={{ ...ghostButtonStyle, marginTop: 14 }}
            >
              Retry
            </button>
          </section>
        ) : null}

        {showSetup ? (
          <section style={{ ...panelStyle('low'), padding: 22 }}>
            <h2
              style={{
                fontSize: 24,
                fontWeight: 800,
                letterSpacing: '-0.03em',
              }}
            >
              How should we calculate the due date?
            </h2>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
              {START_METHOD_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setStartMethod(option.key)}
                  style={chipStyle(startMethod === option.key, PHASE_COLORS.ovulation)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="cy-grid-2" style={{ marginTop: 18 }}>
              <input
                type="date"
                value={dateInput}
                onChange={(event) => setDateInput(event.target.value)}
                style={inputStyle}
              />
              <button
                type="button"
                disabled={busy || !dateInput}
                onClick={() => void handleCreatePregnancy()}
                style={gradientButtonStyle}
              >
                {busy ? 'Starting…' : 'Start tracking'}
              </button>
            </div>
          </section>
        ) : null}
      </div>
    );
  }

  return (
    <div className="cy-section-stack" style={{ maxWidth: 980, margin: '0 auto' }}>
      {error ? (
        <section style={{ ...panelStyle('low'), padding: 22 }}>
          <p style={{ color: TOKENS.danger, fontWeight: 700 }}>{error}</p>
        </section>
      ) : null}

      <section
        style={{
          ...panelStyle('mid'),
          padding: 28,
          background:
            'radial-gradient(circle at top center, rgba(244,114,182,0.18), transparent 36%), linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <p style={{ ...eyebrowStyle, color: PHASE_COLORS.ovulation }}>
            Current Status
          </p>
          <h1 style={{ ...titleStyle, fontSize: 80, marginTop: 12 }}>
            {data.display}
          </h1>
          <p style={{ ...subtitleStyle, marginTop: 8 }}>
            {data.trimester === 1
              ? 'First trimester'
              : data.trimester === 2
                ? 'Second trimester'
                : 'Third trimester'}
          </p>
        </div>

        <div style={{ marginTop: 28 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              color: TOKENS.textSecondary,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            <span>1st</span>
            <span style={{ color: PHASE_COLORS.ovulation }}>
              {data.trimester === 1
                ? 'First trimester'
                : data.trimester === 2
                  ? 'Second trimester'
                  : 'Third trimester'}
            </span>
            <span>3rd</span>
          </div>
          <div
            style={{
              height: 10,
              borderRadius: 999,
              background: 'rgba(255,255,255,0.05)',
              overflow: 'hidden',
              display: 'flex',
              marginTop: 12,
            }}
          >
            <div style={{ width: '33%', background: 'rgba(244,114,182,0.18)' }} />
            <div
              style={{
                width: `${Math.max(0, trimesterProgress - 33)}%`,
                background: PHASE_COLORS.ovulation,
                boxShadow: '0 0 18px rgba(244,114,182,0.4)',
              }}
            />
          </div>
        </div>

        <div className="cy-grid-3" style={{ marginTop: 24 }}>
          <div style={{ ...panelStyle('base'), padding: 18 }}>
            <p style={eyebrowStyle}>Due Date</p>
            <p style={{ fontSize: 24, fontWeight: 800, marginTop: 10 }}>
              {formatMonthDayYear(data.pregnancy.dueDate)}
            </p>
          </div>
          <div style={{ ...panelStyle('base'), padding: 18 }}>
            <p style={eyebrowStyle}>Countdown</p>
            <p
              style={{
                fontSize: 24,
                fontWeight: 800,
                marginTop: 10,
                color: PHASE_COLORS.ovulation,
              }}
            >
              {data.daysUntil >= 0
                ? `${data.daysUntil} days to go`
                : `${Math.abs(data.daysUntil)} days past due`}
            </p>
          </div>
          <div style={{ ...panelStyle('base'), padding: 18 }}>
            <p style={eyebrowStyle}>Current Size</p>
            <p style={{ fontSize: 24, fontWeight: 800, marginTop: 10 }}>
              {data.weekInfo.babySize}
            </p>
          </div>
        </div>
      </section>

      <div className="cy-grid-2">
        <section style={{ ...panelStyle('low'), padding: 24 }}>
          <p style={{ ...eyebrowStyle, color: PHASE_COLORS.ovulation }}>
            Weekly Development
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) 132px',
              gap: 20,
              alignItems: 'start',
              marginTop: 14,
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: 30,
                  fontWeight: 800,
                  letterSpacing: '-0.03em',
                }}
              >
                Size: {data.weekInfo.babySize}
              </h2>
              <p style={{ ...subtitleStyle, marginTop: 12 }}>
                About {data.weekInfo.babySizeCm} cm long.{' '}
                {data.weekInfo.developmentHighlight}.
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
                <span
                  style={{
                    ...chipStyle(true, 'rgba(244,114,182,0.18)'),
                    color: PHASE_COLORS.ovulation,
                  }}
                >
                  Week {data.week}
                </span>
                <span
                  style={{
                    ...chipStyle(true, 'rgba(255,255,255,0.05)'),
                    color: TOKENS.textSecondary,
                  }}
                >
                  Trimester {data.trimester}
                </span>
              </div>
            </div>
            <div
              style={{
                ...panelStyle('base'),
                aspectRatio: '3 / 4',
                display: 'grid',
                placeItems: 'center',
                fontSize: 18,
                fontWeight: 800,
                color: PHASE_COLORS.ovulation,
              }}
            >
              {data.weekInfo.babySize}
            </div>
          </div>

          <div
            className="cy-scroll-x"
            style={{ display: 'flex', gap: 12, marginTop: 22, paddingBottom: 4 }}
          >
            {MILESTONES.map((milestone) => {
              const state =
                data.week >= milestone.week
                  ? 'complete'
                  : milestone.week - data.week <= 4
                    ? 'upcoming'
                    : 'future';
              return (
                <div
                  key={milestone.week}
                  style={{
                    ...panelStyle('base'),
                    minWidth: 148,
                    padding: 16,
                    background:
                      state === 'complete'
                        ? 'rgba(244,114,182,0.16)'
                        : state === 'upcoming'
                          ? 'rgba(255,184,119,0.14)'
                          : undefined,
                  }}
                >
                  <p style={eyebrowStyle}>Week {milestone.week}</p>
                  <p style={{ fontSize: 16, fontWeight: 800, marginTop: 10 }}>
                    {milestone.label}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section style={{ ...panelStyle('low'), padding: 24 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <p style={eyebrowStyle}>Tracking Controls</p>
              <h2 style={{ fontSize: 24, fontWeight: 800, marginTop: 10 }}>
                Manage pregnancy mode
              </h2>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setShowDueDateEditor((value) => !value)}
                style={ghostButtonStyle}
              >
                Edit due date
              </button>
              <button
                type="button"
                onClick={() => void handleEndPregnancy('completed')}
                style={ghostButtonStyle}
              >
                Completed
              </button>
              <button
                type="button"
                onClick={() => void handleEndPregnancy('loss')}
                style={{ ...ghostButtonStyle, color: TOKENS.danger }}
              >
                Loss
              </button>
            </div>
          </div>

          {showDueDateEditor ? (
            <div style={{ ...panelStyle('base'), padding: 18, marginTop: 18 }}>
              <p style={eyebrowStyle}>Edit Due Date</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
                <input
                  type="date"
                  value={dueDateInput}
                  onChange={(event) => setDueDateInput(event.target.value)}
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={() => void handleSaveDueDate()}
                  disabled={busy || !dueDateInput}
                  style={gradientButtonStyle}
                >
                  {busy ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          ) : null}

          <div style={{ ...panelStyle('base'), padding: 18, marginTop: 18 }}>
            <p style={eyebrowStyle}>Method</p>
            <p style={{ fontSize: 22, fontWeight: 800, marginTop: 10 }}>
              {data.pregnancy.startMethod.replace(/_/g, ' ')}
            </p>
            <p style={{ ...subtitleStyle, marginTop: 8 }}>
              Started from{' '}
              {data.pregnancy.lastPeriodDate ??
                data.pregnancy.conceptionDate ??
                data.pregnancy.dueDate}
            </p>
          </div>
        </section>
      </div>

      <section style={{ ...panelStyle('low'), padding: 24 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <p style={eyebrowStyle}>Appointments</p>
            <h2 style={{ fontSize: 24, fontWeight: 800, marginTop: 10 }}>
              Upcoming visits
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setShowAppointmentForm((value) => !value)}
            style={gradientButtonStyle}
          >
            {showAppointmentForm ? 'Hide form' : 'Add visit'}
          </button>
        </div>

        {showAppointmentForm ? (
          <div className="cy-grid-2" style={{ marginTop: 18 }}>
            <input
              value={appointmentTitle}
              onChange={(event) => setAppointmentTitle(event.target.value)}
              placeholder="Appointment title"
              style={inputStyle}
            />
            <input
              type="date"
              value={appointmentDate}
              onChange={(event) => setAppointmentDate(event.target.value)}
              style={inputStyle}
            />
            <input
              type="time"
              value={appointmentTime}
              onChange={(event) => setAppointmentTime(event.target.value)}
              style={inputStyle}
            />
            <input
              value={appointmentLocation}
              onChange={(event) => setAppointmentLocation(event.target.value)}
              placeholder="Location"
              style={inputStyle}
            />
            <textarea
              value={appointmentNotes}
              onChange={(event) => setAppointmentNotes(event.target.value)}
              placeholder="Notes"
              style={{ ...textareaStyle, minHeight: 112, gridColumn: '1 / -1' }}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                gridColumn: '1 / -1',
              }}
            >
              <button
                type="button"
                onClick={() => setShowAppointmentForm(false)}
                style={ghostButtonStyle}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleAddAppointment()}
                disabled={busy || !appointmentTitle || !appointmentDate}
                style={gradientButtonStyle}
              >
                {busy ? 'Saving…' : 'Save visit'}
              </button>
            </div>
          </div>
        ) : null}

        <div style={{ display: 'grid', gap: 14, marginTop: 18 }}>
          {data.appointments.length === 0 ? (
            <div style={{ ...panelStyle('base'), padding: 18 }}>
              <p style={subtitleStyle}>
                No visits logged yet. Add ultrasounds, check-ins, labs, or
                classes here.
              </p>
            </div>
          ) : (
            data.appointments.map((appointment) => (
              <AppointmentCard
                key={appointment.id}
                appointment={appointment}
                onComplete={() => void handleCompleteAppointment(appointment.id)}
                onDelete={() => void handleDeleteAppointment(appointment.id)}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}
