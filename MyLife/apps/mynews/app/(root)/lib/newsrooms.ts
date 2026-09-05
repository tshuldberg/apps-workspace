// C8.8 newsrooms logic: list and detail view models, the create flow (server
// inserts the owner membership), invite by handle, membership removal, embargo
// date validation, and the save-to-newsroom draft transition through the C4
// publish form. Pure or port-injected so everything unit-tests against the
// module's InMemoryCloudAdapter; the screens stay thin.

import type { DatabaseAdapter } from '@mylife/db';
import {
  deleteDraft,
  publishDraft,
  saveArticleEmbargo,
  type AuthorIdentity,
  type Draft,
  type MetaErrorCode,
  type MyNewsCloudPort,
  type NewsroomDraftView,
  type NewsroomMemberView,
  type NewsroomView,
  type ProfileView,
  type PublishErrorCode,
} from '@mylife/mynews';
import { publishErrorMessage } from './publish-errors';

// --- C8.8 copy (verbatim; do not reword) ---

export const REVIEWER_ROLE_COPY =
  'Invited for pre-publication review · can read + suggest, never publish';

export const NEWSROOM_EXPLAINER =
  "Drafts are scoped to this room by server policy and capped so they can never silently escalate to public. Publishing is always the author's explicit act.";

export const INVITE_REVIEWER_LABEL = 'Invite a Trusted Editor';

// --- Roles ---

export type NewsroomRole = NewsroomMemberView['role'];

export const ROLE_CHIP: Record<NewsroomRole, string> = {
  owner: 'Owner',
  coauthor: 'Coauthor',
  reviewer: 'Reviewer',
};

/** Reviewer copy rule: only reviewer rows carry the pre-publication note. */
export function roleNote(role: NewsroomRole): string | null {
  return role === 'reviewer' ? REVIEWER_ROLE_COPY : null;
}

// --- Name validation (mirrors the nw_newsrooms 1-80 char check) ---

export function validateNewsroomName(
  raw: string,
): { ok: true; name: string } | { ok: false; message: string } {
  const name = raw.trim();
  if (name.length === 0) return { ok: false, message: 'Give the newsroom a name.' };
  if (name.length > 80) {
    return { ok: false, message: 'Newsroom names are at most 80 characters.' };
  }
  return { ok: true, name };
}

// --- List + create ---

export type NewsroomListState =
  | { status: 'no-profile' }
  | { status: 'loaded'; profile: ProfileView; rooms: NewsroomView[] };

export async function loadNewsroomList(input: {
  port: MyNewsCloudPort;
}): Promise<NewsroomListState> {
  const profile = await input.port.getMyProfile();
  if (!profile) return { status: 'no-profile' };
  const rooms = await input.port.listMyNewsrooms(profile.id);
  return { status: 'loaded', profile, rooms };
}

/**
 * Create a newsroom. The port inserts the owner membership row in the same
 * client transaction (C6), so a successful create always leaves the caller
 * as the room's owner member.
 */
export async function createNewsroomFlow(input: {
  port: MyNewsCloudPort;
  ownerId: string;
  name: string;
}): Promise<{ ok: true; newsroom: NewsroomView } | { ok: false; message: string }> {
  const valid = validateNewsroomName(input.name);
  if (!valid.ok) return valid;
  const res = await input.port.createNewsroom({ ownerId: input.ownerId, name: valid.name });
  if (res.ok) return res;
  if (res.error === 'not-signed-in') {
    return { ok: false, message: 'You are signed out. Create an account from the Me tab first.' };
  }
  return { ok: false, message: `Could not create the newsroom. ${res.error}` };
}

// --- Detail view model ---

export interface NewsroomMemberRow {
  member: NewsroomMemberView;
  chip: string;
  /** REVIEWER_ROLE_COPY on reviewer rows, null otherwise. */
  note: string | null;
  /** Owners can remove anyone but themselves. */
  canRemove: boolean;
}

export interface NewsroomDraftRow {
  draft: NewsroomDraftView;
  /** "[embargo {date}]" when set, null otherwise. */
  embargoLabel: string | null;
  /** Draft rows open the article page with the draft-read fallback id. */
  openPath: string;
  /** Author-only: set or clear the embargo. */
  canSetEmbargo: boolean;
}

