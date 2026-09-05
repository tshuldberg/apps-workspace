import { z } from 'zod';

export const EventVisibilitySchema = z.enum(['public', 'unlisted', 'private']);
export type EventVisibility = z.infer<typeof EventVisibilitySchema>;

export const InviteStatusSchema = z.enum([
  'invited',
  'requested',
  'approved',
  'declined',
  'waitlisted',
]);
export type InviteStatus = z.infer<typeof InviteStatusSchema>;

export const RsvpResponseSchema = z.enum(['going', 'maybe', 'declined', 'waitlisted']);
export type RsvpResponse = z.infer<typeof RsvpResponseSchema>;

export const QuestionTypeSchema = z.enum([
  'text',
  'single',
  'multi',
  'number',
  'boolean',
  'dietary',
]);
export type QuestionType = z.infer<typeof QuestionTypeSchema>;

export const AnnouncementChannelSchema = z.enum(['all', 'email', 'sms', 'push']);
export type AnnouncementChannel = z.infer<typeof AnnouncementChannelSchema>;

export const LinkTypeSchema = z.enum(['chip_in', 'registry', 'playlist', 'other']);
export type LinkType = z.infer<typeof LinkTypeSchema>;

export const PollOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
});
export type PollOption = z.infer<typeof PollOptionSchema>;

export const EventSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  startAt: z.string(),
  endAt: z.string().nullable(),
  timezone: z.string(),
  locationName: z.string().nullable(),
  locationAddress: z.string().nullable(),
  coverImageUrl: z.string().nullable(),
  visibility: EventVisibilitySchema,
  password: z.string().nullable(),
  requiresApproval: z.boolean(),
  allowPlusOnes: z.boolean(),
  maxGuests: z.number().int().nullable(),
  waitlistEnabled: z.boolean(),
  allowPhotoAlbum: z.boolean(),
  allowComments: z.boolean(),
  allowPolls: z.boolean(),
  allowCohosts: z.boolean(),
  allowChipIn: z.boolean(),
  chipInUrl: z.string().nullable(),
  createdBy: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Event = z.infer<typeof EventSchema>;

export const EventCohostSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  name: z.string(),
  role: z.string().nullable(),
  createdAt: z.string(),
});
export type EventCohost = z.infer<typeof EventCohostSchema>;

export const InviteSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  inviteeName: z.string(),
  inviteeContact: z.string().nullable(),
  inviteeType: z.string(),
  status: InviteStatusSchema,
  plusOneLimit: z.number().int(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Invite = z.infer<typeof InviteSchema>;

export const RsvpSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  inviteId: z.string().nullable(),
  guestName: z.string(),
  guestContact: z.string().nullable(),
  response: RsvpResponseSchema,
  plusOnesCount: z.number().int(),
  notes: z.string().nullable(),
  respondedAt: z.string(),
  checkedInAt: z.string().nullable(),
  source: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Rsvp = z.infer<typeof RsvpSchema>;

export const EventQuestionSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  label: z.string(),
  type: QuestionTypeSchema,
  options: z.array(z.string()),
  required: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
});
export type EventQuestion = z.infer<typeof EventQuestionSchema>;

export const QuestionResponseSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  rsvpId: z.string(),
  questionId: z.string(),
  answer: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]).nullable(),
  createdAt: z.string(),
});
export type QuestionResponse = z.infer<typeof QuestionResponseSchema>;

export const PollSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  question: z.string(),
  options: z.array(PollOptionSchema),
  multipleChoice: z.boolean(),
  isOpen: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Poll = z.infer<typeof PollSchema>;

export const PollVoteSchema = z.object({
  id: z.string(),
  pollId: z.string(),
  rsvpId: z.string().nullable(),
  guestName: z.string().nullable(),
  optionId: z.string(),
  createdAt: z.string(),
});
export type PollVote = z.infer<typeof PollVoteSchema>;

export const AnnouncementSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  message: z.string(),
  sendChannel: AnnouncementChannelSchema,
  scheduledFor: z.string().nullable(),
  sentAt: z.string().nullable(),
  createdAt: z.string(),
});
export type Announcement = z.infer<typeof AnnouncementSchema>;

export const EventCommentSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  rsvpId: z.string().nullable(),
  guestName: z.string(),
  message: z.string(),
  createdAt: z.string(),
});
export type EventComment = z.infer<typeof EventCommentSchema>;

export const EventPhotoSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  rsvpId: z.string().nullable(),
  guestName: z.string(),
  photoUrl: z.string(),
  caption: z.string().nullable(),
  createdAt: z.string(),
});
export type EventPhoto = z.infer<typeof EventPhotoSchema>;

export const EventLinkSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  type: LinkTypeSchema,
  label: z.string(),
  url: z.string(),
  createdAt: z.string(),
});
export type EventLink = z.infer<typeof EventLinkSchema>;

export interface RsvpSummary {
  invited: number;
  requested: number;
  approved: number;
  waitlisted: number;
  going: number;
  maybe: number;
  declined: number;
  checkedIn: number;
  plusOnes: number;
}

