/**
 * Code block parsing and syntax highlighting support for MyNotes.
 * Extracts fenced code blocks from markdown and provides language detection.
 */

export const SUPPORTED_LANGUAGES = [
  'javascript', 'typescript', 'python', 'ruby', 'go', 'rust', 'java',
  'c', 'cpp', 'csharp', 'swift', 'kotlin', 'php', 'html', 'css',
  'sql', 'bash', 'shell', 'json', 'yaml', 'toml', 'xml', 'markdown',
  'diff', 'graphql', 'dockerfile', 'makefile', 'regex', 'plaintext', 'lua',
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** Language aliases that map to canonical language names */
const LANGUAGE_ALIASES: Record<string, SupportedLanguage> = {
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  'c++': 'cpp',
  'c#': 'csharp',
  cs: 'csharp',
  kt: 'kotlin',
  sh: 'bash',
  zsh: 'bash',
  fish: 'bash',
  yml: 'yaml',
  md: 'markdown',
  gql: 'graphql',
  make: 'makefile',
  re: 'regex',
  text: 'plaintext',
  txt: 'plaintext',
};

export interface CodeBlock {
  language: string | null;
  code: string;
  startLine: number;
  endLine: number;
}

/**
 * Parse fenced code blocks from markdown text.
 * Supports ``` and ~~~ delimiters with optional language tags.
 */
export function parseCodeBlocks(markdown: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const lines = markdown.split('\n');
  let i = 0;

  while (i < lines.length) {
    const openMatch = lines[i].match(/^(`{3,}|~{3,})(\w*)\s*$/);
    if (openMatch) {
      const fence = openMatch[1];
      const lang = openMatch[2] || null;
      const startLine = i;
      const codeLines: string[] = [];
      i++;

      while (i < lines.length) {
        if (lines[i].match(new RegExp(`^${fence[0]}{${fence.length},}\\s*$`))) {
          break;
        }
        codeLines.push(lines[i]);
        i++;
      }

      blocks.push({
        language: lang,
        code: codeLines.join('\n'),
        startLine,
        endLine: i,
      });
    }
    i++;
  }

  return blocks;
}

/**
 * Resolve a language tag to a canonical supported language name.
 * Returns null if the language is not recognized.
 */
export function resolveLanguage(tag: string | null): SupportedLanguage | null {
  if (!tag) return null;
  const lower = tag.toLowerCase();
  if ((SUPPORTED_LANGUAGES as readonly string[]).includes(lower)) {
    return lower as SupportedLanguage;
  }
  return LANGUAGE_ALIASES[lower] ?? null;
}

/**
 * Count the number of fenced code blocks in markdown text.
 */
export function countCodeBlocks(markdown: string): number {
  return parseCodeBlocks(markdown).length;
}

/**
 * Extract just the code content from all code blocks in markdown.
 */
export function extractCodeContent(markdown: string): string[] {
  return parseCodeBlocks(markdown).map((b) => b.code);
}
