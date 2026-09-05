// Community challenges engine -- progress tracking, templates, and auto-update

export {
  updateCommunityProgress,
  getGenreDiversity,
  getAuthorDiversity,
  checkThemedMatch,
  getChallengeTimeStatus,
  getCommunityChallengesWithProgress,
} from './engine';

export type { CommunityChallengeWithProgress, CommunityProgressUpdate } from './types';

export { PRESET_IDS } from './templates';
export type { PresetId } from './templates';
