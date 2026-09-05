// Paired native-free onboarding catalog. Preview selection never writes state.
import { encodeLayoutBlob, type MkLayoutDocument } from '@mylife/meerkat-layout';
import { encodeThemeBlob, getPreset } from '@mylife/meerkat-theme';
import type { CommunityChannel } from '@mylife/sync';
import { visibleCommunityName, type CommunityTemplate } from './community-templates';

export type ExperienceId = 'standard' | 'discussion' | 'library' | 'video' | 'shorts' | 'live';
export interface OnboardingExperience {
  id: ExperienceId;
  name: string;
  reference: string;
  description: string;
  /** Whether every primary media surface is implemented in this build. All starters can load. */
  ready: boolean;
  preview: readonly string[];
}

export const ONBOARDING_EXPERIENCES: readonly OnboardingExperience[] = [
  { id: 'standard', name: 'Standard community', reference: 'Chat and channels', description: 'A general conversation and a separate place for announcements.', ready: true, preview: ['General', 'Announcements', 'Your conversation starts here'] },
  { id: 'discussion', name: 'Discussion board', reference: 'Forum-style conversations', description: 'Put discussions at the top of your community home, with chat always close by.', ready: true, preview: ['Discussions', 'A place for your next question', 'General chat'] },
  { id: 'library', name: 'Shared library', reference: 'Collections and shared files', description: 'Open on your photo, video, and document collections. Keep a general chat alongside them.', ready: true, preview: ['Photos', 'Videos', 'Documents'] },
  { id: 'video', name: 'Video channel', reference: 'YouTube-style browsing', description: 'A video-led home with a player and a browsable catalog. Video playback is not available in this build.', ready: false, preview: ['Featured video', 'Latest videos', 'Video catalog'] },
  { id: 'shorts', name: 'Short videos', reference: 'TikTok / Reels-style viewing', description: 'One vertical video at a time. Short-video paging and playback are not available in this build.', ready: false, preview: ['Vertical video', 'Replies', 'Next video'] },
  { id: 'live', name: 'Live stage', reference: 'Twitch-style watching', description: 'A live stage beside the conversation. Live broadcasting is not available in this build.', ready: false, preview: ['Live stage', 'Conversation', 'Schedule'] },
];

export function findOnboardingExperience(id: string): OnboardingExperience | undefined {
  return ONBOARDING_EXPERIENCES.find((experience) => experience.id === id);
}

export const STANDARD_CHANNELS: CommunityChannel[] = [
  { id: 'general', name: 'General', kind: 'chat', order: 0 },
  { id: 'announcements', name: 'Announcements', kind: 'chat', order: 1, postRoles: ['owner', 'admin'] },
];

/** One validated draft drives both platform commit adapters. */
export function buildOnboardingExperience(name: string, experienceId: string, themeId: string) {
  if (!visibleCommunityName(name) || name.trim().length > 80) throw new Error('Enter a community name of 1–80 characters.');
  const experience = findOnboardingExperience(experienceId);
  if (!experience) throw new Error('Choose a known layout to continue.');
  const theme = getPreset(themeId);
  if (!theme) throw new Error('Choose an available theme to continue.');
  const document = ['standard', 'library'].includes(experience.id) ? null : buildExperienceLayout(experience.id, name.trim(), 'general');
  const template: CommunityTemplate = {
    id: experience.id, name: experience.name, blurb: experience.description,
    description: '', themePresetId: theme.id, accent: null,
    layout: experience.id === 'library' ? 'library_first' : 'chat_first',
    categories: [], chatChannels: STANDARD_CHANNELS.map((channel) => ({ id: channel.id, name: channel.name })),
    libraries: experience.id === 'library' ? [
      { name: 'Photos', mediaType: 'photo' },
      { name: 'Videos', mediaType: 'movie' },
      { name: 'Documents', mediaType: 'document' },
    ] : experience.id === 'video' || experience.id === 'shorts' ? [{ name: 'Videos', mediaType: 'movie' }] : [],
  };
  return {
    name: name.trim(), template,
    channels: STANDARD_CHANNELS.map((channel) => ({ ...channel, ...(channel.postRoles ? { postRoles: [...channel.postRoles] } : {}) })),
    themeBlob: encodeThemeBlob(theme),
    layoutBlob: document ? encodeLayoutBlob(document) : null,
  };
}

/** Local starter arrangement; contains no URLs, identity material, or writes. */
export function buildExperienceLayout(id: string, name: string, channelId?: string): MkLayoutDocument {
  const experience = findOnboardingExperience(id);
  if (!experience) throw new Error('Choose a known layout to continue.');
  const config = channelId ? { channelId } : {};
  const header = { type: 'hero', config: { title: name.slice(0, 280), ...(id === 'discussion' ? { subtitle: 'A place for your conversations.' } : {}) } };
  const chat = { type: 'chat', config: { ...config } };
  const bodies: Record<ExperienceId, MkLayoutDocument> = {
    standard: { capabilities: [], tiers: [], home: [header, chat, { type: 'members', config: {} }], channels: {} },
    discussion: { capabilities: [], tiers: [], home: [header, { type: 'posts', config: { ...config } }, chat], channels: {} },
    library: { capabilities: [], tiers: [], home: [header, { type: 'gallery', config: {} }, { type: 'files', config: {} }, chat], channels: {} },
    video: { capabilities: ['video'], tiers: [], home: [header, { type: 'video_gallery', config: {} }, { type: 'gallery', config: {} }, chat], channels: {} },
    shorts: { capabilities: ['shortform'], tiers: [], home: [header, { type: 'shortform_pager', config: { ...config } }, chat], channels: {} },
    live: { capabilities: ['live'], tiers: [], home: [header, { type: 'live_stage', config: { ...config } }, chat], channels: {} },
  };
  return bodies[experience.id];
}
