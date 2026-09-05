export type GenerationMode = 'on_device' | 'cloud';
export type CardTypePreference = 'auto' | 'basic' | 'cloze';

export interface GenerationConfig {
  mode: GenerationMode;
  text: string;
  cardTypePreference: CardTypePreference;
  deckId: string;
}

export interface GeneratedCard {
  front: string;
  back: string;
  cardType: 'basic' | 'cloze';
  source: 'ai_ondevice' | 'ai_cloud';
}

export interface GenerationResult {
  cards: GeneratedCard[];
  mode: GenerationMode;
  inputLength: number;
  durationMs: number;
}
