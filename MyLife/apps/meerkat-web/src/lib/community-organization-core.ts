// community-organization-core.ts (web): pure helpers for Plan 38 Phase 2
// community organization -- the owner channel manager (draft ops + a single
// finalize), the member-side sidebar grouping, and the device-local Communities
// rail ordering. Native-free so the batching rule (one descriptor revision per
// save), the archive-hides-but-preserves rule, and the legacy-render guarantee
// are all testable under Node and cannot drift from the mobile source.

import {
  channelArchived,
  communityCategories,
  orderedChannels,
  type CommunityChannel,
  type CommunityChannelCategory,
  type CommunityDescriptor,
} from '@mylife/sync';
import type { CommunityPrefRow } from './community-prefs';

// ---------------------------------------------------------------------------
// Owner channel-manager draft (edits batch locally; ONE reviseCommunity on save)
// ---------------------------------------------------------------------------

export interface OrgDraft {
  channels: CommunityChannel[];
  categories: CommunityChannelCategory[];
}

export type OrgResult = { ok: true; draft: OrgDraft } | { ok: false; error: string };

/** Slug a channel name to an id (same rule as the live addChannel path). */
export function slugChannelId(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Build an editable draft from the current descriptor. Active channels come in
 * presentation order, then the archived channels (so the manager can unarchive
 * them). Categories are normalized + ordered.
 */
export function buildOrgDraft(descriptor: CommunityDescriptor): OrgDraft {
  const active = orderedChannels(descriptor);
  const archived = orderedChannels(descriptor, { includeArchived: true }).filter((c) => channelArchived(c));
  return {
    channels: [...active, ...archived].map((c) => ({ ...c })),
    categories: communityCategories(descriptor).map((c) => ({ ...c })),
  };
}

export function draftAddChannel(draft: OrgDraft, name: string, categoryId?: string | null): OrgResult {
  const id = slugChannelId(name);
  if (!id) return { ok: false, error: 'Enter a channel name.' };
  if (draft.channels.some((c) => c.id === id)) {
    return { ok: false, error: 'A channel with that name already exists.' };
  }
  const channel: CommunityChannel = { id, name: name.trim() };
  if (categoryId) channel.categoryId = categoryId;
  return { ok: true, draft: { ...draft, channels: [...draft.channels, channel] } };
}

function mapChannel(
  draft: OrgDraft,
  channelId: string,
  fn: (c: CommunityChannel) => CommunityChannel,
): OrgDraft {
  return { ...draft, channels: draft.channels.map((c) => (c.id === channelId ? fn(c) : c)) };
}

export function draftRenameChannel(draft: OrgDraft, channelId: string, name: string): OrgResult {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: 'Enter a channel name.' };
  return { ok: true, draft: mapChannel(draft, channelId, (c) => ({ ...c, name: trimmed })) };
}

/** Set (or, with an empty string, clear) a channel's topic line. */
export function draftSetTopic(draft: OrgDraft, channelId: string, topic: string): OrgDraft {
  const trimmed = topic.trim();
  return mapChannel(draft, channelId, (c) => {
    const next = { ...c };
    if (trimmed) next.topic = trimmed;
    else delete next.topic;
    return next;
  });
}

/** Assign (or, with null, clear) a channel's category. */
export function draftAssignCategory(draft: OrgDraft, channelId: string, categoryId: string | null): OrgDraft {
  return mapChannel(draft, channelId, (c) => {
    const next = { ...c };
    if (categoryId) next.categoryId = categoryId;
    else delete next.categoryId;
    return next;
  });
}

/** Archive / unarchive a channel. Archived = hidden from the default list,
 *  content preserved, never deleted. */
export function draftSetArchived(draft: OrgDraft, channelId: string, archived: boolean): OrgDraft {
  return mapChannel(draft, channelId, (c) => {
    const next = { ...c };
    if (archived) next.archived = true;
    else delete next.archived;
    return next;
  });
}

/**
 * Move a channel up or down among its neighbors in the SAME category (and only
 * among non-archived channels), by swapping array positions. Finalize turns the
 * array position into the signed `order`, so this is all the reordering needed.
 */
