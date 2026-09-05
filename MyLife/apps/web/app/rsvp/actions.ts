'use server';

import { getAdapter, ensureModuleMigrations } from '@/lib/db';
import {
  addEventCohost,
  addPhoto,
  approveInviteRequest,
  checkInRsvp,
  createAnnouncement,
  createComment,
  createEvent,
  createInvite,
  createPoll,
  createQuestion,
  exportAttendanceCsv,
  getAnnouncementsByEvent,
  getCommentsByEvent,
  getEventAnalytics,
  getEventCohosts,
  getEventLinksByEvent,
  getEvents,
  getInvitesByEvent,
  getPhotosByEvent,
  getPollVotes,
  getPollsByEvent,
  getQuestionsByEvent,
  getRsvpSummary,
  getRsvpsByEvent,
  moveInviteToWaitlist,
  recordRsvp,
  saveQuestionResponse,
  setEventLink,
  votePollOption,
  type LinkType,
  type PollOption,
  type RsvpResponse,
} from '@mylife/rsvp';

function db() {
  const adapter = getAdapter();
  ensureModuleMigrations('rsvp');
  return adapter;
}

export async function fetchEvents() {
  try {
    return getEvents(db(), { includePast: true });
  } catch {
    throw new Error('Failed to load events');
  }
}

export async function doCreateEvent(
  id: string,
  input: {
    title: string;
    startAt: string;
    locationName?: string;
  },
) {
  try {
    createEvent(db(), id, {
      title: input.title,
      startAt: input.startAt,
      locationName: input.locationName,
      visibility: 'private',
      requiresApproval: true,
      waitlistEnabled: true,
      allowPlusOnes: true,
      allowPolls: true,
      allowPhotoAlbum: true,
      allowComments: true,
      allowChipIn: true,
      createdBy: 'Host',
    });
  } catch {
    throw new Error('Failed to create event');
  }
}

export async function fetchEventBundle(eventId: string) {
  try {
    const adapter = db();

    return {
      cohosts: getEventCohosts(adapter, eventId),
      invites: getInvitesByEvent(adapter, eventId),
      rsvps: getRsvpsByEvent(adapter, eventId),
      questions: getQuestionsByEvent(adapter, eventId),
      polls: getPollsByEvent(adapter, eventId),
      announcements: getAnnouncementsByEvent(adapter, eventId),
      comments: getCommentsByEvent(adapter, eventId),
      photos: getPhotosByEvent(adapter, eventId),
      links: getEventLinksByEvent(adapter, eventId),
      summary: getRsvpSummary(adapter, eventId),
      analytics: getEventAnalytics(adapter, eventId),
    };
  } catch {
    throw new Error('Failed to load event data');
  }
}

export async function fetchPollVotes(pollId: string) {
  try {
    return getPollVotes(db(), pollId);
  } catch {
    throw new Error('Failed to load poll votes');
  }
}

export async function doAddCohost(id: string, eventId: string, name: string) {
  try {
    addEventCohost(db(), id, eventId, { name, role: 'Cohost' });
  } catch {
    throw new Error('Failed to add cohost');
  }
}

export async function doAddInvite(
  id: string,
  eventId: string,
  input: {
    inviteeName: string;
    inviteeContact?: string;
    plusOneLimit?: number;
  },
) {
  try {
    createInvite(db(), id, eventId, {
      inviteeName: input.inviteeName,
      inviteeContact: input.inviteeContact,
      inviteeType: input.inviteeContact?.includes('@') ? 'email' : 'link',
      plusOneLimit: input.plusOneLimit ?? 0,
      status: 'requested',
    });
  } catch {
    throw new Error('Failed to add invite');
  }
}

export async function doApproveInvite(inviteId: string) {
  try {
    approveInviteRequest(db(), inviteId);
  } catch {
    throw new Error('Failed to approve invite');
  }
}

export async function doWaitlistInvite(inviteId: string) {
  try {
    moveInviteToWaitlist(db(), inviteId);
  } catch {
    throw new Error('Failed to waitlist invite');
  }
}

export async function doRecordRsvp(
  id: string,
  eventId: string,
  input: {
    inviteId?: string;
    guestName: string;
    guestContact?: string;
    response: RsvpResponse;
    plusOnesCount?: number;
  },
) {
  try {
    recordRsvp(db(), id, eventId, {
      inviteId: input.inviteId,
      guestName: input.guestName,
      guestContact: input.guestContact,
      response: input.response,
      plusOnesCount: input.plusOnesCount,
      source: 'web',
    });
  } catch {
    throw new Error('Failed to record RSVP');
  }
}

export async function doCheckInRsvp(rsvpId: string) {
  try {
    checkInRsvp(db(), rsvpId);
  } catch {
    throw new Error('Failed to check in guest');
  }
}

export async function doCreateQuestion(
  id: string,
  eventId: string,
  input: {
    label: string;
  },
) {
  try {
    createQuestion(db(), id, eventId, {
      label: input.label,
      type: 'text',
    });
  } catch {
    throw new Error('Failed to create question');
  }
}

export async function doSaveQuestionResponse(
  id: string,
  eventId: string,
  rsvpId: string,
  questionId: string,
  answer: string,
) {
  try {
    saveQuestionResponse(db(), id, eventId, rsvpId, questionId, answer);
  } catch {
    throw new Error('Failed to save response');
  }
}

export async function doCreatePoll(
  id: string,
  eventId: string,
  input: {
    question: string;
    options: PollOption[];
  },
) {
  try {
    createPoll(db(), id, eventId, {
      question: input.question,
      options: input.options,
      multipleChoice: false,
    });
  } catch {
    throw new Error('Failed to create poll');
  }
}

export async function doVotePollOption(
  id: string,
  pollId: string,
  input: {
    optionId: string;
    rsvpId?: string;
    guestName?: string;
  },
) {
  try {
    votePollOption(db(), id, pollId, input);
  } catch {
    throw new Error('Failed to vote');
  }
}

export async function doCreateAnnouncement(
  id: string,
  eventId: string,
  message: string,
) {
  try {
    createAnnouncement(db(), id, eventId, {
      message,
      sendChannel: 'all',
    });
  } catch {
    throw new Error('Failed to create announcement');
  }
}

export async function doCreateComment(
  id: string,
  eventId: string,
  input: {
    guestName: string;
    message: string;
    rsvpId?: string;
  },
) {
  try {
    createComment(db(), id, eventId, input);
  } catch {
    throw new Error('Failed to post comment');
  }
}

export async function doAddPhoto(
  id: string,
  eventId: string,
  input: {
    guestName: string;
    photoUrl: string;
    rsvpId?: string;
  },
) {
  try {
    addPhoto(db(), id, eventId, input);
  } catch {
    throw new Error('Failed to add photo');
  }
}

export async function doAddLink(
  id: string,
  eventId: string,
  input: {
    type: LinkType;
    label: string;
    url: string;
  },
) {
  try {
    setEventLink(db(), id, eventId, input);
  } catch {
    throw new Error('Failed to add link');
  }
}

export async function exportAttendanceCsvAction(eventId: string) {
  try {
    return exportAttendanceCsv(db(), eventId);
  } catch {
    throw new Error('Failed to export attendance');
  }
}
