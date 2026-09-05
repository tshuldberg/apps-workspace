'use client';

import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  PresenceCard,
  PresenceEmptyState,
  PresenceSectionHeading,
  MaterialSymbol,
  TOKENS,
  chipStyle,
  gradientButtonStyle,
  inputStyle,
  modalBackdropStyle,
  modalCardStyle,
} from '../ui';
import {
  doCreateScheduled,
  doDeleteScheduled,
  doToggleScheduled,
  doUpdateScheduled,
  fetchScheduledSnapshot,
} from '../actions';

type SessionType = 'solo' | 'group' | 'beast';

interface AppLibraryEntry {
  appId: string;
  name: string;
}

interface ScheduledSession {
  id: string;
  name: string;
  startTime: string;
  durationMinutes: number;
  daysOfWeek: number[];
  whitelist: string[];
  sessionType: SessionType;
  active: boolean;
}

interface ScheduledSnapshot {
  scheduled: ScheduledSession[];
  upcoming: Array<{ scheduled: ScheduledSession; datetime: string }>;
  appLibrary: AppLibraryEntry[];
}

const DAY_OPTIONS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function ScheduledPage() {
  const [data, setData] = useState<ScheduledSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduledSession | null>(null);
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [duration, setDuration] = useState('25');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]);
  const [sessionType, setSessionType] = useState<SessionType>('solo');
  const [whitelist, setWhitelist] = useState<string[]>([]);

  async function loadData() {
    try {
      setError(null);
      setData((await fetchScheduledSnapshot()) as ScheduledSnapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scheduled sessions.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const upcoming = data?.upcoming[0] ?? null;

  function openCreateModal() {
    setEditing(null);
    setName('');
    setStartTime('08:00');
    setDuration('25');
    setDaysOfWeek([1, 2, 3, 4, 5]);
    setSessionType('solo');
    setWhitelist([]);
    setModalOpen(true);
  }

  function openEditModal(session: ScheduledSession) {
    setEditing(session);
    setName(session.name);
    setStartTime(session.startTime);
    setDuration(String(session.durationMinutes));
    setDaysOfWeek(session.daysOfWeek);
    setSessionType(session.sessionType);
    setWhitelist(session.whitelist);
    setModalOpen(true);
  }

  const whitelistApps = useMemo(
    () => data?.appLibrary.filter((app) => whitelist.includes(app.appId)) ?? [],
    [data, whitelist],
  );

  async function saveSchedule() {
    try {
      const payload = {
        name,
        startTime,
        durationMinutes: Number(duration),
        daysOfWeek,
        whitelist,
        sessionType,
      };
      if (editing) {
        await doUpdateScheduled(editing.id, payload);
      } else {
        await doCreateScheduled(payload);
      }
      setModalOpen(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the scheduled session.');
    }
  }

  if (loading) {
    return <PresenceCard style={{ minHeight: 240 }} />;
  }

  if (error && data == null) {
    return (
      <PresenceEmptyState
        icon="warning"
        title="Scheduled sessions unavailable"
        body={error}
      />
    );
  }

  return (
    <div className="pr-main-stack">
      <PresenceCard>
        <PresenceSectionHeading
          title="Scheduled Sessions"
          subtitle="Recurring focus blocks you want Presence to put on autopilot."
          action={(
            <button type="button" onClick={openCreateModal} style={gradientButtonStyle}>
              Add Schedule
            </button>
          )}
        />
      </PresenceCard>

      <div className="pr-grid-2">
        <PresenceCard>
          <PresenceSectionHeading title="Up Next" subtitle="The next scheduled focus block in your current local calendar." />
          {upcoming ? (
            <div style={{ marginTop: 16, padding: 22, borderRadius: 24, background: 'rgba(34,211,238,0.08)', border: `1.5px solid ${TOKENS.borderStrong}` }}>
              <div style={{ color: TOKENS.accentLight, fontSize: 11, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
                {new Date(upcoming.datetime).toLocaleString('en-US', { weekday: 'long', hour: 'numeric', minute: '2-digit' })}
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', marginTop: 10 }}>{upcoming.scheduled.name}</div>
              <div style={{ color: TOKENS.textSecondary, fontSize: 14, lineHeight: 1.7, marginTop: 10 }}>
                {upcoming.scheduled.durationMinutes} minutes · {upcoming.scheduled.sessionType} mode · {upcoming.scheduled.daysOfWeek.map((day) => DAY_OPTIONS[day]).join(', ')}
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 16 }}>
              <PresenceEmptyState
                icon="schedule"
                title="Nothing scheduled"
                body="Add a recurring block so Presence knows when to nudge you into a session."
              />
            </div>
          )}
        </PresenceCard>

        <PresenceCard>
          <PresenceSectionHeading title="Whitelisted Apps" subtitle="Apps you allow inside a scheduled focus block." />
          {whitelistApps.length === 0 ? (
            <p style={emptyCopyStyle}>No whitelist selected in the draft schedule.</p>
          ) : (
            <div className="pr-chip-row" style={{ marginTop: 16 }}>
              {whitelistApps.map((app) => (
                <span key={app.appId} style={{ ...chipStyle(true), display: 'inline-flex' }}>{app.name}</span>
              ))}
            </div>
          )}
        </PresenceCard>
      </div>

      {data?.scheduled.length === 0 ? (
        <PresenceEmptyState
          icon="schedule"
          title="No scheduled sessions yet"
          body="Create a recurring solo, group, or beast-mode block and Presence will surface it here."
        />
      ) : (
        <PresenceCard>
          <PresenceSectionHeading title="Scheduled List" subtitle="Every recurring session, including inactive ones you might want to revive later." />
          <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
            {data?.scheduled.map((session) => (
              <div key={session.id} style={{ padding: 18, borderRadius: 24, background: 'rgba(255,255,255,0.04)', border: `1.5px solid ${session.active ? TOKENS.borderStrong : TOKENS.border}`, display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{session.name}</div>
                    <div style={{ color: TOKENS.textSecondary, fontSize: 13, marginTop: 8 }}>
                      {session.startTime} · {session.durationMinutes} minutes · {session.sessionType}
                    </div>
                    <div style={microCopyStyle}>{session.daysOfWeek.map((day) => DAY_OPTIONS[day]).join(', ')}</div>
                  </div>
                  <div style={{ color: session.active ? TOKENS.success : TOKENS.textTertiary, fontSize: 12, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                    {session.active ? 'Active' : 'Paused'}
                  </div>
                </div>
                <div className="pr-chip-row">
                  <button type="button" onClick={() => openEditModal(session)} style={chipStyle(false)}>
                    Edit
                  </button>
                  <button type="button" onClick={() => void doToggleScheduled(session.id, !session.active).then(loadData)} style={chipStyle(session.active)}>
                    {session.active ? 'Pause' : 'Resume'}
                  </button>
                  <button type="button" onClick={() => void doDeleteScheduled(session.id).then(loadData)} style={{ ...chipStyle(false), color: TOKENS.danger }}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </PresenceCard>
      )}

      {modalOpen ? (
        <div style={modalBackdropStyle} onClick={() => setModalOpen(false)}>
          <div style={modalCardStyle} onClick={(event) => event.stopPropagation()}>
            <PresenceSectionHeading title={editing ? 'Edit schedule' : 'Add schedule'} subtitle="Choose a recurring time, cadence, session type, and optional whitelist." />

            <div className="pr-form-grid" style={{ marginTop: 18 }}>
              <label style={fieldStyle}>
                <span style={sectionLabelStyle}>Name</span>
                <input value={name} onChange={(event) => setName(event.target.value)} style={inputStyle} />
              </label>

              <div className="pr-grid-2">
                <label style={fieldStyle}>
                  <span style={sectionLabelStyle}>Time</span>
                  <input value={startTime} onChange={(event) => setStartTime(event.target.value)} style={inputStyle} />
                </label>
                <label style={fieldStyle}>
                  <span style={sectionLabelStyle}>Duration minutes</span>
                  <input value={duration} onChange={(event) => setDuration(event.target.value)} style={inputStyle} inputMode="numeric" />
                </label>
              </div>

              <div>
                <span style={sectionLabelStyle}>Days of week</span>
                <div className="pr-chip-row" style={{ marginTop: 10 }}>
                  {DAY_OPTIONS.map((label, index) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setDaysOfWeek((current) => current.includes(index) ? current.filter((item) => item !== index) : [...current, index].sort())}
                      style={chipStyle(daysOfWeek.includes(index))}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span style={sectionLabelStyle}>Session type</span>
                <div className="pr-chip-row" style={{ marginTop: 10 }}>
                  {(['solo', 'group', 'beast'] as SessionType[]).map((type) => (
                    <button key={type} type="button" onClick={() => setSessionType(type)} style={chipStyle(sessionType === type)}>
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span style={sectionLabelStyle}>Whitelist</span>
                <div className="pr-chip-row" style={{ marginTop: 10 }}>
                  {data?.appLibrary.map((app) => {
                    const selected = whitelist.includes(app.appId);
                    return (
                      <button
                        key={app.appId}
                        type="button"
                        onClick={() => setWhitelist((current) => selected ? current.filter((item) => item !== app.appId) : [...current, app.appId])}
                        style={chipStyle(selected)}
                      >
                        {app.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pr-chip-row" style={{ justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setModalOpen(false)} style={chipStyle(false)}>
                  Cancel
                </button>
                <button type="button" onClick={() => void saveSchedule()} style={gradientButtonStyle}>
                  Save schedule
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const fieldStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
};

const sectionLabelStyle: CSSProperties = {
  color: TOKENS.textTertiary,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
};

const microCopyStyle: CSSProperties = {
  color: TOKENS.textTertiary,
  fontSize: 12,
  lineHeight: 1.5,
};

const emptyCopyStyle: CSSProperties = {
  margin: '16px 0 0',
  color: TOKENS.textSecondary,
  fontSize: 14,
  lineHeight: 1.7,
};
