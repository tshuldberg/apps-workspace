import type { JournalExportBundle } from '../types';

function entryTitle(title: string | null, entryDate: string): string {
  return title ?? `Entry ${entryDate}`;
}

function renderMarkdown(bundle: JournalExportBundle): string {
  return bundle.entries
    .map((entry) => [
      `# ${entryTitle(entry.title, entry.entryDate)}`,
      '',
      `Date: ${entry.entryDate}`,
      `Journal: ${bundle.journals.find((journal) => journal.id === entry.journalId)?.name ?? entry.journalId}`,
      entry.tags.length > 0 ? `Tags: ${entry.tags.join(', ')}` : null,
      entry.mood ? `Mood: ${entry.mood}` : null,
      '',
      entry.body,
      '',
    ].filter(Boolean).join('\n'))
    .join('\n---\n\n');
}

function renderPlainText(bundle: JournalExportBundle): string {
  return bundle.entries
    .map((entry) => [
      entryTitle(entry.title, entry.entryDate),
      `Date: ${entry.entryDate}`,
      `Journal: ${bundle.journals.find((journal) => journal.id === entry.journalId)?.name ?? entry.journalId}`,
      entry.tags.length > 0 ? `Tags: ${entry.tags.join(', ')}` : null,
      entry.mood ? `Mood: ${entry.mood}` : null,
      '',
      entry.body,
    ].filter(Boolean).join('\n'))
    .join('\n\n====================\n\n');
}

export function serializeJournalExport(
  bundle: JournalExportBundle,
  format: 'json' | 'markdown' | 'text' = 'json',
): string {
  if (format === 'markdown') {
    return renderMarkdown(bundle);
  }

  if (format === 'text') {
    return renderPlainText(bundle);
  }

  return JSON.stringify(bundle, null, 2);
}
