import { describe, it, expect } from 'vitest';
import {
  parseApkgMetadata,
  parseApkgDecks,
  parseApkgCards,
  mapAnkiScheduling,
} from '../engine/anki-import';
import type { AnkiNote, AnkiCard, AnkiDeck, AnkiModel } from '../engine/anki-import';

describe('parseApkgMetadata', () => {
  it('returns counts of all structures', () => {
    const decks: AnkiDeck[] = [{ id: 1, name: 'Default' }];
    const notes: AnkiNote[] = [{ id: 1, mid: 1, flds: 'front\x1fback', tags: '' }];
    const cards: AnkiCard[] = [{ id: 1, nid: 1, did: 1, ord: 0, type: 0, queue: 0, due: 0, ivl: 0, factor: 2500, reps: 0, lapses: 0 }];
    const models: AnkiModel[] = [{ id: 1, name: 'Basic', flds: [{ name: 'Front' }, { name: 'Back' }], type: 0 }];

    const meta = parseApkgMetadata(decks, notes, cards, models, 5);
    expect(meta).toEqual({
      deckCount: 1,
      cardCount: 1,
      noteCount: 1,
      modelCount: 1,
      mediaCount: 5,
    });
  });
});

describe('parseApkgDecks', () => {
  it('parses flat deck list', () => {
    const decks: AnkiDeck[] = [
      { id: 1, name: 'Default' },
      { id: 2, name: 'Science' },
    ];
    const result = parseApkgDecks(decks);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Default');
    expect(result[0].parentId).toBeNull();
    expect(result[1].name).toBe('Science');
  });

  it('handles nested deck hierarchy via :: separator', () => {
    const decks: AnkiDeck[] = [
      { id: 1, name: 'Languages' },
      { id: 2, name: 'Languages::Japanese' },
      { id: 3, name: 'Languages::Japanese::Vocab' },
    ];
    const result = parseApkgDecks(decks);
    expect(result).toHaveLength(3);

    const japanese = result.find((d) => d.name === 'Japanese');
    expect(japanese).toBeDefined();
    expect(japanese!.parentId).toBe('Languages');

    const vocab = result.find((d) => d.name === 'Vocab');
    expect(vocab).toBeDefined();
    expect(vocab!.parentId).toBe('Languages::Japanese');
  });

  it('preserves ankiDeckId for mapping', () => {
    const decks: AnkiDeck[] = [{ id: 42, name: 'Test' }];
    const result = parseApkgDecks(decks);
    expect(result[0].ankiDeckId).toBe(42);
  });
});

describe('parseApkgCards', () => {
  const basicModel: AnkiModel = { id: 1, name: 'Basic', flds: [{ name: 'Front' }, { name: 'Back' }], type: 0 };
  const clozeModel: AnkiModel = { id: 2, name: 'Cloze', flds: [{ name: 'Text' }, { name: 'Extra' }], type: 1 };
  const deckMap = new Map([[1, 'fl_deck_test']]);

  it('parses basic cards', () => {
    const notes: AnkiNote[] = [{ id: 1, mid: 1, flds: 'What is 2+2?\x1f4', tags: 'math' }];
    const cards: AnkiCard[] = [{ id: 1, nid: 1, did: 1, ord: 0, type: 2, queue: 2, due: 100, ivl: 10, factor: 2500, reps: 5, lapses: 1 }];

    const result = parseApkgCards(notes, cards, [basicModel], deckMap);
    expect(result).toHaveLength(1);
    expect(result[0].front).toBe('What is 2+2?');
    expect(result[0].back).toBe('4');
    expect(result[0].cardType).toBe('basic');
    expect(result[0].tags).toContain('math');
    expect(result[0].tags).toContain('anki-import');
  });

  it('parses cloze cards', () => {
    const notes: AnkiNote[] = [{ id: 1, mid: 2, flds: '{{c1::TypeScript}} is a typed language\x1fProgramming', tags: '' }];
    const cards: AnkiCard[] = [{ id: 1, nid: 1, did: 1, ord: 0, type: 0, queue: 0, due: 0, ivl: 0, factor: 2500, reps: 0, lapses: 0 }];

    const result = parseApkgCards(notes, cards, [clozeModel], deckMap);
    expect(result).toHaveLength(1);
    expect(result[0].cardType).toBe('cloze');
    expect(result[0].front).toContain('{{c1::TypeScript}}');
  });

  it('strips HTML from card content', () => {
    const notes: AnkiNote[] = [{ id: 1, mid: 1, flds: '<b>Bold</b> text<br>new line\x1f<div>answer</div>', tags: '' }];
    const cards: AnkiCard[] = [{ id: 1, nid: 1, did: 1, ord: 0, type: 0, queue: 0, due: 0, ivl: 0, factor: 2500, reps: 0, lapses: 0 }];

    const result = parseApkgCards(notes, cards, [basicModel], deckMap);
    expect(result[0].front).toBe('Bold text\nnew line');
    expect(result[0].back).toBe('answer');
  });

  it('warns on missing note', () => {
    const cards: AnkiCard[] = [{ id: 1, nid: 999, did: 1, ord: 0, type: 0, queue: 0, due: 0, ivl: 0, factor: 2500, reps: 0, lapses: 0 }];
    const result = parseApkgCards([], cards, [basicModel], deckMap);
    expect(result).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].type).toBe('missing_fields');
  });

  it('warns on unknown model', () => {
    const notes: AnkiNote[] = [{ id: 1, mid: 999, flds: 'front\x1fback', tags: '' }];
    const cards: AnkiCard[] = [{ id: 1, nid: 1, did: 1, ord: 0, type: 0, queue: 0, due: 0, ivl: 0, factor: 2500, reps: 0, lapses: 0 }];
    const result = parseApkgCards(notes, cards, [basicModel], deckMap);
    expect(result).toHaveLength(0);
    expect(result.warnings[0].type).toBe('unsupported_model');
  });

  it('skips cards with empty front', () => {
    const notes: AnkiNote[] = [{ id: 1, mid: 1, flds: '\x1fback only', tags: '' }];
    const cards: AnkiCard[] = [{ id: 1, nid: 1, did: 1, ord: 0, type: 0, queue: 0, due: 0, ivl: 0, factor: 2500, reps: 0, lapses: 0 }];
    const result = parseApkgCards(notes, cards, [basicModel], deckMap);
    expect(result).toHaveLength(0);
    expect(result.warnings[0].type).toBe('empty_card');
  });

  it('defaults to fl_deck_default for unmapped deck IDs', () => {
    const notes: AnkiNote[] = [{ id: 1, mid: 1, flds: 'front\x1fback', tags: '' }];
    const cards: AnkiCard[] = [{ id: 1, nid: 1, did: 99, ord: 0, type: 0, queue: 0, due: 0, ivl: 0, factor: 2500, reps: 0, lapses: 0 }];
    const result = parseApkgCards(notes, cards, [basicModel], deckMap);
    expect(result[0].deckId).toBe('fl_deck_default');
  });
});

