/**
 * Discovery engine types.
 */

import type { ContentWarning } from '../models/schemas';

export interface DiscoveryFilters {
  moods?: string[];
  paces?: string[];
  genres?: string[];
  excludeWarnings?: string[];
  tags?: string[];
  limit?: number;
  offset?: number;
}

export interface BookDiscoveryProfile {
  moods: string[];
  paces: string[];
  genres: string[];
  contentWarnings: ContentWarning[];
  tags: string[];
}

export interface DiscoverySuggestion {
  key: string; // Open Library work key
  title: string;
  authors: string[];
  coverUrl: string | null;
  firstPublishYear: number | null;
  subject: string; // the genre that triggered this suggestion
}
