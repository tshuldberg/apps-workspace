/**
 * Book Club engine types.
 */

import type { BookClub } from '../db/clubs';
import type { ClubMember } from '../db/club-members';

export interface ClubWithProgress {
  club: BookClub;
  currentBookTitle: string | null;
  currentBookCoverUrl: string | null;
  daysRemaining: number | null;
  isOverdue: boolean;
  readingProgress: number | null;
  members: ClubMember[];
}
