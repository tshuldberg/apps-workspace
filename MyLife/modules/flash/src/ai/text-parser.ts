import type { GeneratedCard } from './types';

const MIN_TEXT_LENGTH = 50;
const MAX_TEXT_LENGTH = 50_000;

export function validateTextLength(text: string): string | null {
  if (text.length < MIN_TEXT_LENGTH) return 'Enter more text for better card generation.';
  if (text.length > MAX_TEXT_LENGTH) return 'Text too long. Split into sections.';
  return null;
}

/**
 * Extract "X is Y" and "X are Y" definition patterns.
 */
export function extractDefinitions(text: string): GeneratedCard[] {
  const cards: GeneratedCard[] = [];
  // Match "Term is/are definition" at sentence boundaries
  const isArePattern = /(?:^|[.!?\n]\s*)([A-Z][A-Za-z\s'-]{2,50}?)\s+(?:is|are)\s+(.{10,200}?)(?:\.|$)/gm;

  for (const match of text.matchAll(isArePattern)) {
    const term = match[1].trim();
    const definition = match[2].trim();
    if (term && definition) {
      cards.push({
        front: `What is ${term.toLowerCase()}?`,
        back: capitalize(definition),
        cardType: 'basic',
        source: 'ai_ondevice',
      });
    }
  }

  return cards;
}

/**
 * Extract "Term: definition" colon-separated patterns.
 */
export function extractColonDefinitions(text: string): GeneratedCard[] {
  const cards: GeneratedCard[] = [];
  const colonPattern = /(?:^|\n)\s*([A-Za-z][A-Za-z\s'-]{1,50}?)\s*:\s*(.{10,300}?)(?:\n|$)/gm;

  for (const match of text.matchAll(colonPattern)) {
    const term = match[1].trim();
    const definition = match[2].trim();
    if (term && definition && !definition.includes(':')) {
      cards.push({
        front: `What is ${term.toLowerCase()}?`,
        back: capitalize(definition),
        cardType: 'basic',
        source: 'ai_ondevice',
      });
    }
  }

  return cards;
}

/**
 * Extract list/enumeration patterns.
 */
export function extractLists(text: string): GeneratedCard[] {
  const cards: GeneratedCard[] = [];
  // Pattern: "X types/kinds/categories of Y: A, B, C" or "X: A, B, C"
  const listPattern = /(?:(\w+)\s+(?:types?|kinds?|categories|forms?|stages?|steps?|phases?|parts?)\s+of\s+)?([A-Za-z][A-Za-z\s'-]{1,40}?)\s*(?::|include|are)\s*((?:[A-Za-z][A-Za-z\s'-]*,\s*){2,}[A-Za-z][A-Za-z\s'-]*)/gim;

  for (const match of text.matchAll(listPattern)) {
    const count = match[1] || '';
    const topic = match[2].trim();
    const items = match[3].trim();
    const itemList = items.split(',').map((i) => i.trim()).filter(Boolean);
    if (itemList.length >= 3) {
      const countStr = count ? `${count} ` : `${itemList.length} `;
      cards.push({
        front: `Name ${countStr}types of ${topic.toLowerCase()}.`,
        back: itemList.join(', '),
        cardType: 'basic',
        source: 'ai_ondevice',
      });
    }
  }

  return cards;
}

/**
 * Extract **bold** or *italic* terms for cloze deletion cards.
 */
export function extractBoldTerms(text: string): GeneratedCard[] {
  const cards: GeneratedCard[] = [];
  // Find each **bold term** and extract the surrounding sentence
  const boldPattern = /\*\*([^*]{2,}?)\*\*/g;

  for (const match of text.matchAll(boldPattern)) {
    const term = match[1].trim();
    // Find the surrounding sentence
    const pos = match.index!;
    const sentenceStart = Math.max(0, text.lastIndexOf('.', pos) + 1, text.lastIndexOf('\n', pos) + 1);
    const sentenceEnd = text.indexOf('.', pos + match[0].length);
    const sentence = text.slice(sentenceStart, sentenceEnd > 0 ? sentenceEnd : undefined).trim();
    if (sentence.length > 20 && term.length >= 2) {
      const clozeSentence = sentence.replace(`**${term}**`, `{{c1::${term}}}`);
      cards.push({
        front: clozeSentence,
        back: term,
        cardType: 'cloze',
        source: 'ai_ondevice',
      });
    }
  }

  return cards;
}

/**
 * Deduplicate cards by front text (case-insensitive).
 */
export function deduplicateCards(cards: GeneratedCard[]): GeneratedCard[] {
  const seen = new Set<string>();
  return cards.filter((card) => {
    const key = card.front.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}