describe('mapAnkiScheduling', () => {
  it('maps queue -1 to suspended', () => {
    const card: AnkiCard = { id: 1, nid: 1, did: 1, ord: 0, type: 0, queue: -1, due: 0, ivl: 5, factor: 2500, reps: 3, lapses: 1 };
    const result = mapAnkiScheduling(card);
    expect(result.queue).toBe('suspended');
  });

  it('maps queue -2 to buried', () => {
    const card: AnkiCard = { id: 1, nid: 1, did: 1, ord: 0, type: 0, queue: -2, due: 0, ivl: 0, factor: 2500, reps: 0, lapses: 0 };
    expect(mapAnkiScheduling(card).queue).toBe('buried');
  });

  it('maps queue 0 to new', () => {
    const card: AnkiCard = { id: 1, nid: 1, did: 1, ord: 0, type: 0, queue: 0, due: 0, ivl: 0, factor: 2500, reps: 0, lapses: 0 };
    expect(mapAnkiScheduling(card).queue).toBe('new');
  });

  it('maps queue 1 and 3 to learning', () => {
    const card1: AnkiCard = { id: 1, nid: 1, did: 1, ord: 0, type: 1, queue: 1, due: 0, ivl: 0, factor: 2500, reps: 1, lapses: 0 };
    const card3: AnkiCard = { id: 1, nid: 1, did: 1, ord: 0, type: 3, queue: 3, due: 0, ivl: 0, factor: 2500, reps: 1, lapses: 0 };
    expect(mapAnkiScheduling(card1).queue).toBe('learning');
    expect(mapAnkiScheduling(card3).queue).toBe('learning');
  });

  it('maps queue 2 to review', () => {
    const card: AnkiCard = { id: 1, nid: 1, did: 1, ord: 0, type: 2, queue: 2, due: 100, ivl: 30, factor: 2500, reps: 10, lapses: 2 };
    const result = mapAnkiScheduling(card);
    expect(result.queue).toBe('review');
    expect(result.intervalDays).toBe(30);
    expect(result.ease).toBe(2.5);
    expect(result.reviewCount).toBe(10);
    expect(result.lapseCount).toBe(2);
  });

  it('clamps ease to minimum 1.3', () => {
    const card: AnkiCard = { id: 1, nid: 1, did: 1, ord: 0, type: 0, queue: 0, due: 0, ivl: 0, factor: 500, reps: 0, lapses: 0 };
    expect(mapAnkiScheduling(card).ease).toBe(1.3);
  });

  it('clamps negative interval to 0', () => {
    const card: AnkiCard = { id: 1, nid: 1, did: 1, ord: 0, type: 1, queue: 1, due: 0, ivl: -600, factor: 2500, reps: 1, lapses: 0 };
    expect(mapAnkiScheduling(card).intervalDays).toBe(0);
  });
});
