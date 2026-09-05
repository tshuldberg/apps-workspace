// community-org-core.ts: pure helpers for Plan 38 Phase 2 organization (Track A).
//
// Two concerns, both native-free so they are testable under Node and cannot drift
// from the screens:
//
//  1. The OWNER channel manager (community settings). The manager edits a DRAFT
//     of the channel list + categories locally; on Save the whole draft is folded
//     into ONE CommunityRevisionChanges and signed as a SINGLE reviseCommunity
//     revision (the plan's binding "one revision per save", never per drag). The
//     draft mutators here are all pure so the UI stays a thin state container.
//
//  2. The MEMBER read path: grouping the signed descriptor's channels by category
//     (legacy descriptors with no categories/order render EXACTLY as today), and
//     the per-device Communities-tab ordering over mk_community_prefs.
//
// This module owns NO crypto and NO storage: reviseCommunity/upsertCommunity are
// the @mylife/sync primitives (called by SyncProvider.saveCommunityOrganization),
// and the descriptor readers (orderedChannels, communityCategories, channelArchived)
// are the shipped fail-safe accessors we build on.

import {
  channelArchived,
  communityCategories,
  communityLayout,
  orderedChannels,
  type CommunityChannel,
  type CommunityChannelCategory,
  type CommunityDescriptor,
  type CommunityLayout,
  type CommunityRevisionChanges,
  type StoredCommunity,
} from '@mylife/sync';

// ---------------------------------------------------------------------------
// Owner channel-manager draft
// ---------------------------------------------------------------------------

/**
 * The editable organization draft. `channels` and `categories` array order IS
 * the display/reorder order; buildOrganizationChanges stamps the positional
 * `order` fields from that array order at save time. A draft channel is a full
 * CommunityChannel so postRoles and an unknown `kind` round-trip untouched.
 */
export interface OrganizationDraft {
  channels: CommunityChannel[];
  categories: CommunityChannelCategory[];
  /**
   * Presentation layout (Plan 38 Phase 7, G10). The owner's 'Open on Library'
   * toggle flips this; it commits with the rest of the draft as ONE revision on
   * Save (never a separate revision). Absent on a legacy draft => 'chat_first'.
   */
  layout: CommunityLayout;
}

export type AddChannelResult =
  | { ok: true; draft: OrganizationDraft; channelId: string }
  | { ok: false; error: string };

/**
 * Slugify a channel name into a stable id. Byte-identical to the web
 * MeerkatProvider.addChannel slug so the same name yields the same id on both
 * surfaces (lowercase, non-alphanumerics collapsed to single hyphens, trimmed).
 */
export function slugifyChannelName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Build the editable draft from the current signed descriptor. */
export function draftFromDescriptor(descriptor: CommunityDescriptor): OrganizationDraft {
  return {
    // includeArchived keeps archived channels in the manager (they are hidden,
    // never deleted); the flat ordered list preserves the owner's arrangement.
    channels: orderedChannels(descriptor, { includeArchived: true }).map((c) => ({ ...c })),
    categories: communityCategories(descriptor).map((cat) => ({ ...cat })),
    layout: communityLayout(descriptor),
  };
}

/** Toggle the presentation layout on the draft (owner 'Open on Library'). */
export function setLayoutInDraft(draft: OrganizationDraft, layout: CommunityLayout): OrganizationDraft {
  return { ...draft, layout };
}

/**
 * Add a new channel to the draft. Rejects an empty or duplicate name. Kind
 * defaults to 'chat'; Plan 56 C1 lets the owner also create a 'canvas'
 * channel (the Commons, 4.1). Both are values in the signed kind slot.
 */
export function addChannelToDraft(
  draft: OrganizationDraft,
  name: string,
  kind: 'chat' | 'canvas' = 'chat',
): AddChannelResult {
  const channelName = name.trim();
  const channelId = slugifyChannelName(channelName);
  if (!channelId) return { ok: false, error: 'Enter a channel name.' };
  if (draft.channels.some((c) => c.id === channelId)) {
    return { ok: false, error: 'A channel with that name already exists.' };
  }
  const channel: CommunityChannel = { id: channelId, name: channelName, kind };
  return {
    ok: true,
    channelId,
    draft: { ...draft, channels: [...draft.channels, channel] },
  };
}

/** Rename a channel (display name only; the id stays stable). */
export function renameChannelInDraft(draft: OrganizationDraft, id: string, name: string): OrganizationDraft {
  const next = name.trim();
  return {
    ...draft,
    channels: draft.channels.map((c) => (c.id === id ? { ...c, name: next || c.name } : c)),
  };
}

/** Set (or clear) a channel's topic line. Empty string clears it. */
export function setChannelTopicInDraft(draft: OrganizationDraft, id: string, topic: string): OrganizationDraft {
  const next = topic.trim();
  return {
    ...draft,
    channels: draft.channels.map((c) => {
      if (c.id !== id) return c;
      const clone = { ...c };
      if (next) clone.topic = next;
      else delete clone.topic;
      return clone;
    }),
  };
}

