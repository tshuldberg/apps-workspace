export { ALL_TABLES, CREATE_INDEXES, SEED_SETTINGS, V2_TABLES, V3_TABLES } from './schema';
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
  getRsvpSummary, getEventAnalytics, exportAttendanceCsv,
  getSetting, setSetting,
  // V2
  getCalendarEventId, setCalendarEventId,
  createExpense, getExpensesByEvent, getExpenseById, updateExpense, deleteExpense,
  createExpenseSplit, getExpenseSplitsByExpense, markSplitSettled, markSplitUnsettled, deleteExpenseSplitsByExpense,
  getDietaryResponses,
  // V3: Recurring events
  createRecurrenceRule, getRecurrenceRule, deleteRecurrenceRule,
  createSeriesEntry, getSeriesByParent, cancelOccurrence, markOccurrenceModified,
  // V3: Map/Directions
  setEventCoordinates, getEventCoordinates,
  // V3: Designs
  setEventDesign, getEventDesign,
  // V3: Messaging
  createMessage, getMessagesByEvent, getPinnedMessages, pinMessage, unpinMessage, deleteMessage, getMessageCount,
  // V3: Gift Registry
  createRegistryItem, getRegistryItemsByEvent, updateRegistryItem, deleteRegistryItem, claimRegistryItem, unclaimRegistryItem,
  // V3: Seating
  createSeatingTable, getTablesByEvent, updateSeatingTable, deleteSeatingTable,
  assignSeat, getAssignmentsByTable, getAssignmentsByEvent, removeSeatAssignment,
} from './crud';
