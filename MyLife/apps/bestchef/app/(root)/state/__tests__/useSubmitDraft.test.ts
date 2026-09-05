import { describe, expect, it, vi } from 'vitest';

vi.mock('../../providers/DatabaseProvider', () => ({
  useDatabase: vi.fn(),
}));

import {
  canAdvance,
  formatDraftIngredientLine,
  initialDraftState,
  type DraftIngredient,
} from '../useSubmitDraft';

describe('submit draft ingredient validation', () => {
  it('requires an ingredient name before advancing from the ingredients step', () => {
    const photo = { id: 'photo-1', uri: 'file:///tmp/ingredients.jpg' };

    expect(canAdvance('ingredients', {
      ...initialDraftState,
      ingredientPhoto: photo,
      ingredients: [{ id: 'ing-1', name: '', quantity: '1' }],
    })).toBe(false);

    expect(canAdvance('ingredients', {
      ...initialDraftState,
      ingredientPhoto: photo,
      ingredients: [{ id: 'ing-1', name: 'onion', quantity: '1' }],
    })).toBe(true);
  });

  it('filters quantity-only ingredient rows out of publish payloads', () => {
    const quantityOnly: DraftIngredient = { id: 'ing-1', name: ' ', quantity: '1' };
    const named: DraftIngredient = { id: 'ing-2', name: 'onion', quantity: '1' };

    expect(formatDraftIngredientLine(quantityOnly)).toBeNull();
    expect(formatDraftIngredientLine(named)).toBe('1 onion');
  });
});