/** Assign a channel to a category (or null to move it to the uncategorized group). */
export function setChannelCategoryInDraft(
  draft: OrganizationDraft,
  id: string,
  categoryId: string | null,
): OrganizationDraft {
  return {
    ...draft,
    channels: draft.channels.map((c) => {
      if (c.id !== id) return c;
      const clone = { ...c };
      if (categoryId) clone.categoryId = categoryId;
      else delete clone.categoryId;
      return clone;
    }),
  };
}

/** Archive or unarchive a channel. Archived = hidden from default lists, preserved. */
export function setChannelArchivedInDraft(draft: OrganizationDraft, id: string, archived: boolean): OrganizationDraft {
  return {
    ...draft,
    channels: draft.channels.map((c) => {
      if (c.id !== id) return c;
      const clone = { ...c };
      if (archived) clone.archived = true;
      else delete clone.archived;
      return clone;
    }),
  };
}

/** Move a channel one slot up or down within the flat draft order. */
export function moveChannelInDraft(draft: OrganizationDraft, id: string, dir: 'up' | 'down'): OrganizationDraft {
  return { ...draft, channels: moveById(draft.channels, id, dir) };
}

/** Add a new category to the draft. Rejects an empty or duplicate name. */
export function addCategoryToDraft(
  draft: OrganizationDraft,
  name: string,
): { ok: true; draft: OrganizationDraft; categoryId: string } | { ok: false; error: string } {
  const catName = name.trim();
  if (!catName) return { ok: false, error: 'Enter a category name.' };
  if (draft.categories.some((cat) => cat.name.toLowerCase() === catName.toLowerCase())) {
    return { ok: false, error: 'A category with that name already exists.' };
  }
  // Mint an id that is UNIQUE within the draft. A purely position-based suffix
  // (`length + 1`) can collide after a delete-then-add (a surviving category may
  // already hold that suffix), and a duplicated id makes channels render under
  // two groups. Channel assignments key off this id, so uniqueness is binding.
  const existingIds = new Set(draft.categories.map((cat) => cat.id));
  const base = `cat-${slugifyChannelName(catName) || 'group'}`;
  let suffix = draft.categories.length + 1;
  let categoryId = `${base}-${suffix}`;
  while (existingIds.has(categoryId)) {
    suffix += 1;
    categoryId = `${base}-${suffix}`;
  }
  const category: CommunityChannelCategory = { id: categoryId, name: catName, order: draft.categories.length };
  return { ok: true, categoryId, draft: { ...draft, categories: [...draft.categories, category] } };
}

/** Rename a category (id stays stable, so channel assignments are preserved). */
export function renameCategoryInDraft(draft: OrganizationDraft, id: string, name: string): OrganizationDraft {
  const next = name.trim();
  return {
    ...draft,
    categories: draft.categories.map((cat) => (cat.id === id ? { ...cat, name: next || cat.name } : cat)),
  };
}

/** Move a category one slot up or down. */
export function moveCategoryInDraft(draft: OrganizationDraft, id: string, dir: 'up' | 'down'): OrganizationDraft {
  return { ...draft, categories: moveById(draft.categories, id, dir) };
}

/**
 * Delete a category: the category row is dropped and every channel assigned to it
 * is UNASSIGNED (moved to the uncategorized group). Channels are NEVER deleted.
 */
export function deleteCategoryFromDraft(draft: OrganizationDraft, id: string): OrganizationDraft {
  return {
    ...draft,
    channels: draft.channels.map((c) => {
      if (c.categoryId !== id) return c;
      const clone = { ...c };
      delete clone.categoryId;
      return clone;
    }),
    categories: draft.categories.filter((cat) => cat.id !== id),
  };
}

/**
 * Fold the whole draft into ONE CommunityRevisionChanges (the binding
 * one-revision-per-save contract). Positional `order` is stamped from array
 * position; a channel's categoryId is dropped if it references no surviving
 * category (defense in depth on top of deleteCategoryFromDraft). Categories are
 * renumbered 0..n by array position.
 */
export function buildOrganizationChanges(draft: OrganizationDraft): CommunityRevisionChanges {
  const categoryIds = new Set(draft.categories.map((cat) => cat.id));
  const channels: CommunityChannel[] = draft.channels.map((c, index) => {
    const next: CommunityChannel = { id: c.id, name: c.name, order: index };
    if (c.postRoles) next.postRoles = [...c.postRoles];
    if (c.kind !== undefined) next.kind = c.kind;
    if (c.topic) next.topic = c.topic;
    if (c.categoryId && categoryIds.has(c.categoryId)) next.categoryId = c.categoryId;
    if (channelArchived(c)) next.archived = true;
    return next;
  });
  const categories: CommunityChannelCategory[] = draft.categories.map((cat, index) => ({
    id: cat.id,
    name: cat.name,
    order: index,
  }));
  return { channels, categories, layout: draft.layout };
}

function moveById<T extends { id: string }>(list: readonly T[], id: string, dir: 'up' | 'down'): T[] {
  const index = list.findIndex((item) => item.id === id);
  if (index < 0) return [...list];
  const target = dir === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= list.length) return [...list];
  const next = [...list];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved);
  return next;
}