export function draftMoveChannel(draft: OrgDraft, channelId: string, dir: 'up' | 'down'): OrgDraft {
  const target = draft.channels.find((c) => c.id === channelId);
  if (!target || channelArchived(target)) return draft;
  const catId = target.categoryId ?? null;
  const sameGroup = draft.channels.filter(
    (c) => !channelArchived(c) && (c.categoryId ?? null) === catId,
  );
  const pos = sameGroup.findIndex((c) => c.id === channelId);
  const swapWith = dir === 'up' ? sameGroup[pos - 1] : sameGroup[pos + 1];
  if (!swapWith) return draft;
  const ai = draft.channels.findIndex((c) => c.id === channelId);
  const bi = draft.channels.findIndex((c) => c.id === swapWith.id);
  const channels = draft.channels.slice();
  [channels[ai], channels[bi]] = [channels[bi], channels[ai]];
  return { ...draft, channels };
}

export function draftAddCategory(draft: OrgDraft, name: string, id: string): OrgResult {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: 'Enter a category name.' };
  if (draft.categories.some((c) => c.id === id)) {
    return { ok: false, error: 'That category already exists.' };
  }
  const category: CommunityChannelCategory = { id, name: trimmed, order: draft.categories.length };
  return { ok: true, draft: { ...draft, categories: [...draft.categories, category] } };
}

export function draftRenameCategory(draft: OrgDraft, categoryId: string, name: string): OrgResult {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: 'Enter a category name.' };
  return {
    ok: true,
    draft: {
      ...draft,
      categories: draft.categories.map((c) => (c.id === categoryId ? { ...c, name: trimmed } : c)),
    },
  };
}

export function draftMoveCategory(draft: OrgDraft, categoryId: string, dir: 'up' | 'down'): OrgDraft {
  const i = draft.categories.findIndex((c) => c.id === categoryId);
  const j = dir === 'up' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= draft.categories.length) return draft;
  const categories = draft.categories.slice();
  [categories[i], categories[j]] = [categories[j], categories[i]];
  return { ...draft, categories };
}

/** Delete a category. Its channels are UNASSIGNED (never deleted): they fall
 *  back to the default uncategorized group. */
export function draftDeleteCategory(draft: OrgDraft, categoryId: string): OrgDraft {
  return {
    channels: draft.channels.map((c) => {
      if (c.categoryId !== categoryId) return c;
      const next = { ...c };
      delete next.categoryId;
      return next;
    }),
    categories: draft.categories.filter((c) => c.id !== categoryId),
  };
}

/**
 * Freeze a draft into the exact `{ channels, categories }` a single
 * reviseCommunity call takes. Array position becomes the signed `order`;
 * category ids that no longer exist are dropped from channels; empty topics are
 * omitted. Archived flags are preserved (hidden, never deleted).
 */
export function finalizeOrg(draft: OrgDraft): {
  channels: CommunityChannel[];
  categories: CommunityChannelCategory[];
} {
  const categories = draft.categories.map((c, i) => ({ id: c.id, name: c.name.trim(), order: i }));
  const validCatIds = new Set(categories.map((c) => c.id));
  const channels = draft.channels.map((c, i) => {
    const out: CommunityChannel = { id: c.id, name: c.name };
    if (c.postRoles) out.postRoles = c.postRoles;
    if (c.kind) out.kind = c.kind;
    if (c.categoryId && validCatIds.has(c.categoryId)) out.categoryId = c.categoryId;
    if (c.topic && c.topic.trim()) out.topic = c.topic.trim();
    if (c.archived) out.archived = true;
    out.order = i;
    return out;
  });
  return { channels, categories };
}

// ---------------------------------------------------------------------------
// Member-side sidebar grouping (category groups + rollups; archived hidden)
// ---------------------------------------------------------------------------

export interface SidebarChannelGroup {
  /** null = the default uncategorized group (rendered under the "Channels" head). */
  category: CommunityChannelCategory | null;
  channels: CommunityChannel[];
  /** Sum of the (already muted/active-adjusted) unread counts of this group. */
  unread: number;
}

export interface SidebarModel {
  groups: SidebarChannelGroup[];
  archived: CommunityChannel[];
}

