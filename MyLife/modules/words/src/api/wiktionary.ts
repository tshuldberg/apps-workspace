const BASE_URL =
  process.env.MYWORDS_WIKTIONARY_API_BASE_URL?.trim() || 'https://en.wiktionary.org/w/api.php';
const TIMEOUT_MS = 10000;

interface WiktionarySection {
  line: string;
  index: string;
  level: string;
  toclevel: number;
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const normalized = raw.trim();
    if (!normalized) continue;
    const key = normalized.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }
  return out;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, decimal: string) => String.fromCodePoint(parseInt(decimal, 10)));
}

function stripHtml(input: string): string {
  return decodeHtmlEntities(
    input
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<li[^>]*>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' '),
  ).trim();
}

async function fetchJson(params: Record<string, string>): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const query = new URLSearchParams({ format: 'json', origin: '*', ...params });
    const response = await fetch(`${BASE_URL}?${query.toString()}`, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Wiktionary API returned ${response.status}.`);
    }
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchEnglishSections(word: string): Promise<WiktionarySection[]> {
  const raw = await fetchJson({
    action: 'parse',
    page: word,
    prop: 'sections',
    redirects: '1',
  });
  const sections = (raw as { parse?: { sections?: WiktionarySection[] } }).parse?.sections ?? [];
  return sections;
}

async function fetchSectionHtml(word: string, index: string): Promise<string> {
  const raw = await fetchJson({
    action: 'parse',
    page: word,
    prop: 'text',
    section: index,
    disableeditsection: '1',
    redirects: '1',
  });
  return ((raw as { parse?: { text?: { '*': string } } }).parse?.text?.['*'] ?? '').trim();
}

function findEnglishSectionIndexes(sections: WiktionarySection[]): {
  etymology?: string;
  related: string[];
  derived: string[];
} {
  let inEnglish = false;
  let englishTocLevel = 0;
  let etymology: string | undefined;
  const related: string[] = [];
  const derived: string[] = [];

  for (const section of sections) {
    const line = stripHtml(section.line);
    const level = Number(section.level);

    if (section.toclevel === 1 && level === 2) {
      inEnglish = line.toLocaleLowerCase() === 'english';
      englishTocLevel = inEnglish ? section.toclevel : 0;
      continue;
    }

    if (!inEnglish) continue;

    if (section.toclevel <= englishTocLevel && level <= 2) {
      inEnglish = false;
      continue;
    }

    if (!etymology && /^Etymology(?:\s+\d+)?$/i.test(line)) {
      etymology = section.index;
      continue;
    }
    if (/^Related terms$/i.test(line)) {
      related.push(section.index);
      continue;
    }
    if (/^Derived terms$/i.test(line)) {
      derived.push(section.index);
    }
  }

  return { etymology, related, derived };
}

function extractParagraphs(html: string): string[] {
  const paragraphs = Array.from(html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi))
    .map((match) => stripHtml(match[1] ?? ''))
    .filter(Boolean)
    .filter((line) => !/^Etymology$/i.test(line));

  return dedupe(paragraphs);
}

function extractLinkedTerms(html: string, word: string): string[] {
  const terms = Array.from(html.matchAll(/<a[^>]+href="\/wiki\/[^"#?]+[^>]*>([\s\S]*?)<\/a>/gi))
    .map((match) => stripHtml(match[1] ?? ''))
    .filter((item) => /^[A-Za-z][A-Za-z -]{1,50}$/.test(item))
    .filter((item) => item.toLocaleLowerCase() !== word.toLocaleLowerCase());

  return dedupe(terms);
}

function toDidYouKnow(wordHistory: string[]): string | null {
  const base = wordHistory[0]?.trim();
  if (!base) return null;
  if (base.length <= 320) return base;
  return `${base.slice(0, 317)}...`;
}

export async function fetchEnglishWordHistoryFromWiktionary(word: string): Promise<{
  wordHistory: string[];
  didYouKnow: string | null;
  nearbyWords: string[];
}> {
  const normalizedWord = word.trim();
  if (!normalizedWord) return { wordHistory: [], didYouKnow: null, nearbyWords: [] };

  const sections = await fetchEnglishSections(normalizedWord);
  const indexes = findEnglishSectionIndexes(sections);

  let wordHistory: string[] = [];
  if (indexes.etymology) {
    const etymologyHtml = await fetchSectionHtml(normalizedWord, indexes.etymology);
    wordHistory = extractParagraphs(etymologyHtml);
  }

  const relatedIndexes = [...indexes.related, ...indexes.derived].slice(0, 4);
  const relatedResults = await Promise.allSettled(
    relatedIndexes.map(async (index) => {
      const html = await fetchSectionHtml(normalizedWord, index);
      return extractLinkedTerms(html, normalizedWord);
    }),
  );

  const nearbyWords = dedupe(
    relatedResults.flatMap((result) => (result.status === 'fulfilled' ? result.value : [])),
  ).slice(0, 24);

  return {
    wordHistory,
    didYouKnow: toDidYouKnow(wordHistory),
    nearbyWords,
  };
}
