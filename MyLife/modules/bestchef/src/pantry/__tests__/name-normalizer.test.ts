import { describe, it, expect } from 'vitest';
import {
  extractBarcodeFromReceiptLine,
  normalizeItemName,
  normalizeReceiptLineDescription,
  resolveItemName,
  itemsMatch,
  fuzzyItemMatch,
} from '../name-normalizer';

describe('normalizeItemName', () => {
  it('lowercases and trims', () => {
    expect(normalizeItemName('  Chicken Breast  ')).toBe('chicken breast');
  });

  it('collapses multiple spaces', () => {
    expect(normalizeItemName('red   bell   pepper')).toBe('red bell pepper');
  });

  it('strips leading articles', () => {
    expect(normalizeItemName('a lemon')).toBe('lemon');
    expect(normalizeItemName('an onion')).toBe('onion');
    expect(normalizeItemName('the garlic')).toBe('garlic');
  });

  it('does not strip article if it is the only word', () => {
    expect(normalizeItemName('the')).toBe('the');
  });

  it('removes prep words', () => {
    expect(normalizeItemName('chopped onion')).toBe('onion');
    expect(normalizeItemName('diced tomatoes')).toBe('tomato');
    expect(normalizeItemName('minced garlic')).toBe('garlic');
    expect(normalizeItemName('sliced mushrooms')).toBe('mushroom');
    expect(normalizeItemName('grated parmesan')).toBe('parmesan');
    expect(normalizeItemName('shredded mozzarella')).toBe('mozzarella');
    expect(normalizeItemName('peeled carrots')).toBe('carrot');
  });

  it('removes size modifiers', () => {
    expect(normalizeItemName('large eggs')).toBe('egg');
    expect(normalizeItemName('small onion')).toBe('onion');
    expect(normalizeItemName('medium potato')).toBe('potato');
  });

  it('keeps at least one word even if all are prep/size words', () => {
    // "ground" is a prep word but if it is the only word, keep it
    expect(normalizeItemName('ground')).toBe('ground');
  });

  describe('de-pluralization', () => {
    it('removes trailing s', () => {
      expect(normalizeItemName('onions')).toBe('onion');
      expect(normalizeItemName('carrots')).toBe('carrot');
      expect(normalizeItemName('lemons')).toBe('lemon');
    });

    it('does not remove ss endings', () => {
      expect(normalizeItemName('glass')).toBe('glass');
    });

    it('handles -ies -> -y', () => {
      expect(normalizeItemName('berries')).toBe('berry');
      expect(normalizeItemName('cherries')).toBe('cherry');
      expect(normalizeItemName('anchovies')).toBe('anchovy');
    });

    it('handles -ves -> -f', () => {
      expect(normalizeItemName('halves')).toBe('half');
      expect(normalizeItemName('loaves')).toBe('loaf');
    });

    it('handles -es after sibilants', () => {
      expect(normalizeItemName('peaches')).toBe('peach');
      expect(normalizeItemName('dishes')).toBe('dish');
    });

    it('handles -oes -> -o', () => {
      expect(normalizeItemName('tomatoes')).toBe('tomato');
      expect(normalizeItemName('potatoes')).toBe('potato');
    });

    it('de-pluralizes 4-letter words ending in s', () => {
      expect(normalizeItemName('peas')).toBe('pea');
    });

    it('does not de-pluralize 3-letter words', () => {
      expect(normalizeItemName('gas')).toBe('gas');
    });

    it('does not de-pluralize false plurals', () => {
      expect(normalizeItemName('molasses')).toBe('molasses');
      expect(normalizeItemName('hummus')).toBe('hummus');
      expect(normalizeItemName('couscous')).toBe('couscous');
    });
  });
});

