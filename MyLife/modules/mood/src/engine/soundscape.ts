import type { SoundLayer } from '../types';

export interface SoundDefinition {
  id: string;
  name: string;
  category: 'nature' | 'ambient' | 'music' | 'noise';
}

export const SOUND_LIBRARY: SoundDefinition[] = [
  { id: 'rain', name: 'Rain', category: 'nature' },
  { id: 'thunder_distant', name: 'Distant Thunder', category: 'nature' },
  { id: 'ocean', name: 'Ocean Waves', category: 'nature' },
  { id: 'wind', name: 'Wind', category: 'nature' },
  { id: 'birds', name: 'Birds', category: 'nature' },
  { id: 'creek', name: 'Creek', category: 'nature' },
  { id: 'fire', name: 'Fireplace', category: 'nature' },
  { id: 'cafe', name: 'Cafe Ambiance', category: 'ambient' },
  { id: 'library', name: 'Library', category: 'ambient' },
  { id: 'train', name: 'Train', category: 'ambient' },
  { id: 'white_noise', name: 'White Noise', category: 'noise' },
  { id: 'pink_noise', name: 'Pink Noise', category: 'noise' },
  { id: 'brown_noise', name: 'Brown Noise', category: 'noise' },
];

export const DEFAULT_PRESETS: { name: string; layers: SoundLayer[] }[] = [
  { name: 'Rain', layers: [{ sound: 'rain', volume: 0.7 }, { sound: 'thunder_distant', volume: 0.2 }] },
  { name: 'Ocean', layers: [{ sound: 'ocean', volume: 0.8 }, { sound: 'wind', volume: 0.3 }] },
  { name: 'Forest', layers: [{ sound: 'birds', volume: 0.5 }, { sound: 'wind', volume: 0.3 }, { sound: 'creek', volume: 0.4 }] },
  { name: 'Cafe', layers: [{ sound: 'cafe', volume: 0.6 }] },
  { name: 'White Noise', layers: [{ sound: 'white_noise', volume: 0.5 }] },
];

export function getSoundById(id: string): SoundDefinition | undefined {
  return SOUND_LIBRARY.find((s) => s.id === id);
}

export function getSoundsByCategory(category: SoundDefinition['category']): SoundDefinition[] {
  return SOUND_LIBRARY.filter((s) => s.category === category);
}

export function validateLayers(layers: SoundLayer[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (layers.length === 0) {
    errors.push('At least one sound layer is required');
  }
  for (const layer of layers) {
    if (!SOUND_LIBRARY.some((s) => s.id === layer.sound)) {
      errors.push(`Unknown sound: ${layer.sound}`);
    }
    if (layer.volume < 0 || layer.volume > 1) {
      errors.push(`Volume for ${layer.sound} must be between 0 and 1`);
    }
  }
  return { valid: errors.length === 0, errors };
}

export function mixLayers(layers: SoundLayer[], masterVolume: number): SoundLayer[] {
  return layers.map((l) => ({
    sound: l.sound,
    volume: Math.min(1, l.volume * masterVolume),
  }));
}
