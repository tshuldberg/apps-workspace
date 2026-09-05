'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  Event,
  EventLink,
  Poll,
  PollOption,
  PollVote,
  Rsvp,
  RsvpResponse,
  LinkType,
} from '@mylife/rsvp';
import {
  doAddCohost,
  doAddInvite,
  doAddLink,
  doAddPhoto,
  doApproveInvite,
  doCheckInRsvp,
  doCreateAnnouncement,
  doCreateComment,
  doCreateEvent,
  doCreatePoll,
  doCreateQuestion,
  doRecordRsvp,
  doSaveQuestionResponse,
  doVotePollOption,
  doWaitlistInvite,
  exportAttendanceCsvAction,
  fetchEventBundle,
  fetchEvents,
  fetchPollVotes,
} from './actions';

/* ── constants ──────────────────────────────────────── */

const ACCENT = 'var(--accent-rsvp)';
const ACCENT_DIM = 'color-mix(in srgb, var(--accent-rsvp) 15%, transparent)';
const SURFACE = 'var(--surface)';
const SURFACE_EL = 'var(--surface-elevated)';
const BORDER = 'var(--border)';
const GLASS = 'var(--glass)';
const GLASS_BORDER = 'var(--glass-border)';
const TEXT = 'var(--text)';
const TEXT_SEC = 'var(--text-secondary)';
const TEXT_TER = 'var(--text-tertiary)';

const RSVP_OPTIONS: RsvpResponse[] = ['going', 'maybe', 'declined', 'waitlisted'];
const LINK_TYPES: LinkType[] = ['chip_in', 'registry', 'playlist', 'other'];

type EventBundle = Awaited<ReturnType<typeof fetchEventBundle>>;
type Tab = 'guests' | 'rsvps' | 'polls' | 'feed';

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function isPast(event: Event): boolean {
  return new Date(event.startAt) < new Date();
}

/* ── page ───────────────────────────────────────────── */

