export { RSVP_MODULE } from './definition';
export { crossModule as rsvpCrossModule } from './cross-module';

// V1 types
export type {
  EventVisibility, InviteStatus, RsvpResponse, QuestionType, AnnouncementChannel, LinkType,
  PollOption, Event, EventCohost, Invite, Rsvp, EventQuestion, QuestionResponse,
  Poll, PollVote, Announcement, EventComment, EventPhoto, EventLink, RsvpSummary, EventAnalytics,
} from './types';
export {
  EventVisibilitySchema, InviteStatusSchema, RsvpResponseSchema, QuestionTypeSchema,
  AnnouncementChannelSchema, LinkTypeSchema, PollOptionSchema, EventSchema, EventCohostSchema,
  InviteSchema, RsvpSchema, EventQuestionSchema, QuestionResponseSchema, PollSchema, PollVoteSchema,
  AnnouncementSchema, EventCommentSchema, EventPhotoSchema, EventLinkSchema,
} from './types';

// V2 types
export type { CalendarExportFormat, SplitType, EventExpense, ExpenseSplitRecord, TemplateId, EventTemplate } from './types';
export { SplitTypeSchema, EventExpenseSchema, ExpenseSplitSchema } from './types';

// V3 types
export type {
  RecurrenceFrequency, RecurrenceEndType, RecurrenceRule, EventSeriesEntry,
  LocationCoordinates, DesignCategory, InvitationDesign, DesignCustomization,
  EventRecap, RecapHighlight, EventMessage, RegistryCategory, RegistryItem,
  TableShape, SeatingTable, SeatAssignment,
} from './types';
export { RecurrenceFrequencySchema, RecurrenceEndTypeSchema } from './types';

// V1 CRUD
export {
  createEvent, getEvents, getEventById, updateEvent, deleteEvent,
  addEventCohost, getEventCohosts, removeEventCohost,
  createInvite, getInvitesByEvent, updateInviteStatus, approveInviteRequest, moveInviteToWaitlist, deleteInvite,
  recordRsvp, getRsvpsByEvent, updateRsvp, checkInRsvp,
  createQuestion, getQuestionsByEvent, deleteQuestion, saveQuestionResponse, getQuestionResponsesByRsvp,
  createPoll, getPollsByEvent, votePollOption, getPollVotes, closePoll,
  createAnnouncement, markAnnouncementSent, getAnnouncementsByEvent,
  createComment, getCommentsByEvent,
  addPhoto, getPhotosByEvent, deletePhoto,
  setEventLink, getEventLinksByEvent, deleteEventLink,
  getRsvpSummary, getEventAnalytics, exportAttendanceCsv, getSetting, setSetting,
} from './db';

// V2 CRUD
export {
  getCalendarEventId, setCalendarEventId,
  createExpense, getExpensesByEvent, getExpenseById, updateExpense, deleteExpense,
  createExpenseSplit, getExpenseSplitsByExpense, markSplitSettled, markSplitUnsettled, deleteExpenseSplitsByExpense,
  getDietaryResponses,
} from './db';

// V3 CRUD
export {
  createRecurrenceRule, getRecurrenceRule, deleteRecurrenceRule,
  createSeriesEntry, getSeriesByParent, cancelOccurrence, markOccurrenceModified,
  setEventCoordinates, getEventCoordinates,
  setEventDesign, getEventDesign,
  createMessage, getMessagesByEvent, getPinnedMessages, pinMessage, unpinMessage, deleteMessage, getMessageCount,
  createRegistryItem, getRegistryItemsByEvent, updateRegistryItem, deleteRegistryItem, claimRegistryItem, unclaimRegistryItem,
  createSeatingTable, getTablesByEvent, updateSeatingTable, deleteSeatingTable,
  assignSeat, getAssignmentsByTable, getAssignmentsByEvent, removeSeatAssignment,
} from './db';

// V2 Engines
export { generateICalString, generateGoogleCalendarUrl, eventToICalEvent } from './engines/ical';
export { calculateEqualSplit, calculateSettlements, validateCustomSplit } from './engines/settlement';
export { getTemplates, getTemplateById, applyTemplate, EVENT_TEMPLATES } from './engines/templates';
export { DIETARY_OPTIONS, parseDietaryAnswer, formatDietaryAnswer, aggregateDietaryResponses } from './engines/dietary';
export type { ICalEvent } from './engines/ical';
export type { DietaryOption, DietaryAnswer, DietarySummary, OtherEntry } from './engines/dietary';
export type { Settlement, ExpenseSplit as SettlementSplit } from './engines/settlement';

// V3 Engines
export { calculateNextOccurrence, generateOccurrences, shouldGenerateMore } from './engines/recurrence';
export { buildAppleMapsUrl, buildGoogleMapsUrl, buildMapsSearchUrl, isVirtualLocation, buildDirectionsUrl } from './engines/location';
export { INVITATION_DESIGNS, getDesigns, getDesignById, getDesignsByCategory, applyDesignOverrides, autoContrastTextColor } from './engines/designs';
export { isRecapAvailable, calculateDurationMinutes, formatDuration, generateRecap } from './engines/recap';
export { validateAssignment, calculateRemainingCapacity, autoAssign, getUnassignedGuests, generateSeatingText } from './engines/seating';
export type { RecurrenceConfig } from './engines/recurrence';
export type { AssignmentInput } from './engines/seating';
