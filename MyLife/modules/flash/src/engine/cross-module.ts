import type { CreateFlashcardInput, FlashDashboard, ReviewLog } from '../types';
import { parseClozeText } from './cloze';

// ── Types ────────────────────────────────────────────────────────────

/** Signal that MyFlash exposes to other modules via the hub */
export interface StudySignal {
  /** Current retention rate (0-1) across all active cards */
  retentionRate: number;
  /** Number of active decks */
  activeDeckCount: number;
  /** Current study streak in days */
  currentStreak: number;
  /** Total cards being tracked */
  totalCards: number;
  /** Cards due for review today */
  dueToday: number;
  /** Cards reviewed today */
  reviewedToday: number;
  /** Study readiness score (0-100): higher = more engaged learner */
  studyReadiness: number;
}

/** Suggestion from another module to create flashcards */
export interface CardSuggestion {
  /** Source module ID (e.g., 'books', 'notes', 'meds') */
  sourceModule: string;
  /** Entity ID in the source module */
  sourceEntityId: string;
  /** Suggested card front text */
  front: string;
  /** Suggested card back text */
  back: string;
  /** Target deck ID (null = default deck) */
  deckId: string | null;
  /** Suggested tags including source module */
  tags: string[];
  /** Card type hint */
  cardType: 'basic' | 'reversed' | 'cloze';
}

/** Vocabulary pair from MyBooks or MyWords */
export interface VocabularyPair {
  word: string;
  definition: string;
  context?: string;
  sourceModule: string;
  sourceEntityId: string;
}

/** Note excerpt for cloze deletion generation */
export interface NoteExcerpt {
  text: string;
  title?: string;
  sourceModule: string;
  sourceEntityId: string;
}

/** Result of validating a card suggestion */
export interface CardSuggestionValidation {
  valid: boolean;
  errors: string[];
  sanitized: CardSuggestion | null;
}

// ── Constants ────────────────────────────────────────────────────────

const MAX_FRONT_LENGTH = 2000;
const MAX_BACK_LENGTH = 5000;
const MAX_TAG_LENGTH = 50;
const MAX_TAGS = 20;
const CORRECT_RATINGS = new Set(['good', 'easy']);

// ── Pure Functions ───────────────────────────────────────────────────

/**
 * Compute the cross-module study signal from current flash data.
 * Other modules can use this to understand the user's learning state.
 */
export function getStudySignal(
  dashboard: FlashDashboard,
  logs: ReadonlyArray<Pick<ReviewLog, 'rating'>>,
): StudySignal {
  const totalReviews = logs.length;
  const correctReviews = logs.filter((l) => CORRECT_RATINGS.has(l.rating)).length;
  const retentionRate = totalReviews > 0 ? correctReviews / totalReviews : 0;

  // Study readiness: composite score based on streak, retention, and activity
  const streakScore = Math.min(dashboard.currentStreak / 7, 1) * 30; // 30 points max for 7-day streak
  const retentionScore = retentionRate * 40; // 40 points max for 100% retention
  const activityScore =
    dashboard.reviewedToday > 0
      ? Math.min(dashboard.reviewedToday / 20, 1) * 30 // 30 points max for 20+ reviews
      : 0;
  const studyReadiness = Math.round(streakScore + retentionScore + activityScore);

  return {
    retentionRate: Math.round(retentionRate * 1000) / 1000,
    activeDeckCount: dashboard.deckCount,
    currentStreak: dashboard.currentStreak,
    totalCards: dashboard.cardCount,
    dueToday: dashboard.dueCount,
    reviewedToday: dashboard.reviewedToday,
    studyReadiness: Math.min(100, studyReadiness),
  };
}

/**
 * Validate an incoming card suggestion from another module.
 * Sanitizes text, checks lengths, normalizes tags.
 */
export function validateCardSuggestion(suggestion: CardSuggestion): CardSuggestionValidation {
  const errors: string[] = [];

  if (!suggestion.sourceModule || suggestion.sourceModule.trim().length === 0) {
    errors.push('sourceModule is required');
  }
  if (!suggestion.sourceEntityId || suggestion.sourceEntityId.trim().length === 0) {
    errors.push('sourceEntityId is required');
  }
  if (!suggestion.front || suggestion.front.trim().length === 0) {
    errors.push('front text is required');
  }
  if (suggestion.front && suggestion.front.length > MAX_FRONT_LENGTH) {
    errors.push(`front text exceeds ${MAX_FRONT_LENGTH} characters`);
  }
  if (suggestion.back && suggestion.back.length > MAX_BACK_LENGTH) {
    errors.push(`back text exceeds ${MAX_BACK_LENGTH} characters`);
  }
  if (suggestion.cardType === 'cloze') {
    const parsed = parseClozeText(suggestion.front);
    if (parsed.markers.length === 0) {
      errors.push('cloze card type requires {{c1::...}} markers in front text');
    }
  }
  if (suggestion.tags && suggestion.tags.length > MAX_TAGS) {
    errors.push(`too many tags (max ${MAX_TAGS})`);
  }

  if (errors.length > 0) {
    return { valid: false, errors, sanitized: null };
  }

  const sanitized: CardSuggestion = {
    sourceModule: suggestion.sourceModule.trim(),
    sourceEntityId: suggestion.sourceEntityId.trim(),
    front: suggestion.front.trim(),
    back: (suggestion.back ?? '').trim(),
    deckId: suggestion.deckId,
    tags: [
      `source:${suggestion.sourceModule.trim()}`,
      ...suggestion.tags
        .map((t) => t.trim().toLowerCase().slice(0, MAX_TAG_LENGTH))
        .filter((t) => t.length > 0),
    ],
    cardType: suggestion.cardType,
  };

  return { valid: true, errors: [], sanitized };
}

/**
 * Convert vocabulary word/definition pairs into flash card inputs.
 * Used by MyBooks (reading vocabulary) and MyWords (dictionary lookups).
 * Creates both basic and reversed cards for each pair.
 */
export function buildVocabularyCards(
  pairs: ReadonlyArray<VocabularyPair>,
  deckId: string,
): CreateFlashcardInput[] {
  return pairs.flatMap((pair) => {
    const tags = [`source:${pair.sourceModule}`, 'vocabulary'];
    const front = pair.context ? `${pair.word}\n\n_${pair.context}_` : pair.word;

    return [
      {
        deckId,
        front,
        back: pair.definition,
        cardType: 'basic' as const,
        tags,
      },
      {
        deckId,
        front: pair.definition,
        back: pair.word,
        cardType: 'reversed' as const,
        tags,
      },
    ];
  });
}

/**
 * Convert note excerpts into cloze deletion card inputs.
 * Used by MyNotes to generate study material from note content.
 * Expects text already containing {{c1::...}} cloze markers.
 * Texts without markers are converted to basic front/back cards using the title.
 */
export function buildStudyDeckFromNotes(
  excerpts: ReadonlyArray<NoteExcerpt>,
  deckId: string,
): CreateFlashcardInput[] {
  return excerpts.map((excerpt) => {
    const tags = [`source:${excerpt.sourceModule}`];
    const parsed = parseClozeText(excerpt.text);

    if (parsed.markers.length > 0) {
      return {
        deckId,
        front: excerpt.text,
        back: excerpt.title ?? '',
        cardType: 'cloze' as const,
        tags,
      };
    }

    // No cloze markers: create basic card with title as front
    return {
      deckId,
      front: excerpt.title ?? 'Note',
      back: excerpt.text,
      cardType: 'basic' as const,
      tags,
    };
  });
}