describe('resolveItemName', () => {
  it('resolves scallion to green onion', () => {
    expect(resolveItemName('scallion')).toBe('green onion');
  });

  it('resolves spring onion to green onion', () => {
    expect(resolveItemName('spring onion')).toBe('green onion');
  });

  it('resolves capsicum to bell pepper', () => {
    expect(resolveItemName('capsicum')).toBe('bell pepper');
  });

  it('resolves aubergine to eggplant', () => {
    expect(resolveItemName('aubergine')).toBe('eggplant');
  });

  it('resolves courgette to zucchini', () => {
    expect(resolveItemName('courgette')).toBe('zucchini');
  });

  it('resolves coriander to cilantro', () => {
    expect(resolveItemName('coriander')).toBe('cilantro');
  });

  it('resolves bicarbonate of soda to baking soda', () => {
    expect(resolveItemName('bicarbonate of soda')).toBe('baking soda');
  });

  it('resolves cornflour to cornstarch', () => {
    expect(resolveItemName('cornflour')).toBe('cornstarch');
  });

  it('resolves icing sugar to powdered sugar', () => {
    expect(resolveItemName('icing sugar')).toBe('powdered sugar');
  });

  it('resolves confectioners sugar to powdered sugar', () => {
    expect(resolveItemName('confectioners sugar')).toBe('powdered sugar');
  });

  it('resolves plain flour to all-purpose flour', () => {
    expect(resolveItemName('plain flour')).toBe('all-purpose flour');
  });

  it('resolves self raising flour to self-rising flour', () => {
    expect(resolveItemName('self raising flour')).toBe('self-rising flour');
  });

  it('resolves double cream to heavy cream', () => {
    expect(resolveItemName('double cream')).toBe('heavy cream');
  });

  it('resolves single cream to light cream', () => {
    expect(resolveItemName('single cream')).toBe('light cream');
  });

  it('resolves rocket to arugula', () => {
    expect(resolveItemName('rocket')).toBe('arugula');
  });

  it('resolves cos lettuce to romaine lettuce', () => {
    expect(resolveItemName('cos lettuce')).toBe('romaine lettuce');
  });

  it('resolves broad bean to fava bean', () => {
    expect(resolveItemName('broad bean')).toBe('fava bean');
  });

  it('resolves chickpea to garbanzo bean', () => {
    expect(resolveItemName('chickpea')).toBe('garbanzo bean');
  });

  it('resolves garbanzo to garbanzo bean', () => {
    expect(resolveItemName('garbanzo')).toBe('garbanzo bean');
  });

  it('resolves prawn to shrimp', () => {
    expect(resolveItemName('prawn')).toBe('shrimp');
  });

  it('resolves caster sugar to superfine sugar', () => {
    expect(resolveItemName('caster sugar')).toBe('superfine sugar');
  });

  it('resolves rapeseed oil to canola oil', () => {
    expect(resolveItemName('rapeseed oil')).toBe('canola oil');
  });

  it('resolves groundnut oil to peanut oil', () => {
    expect(resolveItemName('groundnut oil')).toBe('peanut oil');
  });

  it('resolves mangetout to snow pea', () => {
    expect(resolveItemName('mangetout')).toBe('snow pea');
  });

  it('resolves swede to rutabaga', () => {
    expect(resolveItemName('swede')).toBe('rutabaga');
  });

  it('resolves beetroot to beet', () => {
    expect(resolveItemName('beetroot')).toBe('beet');
  });

  it('resolves spring greens to collard greens (de-pluralized)', () => {
    expect(resolveItemName('spring greens')).toBe('collard green');
  });

  it('resolves treacle to molasses', () => {
    expect(resolveItemName('treacle')).toBe('molasses');
  });

  it('resolves sultana to golden raisin', () => {
    expect(resolveItemName('sultana')).toBe('golden raisin');
  });

  it('resolves mince to ground beef', () => {
    expect(resolveItemName('mince')).toBe('ground beef');
  });

  it('resolves stock cube to bouillon cube', () => {
    expect(resolveItemName('stock cube')).toBe('bouillon cube');
  });

  it('returns normalized name when no synonym exists', () => {
    expect(resolveItemName('butter')).toBe('butter');
  });

  it('handles case-insensitive synonym lookup', () => {
    expect(resolveItemName('Aubergine')).toBe('eggplant');
    expect(resolveItemName('ROCKET')).toBe('arugula');
  });
});

