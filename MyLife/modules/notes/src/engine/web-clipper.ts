/**
 * Web clipper engine for MyNotes.
 * Converts HTML content to markdown and prepares clipped notes.
 */

export type ClipType = 'article' | 'full_page' | 'selection' | 'bookmark';

export interface ClipResult {
  title: string;
  body: string;
  sourceUrl: string;
  clipType: ClipType;
}

/**
 * Simple HTML to markdown conversion.
 * Handles common tags: h1-h6, p, a, img, ul, ol, li, strong, em, code, pre, blockquote.
 */
export function htmlToMarkdown(html: string): string {
  let md = html;

  // Remove script and style tags
  md = md.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  md = md.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Headings
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n');
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n');
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n');
  md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n');
  md = md.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n##### $1\n');
  md = md.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n###### $1\n');

  // Bold and italic
  md = md.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**');
  md = md.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*');

  // Code
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');
  md = md.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n```\n$1\n```\n');

  // Links
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');

  // Images
  md = md.replace(/<img[^>]*alt="([^"]*)"[^>]*src="([^"]*)"[^>]*\/?>/gi, '![$1]($2)');
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)');
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, '![]($1)');

  // Blockquotes
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, content) => {
    return content.trim().split('\n').map((line: string) => `> ${line.trim()}`).join('\n');
  });

  // List items
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');

  // Paragraphs and line breaks
  md = md.replace(/<br\s*\/?>/gi, '\n');
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n');
  md = md.replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, '\n$1\n');

  // Remove remaining HTML tags
  md = md.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  md = md.replace(/&amp;/g, '&');
  md = md.replace(/&lt;/g, '<');
  md = md.replace(/&gt;/g, '>');
  md = md.replace(/&quot;/g, '"');
  md = md.replace(/&#39;/g, "'");
  md = md.replace(/&nbsp;/g, ' ');

  // Clean up whitespace
  md = md.replace(/\n{3,}/g, '\n\n');
  md = md.trim();

  return md;
}

/**
 * Build a clipped note body with metadata header.
 */
export function buildClipBody(
  content: string,
  sourceUrl: string,
  title?: string,
  author?: string,
): string {
  const lines: string[] = [];
  if (title) lines.push(`# ${title}`);
  lines.push('');
  lines.push(`> Clipped from [${sourceUrl}](${sourceUrl})`);
  if (author) lines.push(`> Author: ${author}`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(content);

  return lines.join('\n');
}

/**
 * Truncate markdown content to a maximum length.
 */
export function truncateClip(markdown: string, maxLength = 500000): string {
  if (markdown.length <= maxLength) return markdown;
  return markdown.slice(0, maxLength) + '\n\n[Content truncated]';
}
