import type { DatabaseAdapter } from '@mylife/db';
import type {
  Announcement,
  AnnouncementChannel,
  Event,
  EventAnalytics,
  EventCohost,
  EventComment,
  EventExpense,
  EventLink,
  EventMessage,
  EventPhoto,
  EventQuestion,
  EventSeriesEntry,
  EventVisibility,
  ExpenseSplitRecord,
  Invite,
  InviteStatus,
  LinkType,
  Poll,
  PollOption,
  PollVote,
  QuestionResponse,
  QuestionType,
  RecurrenceRule,
  RecurrenceFrequency,
  RecurrenceEndType,
  RegistryCategory,
  RegistryItem,
  Rsvp,
  RsvpResponse,
  RsvpSummary,
  SeatAssignment,
  SeatingTable,
  SplitType,
  TableShape,
} from '../types';

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function rowToEvent(row: Record<string, unknown>): Event {
  return {
    id: row.id as string,
    title: row.title as string,
    description: (row.description as string) ?? null,
    startAt: row.start_at as string,
    endAt: (row.end_at as string) ?? null,
    timezone: row.timezone as string,
    locationName: (row.location_name as string) ?? null,
    locationAddress: (row.location_address as string) ?? null,
    coverImageUrl: (row.cover_image_url as string) ?? null,
    visibility: row.visibility as EventVisibility,
    password: (row.password as string) ?? null,
    requiresApproval: Boolean(row.requires_approval as number),
    allowPlusOnes: Boolean(row.allow_plus_ones as number),
    maxGuests: (row.max_guests as number) ?? null,
    waitlistEnabled: Boolean(row.waitlist_enabled as number),
    allowPhotoAlbum: Boolean(row.allow_photo_album as number),
    allowComments: Boolean(row.allow_comments as number),
    allowPolls: Boolean(row.allow_polls as number),
    allowCohosts: Boolean(row.allow_cohosts as number),
    allowChipIn: Boolean(row.allow_chip_in as number),
    chipInUrl: (row.chip_in_url as string) ?? null,
    createdBy: (row.created_by as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToEventCohost(row: Record<string, unknown>): EventCohost {
  return {
    id: row.id as string,
    eventId: row.event_id as string,
    name: row.name as string,
    role: (row.role as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function rowToInvite(row: Record<string, unknown>): Invite {
  return {
    id: row.id as string,
    eventId: row.event_id as string,
    inviteeName: row.invitee_name as string,
    inviteeContact: (row.invitee_contact as string) ?? null,
    inviteeType: row.invitee_type as string,
    status: row.status as InviteStatus,
    plusOneLimit: row.plus_one_limit as number,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToRsvp(row: Record<string, unknown>): Rsvp {
  return {
    id: row.id as string,
    eventId: row.event_id as string,
    inviteId: (row.invite_id as string) ?? null,
    guestName: row.guest_name as string,
    guestContact: (row.guest_contact as string) ?? null,
    response: row.response as RsvpResponse,
    plusOnesCount: row.plus_ones_count as number,
    notes: (row.notes as string) ?? null,
    respondedAt: row.responded_at as string,
    checkedInAt: (row.checked_in_at as string) ?? null,
    source: row.source as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToQuestion(row: Record<string, unknown>): EventQuestion {
  return {
    id: row.id as string,
    eventId: row.event_id as string,
    label: row.label as string,
    type: row.type as QuestionType,
    options: parseJson<string[]>(row.options_json, []),
    required: Boolean(row.required as number),
    sortOrder: row.sort_order as number,
    createdAt: row.created_at as string,
  };
}

function rowToQuestionResponse(row: Record<string, unknown>): QuestionResponse {
  return {
    id: row.id as string,
    eventId: row.event_id as string,
    rsvpId: row.rsvp_id as string,
    questionId: row.question_id as string,
    answer: parseJson<QuestionResponse['answer']>(row.answer_json, null),
    createdAt: row.created_at as string,
  };
}

function rowToPoll(row: Record<string, unknown>): Poll {
  return {
    id: row.id as string,
    eventId: row.event_id as string,
    question: row.question as string,
    options: parseJson<PollOption[]>(row.options_json, []),
    multipleChoice: Boolean(row.multiple_choice as number),
    isOpen: Boolean(row.is_open as number),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToPollVote(row: Record<string, unknown>): PollVote {
  return {
    id: row.id as string,
    pollId: row.poll_id as string,
    rsvpId: (row.rsvp_id as string) ?? null,
    guestName: (row.guest_name as string) ?? null,
    optionId: row.option_id as string,
    createdAt: row.created_at as string,
  };
}

function rowToAnnouncement(row: Record<string, unknown>): Announcement {
  return {
    id: row.id as string,
    eventId: row.event_id as string,
    message: row.message as string,
    sendChannel: row.send_channel as AnnouncementChannel,
    scheduledFor: (row.scheduled_for as string) ?? null,
    sentAt: (row.sent_at as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function rowToComment(row: Record<string, unknown>): EventComment {
  return {
    id: row.id as string,
    eventId: row.event_id as string,
    rsvpId: (row.rsvp_id as string) ?? null,
    guestName: row.guest_name as string,
    message: row.message as string,
    createdAt: row.created_at as string,
  };
}

function rowToPhoto(row: Record<string, unknown>): EventPhoto {
  return {
    id: row.id as string,
    eventId: row.event_id as string,
    rsvpId: (row.rsvp_id as string) ?? null,
    guestName: row.guest_name as string,
    photoUrl: row.photo_url as string,
    caption: (row.caption as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function rowToEventLink(row: Record<string, unknown>): EventLink {
  return {
    id: row.id as string,
    eventId: row.event_id as string,
    type: row.type as LinkType,
    label: row.label as string,
    url: row.url as string,
    createdAt: row.created_at as string,
  };
}

export function createEvent(
  db: DatabaseAdapter,
  id: string,
  input: {
    title: string;
    description?: string;
    startAt: string;
    endAt?: string;
    timezone?: string;
    locationName?: string;
    locationAddress?: string;
    coverImageUrl?: string;
    visibility?: EventVisibility;
    password?: string;
    requiresApproval?: boolean;
    allowPlusOnes?: boolean;
    maxGuests?: number | null;
    waitlistEnabled?: boolean;
    allowPhotoAlbum?: boolean;
    allowComments?: boolean;
    allowPolls?: boolean;
    allowCohosts?: boolean;
    allowChipIn?: boolean;
    chipInUrl?: string;
    createdBy?: string;
  },
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO rv_events (
      id, title, description, start_at, end_at, timezone, location_name, location_address,
      cover_image_url, visibility, password, requires_approval, allow_plus_ones, max_guests,
      waitlist_enabled, allow_photo_album, allow_comments, allow_polls, allow_cohosts,
      allow_chip_in, chip_in_url, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.title,
      input.description ?? null,
      input.startAt,
      input.endAt ?? null,
      input.timezone ?? 'UTC',
      input.locationName ?? null,
      input.locationAddress ?? null,
      input.coverImageUrl ?? null,
      input.visibility ?? 'private',
      input.password ?? null,
      input.requiresApproval ? 1 : 0,
      input.allowPlusOnes === false ? 0 : 1,
      input.maxGuests ?? null,
      input.waitlistEnabled === false ? 0 : 1,
      input.allowPhotoAlbum === false ? 0 : 1,
      input.allowComments === false ? 0 : 1,
      input.allowPolls === false ? 0 : 1,
      input.allowCohosts === false ? 0 : 1,
      input.allowChipIn === false ? 0 : 1,
      input.chipInUrl ?? null,
      input.createdBy ?? null,
      now,
      now,
    ],
  );
}

export function getEvents(db: DatabaseAdapter, opts?: { includePast?: boolean }): Event[] {
  const params: unknown[] = [];
  let sql = 'SELECT * FROM rv_events';

  if (!opts?.includePast) {
    sql += ' WHERE start_at >= ?';
    params.push(new Date().toISOString());
  }

  sql += ' ORDER BY start_at ASC';
  return db.query<Record<string, unknown>>(sql, params).map(rowToEvent);
}

export function getEventById(db: DatabaseAdapter, id: string): Event | null {
  const rows = db.query<Record<string, unknown>>('SELECT * FROM rv_events WHERE id = ?', [id]);
  return rows.length > 0 ? rowToEvent(rows[0]) : null;
}

export function updateEvent(
  db: DatabaseAdapter,
  id: string,
  updates: Partial<{
    title: string;
    description: string;
    startAt: string;
    endAt: string;
    timezone: string;
    locationName: string;
    locationAddress: string;
    coverImageUrl: string;
    visibility: EventVisibility;
    password: string;
    requiresApproval: boolean;
    allowPlusOnes: boolean;
    maxGuests: number | null;
    waitlistEnabled: boolean;
    allowPhotoAlbum: boolean;
    allowComments: boolean;
    allowPolls: boolean;
    allowCohosts: boolean;
    allowChipIn: boolean;
    chipInUrl: string;
  }>,
): void {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (updates.title !== undefined) {
    sets.push('title = ?');
    params.push(updates.title);
  }
  if (updates.description !== undefined) {
    sets.push('description = ?');
    params.push(updates.description);
  }
  if (updates.startAt !== undefined) {
    sets.push('start_at = ?');
    params.push(updates.startAt);
  }
  if (updates.endAt !== undefined) {
    sets.push('end_at = ?');
    params.push(updates.endAt);
  }
  if (updates.timezone !== undefined) {
    sets.push('timezone = ?');
    params.push(updates.timezone);
  }
  if (updates.locationName !== undefined) {
    sets.push('location_name = ?');
    params.push(updates.locationName);
  }
  if (updates.locationAddress !== undefined) {
    sets.push('location_address = ?');
    params.push(updates.locationAddress);
  }
  if (updates.coverImageUrl !== undefined) {
    sets.push('cover_image_url = ?');
    params.push(updates.coverImageUrl);
  }
  if (updates.visibility !== undefined) {
    sets.push('visibility = ?');
    params.push(updates.visibility);
  }
  if (updates.password !== undefined) {
    sets.push('password = ?');
    params.push(updates.password);
  }
  if (updates.requiresApproval !== undefined) {
    sets.push('requires_approval = ?');
    params.push(updates.requiresApproval ? 1 : 0);
  }
  if (updates.allowPlusOnes !== undefined) {
    sets.push('allow_plus_ones = ?');
    params.push(updates.allowPlusOnes ? 1 : 0);
  }
  if (updates.maxGuests !== undefined) {
    sets.push('max_guests = ?');
    params.push(updates.maxGuests);
  }
  if (updates.waitlistEnabled !== undefined) {
    sets.push('waitlist_enabled = ?');
    params.push(updates.waitlistEnabled ? 1 : 0);
  }
  if (updates.allowPhotoAlbum !== undefined) {
    sets.push('allow_photo_album = ?');
    params.push(updates.allowPhotoAlbum ? 1 : 0);
  }
  if (updates.allowComments !== undefined) {
    sets.push('allow_comments = ?');
    params.push(updates.allowComments ? 1 : 0);
  }
  if (updates.allowPolls !== undefined) {
    sets.push('allow_polls = ?');
    params.push(updates.allowPolls ? 1 : 0);
  }
  if (updates.allowCohosts !== undefined) {
    sets.push('allow_cohosts = ?');
    params.push(updates.allowCohosts ? 1 : 0);
  }
  if (updates.allowChipIn !== undefined) {
    sets.push('allow_chip_in = ?');
    params.push(updates.allowChipIn ? 1 : 0);
  }
  if (updates.chipInUrl !== undefined) {
    sets.push('chip_in_url = ?');
    params.push(updates.chipInUrl);
  }

  if (sets.length === 0) return;

  sets.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(id);

  db.execute(`UPDATE rv_events SET ${sets.join(', ')} WHERE id = ?`, params);
}

export function deleteEvent(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM rv_events WHERE id = ?', [id]);
}

export function addEventCohost(
  db: DatabaseAdapter,
  id: string,
  eventId: string,
  input: { name: string; role?: string },
): void {
  db.execute(
    `INSERT INTO rv_event_cohosts (id, event_id, name, role, created_at) VALUES (?, ?, ?, ?, ?)`,
    [id, eventId, input.name, input.role ?? null, new Date().toISOString()],
  );
}

export function getEventCohosts(db: DatabaseAdapter, eventId: string): EventCohost[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM rv_event_cohosts WHERE event_id = ? ORDER BY created_at ASC',
      [eventId],
    )
    .map(rowToEventCohost);
}

export function removeEventCohost(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM rv_event_cohosts WHERE id = ?', [id]);
}

export function createInvite(
  db: DatabaseAdapter,
  id: string,
  eventId: string,
  input: {
    inviteeName: string;
    inviteeContact?: string;
    inviteeType?: string;
    status?: InviteStatus;
    plusOneLimit?: number;
    notes?: string;
  },
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO rv_invites (
      id, event_id, invitee_name, invitee_contact, invitee_type, status,
      plus_one_limit, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      eventId,
      input.inviteeName,
      input.inviteeContact ?? null,
      input.inviteeType ?? 'link',
      input.status ?? 'invited',
      input.plusOneLimit ?? 0,
      input.notes ?? null,
      now,
      now,
    ],
  );
}

export function getInvitesByEvent(db: DatabaseAdapter, eventId: string): Invite[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM rv_invites WHERE event_id = ? ORDER BY created_at ASC',
      [eventId],
    )
    .map(rowToInvite);
}

export function updateInviteStatus(
  db: DatabaseAdapter,
  inviteId: string,
  status: InviteStatus,
): void {
  db.execute(
    'UPDATE rv_invites SET status = ?, updated_at = ? WHERE id = ?',
    [status, new Date().toISOString(), inviteId],
  );
}

export function approveInviteRequest(db: DatabaseAdapter, inviteId: string): void {
  updateInviteStatus(db, inviteId, 'approved');
}

export function moveInviteToWaitlist(db: DatabaseAdapter, inviteId: string): void {
  updateInviteStatus(db, inviteId, 'waitlisted');
}

export function deleteInvite(db: DatabaseAdapter, inviteId: string): void {
  db.execute('DELETE FROM rv_invites WHERE id = ?', [inviteId]);
}

export function recordRsvp(
  db: DatabaseAdapter,
  id: string,
  eventId: string,
  input: {
    inviteId?: string;
    guestName: string;
    guestContact?: string;
    response: RsvpResponse;
    plusOnesCount?: number;
    notes?: string;
    respondedAt?: string;
    source?: string;
  },
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO rv_rsvps (
      id, event_id, invite_id, guest_name, guest_contact, response,
      plus_ones_count, notes, responded_at, source, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      eventId,
      input.inviteId ?? null,
      input.guestName,
      input.guestContact ?? null,
      input.response,
      input.plusOnesCount ?? 0,
      input.notes ?? null,
      input.respondedAt ?? now,
      input.source ?? 'app',
      now,
      now,
    ],
  );
}

export function getRsvpsByEvent(db: DatabaseAdapter, eventId: string, limit = 1000): Rsvp[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM rv_rsvps WHERE event_id = ? ORDER BY responded_at DESC LIMIT ?',
      [eventId, limit],
    )
    .map(rowToRsvp);
}

export function updateRsvp(
  db: DatabaseAdapter,
  id: string,
  updates: Partial<{
    response: RsvpResponse;
    plusOnesCount: number;
    notes: string;
    checkedInAt: string | null;
  }>,
): void {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (updates.response !== undefined) {
    sets.push('response = ?');
    params.push(updates.response);
  }
  if (updates.plusOnesCount !== undefined) {
    sets.push('plus_ones_count = ?');
    params.push(updates.plusOnesCount);
  }
  if (updates.notes !== undefined) {
    sets.push('notes = ?');
    params.push(updates.notes);
  }
  if (updates.checkedInAt !== undefined) {
    sets.push('checked_in_at = ?');
    params.push(updates.checkedInAt);
  }

  if (sets.length === 0) return;

  sets.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(id);

  db.execute(`UPDATE rv_rsvps SET ${sets.join(', ')} WHERE id = ?`, params);
}

export function checkInRsvp(
  db: DatabaseAdapter,
  id: string,
  checkedInAt = new Date().toISOString(),
): void {
  updateRsvp(db, id, { checkedInAt });
}

export function createQuestion(
  db: DatabaseAdapter,
  id: string,
  eventId: string,
  input: {
    label: string;
    type?: QuestionType;
    options?: string[];
    required?: boolean;
    sortOrder?: number;
  },
): void {
  db.execute(
    `INSERT INTO rv_questions (
      id, event_id, label, type, options_json, required, sort_order, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      eventId,
      input.label,
      input.type ?? 'text',
      JSON.stringify(input.options ?? []),
      input.required ? 1 : 0,
      input.sortOrder ?? 0,
      new Date().toISOString(),
    ],
  );
}

export function getQuestionsByEvent(db: DatabaseAdapter, eventId: string): EventQuestion[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM rv_questions WHERE event_id = ? ORDER BY sort_order ASC, created_at ASC',
      [eventId],
    )
    .map(rowToQuestion);
}

export function deleteQuestion(db: DatabaseAdapter, questionId: string): void {
  db.execute('DELETE FROM rv_questions WHERE id = ?', [questionId]);
}

export function saveQuestionResponse(
  db: DatabaseAdapter,
  id: string,
  eventId: string,
  rsvpId: string,
  questionId: string,
  answer: QuestionResponse['answer'],
): void {
  db.execute('DELETE FROM rv_question_responses WHERE rsvp_id = ? AND question_id = ?', [rsvpId, questionId]);
  db.execute(
    `INSERT INTO rv_question_responses (
      id, event_id, rsvp_id, question_id, answer_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, eventId, rsvpId, questionId, JSON.stringify(answer), new Date().toISOString()],
  );
}

export function getQuestionResponsesByRsvp(
  db: DatabaseAdapter,
  rsvpId: string,
): QuestionResponse[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM rv_question_responses WHERE rsvp_id = ? ORDER BY created_at ASC',
      [rsvpId],
    )
    .map(rowToQuestionResponse);
}

export function createPoll(
  db: DatabaseAdapter,
  id: string,
  eventId: string,
  input: {
    question: string;
    options: PollOption[];
    multipleChoice?: boolean;
  },
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO rv_polls (
      id, event_id, question, options_json, multiple_choice, is_open, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      eventId,
      input.question,
      JSON.stringify(input.options),
      input.multipleChoice ? 1 : 0,
      1,
      now,
      now,
    ],
  );
}

export function getPollsByEvent(db: DatabaseAdapter, eventId: string): Poll[] {
  return db
    .query<Record<string, unknown>>('SELECT * FROM rv_polls WHERE event_id = ? ORDER BY created_at DESC', [
      eventId,
    ])
    .map(rowToPoll);
}

export function closePoll(db: DatabaseAdapter, pollId: string): void {
  db.execute('UPDATE rv_polls SET is_open = 0, updated_at = ? WHERE id = ?', [
    new Date().toISOString(),
    pollId,
  ]);
}

export function votePollOption(
  db: DatabaseAdapter,
  id: string,
  pollId: string,
  input: {
    optionId: string;
    rsvpId?: string;
    guestName?: string;
  },
): void {
  const pollRows = db.query<{ multiple_choice: number }>('SELECT multiple_choice FROM rv_polls WHERE id = ?', [pollId]);
  if (pollRows.length === 0) return;
  const allowsMultipleChoice = pollRows[0].multiple_choice === 1;

  if (!allowsMultipleChoice) {
    if (input.rsvpId) {
      db.execute('DELETE FROM rv_poll_votes WHERE poll_id = ? AND rsvp_id = ?', [pollId, input.rsvpId]);
    } else if (input.guestName) {
      db.execute('DELETE FROM rv_poll_votes WHERE poll_id = ? AND guest_name = ?', [pollId, input.guestName]);
    }
  }

  db.execute(
    `INSERT INTO rv_poll_votes (id, poll_id, rsvp_id, guest_name, option_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, pollId, input.rsvpId ?? null, input.guestName ?? null, input.optionId, new Date().toISOString()],
  );
}

export function getPollVotes(db: DatabaseAdapter, pollId: string, limit = 500): PollVote[] {
  return db
    .query<Record<string, unknown>>('SELECT * FROM rv_poll_votes WHERE poll_id = ? ORDER BY created_at ASC LIMIT ?', [
      pollId, limit,
    ])
    .map(rowToPollVote);
}

export function createAnnouncement(
  db: DatabaseAdapter,
  id: string,
  eventId: string,
  input: {
    message: string;
    sendChannel?: AnnouncementChannel;
    scheduledFor?: string;
  },
): void {
  db.execute(
    `INSERT INTO rv_announcements (
      id, event_id, message, send_channel, scheduled_for, sent_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      eventId,
      input.message,
      input.sendChannel ?? 'all',
      input.scheduledFor ?? null,
      null,
      new Date().toISOString(),
    ],
  );
}

export function markAnnouncementSent(
  db: DatabaseAdapter,
  id: string,
  sentAt = new Date().toISOString(),
): void {
  db.execute('UPDATE rv_announcements SET sent_at = ? WHERE id = ?', [sentAt, id]);
}

export function getAnnouncementsByEvent(db: DatabaseAdapter, eventId: string, limit = 200): Announcement[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM rv_announcements WHERE event_id = ? ORDER BY created_at DESC LIMIT ?',
      [eventId, limit],
    )
    .map(rowToAnnouncement);
}

export function createComment(
  db: DatabaseAdapter,
  id: string,
  eventId: string,
  input: { guestName: string; message: string; rsvpId?: string },
): void {
  db.execute(
    'INSERT INTO rv_comments (id, event_id, rsvp_id, guest_name, message, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, eventId, input.rsvpId ?? null, input.guestName, input.message, new Date().toISOString()],
  );
}

export function getCommentsByEvent(db: DatabaseAdapter, eventId: string, limit = 500): EventComment[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM rv_comments WHERE event_id = ? ORDER BY created_at DESC LIMIT ?',
      [eventId, limit],
    )
    .map(rowToComment);
}

export function addPhoto(
  db: DatabaseAdapter,
  id: string,
  eventId: string,
  input: { guestName: string; photoUrl: string; caption?: string; rsvpId?: string },
): void {
  db.execute(
    `INSERT INTO rv_photos (id, event_id, rsvp_id, guest_name, photo_url, caption, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, eventId, input.rsvpId ?? null, input.guestName, input.photoUrl, input.caption ?? null, new Date().toISOString()],
  );
}

export function getPhotosByEvent(db: DatabaseAdapter, eventId: string, limit = 500): EventPhoto[] {
  return db
    .query<Record<string, unknown>>('SELECT * FROM rv_photos WHERE event_id = ? ORDER BY created_at DESC LIMIT ?', [
      eventId, limit,
    ])
    .map(rowToPhoto);
}

export function deletePhoto(db: DatabaseAdapter, photoId: string): void {
  db.execute('DELETE FROM rv_photos WHERE id = ?', [photoId]);
}

export function setEventLink(
  db: DatabaseAdapter,
  id: string,
  eventId: string,
  input: { type?: LinkType; label: string; url: string },
): void {
  db.execute(
    `INSERT INTO rv_event_links (id, event_id, type, label, url, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, eventId, input.type ?? 'other', input.label, input.url, new Date().toISOString()],
  );
}

export function getEventLinksByEvent(db: DatabaseAdapter, eventId: string): EventLink[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM rv_event_links WHERE event_id = ? ORDER BY created_at DESC',
      [eventId],
    )
    .map(rowToEventLink);
}

export function deleteEventLink(db: DatabaseAdapter, linkId: string): void {
  db.execute('DELETE FROM rv_event_links WHERE id = ?', [linkId]);
}

export function getRsvpSummary(db: DatabaseAdapter, eventId: string): RsvpSummary {
  const summary: RsvpSummary = {
    invited: 0,
    requested: 0,
    approved: 0,
    waitlisted: 0,
    going: 0,
    maybe: 0,
    declined: 0,
    checkedIn: 0,
    plusOnes: 0,
  };

  const inviteRows = db.query<{ status: InviteStatus; count: number }>(
    'SELECT status, COUNT(*) AS count FROM rv_invites WHERE event_id = ? GROUP BY status',
    [eventId],
  );

  for (const row of inviteRows) {
    if (row.status === 'invited') summary.invited = row.count;
    if (row.status === 'requested') summary.requested = row.count;
    if (row.status === 'approved') summary.approved = row.count;
    if (row.status === 'waitlisted') summary.waitlisted = row.count;
  }

  const rsvpRows = db.query<{
    going: number;
    maybe: number;
    declined: number;
    checked_in: number;
    plus_ones: number;
  }>(
    `SELECT
      SUM(CASE WHEN response = 'going' THEN 1 ELSE 0 END) AS going,
      SUM(CASE WHEN response = 'maybe' THEN 1 ELSE 0 END) AS maybe,
      SUM(CASE WHEN response = 'declined' THEN 1 ELSE 0 END) AS declined,
      SUM(CASE WHEN checked_in_at IS NOT NULL THEN 1 ELSE 0 END) AS checked_in,
      SUM(plus_ones_count) AS plus_ones
     FROM rv_rsvps
     WHERE event_id = ?`,
    [eventId],
  );

  if (rsvpRows.length > 0) {
    summary.going = rsvpRows[0].going ?? 0;
    summary.maybe = rsvpRows[0].maybe ?? 0;
    summary.declined = rsvpRows[0].declined ?? 0;
    summary.checkedIn = rsvpRows[0].checked_in ?? 0;
    summary.plusOnes = rsvpRows[0].plus_ones ?? 0;
  }

  return summary;
}

export function getEventAnalytics(db: DatabaseAdapter, eventId: string): EventAnalytics {
  const summary = getRsvpSummary(db, eventId);
  const responses = summary.going + summary.maybe + summary.declined + summary.waitlisted;
  const invitedPool = summary.invited + summary.requested + summary.approved + summary.waitlisted;

  const counts = db.query<{ announcements: number; comments: number; photos: number; polls: number }>(
    `SELECT
      (SELECT COUNT(*) FROM rv_announcements WHERE event_id = ?) AS announcements,
      (SELECT COUNT(*) FROM rv_comments WHERE event_id = ?) AS comments,
      (SELECT COUNT(*) FROM rv_photos WHERE event_id = ?) AS photos,
      (SELECT COUNT(*) FROM rv_polls WHERE event_id = ?) AS polls`,
    [eventId, eventId, eventId, eventId],
  );

  return {
    eventId,
    ...summary,
    responses,
    responseRate: invitedPool > 0 ? Number((responses / invitedPool).toFixed(4)) : 0,
    announcements: counts[0]?.announcements ?? 0,
    comments: counts[0]?.comments ?? 0,
    photos: counts[0]?.photos ?? 0,
    polls: counts[0]?.polls ?? 0,
  };
}

export function exportAttendanceCsv(db: DatabaseAdapter, eventId: string): string {
  const rows = db.query<{
    guest_name: string;
    guest_contact: string | null;
    response: string;
    plus_ones_count: number;
    responded_at: string;
    checked_in_at: string | null;
    invitee_name: string | null;
    invite_status: string | null;
  }>(
    `SELECT
      r.guest_name,
      r.guest_contact,
      r.response,
      r.plus_ones_count,
      r.responded_at,
      r.checked_in_at,
      i.invitee_name,
      i.status AS invite_status
     FROM rv_rsvps r
     LEFT JOIN rv_invites i ON i.id = r.invite_id
     WHERE r.event_id = ?
     ORDER BY r.responded_at ASC`,
    [eventId],
  );

  const header = [
    'Guest Name',
    'Guest Contact',
    'Response',
    'Plus Ones',
    'Responded At',
    'Checked In At',
    'Invitee Name',
    'Invite Status',
  ];

  const lines = rows.map((row) =>
    [
      row.guest_name,
      row.guest_contact,
      row.response,
      row.plus_ones_count,
      row.responded_at,
      row.checked_in_at,
      row.invitee_name,
      row.invite_status,
    ]
      .map(csvCell)
      .join(','),
  );

  return [header.map(csvCell).join(','), ...lines].join('\n');
}

export function getSetting(db: DatabaseAdapter, key: string): string | undefined {
  const rows = db.query<{ value: string }>('SELECT value FROM rv_settings WHERE key = ?', [key]);
  return rows.length > 0 ? rows[0].value : undefined;
}

export function setSetting(db: DatabaseAdapter, key: string, value: string): void {
  db.execute(
    `INSERT INTO rv_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, value],
  );
}

// --- Calendar Sync ---

export function getCalendarEventId(db: DatabaseAdapter, eventId: string): string | null {
  const rows = db.query<{ calendar_event_id: string | null }>(
    'SELECT calendar_event_id FROM rv_events WHERE id = ?',
    [eventId],
  );
  return rows.length > 0 ? rows[0].calendar_event_id : null;
}

export function setCalendarEventId(
  db: DatabaseAdapter,
  eventId: string,
  calendarEventId: string | null,
): void {
  db.execute('UPDATE rv_events SET calendar_event_id = ? WHERE id = ?', [calendarEventId, eventId]);
}

// --- Expense Splitting ---

function rowToExpense(row: Record<string, unknown>): EventExpense {
  return {
    id: row.id as string,
    eventId: row.event_id as string,
    description: row.description as string,
    amountCents: row.amount_cents as number,
    paidByName: row.paid_by_name as string,
    splitType: row.split_type as SplitType,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToExpenseSplit(row: Record<string, unknown>): ExpenseSplitRecord {
  return {
    id: row.id as string,
    expenseId: row.expense_id as string,
    participantName: row.participant_name as string,
    amountCents: row.amount_cents as number,
    isSettled: Boolean(row.is_settled as number),
    settledAt: (row.settled_at as string) ?? null,
    createdAt: row.created_at as string,
  };
}

export function createExpense(
  db: DatabaseAdapter,
  id: string,
  eventId: string,
  input: {
    description: string;
    amountCents: number;
    paidByName: string;
    splitType?: SplitType;
  },
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO rv_expenses (id, event_id, description, amount_cents, paid_by_name, split_type, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, eventId, input.description, input.amountCents, input.paidByName, input.splitType ?? 'equal', now, now],
  );
}

export function getExpensesByEvent(db: DatabaseAdapter, eventId: string): EventExpense[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM rv_expenses WHERE event_id = ? ORDER BY created_at DESC',
      [eventId],
    )
    .map(rowToExpense);
}

export function getExpenseById(db: DatabaseAdapter, id: string): EventExpense | null {
  const rows = db.query<Record<string, unknown>>('SELECT * FROM rv_expenses WHERE id = ?', [id]);
  return rows.length > 0 ? rowToExpense(rows[0]) : null;
}

export function updateExpense(
  db: DatabaseAdapter,
  id: string,
  updates: Partial<{
    description: string;
    amountCents: number;
    paidByName: string;
    splitType: SplitType;
  }>,
): void {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (updates.description !== undefined) {
    sets.push('description = ?');
    params.push(updates.description);
  }
  if (updates.amountCents !== undefined) {
    sets.push('amount_cents = ?');
    params.push(updates.amountCents);
  }
  if (updates.paidByName !== undefined) {
    sets.push('paid_by_name = ?');
    params.push(updates.paidByName);
  }
  if (updates.splitType !== undefined) {
    sets.push('split_type = ?');
    params.push(updates.splitType);
  }

  if (sets.length === 0) return;

  sets.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(id);

  db.execute(`UPDATE rv_expenses SET ${sets.join(', ')} WHERE id = ?`, params);
}

export function deleteExpense(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM rv_expenses WHERE id = ?', [id]);
}

export function createExpenseSplit(
  db: DatabaseAdapter,
  id: string,
  expenseId: string,
  input: { participantName: string; amountCents: number },
): void {
  db.execute(
    `INSERT INTO rv_expense_splits (id, expense_id, participant_name, amount_cents, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, expenseId, input.participantName, input.amountCents, new Date().toISOString()],
  );
}

export function getExpenseSplitsByExpense(db: DatabaseAdapter, expenseId: string, limit = 200): ExpenseSplitRecord[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM rv_expense_splits WHERE expense_id = ? ORDER BY created_at ASC LIMIT ?',
      [expenseId, limit],
    )
    .map(rowToExpenseSplit);
}

export function markSplitSettled(
  db: DatabaseAdapter,
  splitId: string,
  settledAt = new Date().toISOString(),
): void {
  db.execute('UPDATE rv_expense_splits SET is_settled = 1, settled_at = ? WHERE id = ?', [settledAt, splitId]);
}

export function markSplitUnsettled(db: DatabaseAdapter, splitId: string): void {
  db.execute('UPDATE rv_expense_splits SET is_settled = 0, settled_at = NULL WHERE id = ?', [splitId]);
}

export function deleteExpenseSplitsByExpense(db: DatabaseAdapter, expenseId: string): void {
  db.execute('DELETE FROM rv_expense_splits WHERE expense_id = ?', [expenseId]);
}

// --- Dietary Summary (query helper) ---

export function getDietaryResponses(
  db: DatabaseAdapter,
  eventId: string,
): Array<{ guestName: string; answerJson: string | null; rsvpResponse: string }> {
  return db.query<{ guestName: string; answerJson: string | null; rsvpResponse: string }>(
    `SELECT r.guest_name AS guestName, qr.answer_json AS answerJson, r.response AS rsvpResponse
     FROM rv_question_responses qr
     JOIN rv_questions q ON q.id = qr.question_id
     JOIN rv_rsvps r ON r.id = qr.rsvp_id
     WHERE q.event_id = ? AND q.type = 'dietary'`,
    [eventId],
  );
}

// ===== V3: Recurring Events =====

function rowToRecurrenceRule(row: Record<string, unknown>): RecurrenceRule {
  return {
    id: row.id as string,
    eventId: row.event_id as string,
    frequency: row.frequency as RecurrenceFrequency,
    intervalCount: row.interval_count as number,
    dayOfWeek: (row.day_of_week as number) ?? null,
    dayOfMonth: (row.day_of_month as number) ?? null,
    endType: row.end_type as RecurrenceEndType,
    endAfterCount: (row.end_after_count as number) ?? null,
    endByDate: (row.end_by_date as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToEventSeries(row: Record<string, unknown>): EventSeriesEntry {
  return {
    id: row.id as string,
    parentEventId: row.parent_event_id as string,
    occurrenceEventId: row.occurrence_event_id as string,
    occurrenceIndex: row.occurrence_index as number,
    occurrenceDate: row.occurrence_date as string,
    isCancelled: Boolean(row.is_cancelled as number),
    isModified: Boolean(row.is_modified as number),
    createdAt: row.created_at as string,
  };
}

export function createRecurrenceRule(
  db: DatabaseAdapter,
  id: string,
  eventId: string,
  input: {
    frequency: RecurrenceFrequency;
    intervalCount?: number;
    dayOfWeek?: number;
    dayOfMonth?: number;
    endType?: RecurrenceEndType;
    endAfterCount?: number;
    endByDate?: string;
  },
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO rv_recurrence_rules (id, event_id, frequency, interval_count, day_of_week, day_of_month, end_type, end_after_count, end_by_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, eventId, input.frequency, input.intervalCount ?? 1, input.dayOfWeek ?? null, input.dayOfMonth ?? null, input.endType ?? 'never', input.endAfterCount ?? null, input.endByDate ?? null, now, now],
  );
}

export function getRecurrenceRule(db: DatabaseAdapter, eventId: string): RecurrenceRule | null {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM rv_recurrence_rules WHERE event_id = ?',
    [eventId],
  );
  return rows.length > 0 ? rowToRecurrenceRule(rows[0]) : null;
}

export function deleteRecurrenceRule(db: DatabaseAdapter, eventId: string): void {
  db.execute('DELETE FROM rv_recurrence_rules WHERE event_id = ?', [eventId]);
}

export function createSeriesEntry(
  db: DatabaseAdapter,
  id: string,
  input: {
    parentEventId: string;
    occurrenceEventId: string;
    occurrenceIndex: number;
    occurrenceDate: string;
  },
): void {
  db.execute(
    `INSERT INTO rv_event_series (id, parent_event_id, occurrence_event_id, occurrence_index, occurrence_date, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, input.parentEventId, input.occurrenceEventId, input.occurrenceIndex, input.occurrenceDate, new Date().toISOString()],
  );
}

export function getSeriesByParent(db: DatabaseAdapter, parentEventId: string): EventSeriesEntry[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM rv_event_series WHERE parent_event_id = ? ORDER BY occurrence_index ASC',
      [parentEventId],
    )
    .map(rowToEventSeries);
}

export function cancelOccurrence(db: DatabaseAdapter, seriesEntryId: string): void {
  db.execute('UPDATE rv_event_series SET is_cancelled = 1 WHERE id = ?', [seriesEntryId]);
}

export function markOccurrenceModified(db: DatabaseAdapter, seriesEntryId: string): void {
  db.execute('UPDATE rv_event_series SET is_modified = 1 WHERE id = ?', [seriesEntryId]);
}

// ===== V3: Map/Directions =====

export function setEventCoordinates(
  db: DatabaseAdapter,
  eventId: string,
  lat: number | null,
  lng: number | null,
): void {
  db.execute('UPDATE rv_events SET location_lat = ?, location_lng = ? WHERE id = ?', [lat, lng, eventId]);
}

export function getEventCoordinates(
  db: DatabaseAdapter,
  eventId: string,
): { lat: number; lng: number } | null {
  const rows = db.query<{ location_lat: number | null; location_lng: number | null }>(
    'SELECT location_lat, location_lng FROM rv_events WHERE id = ?',
    [eventId],
  );
  if (rows.length === 0 || rows[0].location_lat == null || rows[0].location_lng == null) return null;
  return { lat: rows[0].location_lat, lng: rows[0].location_lng };
}

// ===== V3: Custom Invitation Designs =====

export function setEventDesign(
  db: DatabaseAdapter,
  eventId: string,
  designId: string | null,
  customJson: string | null,
): void {
  db.execute('UPDATE rv_events SET design_id = ?, design_custom_json = ? WHERE id = ?', [designId, customJson, eventId]);
}

export function getEventDesign(
  db: DatabaseAdapter,
  eventId: string,
): { designId: string | null; customJson: string | null } {
  const rows = db.query<{ design_id: string | null; design_custom_json: string | null }>(
    'SELECT design_id, design_custom_json FROM rv_events WHERE id = ?',
    [eventId],
  );
  if (rows.length === 0) return { designId: null, customJson: null };
  return { designId: rows[0].design_id, customJson: rows[0].design_custom_json };
}

// ===== V3: Guest Messaging =====

function rowToMessage(row: Record<string, unknown>): EventMessage {
  return {
    id: row.id as string,
    eventId: row.event_id as string,
    rsvpId: (row.rsvp_id as string) ?? null,
    senderName: row.sender_name as string,
    message: row.message as string,
    replyToId: (row.reply_to_id as string) ?? null,
    isHostMessage: Boolean(row.is_host_message as number),
    isPinned: Boolean(row.is_pinned as number),
    createdAt: row.created_at as string,
  };
}

export function createMessage(
  db: DatabaseAdapter,
  id: string,
  eventId: string,
  input: {
    senderName: string;
    message: string;
    rsvpId?: string;
    replyToId?: string;
    isHostMessage?: boolean;
  },
): void {
  db.execute(
    `INSERT INTO rv_messages (id, event_id, rsvp_id, sender_name, message, reply_to_id, is_host_message, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, eventId, input.rsvpId ?? null, input.senderName, input.message, input.replyToId ?? null, input.isHostMessage ? 1 : 0, new Date().toISOString()],
  );
}

export function getMessagesByEvent(
  db: DatabaseAdapter,
  eventId: string,
  limit = 50,
  offset = 0,
): EventMessage[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM rv_messages WHERE event_id = ? ORDER BY created_at ASC LIMIT ? OFFSET ?',
      [eventId, limit, offset],
    )
    .map(rowToMessage);
}

export function getPinnedMessages(db: DatabaseAdapter, eventId: string): EventMessage[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM rv_messages WHERE event_id = ? AND is_pinned = 1 ORDER BY created_at ASC',
      [eventId],
    )
    .map(rowToMessage);
}

export function pinMessage(db: DatabaseAdapter, messageId: string, eventId: string): void {
  // Atomically unpin oldest if at 3-pin limit, then pin new message
  db.execute(
    `UPDATE rv_messages SET is_pinned = 0
     WHERE id IN (
       SELECT id FROM rv_messages
       WHERE event_id = ? AND is_pinned = 1
       ORDER BY created_at ASC
       LIMIT MAX(0, (SELECT COUNT(*) FROM rv_messages WHERE event_id = ? AND is_pinned = 1) - 2)
     )`,
    [eventId, eventId],
  );
  db.execute('UPDATE rv_messages SET is_pinned = 1 WHERE id = ?', [messageId]);
}

export function unpinMessage(db: DatabaseAdapter, messageId: string): void {
  db.execute('UPDATE rv_messages SET is_pinned = 0 WHERE id = ?', [messageId]);
}

export function deleteMessage(db: DatabaseAdapter, messageId: string): void {
  db.execute('DELETE FROM rv_messages WHERE id = ?', [messageId]);
}

export function getMessageCount(db: DatabaseAdapter, eventId: string): number {
  const rows = db.query<{ count: number }>(
    'SELECT COUNT(*) AS count FROM rv_messages WHERE event_id = ?',
    [eventId],
  );
  return rows[0]?.count ?? 0;
}

// ===== V3: Gift Registry =====

function rowToRegistryItem(row: Record<string, unknown>): RegistryItem {
  return {
    id: row.id as string,
    eventId: row.event_id as string,
    name: row.name as string,
    description: (row.description as string) ?? null,
    category: row.category as RegistryCategory,
    url: (row.url as string) ?? null,
    priceCents: (row.price_cents as number) ?? null,
    quantityWanted: row.quantity_wanted as number,
    quantityClaimed: row.quantity_claimed as number,
    claimedByName: (row.claimed_by_name as string) ?? null,
    claimedAt: (row.claimed_at as string) ?? null,
    sortOrder: row.sort_order as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function createRegistryItem(
  db: DatabaseAdapter,
  id: string,
  eventId: string,
  input: {
    name: string;
    description?: string;
    category?: RegistryCategory;
    url?: string;
    priceCents?: number;
    quantityWanted?: number;
    sortOrder?: number;
  },
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO rv_registry_items (id, event_id, name, description, category, url, price_cents, quantity_wanted, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, eventId, input.name, input.description ?? null, input.category ?? 'other', input.url ?? null, input.priceCents ?? null, input.quantityWanted ?? 1, input.sortOrder ?? 0, now, now],
  );
}

export function getRegistryItemsByEvent(db: DatabaseAdapter, eventId: string): RegistryItem[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM rv_registry_items WHERE event_id = ? ORDER BY sort_order ASC, created_at ASC',
      [eventId],
    )
    .map(rowToRegistryItem);
}

export function updateRegistryItem(
  db: DatabaseAdapter,
  id: string,
  updates: Partial<{
    name: string;
    description: string;
    category: RegistryCategory;
    url: string;
    priceCents: number;
    quantityWanted: number;
    sortOrder: number;
  }>,
): void {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (updates.name !== undefined) { sets.push('name = ?'); params.push(updates.name); }
  if (updates.description !== undefined) { sets.push('description = ?'); params.push(updates.description); }
  if (updates.category !== undefined) { sets.push('category = ?'); params.push(updates.category); }
  if (updates.url !== undefined) { sets.push('url = ?'); params.push(updates.url); }
  if (updates.priceCents !== undefined) { sets.push('price_cents = ?'); params.push(updates.priceCents); }
  if (updates.quantityWanted !== undefined) { sets.push('quantity_wanted = ?'); params.push(updates.quantityWanted); }
  if (updates.sortOrder !== undefined) { sets.push('sort_order = ?'); params.push(updates.sortOrder); }

  if (sets.length === 0) return;
  sets.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(id);

  db.execute(`UPDATE rv_registry_items SET ${sets.join(', ')} WHERE id = ?`, params);
}

export function deleteRegistryItem(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM rv_registry_items WHERE id = ?', [id]);
}

export function claimRegistryItem(
  db: DatabaseAdapter,
  id: string,
  claimedByName: string,
): boolean {
  const now = new Date().toISOString();
  // Atomic check-and-update to prevent TOCTOU race (concurrent claims overclaiming)
  db.execute(
    `UPDATE rv_registry_items
     SET quantity_claimed = quantity_claimed + 1, claimed_by_name = ?, claimed_at = ?, updated_at = ?
     WHERE id = ? AND quantity_claimed < quantity_wanted`,
    [claimedByName, now, now, id],
  );
  const rows = db.query<{ changes: number }>('SELECT changes() AS changes', []);
  return (rows[0]?.changes ?? 0) > 0;
}

export function unclaimRegistryItem(db: DatabaseAdapter, id: string): void {
  // Atomic update to prevent TOCTOU race (concurrent unclaims going below zero)
  db.execute(
    `UPDATE rv_registry_items
     SET quantity_claimed = quantity_claimed - 1,
         claimed_by_name = CASE WHEN quantity_claimed - 1 = 0 THEN NULL ELSE claimed_by_name END,
         claimed_at = CASE WHEN quantity_claimed - 1 = 0 THEN NULL ELSE claimed_at END,
         updated_at = ?
     WHERE id = ? AND quantity_claimed > 0`,
    [new Date().toISOString(), id],
  );
}

// ===== V3: Seating Arrangement =====

function rowToSeatingTable(row: Record<string, unknown>): SeatingTable {
  return {
    id: row.id as string,
    eventId: row.event_id as string,
    label: row.label as string,
    shape: row.shape as TableShape,
    capacity: row.capacity as number,
    positionX: row.position_x as number,
    positionY: row.position_y as number,
    sortOrder: row.sort_order as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToSeatAssignment(row: Record<string, unknown>): SeatAssignment {
  return {
    id: row.id as string,
    tableId: row.table_id as string,
    eventId: row.event_id as string,
    rsvpId: (row.rsvp_id as string) ?? null,
    guestName: row.guest_name as string,
    seatNumber: (row.seat_number as number) ?? null,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
  };
}

export function createSeatingTable(
  db: DatabaseAdapter,
  id: string,
  eventId: string,
  input: {
    label: string;
    shape?: TableShape;
    capacity?: number;
    positionX?: number;
    positionY?: number;
    sortOrder?: number;
  },
): void {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO rv_tables (id, event_id, label, shape, capacity, position_x, position_y, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, eventId, input.label, input.shape ?? 'round', input.capacity ?? 8, input.positionX ?? 0, input.positionY ?? 0, input.sortOrder ?? 0, now, now],
  );
}

export function getTablesByEvent(db: DatabaseAdapter, eventId: string): SeatingTable[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM rv_tables WHERE event_id = ? ORDER BY sort_order ASC',
      [eventId],
    )
    .map(rowToSeatingTable);
}

export function updateSeatingTable(
  db: DatabaseAdapter,
  id: string,
  updates: Partial<{
    label: string;
    shape: TableShape;
    capacity: number;
    positionX: number;
    positionY: number;
    sortOrder: number;
  }>,
): void {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (updates.label !== undefined) { sets.push('label = ?'); params.push(updates.label); }
  if (updates.shape !== undefined) { sets.push('shape = ?'); params.push(updates.shape); }
  if (updates.capacity !== undefined) { sets.push('capacity = ?'); params.push(updates.capacity); }
  if (updates.positionX !== undefined) { sets.push('position_x = ?'); params.push(updates.positionX); }
  if (updates.positionY !== undefined) { sets.push('position_y = ?'); params.push(updates.positionY); }
  if (updates.sortOrder !== undefined) { sets.push('sort_order = ?'); params.push(updates.sortOrder); }

  if (sets.length === 0) return;
  sets.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(id);

  db.execute(`UPDATE rv_tables SET ${sets.join(', ')} WHERE id = ?`, params);
}

export function deleteSeatingTable(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM rv_tables WHERE id = ?', [id]);
}

export function assignSeat(
  db: DatabaseAdapter,
  id: string,
  input: {
    tableId: string;
    eventId: string;
    guestName: string;
    rsvpId?: string;
    seatNumber?: number;
    notes?: string;
  },
): void {
  db.execute(
    `INSERT INTO rv_seat_assignments (id, table_id, event_id, rsvp_id, guest_name, seat_number, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.tableId, input.eventId, input.rsvpId ?? null, input.guestName, input.seatNumber ?? null, input.notes ?? null, new Date().toISOString()],
  );
}

export function getAssignmentsByTable(db: DatabaseAdapter, tableId: string): SeatAssignment[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM rv_seat_assignments WHERE table_id = ? ORDER BY seat_number ASC, created_at ASC',
      [tableId],
    )
    .map(rowToSeatAssignment);
}

export function getAssignmentsByEvent(db: DatabaseAdapter, eventId: string): SeatAssignment[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM rv_seat_assignments WHERE event_id = ? ORDER BY created_at ASC',
      [eventId],
    )
    .map(rowToSeatAssignment);
}

export function removeSeatAssignment(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM rv_seat_assignments WHERE id = ?', [id]);
}
