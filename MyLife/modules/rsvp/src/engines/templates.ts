/**
 * Event templates engine for RSVP module.
 * 12 built-in templates for common event types.
 * Templates are static data -- no database storage, no network.
 */

import type { EventTemplate } from '../types';

export const EVENT_TEMPLATES: EventTemplate[] = [
  {
    id: 'birthday',
    name: 'Birthday Party',
    icon: '\u{1F382}',
    description: 'Celebrate with friends and family',
    suggestedDurationHours: 3,
    suggestedDescription: 'Come celebrate! Gifts welcome but not required.',
    suggestedSettings: {
      allowPlusOnes: true,
      allowPhotoAlbum: true,
      allowComments: true,
    },
    suggestedQuestions: [
      { label: 'Any dietary restrictions?', type: 'dietary', sortOrder: 100 },
    ],
    hostChecklist: [
      'Book venue or set up space',
      'Order cake',
      'Send invites 2 weeks ahead',
      'Plan activities or games',
      'Arrange decorations',
    ],
  },
  {
    id: 'dinner_party',
    name: 'Dinner Party',
    icon: '\u{1F37D}\u{FE0F}',
    description: 'Intimate dinner with great company',
    suggestedDurationHours: 3,
    suggestedDescription: 'Join us for an evening of good food and conversation.',
    suggestedSettings: {
      allowPlusOnes: false,
      maxGuests: 12,
      allowPhotoAlbum: true,
      allowComments: true,
    },
    suggestedQuestions: [
      { label: 'Any dietary restrictions?', type: 'dietary', sortOrder: 100 },
    ],
    hostChecklist: [
      'Plan menu',
      'Buy groceries',
      'Set the table',
      'Prep appetizers the night before',
      'Chill wine',
    ],
  },
  {
    id: 'game_night',
    name: 'Game Night',
    icon: '\u{1F3B2}',
    description: 'Board games, card games, and fun',
    suggestedDurationHours: 4,
    suggestedDescription: 'Bring your favorite games! Snacks provided.',
    suggestedSettings: {
      allowPlusOnes: true,
      allowComments: true,
    },
    suggestedQuestions: [
      { label: 'What games do you want to play?', type: 'text', sortOrder: 100 },
    ],
    hostChecklist: [
      'Pick out games',
      'Set up game area',
      'Buy snacks and drinks',
      'Have extra chairs ready',
    ],
  },
  {
    id: 'wedding',
    name: 'Wedding',
    icon: '\u{1F48D}',
    description: 'Your special day',
    suggestedDurationHours: 8,
    suggestedDescription: 'We would be honored to have you celebrate with us.',
    suggestedSettings: {
      requiresApproval: true,
      allowPlusOnes: true,
      allowPhotoAlbum: true,
      allowComments: true,
    },
    suggestedQuestions: [
      { label: 'Any dietary restrictions?', type: 'dietary', sortOrder: 100 },
      { label: 'Song request for the DJ?', type: 'text', sortOrder: 101 },
    ],
    hostChecklist: [
      'Finalize venue details',
      'Confirm catering',
      'Send invites 6 weeks ahead',
      'Arrange seating chart',
      'Book photographer',
      'Prepare vows',
    ],
  },
  {
    id: 'baby_shower',
    name: 'Baby Shower',
    icon: '\u{1F476}',
    description: 'Welcome the little one',
    suggestedDurationHours: 3,
    suggestedDescription: 'Join us in celebrating the upcoming arrival!',
    suggestedSettings: {
      allowPlusOnes: false,
      allowPhotoAlbum: true,
      allowComments: true,
    },
    suggestedQuestions: [
      { label: 'Any dietary restrictions?', type: 'dietary', sortOrder: 100 },
    ],
    hostChecklist: [
      'Set up gift registry',
      'Order cake',
      'Plan games',
      'Arrange decorations',
      'Buy thank-you cards',
    ],
  },
  {
    id: 'holiday',
    name: 'Holiday Gathering',
    icon: '\u{1F384}',
    description: 'Seasonal celebration with loved ones',
    suggestedDurationHours: 5,
    suggestedDescription: 'Tis the season! Come celebrate with us.',
    suggestedSettings: {
      allowPlusOnes: true,
      allowPhotoAlbum: true,
      allowComments: true,
    },
    suggestedQuestions: [
      { label: 'Any dietary restrictions?', type: 'dietary', sortOrder: 100 },
      { label: 'What are you bringing?', type: 'text', sortOrder: 101 },
    ],
    hostChecklist: [
      'Plan menu and assign dishes',
      'Decorate',
      'Set up seating',
      'Prepare drinks station',
      'Queue holiday playlist',
    ],
  },
  {
    id: 'brunch',
    name: 'Brunch',
    icon: '\u{1F95E}',
    description: 'Late morning bites and good vibes',
    suggestedDurationHours: 2,
    suggestedDescription: 'Brunch is served! Join us for a relaxed morning.',
    suggestedSettings: {
      allowPlusOnes: false,
      maxGuests: 10,
      allowComments: true,
    },
    suggestedQuestions: [
      { label: 'Any dietary restrictions?', type: 'dietary', sortOrder: 100 },
    ],
    hostChecklist: [
      'Plan brunch menu',
      'Buy coffee and juice',
      'Set the table',
      'Prep what you can the night before',
    ],
  },
  {
    id: 'happy_hour',
    name: 'Happy Hour',
    icon: '\u{1F378}',
    description: 'Drinks and conversation',
    suggestedDurationHours: 2,
    suggestedDescription: 'Grab a drink with us after work! Plus-ones welcome.',
    suggestedSettings: {
      allowPlusOnes: true,
      allowComments: true,
    },
    suggestedQuestions: [],
    hostChecklist: [
      'Reserve table or area',
      'Share venue address',
      'Confirm headcount day-of',
    ],
  },
  {
    id: 'potluck',
    name: 'Potluck',
    icon: '\u{1F957}',
    description: 'Everyone brings a dish to share',
    suggestedDurationHours: 3,
    suggestedDescription: 'Bring your favorite dish to share with the group!',
    suggestedSettings: {
      allowPlusOnes: true,
      allowPhotoAlbum: true,
      allowComments: true,
    },
    suggestedQuestions: [
      { label: 'What are you bringing?', type: 'text', sortOrder: 100 },
      { label: 'Any dietary restrictions?', type: 'dietary', sortOrder: 101 },
    ],
    hostChecklist: [
      'Coordinate who brings what',
      'Provide plates and utensils',
      'Set up serving area',
      'Have labels for dishes',
    ],
  },
  {
    id: 'movie_night',
    name: 'Movie Night',
    icon: '\u{1F37F}',
    description: 'Grab some popcorn and settle in',
    suggestedDurationHours: 3,
    suggestedDescription: 'Movie night! Vote on what we watch.',
    suggestedSettings: {
      allowComments: true,
      allowPolls: true,
    },
    suggestedQuestions: [
      { label: 'What should we watch?', type: 'text', sortOrder: 100 },
    ],
    hostChecklist: [
      'Set up screen and sound',
      'Buy popcorn and snacks',
      'Prepare movie options',
      'Arrange seating',
    ],
  },
  {
    id: 'bbq',
    name: 'BBQ / Cookout',
    icon: '\u{1F525}',
    description: 'Grilling and chilling outdoors',
    suggestedDurationHours: 5,
    suggestedDescription: 'Come for the BBQ, stay for the good times!',
    suggestedSettings: {
      allowPlusOnes: true,
      allowPhotoAlbum: true,
      allowComments: true,
    },
    suggestedQuestions: [
      { label: 'Any dietary restrictions?', type: 'dietary', sortOrder: 100 },
      { label: 'Bringing anything?', type: 'text', sortOrder: 101 },
    ],
    hostChecklist: [
      'Buy meat and veggies',
      'Clean the grill',
      'Set up outdoor seating',
      'Stock cooler with drinks',
      'Have bug spray ready',
    ],
  },
  {
    id: 'book_club',
    name: 'Book Club',
    icon: '\u{1F4DA}',
    description: 'Discuss great reads together',
    suggestedDurationHours: 2,
    suggestedDescription: 'This month we are reading... Join us for the discussion!',
    suggestedSettings: {
      allowComments: true,
      allowPolls: true,
    },
    suggestedQuestions: [
      { label: 'Have you finished the book?', type: 'boolean', sortOrder: 100 },
    ],
    hostChecklist: [
      'Announce the book selection',
      'Send reading schedule',
      'Prepare discussion questions',
      'Arrange snacks',
    ],
  },
];

/**
 * Get all available event templates.
 */
export function getTemplates(): EventTemplate[] {
  return EVENT_TEMPLATES;
}

/**
 * Get a template by its ID.
 * Returns null if the template ID is not found.
 */
export function getTemplateById(id: string): EventTemplate | null {
  return EVENT_TEMPLATES.find((t) => t.id === id) ?? null;
}

/**
 * Apply a template to generate event creation form values.
 * Returns null if the template ID is not found.
 */
export function applyTemplate(
  templateId: string,
): {
  suggestedDescription: string;
  suggestedDurationHours: number;
  suggestedSettings: Record<string, unknown>;
  suggestedQuestions: Array<{ label: string; type: string; sortOrder: number }>;
  hostChecklist: string[];
  templateName: string;
} | null {
  const template = getTemplateById(templateId);
  if (!template) return null;

  return {
    suggestedDescription: template.suggestedDescription,
    suggestedDurationHours: template.suggestedDurationHours,
    suggestedSettings: template.suggestedSettings,
    suggestedQuestions: template.suggestedQuestions,
    hostChecklist: template.hostChecklist,
    templateName: template.name,
  };
}
