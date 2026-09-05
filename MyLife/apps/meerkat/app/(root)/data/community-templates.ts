// community-templates.ts (mobile): Plan 38 Phase 7 (amendment C.1). The six
// community creation presets shown in the "Start from a template" picker. Each
// preset composes ONLY the two shipped channel kinds -- chat (baked into the
// genesis descriptor) and library (provisioned via createLibrary at commit) --
// plus an optional theme/identity/category/layout preset. This module is PURE
// data + total helpers, no platform imports, so it is a BYTE-IDENTICAL twin with
// apps/meerkat-web/src/lib/community-templates.ts (only this header differs);
// scripts/check-meerkat-parity.mjs twin-locks the two.
//
// It provisions structure only: the UI resolves each preset's themePresetId into
// a Plan 18 theme codec blob and drives the all-or-nothing staged commit
// (createCommunity + createLibrary rows + publishCommunityIdentity in ONE
// transaction). Nothing here talks to the network, the db, or the node store.

import type {
  CommunityChannel,
  CommunityChannelCategory,
  CommunityLayout,
} from '@mylife/sync';
import type { KnownMediaType } from './library-metadata-core';

/** A chat channel a template bakes into the genesis descriptor. */
export interface TemplateChatChannel {
  id: string;
  name: string;
  topic?: string;
  categoryId?: string;
}

/** A library channel a template provisions through createLibrary at commit. */
export interface TemplateLibrary {
  name: string;
  mediaType: KnownMediaType;
}

export interface CommunityTemplate {
  /** Stable preset id (never user-visible). */
  id: string;
  /** Picker title (canonical string, parity-locked). */
  name: string;
  /** One-line picker subtitle. */
  blurb: string;
  /** Seed community description (published as the community identity). */
  description: string;
  /** @mylife/meerkat-theme preset id, or null for no community theme. */
  themePresetId: string | null;
  /** Community identity accent (#rrggbb), or null. */
  accent: string | null;
  /** Presentation layout: library_first opens on the Libraries home. */
  layout: CommunityLayout;
  /** Channel categories (empty = one flat channel list). */
  categories: CommunityChannelCategory[];
  /** Chat channels, in presentation order. */
  chatChannels: TemplateChatChannel[];
  /** Library channels provisioned after the community exists. */
  libraries: TemplateLibrary[];
}

/**
 * The six presets. Every chatChannels entry becomes a `kind: 'chat'` genesis
 * channel; every libraries entry becomes a `kind: 'library'` channel plus an
 * owner-signed cm_libraries row. No preset references any other channel kind, so
 * the "compose only shipped kinds" invariant is structural, not merely tested.
 */
export const COMMUNITY_TEMPLATES: readonly CommunityTemplate[] = [
  {
    id: 'family',
    name: 'Family Space',
    blurb: 'Chat plus shared photos, videos, and documents.',
    description: 'A private space for family chat and shared photos, videos, and documents.',
    themePresetId: 'calm',
    accent: '#0e7c66',
    layout: 'library_first',
    categories: [],
    chatChannels: [
      { id: 'general', name: 'General' },
      { id: 'memories', name: 'Memories' },
    ],
    libraries: [
      { name: 'Photos', mediaType: 'photo' },
      { name: 'Videos', mediaType: 'movie' },
      { name: 'Documents', mediaType: 'document' },
    ],
  },
  {
    id: 'media',
    name: 'Media Library',
    blurb: 'A shared hub for movies, shows, and music.',
    description: 'A shared media hub for the movies, shows, and music your group collects.',
    themePresetId: 'serious',
    accent: '#3566b0',
    layout: 'library_first',
    categories: [],
    chatChannels: [{ id: 'general', name: 'General' }],
    libraries: [
      { name: 'Movies', mediaType: 'movie' },
      { name: 'Shows', mediaType: 'show' },
      { name: 'Music', mediaType: 'music' },
    ],
  },
  {
    id: 'club',
    name: 'Club',
    blurb: 'Channels for chat, events, and shared files.',
    description: 'Run a club with channels for chat, events, and shared files.',
    themePresetId: 'social',
    accent: '#0e7c66',
    layout: 'chat_first',
    categories: [],
    chatChannels: [
      { id: 'general', name: 'General' },
      { id: 'events', name: 'Events' },
      { id: 'resources', name: 'Resources' },
    ],
    libraries: [{ name: 'Files', mediaType: 'document' }],
  },
  {
    id: 'course',
    name: 'Course Hub',
    blurb: 'Announcements, discussion, and a materials library.',
    description: 'Teach a course with announcements, discussion, and a materials library.',
    themePresetId: 'serious',
    accent: '#8f660d',
    layout: 'chat_first',
    categories: [],
    chatChannels: [
      { id: 'announcements', name: 'Announcements' },
      { id: 'discussion', name: 'Discussion' },
      { id: 'questions', name: 'Questions' },
    ],
    libraries: [
      { name: 'Materials', mediaType: 'document' },
      { name: 'Readings', mediaType: 'book' },
    ],
  },
  {
    id: 'newsroom',
    name: 'Newsroom',
    blurb: 'Publish updates and keep a searchable archive.',
    description: 'Publish updates and keep a searchable archive of stories.',
    themePresetId: 'serious',
    accent: '#b3413e',
    layout: 'chat_first',
    categories: [],
    chatChannels: [
      { id: 'newsroom', name: 'Newsroom' },
      { id: 'pitches', name: 'Pitches' },
    ],
    libraries: [{ name: 'Archive', mediaType: 'document' }],
  },
  {
    id: 'blank',
    name: 'Blank',
    blurb: 'Start with a single channel and build it yourself.',
    description: '',
    themePresetId: null,
    accent: null,
    layout: 'chat_first',
    categories: [],
    chatChannels: [{ id: 'general', name: 'General' }],
    libraries: [],
  },
] as const;