export default function RsvpPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [bundle, setBundle] = useState<EventBundle | null>(null);
  const [bundleLoading, setBundleLoading] = useState(false);
  const [pollVotesById, setPollVotesById] = useState<Record<string, PollVote[]>>({});
  const [activeTab, setActiveTab] = useState<Tab>('guests');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [eventFilter, setEventFilter] = useState<'upcoming' | 'past'>('upcoming');

  // Create event form
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('19:00');
  const [eventLocation, setEventLocation] = useState('');

  // Guest controls
  const [cohostName, setCohostName] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteContact, setInviteContact] = useState('');
  const [plusOneLimit, setPlusOneLimit] = useState('0');

  // RSVP
  const [rsvpGuestName, setRsvpGuestName] = useState('');
  const [rsvpChoice, setRsvpChoice] = useState<RsvpResponse>('going');
  const [rsvpPlusOnes, setRsvpPlusOnes] = useState('0');

  // Polls
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptionA, setPollOptionA] = useState('');
  const [pollOptionB, setPollOptionB] = useState('');

  // Feed
  const [announcementMessage, setAnnouncementMessage] = useState('');
  const [commentAuthor, setCommentAuthor] = useState('Host');
  const [commentMessage, setCommentMessage] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [linkType, setLinkType] = useState<LinkType>('chip_in');
  const [linkLabel, setLinkLabel] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  // Question
  const [questionLabel, setQuestionLabel] = useState('');
  const [questionAnswer, setQuestionAnswer] = useState('');

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  const upcomingEvents = useMemo(() => events.filter((e) => !isPast(e)), [events]);
  const pastEvents = useMemo(() => events.filter(isPast), [events]);
  const filteredEvents = eventFilter === 'upcoming' ? upcomingEvents : pastEvents;

  /* ── data loading ──────────────────────────────── */

  const loadEvents = useCallback(async () => {
    try {
      const result = await fetchEvents();
      setEvents(result);
      setError(null);
    } catch {
      setError('Failed to load events');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBundle = useCallback(async (eventId: string) => {
    setBundleLoading(true);
    try {
      const nextBundle = await fetchEventBundle(eventId);
      setBundle(nextBundle);

      const votesEntries = await Promise.all(
        nextBundle.polls.map(async (poll) => [poll.id, await fetchPollVotes(poll.id)] as const),
      );
      setPollVotesById(Object.fromEntries(votesEntries));
    } catch {
      setBundle(null);
    } finally {
      setBundleLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    if (events.length === 0) {
      if (selectedEventId !== null) setSelectedEventId(null);
      return;
    }
    if (!selectedEventId || !events.some((e) => e.id === selectedEventId)) {
      setSelectedEventId(events[0].id);
    }
  }, [events, selectedEventId]);

  useEffect(() => {
    if (!selectedEventId) {
      setBundle(null);
      setPollVotesById({});
      return;
    }
    void loadBundle(selectedEventId);
  }, [loadBundle, selectedEventId]);

  /* ── handlers ──────────────────────────────────── */

  const createEventHandler = async () => {
    const title = eventTitle.trim();
    if (!title) return;

    const startAt = eventDate && eventTime
      ? new Date(`${eventDate}T${eventTime}`).toISOString()
      : new Date(Date.now() + 86400000).toISOString();

    const eventId = makeId();
    await doCreateEvent(eventId, {
      title,
      startAt,
      locationName: eventLocation.trim() || undefined,
    });

    setEventTitle('');
    setEventDate('');
    setEventTime('19:00');
    setEventLocation('');
    setShowCreateForm(false);
    setEventFilter('upcoming');
    await loadEvents();
    setSelectedEventId(eventId);
  };

  const addCohostHandler = async () => {
    if (!selectedEvent) return;
    const name = cohostName.trim();
    if (!name) return;
    await doAddCohost(makeId(), selectedEvent.id, name);
    setCohostName('');
    await loadBundle(selectedEvent.id);
  };

  const addInviteHandler = async () => {
    if (!selectedEvent) return;
    const name = inviteName.trim();
    if (!name) return;
    await doAddInvite(makeId(), selectedEvent.id, {
      inviteeName: name,
      inviteeContact: inviteContact.trim() || undefined,
      plusOneLimit: Math.max(0, Number(plusOneLimit) || 0),
    });
    setInviteName('');
    setInviteContact('');
    setPlusOneLimit('0');
    await loadBundle(selectedEvent.id);
  };

  const addRsvpHandler = async () => {
    if (!selectedEvent || !bundle) return;
    const guestName = rsvpGuestName.trim();
    if (!guestName) return;
    const invite = bundle.invites.find(
      (row) => row.inviteeName.toLowerCase() === guestName.toLowerCase(),
    );
    await doRecordRsvp(makeId(), selectedEvent.id, {
      inviteId: invite?.id,
      guestName,
      guestContact: invite?.inviteeContact ?? undefined,
      response: rsvpChoice,
      plusOnesCount: Math.max(0, Number(rsvpPlusOnes) || 0),
    });
    setRsvpGuestName('');
    setRsvpPlusOnes('0');
    await loadBundle(selectedEvent.id);
  };

  const addQuestionHandler = async () => {
    if (!selectedEvent || !bundle) return;
    const label = questionLabel.trim();
    if (!label) return;
    const questionId = makeId();
    await doCreateQuestion(questionId, selectedEvent.id, { label });
    if (questionAnswer.trim() && bundle.rsvps[0]) {
      await doSaveQuestionResponse(
        makeId(),
        selectedEvent.id,
        bundle.rsvps[0].id,
        questionId,
        questionAnswer.trim(),
      );
    }
    setQuestionLabel('');
    setQuestionAnswer('');
    await loadBundle(selectedEvent.id);
  };

  const addPollHandler = async () => {
    if (!selectedEvent) return;
    const question = pollQuestion.trim();
    const optA = pollOptionA.trim();
    const optB = pollOptionB.trim();
    if (!question || !optA || !optB) return;
    const options: PollOption[] = [
      { id: makeId(), label: optA },
      { id: makeId(), label: optB },
    ];
    await doCreatePoll(makeId(), selectedEvent.id, { question, options });
    setPollQuestion('');
    setPollOptionA('');
    setPollOptionB('');
    await loadBundle(selectedEvent.id);
  };

  const addAnnouncementHandler = async () => {
    if (!selectedEvent) return;
    const message = announcementMessage.trim();
    if (!message) return;
    await doCreateAnnouncement(makeId(), selectedEvent.id, message);
    setAnnouncementMessage('');
    await loadBundle(selectedEvent.id);
  };

  const addCommentHandler = async () => {
    if (!selectedEvent || !bundle) return;
    const message = commentMessage.trim();
    if (!message) return;
    await doCreateComment(makeId(), selectedEvent.id, {
      guestName: commentAuthor.trim() || 'Guest',
      message,
      rsvpId: bundle.rsvps[0]?.id,
    });
    setCommentMessage('');
    await loadBundle(selectedEvent.id);
  };

  const addPhotoHandler = async () => {
    if (!selectedEvent || !bundle) return;
    const url = photoUrl.trim();
    if (!url) return;
    await doAddPhoto(makeId(), selectedEvent.id, {
      guestName: commentAuthor.trim() || 'Guest',
      photoUrl: url,
      rsvpId: bundle.rsvps[0]?.id,
    });
    setPhotoUrl('');
    await loadBundle(selectedEvent.id);
  };

  const addLinkHandler = async () => {
    if (!selectedEvent) return;
    const label = linkLabel.trim();
    const url = linkUrl.trim();
    if (!label || !url) return;
    await doAddLink(makeId(), selectedEvent.id, { type: linkType, label, url });
    setLinkLabel('');
    setLinkUrl('');
    await loadBundle(selectedEvent.id);
  };

  const exportCsv = async () => {
    if (!selectedEvent) return;
    const csv = await exportAttendanceCsvAction(selectedEvent.id);
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${selectedEvent.title.replace(/\s+/g, '-')}-attendance.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  /* ── loading state ─────────────────────────────── */

  if (loading) {
    return (
      <div style={s.twoCol}>
        <div style={s.sidebar}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={s.skeleton} />
          ))}
        </div>
        <div style={s.main}>
          <div style={{ ...s.skeleton, height: 120 }} />
          <div style={{ ...s.skeleton, height: 200 }} />
        </div>
      </div>
    );
  }

  /* ── error state ───────────────────────────────── */

  if (error) {
    return (
      <div style={s.centerCard}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
        <h2 style={{ margin: 0, color: TEXT }}>Something went wrong</h2>
        <p style={{ color: TEXT_SEC, margin: '8px 0 16px' }}>{error}</p>
        <button style={s.btnPrimary} onClick={() => { setError(null); setLoading(true); void loadEvents(); }}>
          Try Again
        </button>
      </div>
    );
  }

  /* ── empty state ───────────────────────────────── */

  if (events.length === 0 && !showCreateForm) {
    return (
      <div style={s.centerCard}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>💌</div>
        <h2 style={{ margin: 0, fontSize: 24, color: TEXT }}>Your event planner is ready</h2>
        <p style={{ color: TEXT_SEC, margin: '8px 0 20px', maxWidth: 400, textAlign: 'center' as const }}>
          Create your first event to start managing invites, RSVPs, polls, and guest check-in.
        </p>
        <button style={s.btnPrimary} onClick={() => setShowCreateForm(true)}>
          Create Your First Event
        </button>
      </div>
    );
  }

  /* ── main layout: two-column ───────────────────── */

  return (
    <div style={s.twoCol}>
      {/* ── LEFT: Event Sidebar ──────────────────── */}
      <aside style={s.sidebar}>
        <button style={s.btnPrimary} onClick={() => setShowCreateForm(!showCreateForm)}>
          + New Event
        </button>

        {showCreateForm && (
          <div style={s.card}>
            <h3 style={s.cardTitle}>Create Event</h3>
            <div style={s.formStack}>
              <input style={s.input} value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} placeholder="Event name" />
              <input style={s.input} type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
              <input style={s.input} type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} />
              <input style={s.input} value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} placeholder="Location" />
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={s.btnPrimary} onClick={() => void createEventHandler()}>Create</button>
                <button style={s.btnGhost} onClick={() => setShowCreateForm(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div style={s.filterRow}>
          <button
            style={eventFilter === 'upcoming' ? s.filterActive : s.filterBtn}
            onClick={() => setEventFilter('upcoming')}
          >
            Upcoming ({upcomingEvents.length})
          </button>
          <button
            style={eventFilter === 'past' ? s.filterActive : s.filterBtn}
            onClick={() => setEventFilter('past')}
          >
            Past ({pastEvents.length})
          </button>
        </div>

        {/* Event list */}
        <div style={s.eventList}>
          {filteredEvents.length === 0 && (
            <p style={{ color: TEXT_TER, fontSize: 13, padding: '8px 0' }}>
              No {eventFilter} events
            </p>
          )}
          {filteredEvents.map((event) => {
            const active = event.id === selectedEventId;
            return (
              <button
                key={event.id}
                onClick={() => setSelectedEventId(event.id)}
                style={active ? s.eventCardActive : s.eventCard}
              >
                <div style={{ fontWeight: 600, fontSize: 14, color: TEXT }}>{event.title}</div>
                <div style={{ fontSize: 12, color: TEXT_SEC, marginTop: 2 }}>
                  {formatDate(event.startAt)}
                </div>
                {event.locationName && (
                  <div style={{ fontSize: 12, color: TEXT_TER, marginTop: 2 }}>
                    📍 {event.locationName}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </aside>

      {/* ── RIGHT: Event Detail ──────────────────── */}
      <div style={s.main}>
        {!selectedEvent ? (
          <div style={s.centerCard}>
            <p style={{ color: TEXT_SEC }}>Select an event to view details</p>
          </div>
        ) : bundleLoading && !bundle ? (
          <div style={s.main}>
            <div style={{ ...s.skeleton, height: 100 }} />
            <div style={{ ...s.skeleton, height: 60 }} />
            <div style={{ ...s.skeleton, height: 200 }} />
          </div>
        ) : bundle ? (
          <>
            {/* Hero */}
            <div style={s.hero}>
              <div>
                <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>{selectedEvent.title}</h1>
                <div style={{ color: TEXT_SEC, marginTop: 6, fontSize: 14 }}>
                  {formatDate(selectedEvent.startAt)}
                  {selectedEvent.locationName ? ` · ${selectedEvent.locationName}` : ''}
                </div>
                {bundle.cohosts.length > 0 && (
                  <div style={{ color: TEXT_TER, marginTop: 4, fontSize: 13 }}>
                    Co-hosts: {bundle.cohosts.map((c) => c.name).join(', ')}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={s.btnGhost} onClick={() => void exportCsv()}>Export CSV</button>
              </div>
            </div>

            {/* Metrics */}
            <div style={s.metricGrid}>
              <MetricCard label="Invited" value={bundle.summary.invited + bundle.summary.approved} />
              <MetricCard label="Going" value={bundle.summary.going} />
              <MetricCard label="Maybe" value={bundle.rsvps.filter((r: Rsvp) => r.response === 'maybe').length} />
              <MetricCard label="Declined" value={bundle.rsvps.filter((r: Rsvp) => r.response === 'declined').length} />
              <MetricCard label="Waitlisted" value={bundle.summary.waitlisted} />
              <MetricCard label="Checked In" value={bundle.summary.checkedIn} />
              <MetricCard label="Response Rate" value={`${Math.round(bundle.analytics.responseRate * 100)}%`} />
              <MetricCard label="Plus Ones" value={bundle.summary.plusOnes} />
            </div>

            {/* Tab bar */}
            <div style={s.tabBar}>
              {(['guests', 'rsvps', 'polls', 'feed'] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={activeTab === tab ? s.tabActive : s.tabBtn}
                >
                  {tab === 'guests' ? `Guests (${bundle.invites.length})` :
                   tab === 'rsvps' ? `RSVPs (${bundle.rsvps.length})` :
                   tab === 'polls' ? `Polls (${bundle.polls.length})` :
                   `Feed (${bundle.announcements.length + bundle.comments.length})`}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {activeTab === 'guests' && (
              <div style={s.card}>
                {/* Add cohost */}
                <div style={s.formRow}>
                  <input style={{ ...s.input, flex: 1 }} value={cohostName} onChange={(e) => setCohostName(e.target.value)} placeholder="Co-host name" />
                  <button style={s.btnGhost} onClick={() => void addCohostHandler()}>Add Co-host</button>
                </div>

                {/* Add invite */}
                <div style={{ ...s.formRow, marginTop: 12 }}>
                  <input style={{ ...s.input, flex: 2 }} value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Guest name" />
                  <input style={{ ...s.input, flex: 2 }} value={inviteContact} onChange={(e) => setInviteContact(e.target.value)} placeholder="Email or phone" />
                  <input style={{ ...s.input, width: 60 }} type="number" min="0" value={plusOneLimit} onChange={(e) => setPlusOneLimit(e.target.value)} placeholder="+1s" />
                  <button style={s.btnPrimary} onClick={() => void addInviteHandler()}>Invite</button>
                </div>

                {/* Guest table */}
                {bundle.invites.length === 0 ? (
                  <p style={{ color: TEXT_TER, fontSize: 13, marginTop: 16 }}>No guests invited yet. Add your first guest above.</p>
                ) : (
                  <div style={s.tableWrap}>
                    <table style={s.table}>
                      <thead>
                        <tr>
                          <th style={s.th}>Name</th>
                          <th style={s.th}>Contact</th>
                          <th style={s.th}>Status</th>
                          <th style={s.th}>+1 Limit</th>
                          <th style={s.th}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bundle.invites.map((invite) => (
                          <tr key={invite.id}>
                            <td style={s.td}>{invite.inviteeName}</td>
                            <td style={{ ...s.td, color: TEXT_SEC }}>{invite.inviteeContact || '-'}</td>
                            <td style={s.td}>
                              <span style={{
                                ...s.statusBadge,
                                backgroundColor: invite.status === 'approved' ? 'color-mix(in srgb, var(--success) 15%, transparent)' : invite.status === 'waitlisted' ? 'color-mix(in srgb, var(--accent-rsvp) 15%, transparent)' : 'var(--border)',
                                color: invite.status === 'approved' ? 'var(--success)' : invite.status === 'waitlisted' ? ACCENT : TEXT_SEC,
                              }}>
                                {invite.status}
                              </span>
                            </td>
                            <td style={{ ...s.td, color: TEXT_SEC }}>{invite.plusOneLimit}</td>
                            <td style={s.td}>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button style={s.btnSmall} onClick={async () => { await doApproveInvite(invite.id); await loadBundle(selectedEvent.id); }}>Approve</button>
                                <button style={s.btnSmallDanger} onClick={async () => { await doWaitlistInvite(invite.id); await loadBundle(selectedEvent.id); }}>Waitlist</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Questions */}
                <div style={{ marginTop: 20, borderTop: `1px solid ${BORDER}`, paddingTop: 16 }}>
                  <h4 style={s.subTitle}>Custom Questions</h4>
                  <div style={s.formRow}>
                    <input style={{ ...s.input, flex: 2 }} value={questionLabel} onChange={(e) => setQuestionLabel(e.target.value)} placeholder="Question for guests" />
                    <input style={{ ...s.input, flex: 2 }} value={questionAnswer} onChange={(e) => setQuestionAnswer(e.target.value)} placeholder="Sample answer (optional)" />
                    <button style={s.btnGhost} onClick={() => void addQuestionHandler()}>Add</button>
                  </div>
                  {bundle.questions.map((q) => (
                    <div key={q.id} style={{ color: TEXT_SEC, fontSize: 13, marginTop: 6 }}>Q: {q.label}</div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'rsvps' && (
              <div style={s.card}>
                {/* Record RSVP */}
                <div style={s.formRow}>
                  <input style={{ ...s.input, flex: 2 }} value={rsvpGuestName} onChange={(e) => setRsvpGuestName(e.target.value)} placeholder="Guest name" />
                  <input style={{ ...s.input, width: 60 }} type="number" min="0" value={rsvpPlusOnes} onChange={(e) => setRsvpPlusOnes(e.target.value)} placeholder="+1" />
                  <button style={s.btnPrimary} onClick={() => void addRsvpHandler()}>Record</button>
                </div>
                <div style={{ ...s.chipRow, marginTop: 8 }}>
                  {RSVP_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      style={opt === rsvpChoice ? s.chipActive : s.chip}
                      onClick={() => setRsvpChoice(opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>

                {/* RSVP table */}
                {bundle.rsvps.length === 0 ? (
                  <p style={{ color: TEXT_TER, fontSize: 13, marginTop: 16 }}>No RSVPs recorded yet.</p>
                ) : (
                  <div style={s.tableWrap}>
                    <table style={s.table}>
                      <thead>
                        <tr>
                          <th style={s.th}>Guest</th>
                          <th style={s.th}>Response</th>
                          <th style={s.th}>+1s</th>
                          <th style={s.th}>Check-in</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bundle.rsvps.map((rsvp: Rsvp) => (
                          <tr key={rsvp.id}>
                            <td style={s.td}>{rsvp.guestName}</td>
                            <td style={s.td}>
                              <span style={{
                                ...s.statusBadge,
                                backgroundColor: rsvp.response === 'going' ? 'color-mix(in srgb, var(--success) 15%, transparent)' : rsvp.response === 'declined' ? 'color-mix(in srgb, var(--danger) 15%, transparent)' : 'var(--border)',
                                color: rsvp.response === 'going' ? 'var(--success)' : rsvp.response === 'declined' ? 'var(--danger)' : TEXT_SEC,
                              }}>
                                {rsvp.response}
                              </span>
                            </td>
                            <td style={{ ...s.td, color: TEXT_SEC }}>{rsvp.plusOnesCount}</td>
                            <td style={s.td}>
                              {rsvp.checkedInAt ? (
                                <span style={{ color: 'var(--success)', fontSize: 13 }}>Checked in</span>
                              ) : (
                                <button style={s.btnSmall} onClick={async () => { await doCheckInRsvp(rsvp.id); await loadBundle(selectedEvent.id); }}>
                                  Check In
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'polls' && (
              <div style={s.card}>
                {/* Create poll */}
                <div style={s.formRow}>
                  <input style={{ ...s.input, flex: 2 }} value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)} placeholder="Poll question" />
                  <input style={{ ...s.input, flex: 1 }} value={pollOptionA} onChange={(e) => setPollOptionA(e.target.value)} placeholder="Option A" />
                  <input style={{ ...s.input, flex: 1 }} value={pollOptionB} onChange={(e) => setPollOptionB(e.target.value)} placeholder="Option B" />
                  <button style={s.btnPrimary} onClick={() => void addPollHandler()}>Create</button>
                </div>

                {bundle.polls.length === 0 ? (
                  <p style={{ color: TEXT_TER, fontSize: 13, marginTop: 16 }}>No polls yet. Create one to let guests vote.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 12, marginTop: 16 }}>
                    {bundle.polls.map((poll: Poll) => {
                      const votes = pollVotesById[poll.id] ?? [];
                      const totalVotes = votes.length;
                      return (
                        <div key={poll.id} style={s.pollCard}>
                          <div style={{ fontWeight: 600, fontSize: 15, color: TEXT }}>{poll.question}</div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            {poll.options.map((option) => {
                              const count = votes.filter((v) => v.optionId === option.id).length;
                              const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                              return (
                                <button
                                  key={option.id}
                                  style={s.pollOption}
                                  onClick={async () => {
                                    await doVotePollOption(makeId(), poll.id, {
                                      optionId: option.id,
                                      rsvpId: bundle.rsvps[0]?.id,
                                      guestName: bundle.rsvps[0] ? undefined : commentAuthor,
                                    });
                                    await loadBundle(selectedEvent.id);
                                  }}
                                >
                                  <div style={{ position: 'absolute' as const, left: 0, top: 0, bottom: 0, width: `${pct}%`, backgroundColor: ACCENT_DIM, borderRadius: 8 }} />
                                  <span style={{ position: 'relative' as const, zIndex: 1 }}>{option.label} ({count})</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'feed' && (
              <div style={s.card}>
                {/* Announcements */}
                <h4 style={s.subTitle}>Announcements</h4>
                <div style={s.formRow}>
                  <input style={{ ...s.input, flex: 1 }} value={announcementMessage} onChange={(e) => setAnnouncementMessage(e.target.value)} placeholder="Broadcast a message to all guests" />
                  <button style={s.btnPrimary} onClick={() => void addAnnouncementHandler()}>Post</button>
                </div>
                {bundle.announcements.map((a) => (
                  <div key={a.id} style={s.feedItem}>
                    <div style={{ fontSize: 11, color: TEXT_TER, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Announcement</div>
                    <div style={{ color: TEXT, marginTop: 4 }}>{a.message}</div>
                  </div>
                ))}

                {/* Comments */}
                <h4 style={{ ...s.subTitle, marginTop: 20 }}>Comments</h4>
                <div style={s.formRow}>
                  <input style={{ ...s.input, width: 100 }} value={commentAuthor} onChange={(e) => setCommentAuthor(e.target.value)} placeholder="Name" />
                  <input style={{ ...s.input, flex: 1 }} value={commentMessage} onChange={(e) => setCommentMessage(e.target.value)} placeholder="Write a comment" />
                  <button style={s.btnGhost} onClick={() => void addCommentHandler()}>Post</button>
                </div>
                {bundle.comments.map((c) => (
                  <div key={c.id} style={s.feedItem}>
                    <span style={{ fontWeight: 600, color: ACCENT, fontSize: 13 }}>{c.guestName}</span>
                    <span style={{ color: TEXT, marginLeft: 8 }}>{c.message}</span>
                  </div>
                ))}

                {/* Photos */}
                <h4 style={{ ...s.subTitle, marginTop: 20 }}>Photos ({bundle.photos.length})</h4>
                <div style={s.formRow}>
                  <input style={{ ...s.input, flex: 1 }} value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="Photo URL" />
                  <button style={s.btnGhost} onClick={() => void addPhotoHandler()}>Add Photo</button>
                </div>

                {/* Links */}
                <h4 style={{ ...s.subTitle, marginTop: 20 }}>Links ({bundle.links.length})</h4>
                <div style={s.formRow}>
                  <div style={s.chipRow}>
                    {LINK_TYPES.map((t) => (
                      <button key={t} style={t === linkType ? s.chipActive : s.chip} onClick={() => setLinkType(t)}>
                        {t.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ ...s.formRow, marginTop: 8 }}>
                  <input style={{ ...s.input, flex: 1 }} value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="Label" />
                  <input style={{ ...s.input, flex: 2 }} value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="URL" />
                  <button style={s.btnPrimary} onClick={() => void addLinkHandler()}>Add</button>
                </div>
                {bundle.links.map((link: EventLink) => (
                  <div key={link.id} style={s.feedItem}>
                    <span style={{ fontSize: 11, color: TEXT_TER, textTransform: 'uppercase' as const }}>{link.type.replace('_', ' ')}</span>
                    <span style={{ color: TEXT, marginLeft: 8 }}>{link.label}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

/* ── components ──────────────────────────────────────── */

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={s.metricCard}>
      <div style={{ fontSize: 11, color: TEXT_SEC, textTransform: 'uppercase' as const, letterSpacing: '0.04em', fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: ACCENT, marginTop: 4 }}>
        {value}
      </div>
    </div>
  );
}

/* ── styles ──────────────────────────────────────────── */

const s: Record<string, CSSProperties> = {
  /* layout */
  twoCol: {
    display: 'grid',
    gridTemplateColumns: '300px 1fr',
    gap: 24,
    minHeight: 'calc(100vh - 140px)',
  },
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    position: 'sticky',
    top: 24,
    alignSelf: 'start',
  },
  main: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    minWidth: 0,
  },

  /* cards */
  card: {
    background: GLASS,
    border: `1px solid ${GLASS_BORDER}`,
    borderRadius: 16,
    padding: 20,
  },
  cardTitle: {
    margin: 0,
    marginBottom: 12,
    fontSize: 15,
    fontWeight: 600,
    color: TEXT,
  },
  centerCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
    background: GLASS,
    border: `1px solid ${GLASS_BORDER}`,
    borderRadius: 16,
    minHeight: 300,
  },

  /* hero */
  hero: {
    background: `linear-gradient(135deg, ${ACCENT_DIM} 0%, ${SURFACE} 100%)`,
    border: `1px solid ${GLASS_BORDER}`,
    borderRadius: 16,
    padding: 24,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },

  /* metrics */
  metricGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: 10,
  },
  metricCard: {
    background: GLASS,
    border: `1px solid ${BORDER}`,
    borderRadius: 12,
    padding: '12px 14px',
  },

  /* tabs */
  tabBar: {
    display: 'flex',
    gap: 2,
    background: SURFACE_EL,
    borderRadius: 10,
    padding: 3,
  },
  tabBtn: {
    flex: 1,
    padding: '8px 12px',
    borderRadius: 8,
    border: 'none',
    background: 'transparent',
    color: TEXT_SEC,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  tabActive: {
    flex: 1,
    padding: '8px 12px',
    borderRadius: 8,
    border: 'none',
    background: GLASS,
    color: TEXT,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: `0 0 0 1px ${GLASS_BORDER}`,
  },

  /* event sidebar */
  filterRow: {
    display: 'flex',
    gap: 2,
    background: SURFACE_EL,
    borderRadius: 8,
    padding: 2,
  },
  filterBtn: {
    flex: 1,
    padding: '6px 10px',
    borderRadius: 6,
    border: 'none',
    background: 'transparent',
    color: TEXT_SEC,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  filterActive: {
    flex: 1,
    padding: '6px 10px',
    borderRadius: 6,
    border: 'none',
    background: ACCENT,
    color: 'var(--background)',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  eventList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  eventCard: {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '12px 14px',
    borderRadius: 12,
    border: `1px solid ${BORDER}`,
    background: GLASS,
    cursor: 'pointer',
  },
  eventCardActive: {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '12px 14px',
    borderRadius: 12,
    border: `1px solid ${ACCENT}`,
    background: ACCENT_DIM,
    cursor: 'pointer',
  },

  /* forms */
  formStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  formRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  input: {
    background: SURFACE_EL,
    border: `1px solid ${BORDER}`,
    borderRadius: 8,
    color: TEXT,
    padding: '8px 12px',
    fontSize: 13,
    outline: 'none',
  },
  subTitle: {
    margin: 0,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: 600,
    color: TEXT_SEC,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },

  /* buttons */
  btnPrimary: {
    background: ACCENT,
    border: 'none',
    borderRadius: 8,
    color: 'var(--background)',
    fontWeight: 700,
    padding: '8px 16px',
    fontSize: 13,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  btnGhost: {
    background: 'transparent',
    border: `1px solid ${BORDER}`,
    borderRadius: 8,
    color: TEXT,
    padding: '8px 16px',
    fontSize: 13,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  btnSmall: {
    background: 'color-mix(in srgb, var(--success) 15%, transparent)',
    border: 'none',
    borderRadius: 6,
    color: 'var(--success)',
    fontSize: 11,
    fontWeight: 600,
    padding: '4px 10px',
    cursor: 'pointer',
  },
  btnSmallDanger: {
    background: 'color-mix(in srgb, var(--danger) 15%, transparent)',
    border: 'none',
    borderRadius: 6,
    color: 'var(--danger)',
    fontSize: 11,
    fontWeight: 600,
    padding: '4px 10px',
    cursor: 'pointer',
  },

  /* chips */
  chipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    borderRadius: 999,
    border: `1px solid ${BORDER}`,
    background: GLASS,
    color: TEXT_SEC,
    padding: '5px 12px',
    fontSize: 12,
    cursor: 'pointer',
  },
  chipActive: {
    borderRadius: 999,
    border: `1px solid ${ACCENT}`,
    background: ACCENT,
    color: 'var(--background)',
    padding: '5px 12px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },

  /* table */
  tableWrap: {
    marginTop: 16,
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
  },
  th: {
    textAlign: 'left',
    padding: '8px 12px',
    borderBottom: `1px solid ${BORDER}`,
    color: TEXT_TER,
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  td: {
    padding: '10px 12px',
    borderBottom: `1px solid ${BORDER}`,
    color: TEXT,
  },
  statusBadge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 600,
  },

  /* polls */
  pollCard: {
    background: SURFACE_EL,
    border: `1px solid ${BORDER}`,
    borderRadius: 12,
    padding: 16,
  },
  pollOption: {
    position: 'relative',
    flex: 1,
    padding: '10px 14px',
    borderRadius: 8,
    border: `1px solid ${BORDER}`,
    background: GLASS,
    color: TEXT,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    overflow: 'hidden',
    textAlign: 'center',
  },

  /* feed */
  feedItem: {
    padding: '8px 0',
    borderBottom: `1px solid ${BORDER}`,
    fontSize: 13,
  },

  /* loading */
  skeleton: {
    background: `linear-gradient(90deg, ${SURFACE_EL} 0%, ${GLASS} 50%, ${SURFACE_EL} 100%)`,
    backgroundSize: '200% 100%',
    animation: 'skeleton-pulse 1.5s ease infinite',
    borderRadius: 12,
    height: 60,
  },
};