export interface EventAnalytics extends RsvpSummary {
  eventId: string;
  responses: number;
  responseRate: number;
  announcements: number;
  comments: number;
  photos: number;
  polls: number;
}

// --- Calendar Sync types ---

export type CalendarExportFormat = 'ical' | 'google';

// --- Expense Splitting types ---

export const SplitTypeSchema = z.enum(['equal', 'custom', 'itemized']);
export type SplitType = z.infer<typeof SplitTypeSchema>;

export const EventExpenseSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  description: z.string(),
  amountCents: z.number().int(),
  paidByName: z.string(),
  splitType: SplitTypeSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type EventExpense = z.infer<typeof EventExpenseSchema>;

export const ExpenseSplitSchema = z.object({
  id: z.string(),
  expenseId: z.string(),
  participantName: z.string(),
  amountCents: z.number().int(),
  isSettled: z.boolean(),
  settledAt: z.string().nullable(),
  createdAt: z.string(),
});
export type ExpenseSplitRecord = z.infer<typeof ExpenseSplitSchema>;

// --- Event Template types ---

export type TemplateId =
  | 'birthday'
  | 'dinner_party'
  | 'game_night'
  | 'wedding'
  | 'baby_shower'
  | 'holiday'
  | 'brunch'
  | 'happy_hour'
  | 'potluck'
  | 'movie_night'
  | 'bbq'
  | 'book_club';

export interface EventTemplate {
  id: TemplateId;
  name: string;
  icon: string;
  description: string;
  suggestedDurationHours: number;
  suggestedDescription: string;
  suggestedSettings: Record<string, unknown>;
  suggestedQuestions: Array<{ label: string; type: string; sortOrder: number }>;
  hostChecklist: string[];
}

// --- V3: Recurring events ---

export const RecurrenceFrequencySchema = z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'custom']);
export type RecurrenceFrequency = z.infer<typeof RecurrenceFrequencySchema>;

export const RecurrenceEndTypeSchema = z.enum(['never', 'after_count', 'by_date']);
export type RecurrenceEndType = z.infer<typeof RecurrenceEndTypeSchema>;

export interface RecurrenceRule {
  id: string;
  eventId: string;
  frequency: RecurrenceFrequency;
  intervalCount: number;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  endType: RecurrenceEndType;
  endAfterCount: number | null;
  endByDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EventSeriesEntry {
  id: string;
  parentEventId: string;
  occurrenceEventId: string;
  occurrenceIndex: number;
  occurrenceDate: string;
  isCancelled: boolean;
  isModified: boolean;
  createdAt: string;
}

// --- V3: Map/Directions ---

export interface LocationCoordinates {
  lat: number;
  lng: number;
}

// --- V3: Custom Invitation Designs ---

export type DesignCategory = 'celebration' | 'elegant' | 'casual' | 'seasonal' | 'minimal';

export interface InvitationDesign {
  id: string;
  name: string;
  category: DesignCategory;
  backgroundColor: string;
  backgroundPattern: string | null;
  accentColor: string;
  textColor: string;
  headerFont: string;
  headerWeight: number;
}

export interface DesignCustomization {
  accentColor?: string;
  textColor?: string;
  backgroundImageUrl?: string;
}

// --- V3: Event Recap ---

export interface RecapHighlight {
  label: string;
  value: string;
  icon: string;
}

export interface EventRecap {
  eventId: string;
  title: string;
  date: string;
  location: string | null;
  durationMinutes: number;
  attendeeCount: number;
  plusOnesCount: number;
  photoCount: number;
  highlights: RecapHighlight[];
  firstResponder: string | null;
  responseRate: number;
  expenseTotalCents: number;
}

// --- V3: Guest Messaging ---

export interface EventMessage {
  id: string;
  eventId: string;
  rsvpId: string | null;
  senderName: string;
  message: string;
  replyToId: string | null;
  isHostMessage: boolean;
  isPinned: boolean;
  createdAt: string;
}

// --- V3: Gift Registry ---

export type RegistryCategory = 'kitchen' | 'clothing' | 'experiences' | 'home' | 'baby' | 'electronics' | 'books' | 'other';

export interface RegistryItem {
  id: string;
  eventId: string;
  name: string;
  description: string | null;
  category: RegistryCategory;
  url: string | null;
  priceCents: number | null;
  quantityWanted: number;
  quantityClaimed: number;
  claimedByName: string | null;
  claimedAt: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// --- V3: Seating Arrangement ---

export type TableShape = 'round' | 'rectangle' | 'long';

export interface SeatingTable {
  id: string;
  eventId: string;
  label: string;
  shape: TableShape;
  capacity: number;
  positionX: number;
  positionY: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface SeatAssignment {
  id: string;
  tableId: string;
  eventId: string;
  rsvpId: string | null;
  guestName: string;
  seatNumber: number | null;
  notes: string | null;
  createdAt: string;
}
