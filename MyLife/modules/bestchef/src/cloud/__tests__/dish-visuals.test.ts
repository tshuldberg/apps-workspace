import { describe, expect, it } from 'vitest';
import {
  BC_CUISINES,
  UNKNOWN_CUISINE_GRADIENT,
  getCuisineGradient,
  getDishEmoji,
  getDishVisuals,
  type BcCuisine,
  type DishGradient,
} from '../dish-visuals';

const HEX = /^#[0-9A-F]{6}$/;

describe('getCuisineGradient', () => {
  const expected: Record<BcCuisine, DishGradient> = {
    Italian: { from: '#F27333', to: '#A63326' },
    Japanese: { from: '#EBC766', to: '#B37333' },
    Mexican: { from: '#F2662E', to: '#A6401F' },
    Thai: { from: '#F28C33', to: '#E64D26' },
    French: { from: '#F5C773', to: '#C7803F' },
    Korean: { from: '#F25940', to: '#B32E26' },
    Indian: { from: '#EB7326', to: '#B8401A' },
    Chinese: { from: '#CC4059', to: '#801F38' },
    Vietnamese: { from: '#B37340', to: '#7A471F' },
    Spanish: { from: '#F28C33', to: '#BF4D26' },
    Peruvian: { from: '#D9664D', to: '#8C332E' },
    Argentine: { from: '#8CA6D9', to: '#4D66A6' },
    'Middle Eastern': { from: '#D98C4D', to: '#8C4D26' },
    'West African': { from: '#F28033', to: '#B3401F' },
  };

  it('matches the canonical 14-cuisine snapshot', () => {
    expect(expected).toMatchSnapshot();
    for (const cuisine of BC_CUISINES) {
      expect(getCuisineGradient(cuisine)).toEqual(expected[cuisine]);
    }
  });

  it('returns hex gradients for every known cuisine', () => {
    for (const cuisine of BC_CUISINES) {
      const gradient = getCuisineGradient(cuisine);
      expect(gradient.from).toMatch(HEX);
      expect(gradient.to).toMatch(HEX);
    }
  });

  it('returns the documented unknown fallback', () => {
    expect(UNKNOWN_CUISINE_GRADIENT).toEqual({
      from: '#D9742F',
      to: '#8C401E',
    });
    expect(getCuisineGradient('Martian')).toEqual(UNKNOWN_CUISINE_GRADIENT);
    expect(getCuisineGradient('')).toEqual(UNKNOWN_CUISINE_GRADIENT);
  });
});

describe('getDishEmoji', () => {
  it('maps the are-blaze keyword set', () => {
    expect(getDishEmoji('Tonkotsu Ramen')).toBe('\u{1F35C}');
    expect(getDishEmoji('Classic Beef Pho')).toBe('\u{1F35C}');
    expect(getDishEmoji('Pad Thai')).toBe('\u{1F35C}');
    expect(getDishEmoji('Tacos al Pastor')).toBe('\u{1F32E}');
    expect(getDishEmoji('Char Siu Bao')).toBe('\u{1F95F}');
    expect(getDishEmoji('Dumplings')).toBe('\u{1F95F}');
    expect(getDishEmoji('Empanadas')).toBe('\u{1F95F}');
    expect(getDishEmoji('Truffle Risotto')).toBe('\u{1F35A}');
    expect(getDishEmoji('Bibimbap')).toBe('\u{1F35A}');
    expect(getDishEmoji('Croissant Parisien')).toBe('\u{1F950}');
    expect(getDishEmoji('Churros')).toBe('\u{1F950}');
    expect(getDishEmoji('Butter Chicken Masala')).toBe('\u{1F35B}');
    expect(getDishEmoji('Falafel')).toBe('\u{1F9C6}');
    expect(getDishEmoji('Ceviche')).toBe('\u{1F41F}');
    expect(getDishEmoji('Shakshuka')).toBe('\u{1F373}');
    expect(getDishEmoji('Tiramisu')).toBe('\u{1F370}');
    expect(getDishEmoji('Banh Mi')).toBe('\u{1F956}');
    expect(getDishEmoji('Tom Yum')).toBe('\u{1F372}');
  });

  it('falls back to the generic plate emoji for unknown dishes', () => {
    expect(getDishEmoji('Mystery Stew')).toBe('\u{1F37D}\u{FE0F}');
    expect(getDishEmoji('')).toBe('\u{1F37D}\u{FE0F}');
  });
});

