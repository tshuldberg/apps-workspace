import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { RSVP_MODULE } from '../definition';
import {
  addEventCohost, approveInviteRequest, createAnnouncement, createComment,
  createEvent, createExpense, createExpenseSplit, createInvite, createPoll, createQuestion,
  deleteExpense, exportAttendanceCsv, getCalendarEventId, getEventAnalytics, getEventById,
  getEventCohosts, getExpensesByEvent, getExpenseSplitsByExpense, getInvitesByEvent,
  getPollVotes, getQuestionsByEvent, getDietaryResponses, getRsvpSummary, getRsvpsByEvent,
  markSplitSettled, recordRsvp, saveQuestionResponse, setCalendarEventId, votePollOption,
  // V3
  createRecurrenceRule, getRecurrenceRule, deleteRecurrenceRule,
  createSeriesEntry, getSeriesByParent, cancelOccurrence,
  setEventCoordinates, getEventCoordinates,
  setEventDesign, getEventDesign,
  createMessage, getMessagesByEvent, getPinnedMessages, pinMessage, deleteMessage, getMessageCount,
  createRegistryItem, getRegistryItemsByEvent, claimRegistryItem, unclaimRegistryItem, deleteRegistryItem,
  createSeatingTable, getTablesByEvent, deleteSeatingTable,
  assignSeat, getAssignmentsByTable, getAssignmentsByEvent, removeSeatAssignment,
} from '../db/crud';