describe('itemsMatch', () => {
  it('matches identical items', () => {
    expect(itemsMatch('butter', 'butter')).toBe(true);
  });

  it('matches items differing only in case', () => {
    expect(itemsMatch('Butter', 'butter')).toBe(true);
  });

  it('matches items differing in pluralization', () => {
    expect(itemsMatch('onion', 'onions')).toBe(true);
    expect(itemsMatch('tomatoes', 'tomato')).toBe(true);
  });

  it('matches synonym pairs', () => {
    expect(itemsMatch('scallion', 'green onion')).toBe(true);
    expect(itemsMatch('spring onion', 'scallion')).toBe(true);
    expect(itemsMatch('aubergine', 'eggplant')).toBe(true);
    expect(itemsMatch('prawn', 'shrimp')).toBe(true);
  });

  it('does not match unrelated items', () => {
    expect(itemsMatch('butter', 'sugar')).toBe(false);
    expect(itemsMatch('chicken', 'beef')).toBe(false);
  });

  it('matches with prep words removed', () => {
    expect(itemsMatch('diced onion', 'onion')).toBe(true);
    expect(itemsMatch('minced garlic', 'garlic')).toBe(true);
  });
});

describe('fuzzyItemMatch', () => {
  it('returns 1.0 for exact resolved matches', () => {
    expect(fuzzyItemMatch('onion', 'onion')).toBe(1.0);
    expect(fuzzyItemMatch('scallion', 'green onion')).toBe(1.0);
    expect(fuzzyItemMatch('Diced Tomatoes', 'tomato')).toBe(1.0);
  });

  it('returns 0.8 for substring containment', () => {
    expect(fuzzyItemMatch('bell pepper', 'red bell pepper')).toBe(0.8);
    expect(fuzzyItemMatch('cheddar cheese', 'cheddar')).toBe(0.8);
  });

  it('returns 0.6 for significant word overlap', () => {
    // 4 words each, 3 shared, 1 unique each side = 5 total unique, 3/5 = 0.6 > 0.5
    // Neither string is a substring of the other
    expect(fuzzyItemMatch('sweet italian pork sausage', 'hot italian pork sausage')).toBe(0.6);
  });

  it('returns 0.0 for no match', () => {
    expect(fuzzyItemMatch('butter', 'sugar')).toBe(0.0);
    expect(fuzzyItemMatch('chicken', 'broccoli')).toBe(0.0);
  });

  describe('edge cases', () => {
    it('handles empty string', () => {
      expect(fuzzyItemMatch('', '')).toBe(1.0);
      expect(fuzzyItemMatch('onion', '')).toBe(0.8);
    });

    it('handles strings with numbers', () => {
      expect(normalizeItemName('2% milk')).toBe('2% milk');
    });

    it('handles special characters', () => {
      expect(normalizeItemName('half-and-half')).toBe('half-and-half');
    });
  });
});

describe('receipt line normalization', () => {
  it('expands grocery receipt abbreviations and removes price fragments', () => {
    expect(normalizeReceiptLineDescription('049000042566 ORG BNLS CHKN BRST 1 x 8.99 $8.99')).toBe(
      'organic boneless chicken breast',
    );
  });

  it('keeps food identity while dropping receipt-only tokens', () => {
    expect(normalizeReceiptLineDescription('2.00LB BANANAS LB TAXABLE $2.49')).toBe('banana');
  });

  it('extracts 8 to 14 digit barcode aliases', () => {
    expect(extractBarcodeFromReceiptLine('049000042566 ORGANIC MILK $5.99')).toBe('049000042566');
    expect(extractBarcodeFromReceiptLine('Organic Milk $5.99')).toBeNull();
  });
});