export interface NewsroomDetailModel {
  newsroom: NewsroomView;
  isOwner: boolean;
  /** Non-owner members get the "Leave newsroom" action. */
  canLeave: boolean;
  members: NewsroomMemberRow[];
  drafts: NewsroomDraftRow[];
}

export function draftEmbargoLabel(embargoUntil: string | null): string | null {
  return embargoUntil ? `[embargo ${embargoUntil.slice(0, 10)}]` : null;
}

const ROLE_RANK: Record<NewsroomRole, number> = { owner: 0, coauthor: 1, reviewer: 2 };

export function buildNewsroomDetailModel(input: {
  newsroom: NewsroomView;
  members: NewsroomMemberView[];
  drafts: NewsroomDraftView[];
  myProfile: Pick<ProfileView, 'id' | 'handle'>;
}): NewsroomDetailModel {
  const isOwner = input.newsroom.ownerId === input.myProfile.id;
  const isMember = input.members.some((m) => m.profileId === input.myProfile.id);
  const members = [...input.members]
    .sort(
      (a, b) => ROLE_RANK[a.role] - ROLE_RANK[b.role] || a.handle.localeCompare(b.handle),
    )
    .map((member) => ({
      member,
      chip: ROLE_CHIP[member.role],
      note: roleNote(member.role),
      canRemove: isOwner && member.profileId !== input.myProfile.id,
    }));
  const drafts = [...input.drafts]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((draft) => ({
      draft,
      embargoLabel: draftEmbargoLabel(draft.embargoUntil),
      openPath: `/(root)/article/${encodeURIComponent(draft.slug)}?articleId=${encodeURIComponent(draft.articleId)}`,
      canSetEmbargo: draft.authorHandle === input.myProfile.handle,
    }));
  return { newsroom: input.newsroom, isOwner, canLeave: isMember && !isOwner, members, drafts };
}

export type NewsroomDetailState =
  | { status: 'no-profile' }
  | { status: 'not-found' }
  | { status: 'loaded'; profile: ProfileView; model: NewsroomDetailModel };

export async function loadNewsroomDetail(input: {
  port: MyNewsCloudPort;
  id: string;
}): Promise<NewsroomDetailState> {
  const profile = await input.port.getMyProfile();
  if (!profile) return { status: 'no-profile' };
  const detail = await input.port.getNewsroom(input.id);
  if (!detail) return { status: 'not-found' };
  return {
    status: 'loaded',
    profile,
    model: buildNewsroomDetailModel({ ...detail, myProfile: profile }),
  };
}

// --- Membership flows ---

