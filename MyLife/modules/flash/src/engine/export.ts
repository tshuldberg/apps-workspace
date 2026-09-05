import type { FlashExportBundle } from '../types';

export type FlashExportFormat = 'json' | 'markdown' | 'text';

export function serializeFlashExport(bundle: FlashExportBundle, format: FlashExportFormat): string {
  if (format === 'json') {
    return JSON.stringify(bundle, null, 2);
  }

  const header = bundle.deck
    ? `MyFlash export for ${bundle.deck.name}`
    : 'MyFlash collection export';
  const stats = [
    `Decks: ${bundle.decks.length}`,
    `Cards: ${bundle.cards.length}`,
    `Review logs: ${bundle.reviewLogs.length}`,
    `Settings: ${bundle.settings.length}`,
    `Exported: ${bundle.exportRecord.exportedAt}`,
  ];

  if (format === 'markdown') {
    const deckLines = bundle.decks.map((deck) => `- ${deck.name}: ${deck.cardCount} cards`);
    const cardLines = bundle.cards.slice(0, 12).map((card) => `- ${card.front} -> ${card.back}`);
    return [
      `# ${header}`,
      '',
      ...stats.map((line) => `- ${line}`),
      '',
      '## Decks',
      ...deckLines,
      '',
      '## Cards',
      ...cardLines,
    ].join('\n');
  }

  const cardPreview = bundle.cards
    .slice(0, 12)
    .map((card) => `${card.front} -> ${card.back}`)
    .join('\n');
  return `${header}\n${stats.join('\n')}\n\n${cardPreview}`.trim();
}