describe('getDishVisuals', () => {
  it('combines per-cuisine gradient with keyword-derived emoji', () => {
    expect(getDishVisuals('Pad Thai', 'Thai')).toEqual({
      from: '#F28C33',
      to: '#E64D26',
      emoji: '\u{1F35C}',
    });
    expect(getDishVisuals('Margherita', 'Italian')).toEqual({
      from: '#F27333',
      to: '#A63326',
      emoji: '\u{1F37D}\u{FE0F}',
    });
  });

  it('uses the unknown fallback for unrecognized cuisines', () => {
    expect(getDishVisuals('Galactic Goulash', 'Martian')).toEqual({
      from: '#D9742F',
      to: '#8C401E',
      emoji: '\u{1F37D}\u{FE0F}',
    });
  });
});

describe('multilingual emoji matching (plan 33 Phase 2.6)', () => {
  it('matches native-script dish names directly', () => {
    expect(getDishVisuals('寿司').emoji).toBe('\u{1F363}');
    expect(getDishVisuals('ラーメン').emoji).toBe('\u{1F35C}');
    expect(getDishVisuals('비빔밥').emoji).toBe('\u{1F35A}');
    expect(getDishVisuals('ผัดไทย').emoji).toBe('\u{1F35C}');
    expect(getDishVisuals('فلافل').emoji).toBe('\u{1F9C6}');
    expect(getDishVisuals('פיצה').emoji).toBe('\u{1F355}');
    expect(getDishVisuals('饺子').emoji).toBe('\u{1F95F}');
  });

  it('matches localized keywords in Latin-script languages', () => {
    expect(getDishVisuals('Hamburguesa clásica').emoji).toBe('\u{1F354}');
    expect(getDishVisuals('Sopa de tomate').emoji).toBe('\u{1F372}');
    expect(getDishVisuals('Poisson grillé').emoji).toBe('\u{1F41F}');
    expect(getDishVisuals('Nasi goreng').emoji).toBe('\u{1F35A}');
  });

  it('matches via extraNames (native_name, localized translation, aliases)', () => {
    expect(getDishVisuals('Chef Special #7', undefined, ['寿司']).emoji).toBe('\u{1F363}');
    expect(getDishVisuals('House Bowl', undefined, [null, 'ラーメン']).emoji).toBe('\u{1F35C}');
    expect(getDishVisuals('Mystery Dish', undefined, [undefined, null]).emoji).toBe(
      '\u{1F37D}\u{FE0F}',
    );
  });

  it('sushi wins over the fish catch-all', () => {
    expect(getDishVisuals('Fish Sushi', undefined).emoji).toBe('\u{1F363}');
  });

  it('tom yum keeps its soup emoji ahead of generic matching', () => {
    expect(getDishVisuals('ต้มยำกุ้ง').emoji).toBe('\u{1F372}');
  });

  it('banh mi resolves the baguette, never the noodle keyword inside it', () => {
    expect(getDishVisuals('Bánh mì').emoji).toBe('\u{1F956}');
    expect(getDishVisuals('Banh Mi Special').emoji).toBe('\u{1F956}');
    // Bare noodle names still resolve the bowl.
    expect(getDishVisuals('Mì Quảng').emoji).toBe('\u{1F35C}');
  });

  it('short Latin keywords match on word boundaries, never inside words', () => {
    const plate = '\u{1F37D}\u{FE0F}';
    expect(getDishVisuals('Chicken Supreme').emoji).toBe(plate); // not 'sup'
    expect(getDishVisuals('Chorizo a la sidra').emoji).toBe(plate); // not 'riz'
    expect(getDishVisuals('Schnitzel mit Preiselbeeren').emoji).toBe(plate); // not 'reis'
    expect(getDishVisuals('Karides güveç').emoji).toBe(plate); // not 'kari'
  });

  it('CJK noodle matching uses compounds so bread never becomes noodles', () => {
    expect(getDishVisuals('蒜蓉面包').emoji).toBe('\u{1F37D}\u{FE0F}'); // garlic bread
    expect(getDishVisuals('炒面').emoji).toBe('\u{1F35C}');
    expect(getDishVisuals('红烧鱼').emoji).toBe('\u{1F41F}');
  });

  it('folds Turkish uppercase and NFD input before matching', () => {
    expect(getDishVisuals('PİLAV').emoji).toBe('\u{1F35A}');
    expect(getDishVisuals('BALIK IZGARA').emoji).toBe('\u{1F41F}');
    expect(getDishVisuals('비빔밥'.normalize('NFD')).emoji).toBe('\u{1F35A}');
  });

  it('pins intended combo-name precedence changes vs the pre-2.6 chain', () => {
    expect(getDishVisuals('Sushi Rice Bowl').emoji).toBe('\u{1F363}');
    expect(getDishVisuals('Fish Empanada').emoji).toBe('\u{1F95F}');
    expect(getDishVisuals('Pad Thai Soup').emoji).toBe('\u{1F35C}');
  });
});