export async function inviteMemberFlow(input: {
  port: MyNewsCloudPort;
  newsroomId: string;
  handle: string;
  role: 'coauthor' | 'reviewer';
  invitedBy: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const handle = input.handle.trim().replace(/^@/, '').toLowerCase();
  if (!handle) return { ok: false, message: 'Enter a handle to invite.' };
  const res = await input.port.addNewsroomMember({
    newsroomId: input.newsroomId,
    handle,
    role: input.role,
    invitedBy: input.invitedBy,
  });
  if (res.ok) return { ok: true };
  if (res.error === 'unknown-handle') {
    return { ok: false, message: `No profile has the handle @${handle}.` };
  }
  if (res.error === 'not-signed-in') {
    return { ok: false, message: 'You are signed out. Create an account from the Me tab first.' };
  }
  return { ok: false, message: `Invite failed. ${res.error ?? 'unknown'}` };
}

/** Owner removal and self-leave share the same port call and error mapping. */
export async function removeMemberFlow(input: {
  port: MyNewsCloudPort;
  newsroomId: string;
  profileId: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const res = await input.port.removeNewsroomMember({
    newsroomId: input.newsroomId,
    profileId: input.profileId,
  });
  if (res.ok) return { ok: true };
  return { ok: false, message: `Could not update membership. ${res.error ?? 'unknown'}` };
}

// --- Embargo (author-only, YYYY-MM-DD, empty clears) ---

export const EMBARGO_DATE_RULE = /^\d{4}-\d{2}-\d{2}$/;

export function parseEmbargoInput(
  raw: string,
): { ok: true; embargoUntil: string | null } | { ok: false; message: string } {
  const text = raw.trim();
  if (text === '') return { ok: true, embargoUntil: null };
  if (!EMBARGO_DATE_RULE.test(text)) {
    return { ok: false, message: 'Use YYYY-MM-DD, or leave empty to clear the embargo.' };
  }
  const [year, month, day] = text.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return { ok: false, message: 'That is not a real calendar date.' };
  }
  return { ok: true, embargoUntil: `${text}T00:00:00.000Z` };
}

function embargoErrorMessage(code: MetaErrorCode): string {
  switch (code) {
    case 'not-signed-in':
      return 'You are signed out. Create an account from the Me tab first.';
    case 'not-author':
      return 'Only the article author can set an embargo on this draft.';
    case 'bad-signature':
      return 'Your signing key could not sign this embargo. Try again.';
    case 'network':
      return 'Could not reach the server. Check your connection and try again.';
    default:
      return `Could not save the embargo. ${code}`;
  }
}

export async function setEmbargoFlow(input: {
  port: MyNewsCloudPort;
  identity: AuthorIdentity | null;
  articleId: string;
  raw: string;
}): Promise<{ ok: true; embargoUntil: string | null } | { ok: false; message: string }> {
  const parsed = parseEmbargoInput(input.raw);
  if (!parsed.ok) return parsed;
  if (!input.identity) {
    return { ok: false, message: 'Your signing key is still loading. Try again in a moment.' };
  }
  // The embargo is one field of the signed provenance metadata: read-modify-sign
  // the whole record so the DOI, license, dataset hashes, and canonical URL keep
  // their author signature (Track 0.5).
  const res = await saveArticleEmbargo({
    port: input.port,
    identity: input.identity,
    articleId: input.articleId,
    embargoUntil: parsed.embargoUntil,
  });
  if (!res.ok) {
    return { ok: false, message: embargoErrorMessage(res.code) };
  }
  return { ok: true, embargoUntil: parsed.embargoUntil };
}

// --- Save to newsroom (compose secondary action, C4 draft form) ---

/**
 * Rooms the composer can save into: requires a profile and at least one
 * membership. Empty means the secondary action stays hidden; nothing is
 * fabricated for signed-out or profile-less sessions.
 */
export async function loadSaveTargets(input: {
  port: MyNewsCloudPort;
}): Promise<NewsroomView[]> {
  const profile = await input.port.getMyProfile();
  if (!profile) return [];
  return input.port.listMyNewsrooms(profile.id);
}

export function saveToNewsroomErrorMessage(code: PublishErrorCode, detail?: string): string {
  if (code === 'not-newsroom-member') {
    return 'Saving a draft here needs an owner or coauthor role in this newsroom.';
  }
  return publishErrorMessage(code, detail);
}

/**
 * Save a local draft as a server-side newsroom draft: the C4 publish form with
 * `draft: true` + `newsroomId`, rev 1, slug derived from the headline exactly
 * like the publish path. On success the local nw_drafts row is deleted (the
 * draft now lives in the newsroom); on failure the local draft is untouched.
 */
export async function saveToNewsroomFlow(input: {
  db: DatabaseAdapter;
  port: MyNewsCloudPort;
  identity: AuthorIdentity;
  draft: Draft;
  articleId: string;
  newsroomId: string;
  nowIso: string;
}): Promise<{ ok: true; articleId: string; slug: string } | { ok: false; message: string }> {
  const result = await publishDraft({
    draft: input.draft,
    articleId: input.articleId,
    rev: 1,
    identity: input.identity,
    port: input.port,
    nowIso: input.nowIso,
    newsroomId: input.newsroomId,
    asDraft: true,
  });
  if (!result.ok) {
    return { ok: false, message: saveToNewsroomErrorMessage(result.code, result.detail) };
  }
  deleteDraft(input.db, input.draft.id);
  return { ok: true, articleId: result.articleId, slug: result.slug };
}
