import { describe, it, expect } from 'vitest';
import {
  validateTextLength,
  extractDefinitions,
  extractColonDefinitions,
  extractLists,
  extractBoldTerms,
  deduplicateCards,
} from '../ai/text-parser';
import { generateCardsOnDevice } from '../ai/generator';

describe('AI Card Generation - Text Parser', () => {
  it('extracts "X is Y" definitions', () => {
    const text = 'Mitosis is the process of cell division. Meiosis is a type of cell division that results in four daughter cells.';
    const cards = extractDefinitions(text);
    expect(cards.length).toBeGreaterThanOrEqual(1);
    const mitosis = cards.find((c) => c.front.toLowerCase().includes('mitosis'));
    expect(mitosis).toBeTruthy();
    expect(mitosis!.cardType).toBe('basic');
    expect(mitosis!.source).toBe('ai_ondevice');
  });

  it('extracts "Term: definition" colon patterns', () => {
    const text = 'Photosynthesis: the process by which plants convert sunlight into energy\nChemosynthesis: the process by which organisms produce food using chemical energy';
    const cards = extractColonDefinitions(text);
    expect(cards.length).toBeGreaterThanOrEqual(1);
    expect(cards[0].front.toLowerCase()).toContain('photosynthesis');
  });

  it('extracts list patterns', () => {
    const text = 'Three types of rocks: igneous, sedimentary, metamorphic';
    const cards = extractLists(text);
    expect(cards.length).toBeGreaterThanOrEqual(1);
    expect(cards[0].back).toContain('igneous');
    expect(cards[0].back).toContain('sedimentary');
  });

  it('extracts bold terms for cloze', () => {
    const text = 'The **mitochondria** is the powerhouse of the cell. The **ribosome** synthesizes proteins.';
    const cards = extractBoldTerms(text);
    expect(cards.length).toBeGreaterThanOrEqual(1);
    const mito = cards.find((c) => c.back === 'mitochondria');
    expect(mito).toBeTruthy();
    expect(mito!.cardType).toBe('cloze');
    expect(mito!.front).toContain('{{c1::mitochondria}}');
  });

  it('deduplicates cards by front text', () => {
    const cards = [
      { front: 'What is X?', back: 'A', cardType: 'basic' as const, source: 'ai_ondevice' as const },
      { front: 'What is x?', back: 'B', cardType: 'basic' as const, source: 'ai_ondevice' as const },
      { front: 'What is Y?', back: 'C', cardType: 'basic' as const, source: 'ai_ondevice' as const },
    ];
    const deduplicated = deduplicateCards(cards);
    expect(deduplicated).toHaveLength(2);
  });

  it('rejects text under 50 chars', () => {
    expect(validateTextLength('short')).toBe('Enter more text for better card generation.');
  });

  it('rejects text over 50,000 chars', () => {
    expect(validateTextLength('x'.repeat(50001))).toBe('Text too long. Split into sections.');
  });

  it('accepts valid length text', () => {
    expect(validateTextLength('x'.repeat(100))).toBeNull();
  });
});

describe('AI Card Generation - On-Device Generator', () => {
  it('generates cards from structured text', () => {
    const text = `Photosynthesis: the process by which green plants use sunlight to synthesize foods
Respiration: the metabolic process by which organisms convert nutrients into energy
DNA is a molecule that carries genetic instructions for development
Three types of rocks: igneous, sedimentary, metamorphic
The **chloroplast** is the organelle where photosynthesis takes place in plant cells.`;

    const result = generateCardsOnDevice({
      mode: 'on_device',
      text,
      cardTypePreference: 'auto',
      deckId: 'test',
    });

    expect(result.cards.length).toBeGreaterThan(0);
    expect(result.mode).toBe('on_device');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    // Verify all cards have correct source
    for (const card of result.cards) {
      expect(card.source).toBe('ai_ondevice');
    }
  });

  it('returns empty for too-short text', () => {
    const result = generateCardsOnDevice({
      mode: 'on_device',
      text: 'Short',
      cardTypePreference: 'auto',
      deckId: 'test',
    });
    expect(result.cards).toHaveLength(0);
  });

  it('filters by card type preference', () => {
    const text = `DNA is the molecule that carries genetic information.
The **ribosome** is responsible for protein synthesis in living cells.`;

    const basicOnly = generateCardsOnDevice({
      mode: 'on_device',
      text,
      cardTypePreference: 'basic',
      deckId: 'test',
    });

    for (const card of basicOnly.cards) {
      expect(card.cardType).toBe('basic');
    }
  });

  it('sets source metadata on generated cards', () => {
    const text = 'Osmosis is the movement of water molecules through a semipermeable membrane from low concentration to high concentration.';
    const result = generateCardsOnDevice({
      mode: 'on_device',
      text,
      cardTypePreference: 'auto',
      deckId: 'test',
    });
    for (const card of result.cards) {
      expect(card.source).toBe('ai_ondevice');
    }
  });
});
