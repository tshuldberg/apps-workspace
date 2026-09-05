/**
 * Per-cuisine fallback visuals for BestChef dishes.
 *
 * Ports the SwiftUI mapping in are-blaze `RecipeRepository.gradient(for:)` and
 * `RecipeRepository.emoji(for:dish:)` so every dish has a brand-strong fallback
 * (oversized rotated emoji over a per-cuisine gradient) when no photo is set.
 */

/** Canonical cuisines that have a defined gradient. */
export const BC_CUISINES = [
  'Italian',
  'Japanese',
  'Mexican',
  'Thai',
  'French',
  'Korean',
  'Indian',
  'Chinese',
  'Vietnamese',
  'Spanish',
  'Peruvian',
  'Argentine',
  'Middle Eastern',
  'West African',
] as const;

export type BcCuisine = (typeof BC_CUISINES)[number];

export interface DishGradient {
  readonly from: string;
  readonly to: string;
}

export interface DishVisuals extends DishGradient {
  readonly emoji: string;
}

/** Fallback gradient for any cuisine not in BC_CUISINES. */
export const UNKNOWN_CUISINE_GRADIENT: DishGradient = {
  from: '#D9742F',
  to: '#8C401E',
};

const CUISINE_GRADIENTS: Record<BcCuisine, DishGradient> = {
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

function isKnownCuisine(value: string): value is BcCuisine {
  return (BC_CUISINES as readonly string[]).includes(value);
}

/**
 * Returns the gradient for a cuisine. Unknown cuisines fall back to
 * UNKNOWN_CUISINE_GRADIENT so callers always get a usable gradient.
 */
export function getCuisineGradient(cuisine: string): DishGradient {
  if (isKnownCuisine(cuisine)) {
    return CUISINE_GRADIENTS[cuisine];
  }
  return UNKNOWN_CUISINE_GRADIENT;
}

/**
 * Keyword table for emoji fallbacks (plan 33 Phase 2.6). Each concept lists
 * curated keywords across the 21 shipped locales so native-language dish
 * names (寿司, ラーメン, 김치...) resolve real emoji instead of the generic
 * plate. Order is precedence: earlier concepts win (banh before noodles so
 * 'bánh mì' is a baguette, sushi before the fish catch-all, tom yum before
 * generic soup). Combo names resolve the FIRST matching concept, which can
 * differ from the pre-2.6 if-chain (e.g. 'Fish Empanada' is now a dumpling,
 * 'Sushi Rice Bowl' is sushi) - intended and pinned by tests.
 *
 * Matching rules (see matchesConcept): Latin-script keywords match on WORD
 * boundaries after diacritic folding ('sup' never fires inside 'supreme',
 * 'riz' never inside 'chorizo'); non-Latin keywords match as substrings, so
 * single CJK characters are avoided in favor of compounds (拉面, never 面,
 * which sits inside 面包 = bread).
 */
const DISH_EMOJI_KEYWORDS: ReadonlyArray<{ emoji: string; keywords: readonly string[] }> = [
  {
    emoji: '\u{1F956}', // baguette (before noodles: 'bánh mì' must win over 'mì')
    keywords: ['banh', 'bánh'],
  },
  {
    emoji: '\u{1F35C}', // steaming bowl
    keywords: [
      'ramen', 'ラーメン', 'らーめん', '라면', '拉面', '拉麵',
      'pho', 'phở',
      'noodle', 'nudel', 'nouille', 'fideo', 'noedel',
      '炒面', '炒麵', '汤面', '湯麵', '面条', '麵條', '冷面', '拌面',
      '국수', 'ก๋วยเตี๋ยว', 'mì',
      'pad thai', 'ผัดไทย',
    ],
  },
  { emoji: '\u{1F32E}', keywords: ['taco', 'タコス', '타코'] },
  {
    emoji: '\u{1F95F}', // dumpling
    keywords: [
      'dumpling', 'bao', '包子', '饺子', '餃子', 'gyoza', 'ぎょうざ',
      '만두', 'mandu', 'pierogi', 'empanada', 'knödel', 'knodel',
    ],
  },
  {
    emoji: '\u{1F363}', // sushi (before the fish catch-all)
    keywords: ['sushi', '寿司', '壽司', 'すし', '초밥', 'سوشي', 'סושי'],
  },
  {
    emoji: '\u{1F35A}', // cooked rice
    keywords: [
      'rice', 'risotto', 'bibimbap', '비빔밥',
      'arroz', 'riz', 'reis', 'riso', 'nasi', 'rijst', 'ryż', 'pilav',
      'ご飯', 'ごはん', '御飯', '丼', '밥', '米饭', '米飯', 'ข้าว', 'cơm',
      'أرز', 'אורז', 'चावल',
    ],
  },
  { emoji: '\u{1F950}', keywords: ['croissant', 'churro', 'クロワッサン', '크루아상'] },
  {
    emoji: '\u{1F35B}', // curry
    keywords: [
      'curry', 'カレー', '카레', 'cà ri', 'แกง', 'kari', 'करी', 'كاري', 'קארי',
      'butter chicken',
    ],
  },
  { emoji: '\u{1F9C6}', keywords: ['falafel', 'فلافل', 'פלאפל', 'ファラフェル'] },
  { emoji: '\u{1F373}', keywords: ['shakshuka', 'شكشوكة', 'שקשוקה'] },
  { emoji: '\u{1F370}', keywords: ['tiramisu', 'ティラミス', '티라미수'] },
  {
    emoji: '\u{1F355}', // pizza
    keywords: ['pizza', 'ピザ', '피자', '披萨', '披薩', 'بيتزا', 'פיצה', 'पिज़्ज़ा', 'พิซซ่า'],
  },
  {
    emoji: '\u{1F354}', // burger
    keywords: [
      'burger', 'hamburguesa', 'hambúrguer', 'ハンバーガー', '햄버거',
      '汉堡', '漢堡', 'برغر', 'המבורגר', 'बर्गर', 'เบอร์เกอร์',
    ],
  },
  {
    emoji: '\u{1F35D}', // spaghetti
    keywords: ['pasta', 'spaghetti', 'makarna', 'パスタ', '파스타', '意面', '意麵', 'مكرونة', 'פסטה'],
  },
  {
    emoji: '\u{1F41F}', // fish (catch-all: after sushi)
    keywords: [
      'ceviche', 'fish', 'pescado', 'poisson', 'fisch', 'pesce', 'peixe',
      'vis', 'fisk', 'ryba', 'balık', 'balik', 'cá', 'ปลา', '魚', '鱼',
      '생선', 'سمك', 'דג', 'मछली', 'ikan',
    ],
  },
  {
    emoji: '\u{1F372}', // pot of food (soup catch-all)
    keywords: [
      'tom yum', 'ต้มยำ',
      'soup', 'sopa', 'soupe', 'suppe', 'zuppa', 'soep', 'soppa', 'zupa',
      'çorba', 'súp', 'ซุป', 'スープ', '수프', '汤', '湯', 'شوربة', 'מרק',
      'सूप', 'sup',
    ],
  },
];

/**
 * Fold for matching: NFC (fixes NFD Hangul/Vietnamese input), lowercase,
 * then strip Latin combining marks (Turkish 'PİLAV' folds to 'pilav';
 * Thai/Hebrew/Arabic marks live outside ̀-ͯ and are untouched).
 */
function foldForMatch(value: string): string {
  return value
    .normalize('NFC')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .normalize('NFC');
}

const LATIN_TOKEN_KEYWORD = /^[a-z0-9 ]+$/;

interface PreparedConcept {
  emoji: string;
  /** Folded Latin keywords, matched on word boundaries via the token string. */
  tokenKeywords: string[];
  /** Non-Latin keywords, matched as substrings of the folded name. */
  substringKeywords: string[];
}

const PREPARED_CONCEPTS: readonly PreparedConcept[] = DISH_EMOJI_KEYWORDS.map((concept) => {
  const tokenKeywords: string[] = [];
  const substringKeywords: string[] = [];
  for (const keyword of concept.keywords) {
    const folded = foldForMatch(keyword);
    if (LATIN_TOKEN_KEYWORD.test(folded)) {
      // Word-boundary matching needs explicit plural variants ('Tacos',
      // 'Dumplings', German 'Nudeln') that substring matching got for free.
      for (const variant of [folded, `${folded}s`, `${folded}es`, `${folded}n`]) {
        if (!tokenKeywords.includes(variant)) tokenKeywords.push(variant);
      }
    } else if (!substringKeywords.includes(folded)) {
      substringKeywords.push(folded);
    }
  }
  return { emoji: concept.emoji, tokenKeywords, substringKeywords };
});

function matchesConcept(foldedName: string, tokenString: string, concept: PreparedConcept): boolean {
  return (
    concept.tokenKeywords.some((keyword) => tokenString.includes(` ${keyword} `)) ||
    concept.substringKeywords.some((keyword) => foldedName.includes(keyword))
  );
}

/**
 * Returns the emoji that best represents a dish. Matches the canonical name
 * PLUS any extra names (native_name, localized translation, aliases) so
 * non-Latin dish names resolve real emoji, not English-only keywords
 * (plan 33 Phase 2.6). Each name is matched independently (a keyword can
 * never straddle two adjacent names). Cuisine is accepted for future
 * extension.
 */
export function getDishEmoji(
  dish: string,
  _cuisine?: string,
  extraNames?: ReadonlyArray<string | null | undefined>,
): string {
  const names = [dish, ...(extraNames ?? [])]
    .filter((name): name is string => typeof name === 'string' && name.length > 0)
    .map((name) => {
      const folded = foldForMatch(name);
      const tokenString = ` ${folded.replace(/[^\p{L}\p{N}]+/gu, ' ').trim()} `;
      return { folded, tokenString };
    });
  for (const concept of PREPARED_CONCEPTS) {
    if (names.some((name) => matchesConcept(name.folded, name.tokenString, concept))) {
      return concept.emoji;
    }
  }
  return '\u{1F37D}\u{FE0F}';
}

/**
 * Returns the combined fallback visuals for a dish: per-cuisine gradient plus
 * keyword-derived emoji. Use this to backfill seeded `bc_dishes` rows and any
 * downstream consumer (DEMO_DISHES, render helpers). Pass native/localized
 * names via extraNames so non-English dishes resolve real emoji.
 */
export function getDishVisuals(
  dish: string,
  cuisine?: string,
  extraNames?: ReadonlyArray<string | null | undefined>,
): DishVisuals {
  const { from, to } = getCuisineGradient(cuisine ?? '');
  return {
    from,
    to,
    emoji: getDishEmoji(dish, cuisine, extraNames),
  };
}