/**
 * Group a descriptor's channels for the sidebar. `unreadByChannel` is expected
 * to be the caller's already-adjusted map (muted / active channels zeroed), so
 * the per-category rollups match the per-channel badges. A legacy descriptor
 * (no categories, no order, no archived) yields exactly one group (category
 * null) holding every channel in descriptor order, and no archived list -- i.e.
 * the pre-Plan-38 flat render.
 */
export function buildSidebarModel(
  descriptor: CommunityDescriptor,
  unreadByChannel: Record<string, number>,
): SidebarModel {
  const categories = communityCategories(descriptor);
  const catById = new Map(categories.map((c) => [c.id, c] as const));
  const active = orderedChannels(descriptor);
  const archived = orderedChannels(descriptor, { includeArchived: true }).filter((c) => channelArchived(c));

  const uncategorized: CommunityChannel[] = [];
  const byCat = new Map<string, CommunityChannel[]>();
  for (const ch of active) {
    const cid = ch.categoryId;
    if (cid && catById.has(cid)) {
      const arr = byCat.get(cid) ?? [];
      arr.push(ch);
      byCat.set(cid, arr);
    } else {
      uncategorized.push(ch);
    }
  }

  const rollup = (chs: CommunityChannel[]): number =>
    chs.reduce((sum, c) => sum + (unreadByChannel[c.id] ?? 0), 0);

  const groups: SidebarChannelGroup[] = [
    { category: null, channels: uncategorized, unread: rollup(uncategorized) },
  ];
  for (const cat of categories) {
    const chs = byCat.get(cat.id) ?? [];
    groups.push({ category: cat, channels: chs, unread: rollup(chs) });
  }
  return { groups, archived };
}

// ---------------------------------------------------------------------------
// Communities rail ordering (device-local: pin floats up, folders group)
// ---------------------------------------------------------------------------

export interface RailGroup {
  kind: 'pinned' | 'folder' | 'ungrouped';
  /** Set only when kind === 'folder'. */
  folder: string | null;
  communityIds: string[];
}

/**
 * Order the Communities rail from the device-local prefs. Pinned communities
 * float to the top as one group; the rest split into folder groups (ordered by
 * folder name) then an ungrouped tail. Within any group the manual `sortIndex`
 * wins, falling back to the community's default list position. With NO prefs
 * every community lands in a single 'ungrouped' group in default order -- the
 * pre-Plan-38 flat rail.
 */
export function orderCommunitiesForRail(
  communityIds: string[],
  prefs: Record<string, CommunityPrefRow>,
): RailGroup[] {
  const indexOf = new Map(communityIds.map((id, i) => [id, i] as const));
  const pref = (id: string): CommunityPrefRow =>
    prefs[id] ?? { communityId: id, pinned: false, sortIndex: null, folder: null };
  const cmp = (a: string, b: string): number => {
    const sa = pref(a).sortIndex ?? indexOf.get(a) ?? 0;
    const sb = pref(b).sortIndex ?? indexOf.get(b) ?? 0;
    if (sa !== sb) return sa - sb;
    return (indexOf.get(a) ?? 0) - (indexOf.get(b) ?? 0);
  };

  const pinned = communityIds.filter((id) => pref(id).pinned).sort(cmp);
  const folders = new Map<string, string[]>();
  const ungrouped: string[] = [];
  for (const id of communityIds) {
    if (pref(id).pinned) continue;
    const folder = pref(id).folder;
    if (folder) {
      const arr = folders.get(folder) ?? [];
      arr.push(id);
      folders.set(folder, arr);
    } else {
      ungrouped.push(id);
    }
  }

  const groups: RailGroup[] = [];
  if (pinned.length) groups.push({ kind: 'pinned', folder: null, communityIds: pinned });
  for (const folder of [...folders.keys()].sort((a, b) => a.localeCompare(b))) {
    groups.push({ kind: 'folder', folder, communityIds: folders.get(folder)!.slice().sort(cmp) });
  }
  if (ungrouped.length) {
    groups.push({ kind: 'ungrouped', folder: null, communityIds: ungrouped.slice().sort(cmp) });
  }
  return groups;
}
