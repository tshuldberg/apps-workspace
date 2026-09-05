/**
 * Pure markdown utility functions for MyNotes.
 * No I/O dependencies - all functions are testable without a database.
 */

/** Regex to match [[wiki-style backlinks]] */
const BACKLINK_REGEX = /\[\[([^\]]+)\]\]/g;

/**
 * Extract all [[backlink]] references from markdown text.
 * Returns an array of unique target note titles.
 */
export function extractBacklinks(body: string): string[] {
  const matches = new Set<string>();
  let match: RegExpExecArray | null;
  const regex = new RegExp(BACKLINK_REGEX.source, 'g');
  while ((match = regex.exec(body)) !== null) {
    const title = match[1].trim();
    if (title.length > 0) {
      matches.add(title);
    }
  }
  return Array.from(matches);
}

/**
 * Count words in text. Strips markdown formatting before counting.
 */
export function countWords(text: string): number {
  if (!text || text.trim().length === 0) return 0;
  // Strip common markdown: headings, bold, italic, code, links, images
  const stripped = text
    .replace(/^#{1,6}\s+/gm, '')     // headings
    .replace(/[*_~`]/g, '')           // bold, italic, strikethrough, inline code
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // links and images
    .replace(/\[([^\]]*)\]/g, '$1')   // remaining brackets
    .trim();
  if (stripped.length === 0) return 0;
  return stripped.split(/\s+/).filter((w) => w.length > 0).length;
}

/**
 * Extract headings from markdown for a Table of Contents.
 * Returns array of { level, text } objects.
 */
export function extractHeadings(body: string): { level: number; text: string }[] {
  const headings: { level: number; text: string }[] = [];
  const lines = body.split('\n');
  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].trim(),
      });
    }
  }
  return headings;
}

/**
 * Count checklist items and how many are checked.
 * Markdown checklists: - [ ] unchecked, - [x] checked
 */
export function countChecklistItems(body: string): { total: number; checked: number } {
  const unchecked = (body.match(/^-\s+\[\s\]/gm) ?? []).length;
  const checked = (body.match(/^-\s+\[x\]/gim) ?? []).length;
  return { total: unchecked + checked, checked };
}

/**
 * Generate a simple text snippet from markdown body.
 * Strips formatting and truncates to maxLength characters.
 */
export function generateSnippet(body: string, maxLength = 150): string {
  const stripped = body
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~`]/g, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\n+/g, ' ')
    .trim();
  if (stripped.length <= maxLength) return stripped;
  return stripped.slice(0, maxLength).replace(/\s+\S*$/, '') + '...';
}
