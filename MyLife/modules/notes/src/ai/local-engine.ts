/**
 * Local (on-device) AI writing assistant engine.
 * Rule-based text transformations that work offline without cloud APIs.
 */

/**
 * Extractive summarization: picks the most informative sentences.
 * Simple heuristic: first sentence, longest sentence, last sentence.
 */
export function summarizeLocal(text: string, maxSentences = 3): string {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (sentences.length <= maxSentences) return text;

  // Pick first, longest, and last sentences
  const picked = new Set<number>();
  picked.add(0);
  picked.add(sentences.length - 1);

  const sorted = sentences
    .map((s, i) => ({ s, i }))
    .sort((a, b) => b.s.length - a.s.length);

  for (const item of sorted) {
    if (picked.size >= maxSentences) break;
    picked.add(item.i);
  }

  return Array.from(picked)
    .sort((a, b) => a - b)
    .map((i) => sentences[i])
    .join(' ');
}

/**
 * Simple grammar fixes: double spaces, capitalization, common typos.
 */
export function fixGrammarLocal(text: string): string {
  let result = text;

  // Fix double spaces
  result = result.replace(/  +/g, ' ');

  // Fix missing capitalization after sentence endings
  result = result.replace(/([.!?])\s+([a-z])/g, (_, punct, letter) => `${punct} ${letter.toUpperCase()}`);

  // Fix start of text capitalization
  result = result.replace(/^([a-z])/, (_, letter) => letter.toUpperCase());

  // Common contractions
  result = result.replace(/\bi\b/g, 'I');
  result = result.replace(/\bdont\b/g, "don't");
  result = result.replace(/\bcant\b/g, "can't");
  result = result.replace(/\bwont\b/g, "won't");
  result = result.replace(/\bim\b/g, "I'm");
  result = result.replace(/\bive\b/g, "I've");
  result = result.replace(/\btheyre\b/g, "they're");
  result = result.replace(/\btheres\b/g, "there's");

  return result;
}

/**
 * Simplify text by shortening long sentences and replacing complex words.
 */
export function simplifyLocal(text: string): string {
  const replacements: Array<[string, string]> = [
    ['utilize', 'use'],
    ['implement', 'build'],
    ['facilitate', 'help'],
    ['demonstrate', 'show'],
    ['approximately', 'about'],
    ['subsequently', 'then'],
    ['nevertheless', 'still'],
    ['consequently', 'so'],
    ['furthermore', 'also'],
    ['additionally', 'also'],
    ['in order to', 'to'],
    ['due to the fact that', 'because'],
    ['at this point in time', 'now'],
    ['in the event that', 'if'],
  ];

  let result = text;
  for (const [complex, simple] of replacements) {
    result = result.replace(new RegExp(complex, 'gi'), simple);
  }

  return result;
}

/**
 * Get the available local AI actions.
 */
export function getLocalAiActions(): string[] {
  return ['summarize', 'fix_grammar', 'simplify'];
}

/**
 * Run a local AI action on text.
 */
export function runLocalAiAction(action: string, text: string): string {
  switch (action) {
    case 'summarize': return summarizeLocal(text);
    case 'fix_grammar': return fixGrammarLocal(text);
    case 'simplify': return simplifyLocal(text);
    default: return text;
  }
}