/** The picker heading (canonical string, parity-locked). */
export const TEMPLATE_PICKER_HEADING = 'Start from a template';

/** Look a template up by id (total: undefined when unknown). */
export function findCommunityTemplate(id: string): CommunityTemplate | undefined {
  return COMMUNITY_TEMPLATES.find((t) => t.id === id);
}

/**
 * The visible portion of a community name: ASCII controls, zero-width and bidi
 * control characters, invisible fillers and format characters, and the BOM
 * stripped, then trimmed. `trim()` alone passes a name made ONLY of invisible
 * characters, which creates a community whose card renders blank everywhere;
 * creation rejects a name whose visible form is empty. The stored name keeps
 * the user's original characters otherwise (RTL marks INSIDE real text stay
 * untouched by callers, which only test this). Beyond zero-width and bidi
 * controls the class covers the classic invisible-name fillers: soft hyphen,
 * combining grapheme joiner, arabic letter mark, hangul fillers (incl. U+3164
 * and U+FFA0), mongolian selectors/separator, invisible math operators,
 * braille blank, variation selectors, interlinear annotations, and the astral
 * tag block (U+E0000..U+E007F as surrogate pairs).
 */
export function visibleCommunityName(raw: string): string {
  return raw
    .replace(
      // Lone combining/invisible code points are matched DELIBERATELY (the
      // strip is per-code-point, not per-grapheme).
      // eslint-disable-next-line no-control-regex, no-misleading-character-class
      /[\u0000-\u001f\u007f\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180b-\u180f\u200b-\u200f\u2028-\u202e\u2060-\u2064\u2800\u3164\ufe00-\ufe0f\ufeff\uffa0\ufff9-\ufffb]|\udb40[\udc00-\udc7f]/g,
      '',
    )
    .trim();
}

/**
 * The genesis chat channels a template bakes into createCommunity, each stamped
 * with the explicit `kind: 'chat'` and its presentation `order`. Library
 * channels are NOT included here; they are appended by createLibrary after the
 * community exists so each carries an owner-signed cm_libraries row.
 */
export function templateGenesisChannels(template: CommunityTemplate): CommunityChannel[] {
  return template.chatChannels.map((c, index) => {
    const channel: CommunityChannel = { id: c.id, name: c.name, kind: 'chat', order: index };
    if (c.topic) channel.topic = c.topic;
    if (c.categoryId) channel.categoryId = c.categoryId;
    return channel;
  });
}

/** The categories a template bakes into createCommunity (copied, never shared). */
export function templateGenesisCategories(template: CommunityTemplate): CommunityChannelCategory[] {
  return template.categories.map((c) => ({ ...c }));
}
