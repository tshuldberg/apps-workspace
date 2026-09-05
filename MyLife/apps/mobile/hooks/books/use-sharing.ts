import { useState, useEffect, useCallback } from 'react';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  getTemplateAvailability,
  buildCardData,
  getCardThemeColors,
  getCardDimensions,
  calculateReadingStats,
  gatherBadgeStats,
  getSessions,
  getBooks,
  type TemplateAvailability,
  type CardData,
  type CardTemplateId,
  type ColorTheme,
  type ReadingStats,
} from '@mylife/books';

export function useSharing() {
  const db = useDatabase();
  const [templates, setTemplates] = useState<TemplateAvailability[]>([]);
  const [stats, setStats] = useState<ReadingStats | null>(null);

  useEffect(() => {
    try {
      const sessions = getSessions(db);
      const books = getBooks(db);
      // calculateReadingStats needs reviews too, pass empty array if not loaded
      const computed = calculateReadingStats(sessions, [], books);
      setStats(computed);
      const badgeStats = gatherBadgeStats(db);
      const availability = getTemplateAvailability(computed, badgeStats.genreCount, badgeStats.authorCount);
      setTemplates(availability);
    } catch {
      // silently handle
    }
  }, [db]);

  const buildCard = useCallback(
    (templateId: CardTemplateId, theme: ColorTheme, displayName: string, showName: boolean): CardData | null => {
      if (!stats) return null;
      return buildCardData(templateId, stats, {
        theme,
        showDisplayName: showName,
        displayName,
      });
    },
    [stats],
  );

  const themeColors = useCallback(
    (theme: ColorTheme) => {
      return getCardThemeColors(theme);
    },
    [],
  );

  const dimensions = getCardDimensions();

  return { templates, buildCard, themeColors, dimensions };
}