// ---------------------------------------------------------------------------
// Member read path: category grouping over the signed descriptor
// ---------------------------------------------------------------------------

export interface ChannelGroup {
  /** The category this group renders under, or null for the uncategorized group. */
  category: CommunityChannelCategory | null;
  channels: CommunityChannel[];
}

export interface CommunityChannelDisplay {
  /** Active (non-archived) channels grouped by category, categories in order. */
  groups: ChannelGroup[];
  /** Archived channels (any category), ordered; hidden behind a collapsed group. */
  archived: CommunityChannel[];
  /** Whether category headers should render at all. Legacy descriptors => false. */
  hasCategories: boolean;
}

/**
 * Group a community's channels for the member-side screen. Legacy descriptors
 * (no categories, no order) collapse to a single header-less group whose channels
 * are in descriptor order -- byte-for-byte the pre-Plan-38 rendering. When
 * categories exist, active channels are grouped under their category (categories
 * in their owner order), uncategorized channels fall into a trailing null group,
 * and archived channels are pulled out for the collapsed "Archived" group.
 */
export function groupChannelsForDisplay(descriptor: CommunityDescriptor): CommunityChannelDisplay {
  const active = orderedChannels(descriptor);
  const archived = orderedChannels(descriptor, { includeArchived: true }).filter(channelArchived);
  const categories = communityCategories(descriptor);

  if (categories.length === 0) {
    return {
      groups: [{ category: null, channels: active }],
      archived,
      hasCategories: false,
    };
  }

  const validIds = new Set(categories.map((cat) => cat.id));
  const groups: ChannelGroup[] = categories.map((category) => ({
    category,
    channels: active.filter((c) => c.categoryId === category.id),
  }));
  const uncategorized = active.filter((c) => !c.categoryId || !validIds.has(c.categoryId));
  if (uncategorized.length > 0) groups.push({ category: null, channels: uncategorized });

  return { groups, archived, hasCategories: true };
}

/** Sum a group's channels' unread counts for the per-category rollup badge. */
export function groupUnreadCount(
  channels: readonly CommunityChannel[],
  unreadByChannel: Record<string, number>,
  mutedChannelIds?: ReadonlySet<string>,
): number {
  let total = 0;
  for (const channel of channels) {
    const n = unreadByChannel[channel.id] ?? 0;
    if (n > 0 && !mutedChannelIds?.has(channel.id)) total += n;
  }
  return total;
}

// ---------------------------------------------------------------------------
// Communities-tab per-device ordering (mk_community_prefs)
// ---------------------------------------------------------------------------

export interface CommunityPrefs {
  communityId: string;
  pinned: boolean;
  sortIndex: number | null;
  folder: string | null;
}

export interface CommunitySection {
  /** Stable render key. */
  key: string;
  kind: 'pinned' | 'folder' | 'ungrouped';
  /** The folder name for a 'folder' section, else null. */
  folder: string | null;
  communities: StoredCommunity[];
}

/**
 * Build the per-device Communities-tab sections from mk_community_prefs. This is
 * a DEVICE-LOCAL view only (prefs never replicate): pinned communities float to
 * the top, then folders render as their own sections (alphabetical), then the
 * ungrouped remainder. Within every section the manual sortIndex orders the
 * cards (unset sortIndex sorts last, ties fall back to the input order, which is
 * joined-at ascending from listCommunities).
 */
export function buildCommunitySections(
  communities: readonly StoredCommunity[],
  prefsById: Record<string, CommunityPrefs>,
): CommunitySection[] {
  const annotated = communities.map((community, index) => ({
    community,
    index,
    prefs: prefsById[community.communityId] ?? null,
  }));

  const byOrder = (a: (typeof annotated)[number], b: (typeof annotated)[number]): number => {
    const ai = a.prefs?.sortIndex ?? null;
    const bi = b.prefs?.sortIndex ?? null;
    if (ai !== bi) {
      if (ai === null) return 1;
      if (bi === null) return -1;
      return ai - bi;
    }
    return a.index - b.index;
  };

  const pinned = annotated.filter((a) => a.prefs?.pinned).sort(byOrder);
  const rest = annotated.filter((a) => !a.prefs?.pinned);

  const folderNames = Array.from(
    new Set(rest.map((a) => a.prefs?.folder).filter((f): f is string => Boolean(f))),
  ).sort((a, b) => a.localeCompare(b));

  const sections: CommunitySection[] = [];
  if (pinned.length > 0) {
    sections.push({ key: 'pinned', kind: 'pinned', folder: null, communities: pinned.map((a) => a.community) });
  }
  for (const folder of folderNames) {
    const inFolder = rest.filter((a) => a.prefs?.folder === folder).sort(byOrder);
    sections.push({ key: `folder:${folder}`, kind: 'folder', folder, communities: inFolder.map((a) => a.community) });
  }
  const ungrouped = rest.filter((a) => !a.prefs?.folder).sort(byOrder);
  if (ungrouped.length > 0) {
    sections.push({ key: 'ungrouped', kind: 'ungrouped', folder: null, communities: ungrouped.map((a) => a.community) });
  }
  return sections;
}
