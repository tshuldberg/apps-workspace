import { useState, useCallback } from 'react';

/**
 * Flash bridge hook for creating flashcards from saved words.
 *
 * The flash bridge depends on @mylife/flash which may not be available
 * or enabled. This hook gracefully handles the module not being present
 * by defaulting flashEnabled to false until the flash module is wired.
 */
export function useFlashBridge(_savedWordId?: string) {
  const [creating, setCreating] = useState(false);

  // Flash module availability placeholder.
  // When @mylife/flash is fully wired into the words module bridge,
  // this will check module registry for flash enablement status.
  const flashEnabled = false;
  const hasCard = false;

  const createCard = useCallback(async () => {
    if (!_savedWordId || !flashEnabled) return;

    try {
      setCreating(true);
      // When flash module is wired:
      // 1. Get or create vocabulary deck via getOrCreateVocabularyDeck(db, deps)
      // 2. Call createFlashcardFromWord(db, savedWordId, deckId, deps)
      // 3. Update hasCard state
    } catch {
      // Silently fail -- flash module may not be available
    } finally {
      setCreating(false);
    }
  }, [_savedWordId, flashEnabled]);

  return { hasCard, creating, createCard, flashEnabled };
}
