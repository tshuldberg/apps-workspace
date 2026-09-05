export interface ParsedClozeMarker {
  answer: string;
  hint: string | null;
  number: number;
  raw: string;
}

export interface ParsedClozeText {
  markers: ParsedClozeMarker[];
  uniqueNumbers: number[];
}

const CLOZE_PATTERN = /\{\{c(\d+)::(.*?)(?:::(.*?))?\}\}/g;

export function parseClozeText(text: string): ParsedClozeText {
  const markers: ParsedClozeMarker[] = [];

  for (const match of text.matchAll(CLOZE_PATTERN)) {
    const answer = (match[2] ?? '').trim();
    if (!answer) {
      continue;
    }

    markers.push({
      raw: match[0],
      number: Number(match[1]),
      answer,
      hint: (match[3] ?? '').trim() || null,
    });
  }

  return {
    markers,
    uniqueNumbers: [...new Set(markers.map((marker) => marker.number))].sort((left, right) => left - right),
  };
}

function replaceCloze(text: string, activeNumber: number, mode: 'front' | 'back'): string {
  return text.replace(CLOZE_PATTERN, (raw, numberValue: string, answer: string, hint?: string) => {
    const number = Number(numberValue);
    const normalizedAnswer = answer.trim();
    const normalizedHint = (hint ?? '').trim();
    if (!normalizedAnswer) {
      return raw;
    }

    if (number !== activeNumber) {
      return normalizedAnswer;
    }

    if (mode === 'front') {
      return normalizedHint ? `[${normalizedHint}]` : '[...]';
    }

    return `[[${normalizedAnswer}]]`;
  });
}

export function renderClozeFront(text: string, activeNumber: number): string {
  return replaceCloze(text, activeNumber, 'front');
}

export function renderClozeBack(text: string, activeNumber: number, extraBack?: string): string {
  const rendered = replaceCloze(text, activeNumber, 'back');
  return extraBack?.trim() ? `${rendered}\n\n${extraBack.trim()}` : rendered;
}

export function buildClozeFlashcards(
  text: string,
  extraBack?: string,
): Array<{ back: string; front: string; templateOrdinal: number }> {
  const parsed = parseClozeText(text);
  return parsed.uniqueNumbers.map((number) => ({
    templateOrdinal: number - 1,
    front: renderClozeFront(text, number),
    back: renderClozeBack(text, number, extraBack),
  }));
}