describe('@mylife/rsvp', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('rsvp', RSVP_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  it('defines module metadata', () => {
    expect(RSVP_MODULE.id).toBe('rsvp');
    expect(RSVP_MODULE.tablePrefix).toBe('rv_');
    expect(RSVP_MODULE.navigation.tabs).toHaveLength(5);
  });

  it('creates event, invites, responses, and derives analytics', () => {
    createEvent(adapter, 'event-1', {
      title: 'Summer Rooftop Party',
      startAt: '2026-07-10T22:00:00.000Z',
      locationName: 'Skyline Roof',
      visibility: 'private',
      requiresApproval: true,
      waitlistEnabled: true,
    });

    const event = getEventById(adapter, 'event-1');
    expect(event).not.toBeNull();
    expect(event?.title).toBe('Summer Rooftop Party');

    addEventCohost(adapter, 'cohost-1', 'event-1', {
      name: 'Alex',
      role: 'Door + check-in',
    });
    expect(getEventCohosts(adapter, 'event-1')).toHaveLength(1);

    createInvite(adapter, 'invite-1', 'event-1', {
      inviteeName: 'Trey',
      inviteeContact: 'trey@example.com',
      inviteeType: 'email',
      plusOneLimit: 1,
      status: 'requested',
    });
    approveInviteRequest(adapter, 'invite-1');

    createInvite(adapter, 'invite-2', 'event-1', {
      inviteeName: 'Jordan',
      inviteeType: 'sms',
      status: 'invited',
    });

    const invites = getInvitesByEvent(adapter, 'event-1');
    expect(invites).toHaveLength(2);
    expect(invites.find((invite) => invite.id === 'invite-1')?.status).toBe('approved');

    recordRsvp(adapter, 'rsvp-1', 'event-1', {
      inviteId: 'invite-1',
      guestName: 'Trey',
      guestContact: 'trey@example.com',
      response: 'going',
      plusOnesCount: 1,
      source: 'link',
    });

    recordRsvp(adapter, 'rsvp-2', 'event-1', {
      inviteId: 'invite-2',
      guestName: 'Jordan',
      response: 'maybe',
      source: 'app',
    });

    const responses = getRsvpsByEvent(adapter, 'event-1');
    expect(responses).toHaveLength(2);

    const summary = getRsvpSummary(adapter, 'event-1');
    expect(summary.approved).toBe(1);
    expect(summary.invited).toBe(1);
    expect(summary.going).toBe(1);
    expect(summary.maybe).toBe(1);
    expect(summary.plusOnes).toBe(1);

    createQuestion(adapter, 'question-1', 'event-1', {
      label: 'Dietary restrictions?',
      type: 'dietary',
      required: true,
    });
    expect(getQuestionsByEvent(adapter, 'event-1')).toHaveLength(1);

    saveQuestionResponse(adapter, 'answer-1', 'event-1', 'rsvp-1', 'question-1', 'Vegetarian');

    createPoll(adapter, 'poll-1', 'event-1', {
      question: 'Best arrival window?',
      options: [
        { id: 'opt-1', label: '7:00 PM' },
        { id: 'opt-2', label: '8:00 PM' },
      ],
      multipleChoice: false,
    });

    votePollOption(adapter, 'vote-1', 'poll-1', {
      rsvpId: 'rsvp-1',
      optionId: 'opt-1',
    });
    votePollOption(adapter, 'vote-2', 'poll-1', {
      rsvpId: 'rsvp-1',
      optionId: 'opt-2',
    });

    // Single-choice poll keeps one latest vote per voter.
    const votes = getPollVotes(adapter, 'poll-1');
    expect(votes).toHaveLength(1);
    expect(votes[0]?.optionId).toBe('opt-2');

    createAnnouncement(adapter, 'announce-1', 'event-1', {
      message: 'Reminder: dress code is rooftop casual.',
      sendChannel: 'all',
    });

    createComment(adapter, 'comment-1', 'event-1', {
      guestName: 'Trey',
      message: 'Can I bring sparkling water?',
      rsvpId: 'rsvp-1',
    });

    const analytics = getEventAnalytics(adapter, 'event-1');
    expect(analytics.responses).toBe(2);
    expect(analytics.announcements).toBe(1);
    expect(analytics.comments).toBe(1);

    const csv = exportAttendanceCsv(adapter, 'event-1');
    expect(csv).toContain('Guest Name');
    expect(csv).toContain('Trey');
    expect(csv).toContain('Jordan');
  });

  // --- V2 Integration Tests ---

  it('V2 migration: calendar_event_id tracking', () => {
    createEvent(adapter, 'cal-evt', { title: 'Calendar Test', startAt: '2026-08-01T18:00:00.000Z' });
    expect(getCalendarEventId(adapter, 'cal-evt')).toBeNull();

    setCalendarEventId(adapter, 'cal-evt', 'device-cal-123');
    expect(getCalendarEventId(adapter, 'cal-evt')).toBe('device-cal-123');

    setCalendarEventId(adapter, 'cal-evt', null);
    expect(getCalendarEventId(adapter, 'cal-evt')).toBeNull();
  });

  it('V2 migration: expense splitting CRUD', () => {
    createEvent(adapter, 'exp-evt', { title: 'Expense Test', startAt: '2026-08-01T18:00:00.000Z' });

    createExpense(adapter, 'exp-1', 'exp-evt', {
      description: 'Pizza',
      amountCents: 8000,
      paidByName: 'Alice',
      splitType: 'equal',
    });

    const expenses = getExpensesByEvent(adapter, 'exp-evt');
    expect(expenses).toHaveLength(1);
    expect(expenses[0].description).toBe('Pizza');
    expect(expenses[0].amountCents).toBe(8000);

    createExpenseSplit(adapter, 'split-1', 'exp-1', { participantName: 'Alice', amountCents: 2000 });
    createExpenseSplit(adapter, 'split-2', 'exp-1', { participantName: 'Bob', amountCents: 2000 });
    createExpenseSplit(adapter, 'split-3', 'exp-1', { participantName: 'Carol', amountCents: 2000 });
    createExpenseSplit(adapter, 'split-4', 'exp-1', { participantName: 'Dave', amountCents: 2000 });

    const splits = getExpenseSplitsByExpense(adapter, 'exp-1');
    expect(splits).toHaveLength(4);
    expect(splits.every((s) => s.amountCents === 2000)).toBe(true);

    markSplitSettled(adapter, 'split-2');
    const updated = getExpenseSplitsByExpense(adapter, 'exp-1');
    const settled = updated.find((s) => s.id === 'split-2');
    expect(settled?.isSettled).toBe(true);
    expect(settled?.settledAt).not.toBeNull();
  });

  it('V2 migration: expense cascade deletes', () => {
    createEvent(adapter, 'cascade-evt', { title: 'Cascade Test', startAt: '2026-08-01T18:00:00.000Z' });
    createExpense(adapter, 'cascade-exp', 'cascade-evt', {
      description: 'Uber',
      amountCents: 2500,
      paidByName: 'Alice',
    });
    createExpenseSplit(adapter, 'cascade-split', 'cascade-exp', { participantName: 'Bob', amountCents: 1250 });

    deleteExpense(adapter, 'cascade-exp');
    expect(getExpensesByEvent(adapter, 'cascade-evt')).toHaveLength(0);
    expect(getExpenseSplitsByExpense(adapter, 'cascade-exp')).toHaveLength(0);
  });

  it('V2 migration: dietary responses query', () => {
    createEvent(adapter, 'diet-evt', { title: 'Dietary Test', startAt: '2026-08-01T18:00:00.000Z' });
    createQuestion(adapter, 'diet-q', 'diet-evt', { label: 'Dietary?', type: 'dietary', sortOrder: 100 });
    recordRsvp(adapter, 'diet-rsvp', 'diet-evt', { guestName: 'Alice', response: 'going' });
    saveQuestionResponse(adapter, 'diet-ans', 'diet-evt', 'diet-rsvp', 'diet-q', '{"selections":["vegetarian"],"other":null}');

    const responses = getDietaryResponses(adapter, 'diet-evt');
    expect(responses).toHaveLength(1);
    expect(responses[0].guestName).toBe('Alice');
    expect(responses[0].rsvpResponse).toBe('going');
  });

  // --- V3 Integration Tests ---

  it('V3: recurrence rules CRUD', () => {
    createEvent(adapter, 'rec-evt', { title: 'Weekly Game Night', startAt: '2026-07-04T19:00:00.000Z' });
    createRecurrenceRule(adapter, 'rec-1', 'rec-evt', { frequency: 'weekly', endType: 'after_count', endAfterCount: 8 });

    const rule = getRecurrenceRule(adapter, 'rec-evt');
    expect(rule).not.toBeNull();
    expect(rule!.frequency).toBe('weekly');
    expect(rule!.endAfterCount).toBe(8);

    deleteRecurrenceRule(adapter, 'rec-evt');
    expect(getRecurrenceRule(adapter, 'rec-evt')).toBeNull();
  });

  it('V3: event series with cancellation', () => {
    createEvent(adapter, 'ser-parent', { title: 'Parent', startAt: '2026-07-04T19:00:00.000Z' });
    createEvent(adapter, 'ser-occ-1', { title: 'Occurrence 1', startAt: '2026-07-11T19:00:00.000Z' });
    createSeriesEntry(adapter, 'se-1', { parentEventId: 'ser-parent', occurrenceEventId: 'ser-occ-1', occurrenceIndex: 1, occurrenceDate: '2026-07-11' });

    const series = getSeriesByParent(adapter, 'ser-parent');
    expect(series).toHaveLength(1);
    expect(series[0].isCancelled).toBe(false);

    cancelOccurrence(adapter, 'se-1');
    const updated = getSeriesByParent(adapter, 'ser-parent');
    expect(updated[0].isCancelled).toBe(true);
  });

  it('V3: map coordinates', () => {
    createEvent(adapter, 'map-evt', { title: 'Map Test', startAt: '2026-08-01T18:00:00.000Z' });
    expect(getEventCoordinates(adapter, 'map-evt')).toBeNull();

    setEventCoordinates(adapter, 'map-evt', 37.7749, -122.4194);
    const coords = getEventCoordinates(adapter, 'map-evt');
    expect(coords).not.toBeNull();
    expect(coords!.lat).toBeCloseTo(37.7749);
    expect(coords!.lng).toBeCloseTo(-122.4194);
  });

  it('V3: invitation designs', () => {
    createEvent(adapter, 'design-evt', { title: 'Design Test', startAt: '2026-08-01T18:00:00.000Z' });
    const initial = getEventDesign(adapter, 'design-evt');
    expect(initial.designId).toBeNull();

    setEventDesign(adapter, 'design-evt', 'confetti', '{"accentColor":"#00FF00"}');
    const design = getEventDesign(adapter, 'design-evt');
    expect(design.designId).toBe('confetti');
    expect(design.customJson).toContain('#00FF00');

    setEventDesign(adapter, 'design-evt', null, null);
    expect(getEventDesign(adapter, 'design-evt').designId).toBeNull();
  });

  it('V3: guest messaging with pinning', () => {
    createEvent(adapter, 'chat-evt', { title: 'Chat Test', startAt: '2026-08-01T18:00:00.000Z' });
    createMessage(adapter, 'msg-1', 'chat-evt', { senderName: 'Alice', message: 'Hello!' });
    createMessage(adapter, 'msg-2', 'chat-evt', { senderName: 'Bob', message: 'Hey!', replyToId: 'msg-1' });
    createMessage(adapter, 'msg-3', 'chat-evt', { senderName: 'Host', message: 'Welcome!', isHostMessage: true });

    const messages = getMessagesByEvent(adapter, 'chat-evt');
    expect(messages).toHaveLength(3);
    expect(messages[0].senderName).toBe('Alice');
    expect(messages[1].replyToId).toBe('msg-1');
    expect(messages[2].isHostMessage).toBe(true);
    expect(getMessageCount(adapter, 'chat-evt')).toBe(3);

    pinMessage(adapter, 'msg-3', 'chat-evt');
    expect(getPinnedMessages(adapter, 'chat-evt')).toHaveLength(1);

    deleteMessage(adapter, 'msg-1');
    expect(getMessagesByEvent(adapter, 'chat-evt')).toHaveLength(2);
  });

  it('V3: gift registry with claims', () => {
    createEvent(adapter, 'reg-evt', { title: 'Registry Test', startAt: '2026-08-01T18:00:00.000Z' });
    createRegistryItem(adapter, 'item-1', 'reg-evt', { name: 'Stand Mixer', category: 'kitchen', priceCents: 29999 });
    createRegistryItem(adapter, 'item-2', 'reg-evt', { name: 'Cooking Class', category: 'experiences', quantityWanted: 2 });

    const items = getRegistryItemsByEvent(adapter, 'reg-evt');
    expect(items).toHaveLength(2);
    expect(items[0].name).toBe('Stand Mixer');

    const claimed = claimRegistryItem(adapter, 'item-1', 'Alice');
    expect(claimed).toBe(true);
    const afterClaim = getRegistryItemsByEvent(adapter, 'reg-evt');
    expect(afterClaim.find((i) => i.id === 'item-1')!.quantityClaimed).toBe(1);

    // Cannot claim again (quantity 1)
    expect(claimRegistryItem(adapter, 'item-1', 'Bob')).toBe(false);

    // Multi-quantity: can claim twice
    expect(claimRegistryItem(adapter, 'item-2', 'Bob')).toBe(true);
    expect(claimRegistryItem(adapter, 'item-2', 'Carol')).toBe(true);
    expect(claimRegistryItem(adapter, 'item-2', 'Dave')).toBe(false);

    unclaimRegistryItem(adapter, 'item-1');
    expect(getRegistryItemsByEvent(adapter, 'reg-evt').find((i) => i.id === 'item-1')!.quantityClaimed).toBe(0);

    deleteRegistryItem(adapter, 'item-1');
    expect(getRegistryItemsByEvent(adapter, 'reg-evt')).toHaveLength(1);
  });

  it('V3: seating arrangement', () => {
    createEvent(adapter, 'seat-evt', { title: 'Seating Test', startAt: '2026-08-01T18:00:00.000Z' });
    createSeatingTable(adapter, 'tbl-1', 'seat-evt', { label: 'Table 1', shape: 'round', capacity: 4, sortOrder: 0 });
    createSeatingTable(adapter, 'tbl-2', 'seat-evt', { label: 'Table 2', shape: 'rectangle', capacity: 6, sortOrder: 1 });

    const tables = getTablesByEvent(adapter, 'seat-evt');
    expect(tables).toHaveLength(2);
    expect(tables[0].label).toBe('Table 1');
    expect(tables[0].shape).toBe('round');

    assignSeat(adapter, 'sa-1', { tableId: 'tbl-1', eventId: 'seat-evt', guestName: 'Alice' });
    assignSeat(adapter, 'sa-2', { tableId: 'tbl-1', eventId: 'seat-evt', guestName: 'Bob' });
    assignSeat(adapter, 'sa-3', { tableId: 'tbl-2', eventId: 'seat-evt', guestName: 'Carol' });

    expect(getAssignmentsByTable(adapter, 'tbl-1')).toHaveLength(2);
    expect(getAssignmentsByTable(adapter, 'tbl-2')).toHaveLength(1);
    expect(getAssignmentsByEvent(adapter, 'seat-evt')).toHaveLength(3);

    removeSeatAssignment(adapter, 'sa-1');
    expect(getAssignmentsByTable(adapter, 'tbl-1')).toHaveLength(1);

    deleteSeatingTable(adapter, 'tbl-1');
    expect(getTablesByEvent(adapter, 'seat-evt')).toHaveLength(1);
    // CASCADE: assignments for tbl-1 should be deleted too
    expect(getAssignmentsByEvent(adapter, 'seat-evt')).toHaveLength(1); // only Carol at tbl-2
  });
});
