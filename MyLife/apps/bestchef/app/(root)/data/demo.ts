import { getDishVisuals } from '@mylife/bestchef';
import type { TagId } from './taxonomy';

export interface DishVariant {
  id: string;
  name: string;
  nativeName?: string;
  description: string;
  distinguishingTraits: string[];
  submissionCount: number;
  tags: TagId[];
}

export interface DemoDish {
  id: string;
  name: string;
  cuisine: string;
  category: string;
  nativeName?: string;
  photoUrl?: string;
  gradientFrom: string;
  gradientTo: string;
  emoji: string;
  submissionCount: number;
  slug: string;
  tags: TagId[];
  variants?: DishVariant[];
}

export interface DemoSubmission {
  id: string;
  dishId: string;
  chefId: string;
  chefName: string;
  chefHandle: string;
  title: string;
  description: string;
  photoUrl?: string;
  voteScore: number;
  likeCount?: number;
  rank: number;
  photoVerified: boolean;
  createdAt: string;
  tags: TagId[];
  ingredients: string[];
  steps?: string[];
  /** P5-C vote decomposition columns (populated from cloud, absent on demo/local). */
  upvoteCount?: number;
  downvoteCount?: number;
  reviewedCount?: number;
}

export interface DemoChef {
  id: string;
  displayName: string;
  handle: string;
  avatarUrl?: string;
  location: string;
  submissionCount: number;
  totalVotes: number;
  wins: number;
  followers: number;
  topCuisine: string;
}

export interface DemoComment {
  id: string;
  submissionId: string;
  authorName: string;
  authorHandle: string;
  text: string;
  type: 'comment' | 'tried_this' | 'chefs_tip';
  helpfulCount: number;
  createdAt: string;
  // P12-A additions for cloud-backed comments. Local/demo comments leave these
  // undefined; callers should treat undefined as "not applicable".
  parentId?: string | null;
  isMine?: boolean;
  isEdited?: boolean;
  isDeleted?: boolean;
  isHelpful?: boolean;
  /** Raw createdAt timestamp for client-side edit-window checks. */
  createdAtIso?: string;
  /** True when the row originated from the bc_comments cloud table. */
  isCloud?: boolean;
}

export interface DemoBadge {
  id: string;
  name: string;
  icon: string;
  description: string;
  criteria: string;
}

type DemoDishSeed = Omit<DemoDish, 'gradientFrom' | 'gradientTo' | 'emoji'>;
type DemoDishVisualSeed = Pick<DemoDish, 'gradientFrom' | 'gradientTo' | 'emoji'>;

const FALLBACK_DISH_VISUALS: DemoDishVisualSeed = {
  gradientFrom: '#D9742F',
  gradientTo: '#8C401E',
  emoji: '\u{1F37D}\u{FE0F}',
};

function getDemoDishVisuals(seed: DemoDishSeed): DemoDishVisualSeed {
  try {
    const visuals = getDishVisuals(seed.name, seed.cuisine) as
      | { from?: string; to?: string; emoji?: string }
      | undefined;
    if (!visuals?.from || !visuals.to || !visuals.emoji) {
      return FALLBACK_DISH_VISUALS;
    }
    return {
      gradientFrom: visuals.from,
      gradientTo: visuals.to,
      emoji: visuals.emoji,
    };
  } catch {
    return FALLBACK_DISH_VISUALS;
  }
}

const DEMO_DISH_SEEDS: DemoDishSeed[] = [
  { id: 'd1', name: 'Pad Thai', cuisine: 'Thai', category: 'main', nativeName: '\u0E1C\u0E31\u0E14\u0E44\u0E17\u0E22', submissionCount: 142, slug: 'pad-thai', tags: ['cuisine:thai', 'method:stir-fry', 'equip:wok', 'time:under-30', 'meal:dinner', 'meal:weeknight', 'protein:shrimp', 'protein:tofu', 'spice:mild', 'allergen:peanuts', 'allergen:eggs', 'allergen:soy', 'grocery:produce', 'grocery:pantry'] },
  { id: 'd2', name: 'Carbonara', cuisine: 'Italian', category: 'main', nativeName: 'Pasta alla Carbonara', submissionCount: 118, slug: 'carbonara', tags: ['cuisine:italian', 'method:saute', 'equip:stovetop', 'time:under-30', 'meal:dinner', 'meal:weeknight', 'meal:date-night', 'protein:pork', 'protein:eggs', 'spice:no-spice', 'allergen:eggs', 'allergen:milk', 'allergen:wheat', 'grocery:dairy', 'grocery:meat', 'grocery:grains'] },
  { id: 'd3', name: 'Tacos al Pastor', cuisine: 'Mexican', category: 'main', submissionCount: 97, slug: 'tacos-al-pastor', tags: ['cuisine:mexican', 'method:grill', 'method:roast', 'time:1-2-hours', 'meal:dinner', 'meal:party-food', 'protein:pork', 'spice:medium', 'allergen:wheat', 'grocery:meat', 'grocery:produce'] },
  { id: 'd4', name: 'Ramen', cuisine: 'Japanese', category: 'soup', nativeName: '\u30E9\u30FC\u30E1\u30F3', submissionCount: 89, slug: 'ramen', tags: ['cuisine:japanese', 'method:simmer', 'method:boil', 'equip:dutch-oven', 'time:over-2-hours', 'meal:dinner', 'meal:comfort-food', 'protein:pork', 'protein:eggs', 'spice:mild', 'allergen:wheat', 'allergen:eggs', 'allergen:soy', 'grocery:meat', 'grocery:grains'], variants: [
    { id: 'd4-tonkotsu', name: 'Tonkotsu', nativeName: '\u8C5A\u9AA8', description: 'Creamy pork bone broth simmered 12-18 hours.', distinguishingTraits: ['Milky white broth', 'Collagen-heavy', 'Thin noodles'], submissionCount: 34, tags: ['protein:pork'] },
    { id: 'd4-shoyu', name: 'Shoyu', nativeName: '\u91A4\u6CB9', description: 'Clear soy sauce-based broth, Tokyo style.', distinguishingTraits: ['Clear brown broth', 'Curly noodles'], submissionCount: 22, tags: ['protein:chicken'] },
    { id: 'd4-miso', name: 'Miso', nativeName: '\u5473\u564C', description: 'Fermented soybean paste broth, Hokkaido style.', distinguishingTraits: ['Earthy, hearty', 'Thick noodles'], submissionCount: 18, tags: [] },
  ] },
  { id: 'd5', name: 'Butter Chicken', cuisine: 'Indian', category: 'main', nativeName: 'Murgh Makhani', submissionCount: 76, slug: 'butter-chicken', tags: ['cuisine:indian', 'method:simmer', 'method:saute', 'equip:stovetop', 'time:under-60', 'meal:dinner', 'meal:comfort-food', 'protein:chicken', 'spice:medium', 'allergen:milk', 'diet:gluten-free', 'grocery:meat', 'grocery:dairy', 'grocery:spices'] },
  { id: 'd6', name: 'Pho', cuisine: 'Vietnamese', category: 'soup', nativeName: 'Ph\u1EDF', submissionCount: 71, slug: 'pho', tags: ['cuisine:vietnamese', 'method:simmer', 'time:over-2-hours', 'meal:dinner', 'meal:lunch', 'meal:comfort-food', 'protein:beef', 'spice:mild', 'diet:dairy-free', 'allergen:soy', 'grocery:meat', 'grocery:produce'] },
  { id: 'd7', name: 'Ceviche', cuisine: 'Peruvian', category: 'appetizer', submissionCount: 63, slug: 'ceviche', tags: ['cuisine:peruvian', 'method:no-cook', 'method:cure', 'equip:none', 'time:under-30', 'meal:appetizer', 'meal:entertaining', 'protein:fish', 'protein:shrimp', 'spice:medium', 'diet:gluten-free', 'diet:dairy-free', 'allergen:fish', 'allergen:shellfish', 'season:summer', 'grocery:seafood', 'grocery:produce'] },
  { id: 'd8', name: 'Bibimbap', cuisine: 'Korean', category: 'main', nativeName: '\uBE44\uBE54\uBC25', submissionCount: 58, slug: 'bibimbap', tags: ['cuisine:korean', 'method:saute', 'method:fry', 'equip:stovetop', 'time:under-45', 'meal:dinner', 'meal:lunch', 'protein:beef', 'protein:eggs', 'spice:hot', 'allergen:eggs', 'allergen:soy', 'allergen:sesame', 'grocery:meat', 'grocery:produce', 'grocery:grains'] },
  { id: 'd9', name: 'Shakshuka', cuisine: 'Middle Eastern', category: 'breakfast', submissionCount: 52, slug: 'shakshuka', tags: ['cuisine:middle-eastern', 'method:simmer', 'equip:cast-iron', 'time:under-30', 'meal:breakfast', 'meal:brunch', 'meal:one-pot', 'protein:eggs', 'spice:medium', 'diet:vegetarian', 'diet:gluten-free', 'allergen:eggs', 'grocery:produce', 'grocery:dairy'] },
  { id: 'd10', name: 'Tiramisu', cuisine: 'Italian', category: 'dessert', submissionCount: 48, slug: 'tiramisu', tags: ['cuisine:italian', 'method:no-cook', 'equip:none', 'time:under-30', 'time:overnight', 'meal:dessert', 'meal:entertaining', 'meal:date-night', 'spice:no-spice', 'allergen:eggs', 'allergen:milk', 'allergen:wheat', 'grocery:dairy', 'grocery:bakery', 'grocery:beverages'] },
  { id: 'd11', name: 'Jollof Rice', cuisine: 'West African', category: 'main', submissionCount: 45, slug: 'jollof-rice', tags: ['cuisine:west-african', 'method:simmer', 'method:bake', 'equip:dutch-oven', 'time:1-2-hours', 'meal:dinner', 'meal:party-food', 'meal:batch-cook', 'protein:chicken', 'spice:medium', 'diet:gluten-free', 'diet:dairy-free', 'grocery:meat', 'grocery:grains', 'grocery:produce'] },
  { id: 'd12', name: 'Tom Yum', cuisine: 'Thai', category: 'soup', nativeName: '\u0E15\u0E49\u0E21\u0E22\u0E33', submissionCount: 41, slug: 'tom-yum', tags: ['cuisine:thai', 'method:simmer', 'equip:stovetop', 'time:under-30', 'meal:dinner', 'meal:lunch', 'protein:shrimp', 'spice:hot', 'diet:gluten-free', 'diet:dairy-free', 'allergen:shellfish', 'allergen:fish', 'grocery:seafood', 'grocery:produce'] },
  { id: 'd13', name: 'Empanadas', cuisine: 'Argentine', category: 'appetizer', submissionCount: 38, slug: 'empanadas', tags: ['cuisine:argentine', 'method:bake', 'method:fry', 'equip:oven', 'time:1-2-hours', 'meal:appetizer', 'meal:snack', 'meal:party-food', 'meal:lunchbox', 'protein:beef', 'spice:mild', 'allergen:wheat', 'allergen:eggs', 'grocery:meat', 'grocery:pantry'] },
  { id: 'd14', name: 'Croissant', cuisine: 'French', category: 'bread', submissionCount: 35, slug: 'croissant', tags: ['cuisine:french', 'method:bake', 'equip:oven', 'time:over-2-hours', 'time:overnight', 'meal:breakfast', 'meal:brunch', 'spice:no-spice', 'diet:vegetarian', 'allergen:wheat', 'allergen:milk', 'allergen:eggs', 'cost:moderate', 'grocery:dairy', 'grocery:pantry'] },
  { id: 'd15', name: 'Dumplings', cuisine: 'Chinese', category: 'appetizer', nativeName: '\u997A\u5B50', submissionCount: 67, slug: 'dumplings', tags: ['cuisine:chinese', 'method:steam', 'method:fry', 'method:boil', 'equip:stovetop', 'time:1-2-hours', 'meal:appetizer', 'meal:dinner', 'meal:batch-cook', 'protein:pork', 'spice:mild', 'allergen:wheat', 'allergen:soy', 'allergen:sesame', 'grocery:meat', 'grocery:pantry'] },
  { id: 'd16', name: 'Fish Tacos', cuisine: 'Mexican', category: 'main', submissionCount: 54, slug: 'fish-tacos', tags: ['cuisine:mexican', 'method:grill', 'method:fry', 'equip:stovetop', 'time:under-30', 'meal:dinner', 'meal:lunch', 'meal:weeknight', 'protein:fish', 'spice:mild', 'diet:dairy-free', 'allergen:fish', 'allergen:wheat', 'season:summer', 'grocery:seafood', 'grocery:produce'] },
  { id: 'd17', name: 'Risotto', cuisine: 'Italian', category: 'main', submissionCount: 43, slug: 'risotto', tags: ['cuisine:italian', 'method:saute', 'method:simmer', 'equip:stovetop', 'time:under-45', 'meal:dinner', 'meal:date-night', 'protein:none', 'spice:no-spice', 'diet:vegetarian', 'diet:gluten-free', 'allergen:milk', 'cost:moderate', 'grocery:dairy', 'grocery:grains', 'grocery:beverages'] },
  { id: 'd18', name: 'Banh Mi', cuisine: 'Vietnamese', category: 'main', nativeName: 'B\u00E1nh M\u00EC', submissionCount: 39, slug: 'banh-mi', tags: ['cuisine:vietnamese', 'method:grill', 'method:pickle', 'equip:stovetop', 'time:under-30', 'meal:lunch', 'meal:weeknight', 'protein:pork', 'spice:mild', 'diet:dairy-free', 'allergen:wheat', 'allergen:soy', 'grocery:meat', 'grocery:bakery', 'grocery:produce'] },
  { id: 'd19', name: 'Churros', cuisine: 'Spanish', category: 'dessert', submissionCount: 31, slug: 'churros', tags: ['cuisine:spanish', 'method:deep-fry', 'equip:deep-fryer', 'time:under-30', 'meal:dessert', 'meal:snack', 'spice:no-spice', 'diet:vegan', 'allergen:wheat', 'cost:budget', 'grocery:pantry'] },
  { id: 'd20', name: 'Falafel', cuisine: 'Middle Eastern', category: 'appetizer', submissionCount: 56, slug: 'falafel', tags: ['cuisine:middle-eastern', 'method:deep-fry', 'method:bake', 'equip:stovetop', 'time:under-45', 'meal:lunch', 'meal:appetizer', 'meal:meal-prep', 'protein:chickpeas', 'spice:mild', 'diet:vegan', 'diet:gluten-free', 'diet:dairy-free', 'season:year-round', 'cost:budget', 'grocery:pantry', 'grocery:produce'] },
];

export const DEMO_DISHES: DemoDish[] = DEMO_DISH_SEEDS.map((seed) => {
  const visuals = getDemoDishVisuals(seed);
  return {
    ...seed,
    ...visuals,
  };
});

export const DEMO_SUBMISSIONS: DemoSubmission[] = [
  { id: 's1', dishId: 'd1', chefId: 'c1', chefName: 'Somchai K.', chefHandle: 'somchai_bkk', title: "Grandma's Street Pad Thai", description: 'The real Bangkok street cart recipe, no ketchup shortcuts.', voteScore: 847, rank: 1, photoVerified: true, createdAt: '2026-03-15', tags: ['cuisine:thai', 'method:stir-fry', 'equip:wok', 'time:under-30', 'protein:shrimp', 'spice:mild', 'meal:dinner'], ingredients: ['rice noodles', 'shrimp', 'tamarind paste', 'fish sauce', 'palm sugar', 'eggs', 'bean sprouts', 'peanuts', 'lime', 'green onion', 'chili flakes'] },
  { id: 's2', dishId: 'd1', chefId: 'c2', chefName: 'Maria Lopez', chefHandle: 'maria_cooks', title: 'Pad Thai with Jumbo Prawns', description: 'Restaurant-quality with fresh tamarind paste and palm sugar.', voteScore: 723, rank: 2, photoVerified: true, createdAt: '2026-03-18', tags: ['cuisine:thai', 'method:stir-fry', 'equip:wok', 'time:under-30', 'protein:shrimp', 'spice:mild', 'cost:moderate'], ingredients: ['rice noodles', 'jumbo prawns', 'tamarind paste', 'fish sauce', 'palm sugar', 'eggs', 'bean sprouts', 'peanuts', 'lime'] },
  { id: 's3', dishId: 'd1', chefId: 'c3', chefName: 'Alex Chen', chefHandle: 'wok_star', title: 'Vegan Tofu Pad Thai', description: 'Plant-based but still packed with umami. Fish sauce replaced with soy + lime.', voteScore: 612, rank: 3, photoVerified: false, createdAt: '2026-04-01', tags: ['cuisine:thai', 'method:stir-fry', 'equip:wok', 'time:under-30', 'protein:tofu', 'diet:vegan', 'diet:dairy-free', 'diet:egg-free', 'spice:mild'], ingredients: ['rice noodles', 'firm tofu', 'soy sauce', 'lime juice', 'palm sugar', 'bean sprouts', 'peanuts', 'green onion'] },
  { id: 's4', dishId: 'd2', chefId: 'c4', chefName: 'Marco Rossi', chefHandle: 'marco_roma', title: 'Authentic Roman Carbonara', description: 'Guanciale, pecorino, eggs, pepper. Nothing else.', voteScore: 921, rank: 1, photoVerified: true, createdAt: '2026-02-20', tags: ['cuisine:italian', 'method:saute', 'equip:stovetop', 'time:under-30', 'protein:pork', 'protein:eggs', 'spice:no-spice', 'meal:date-night'], ingredients: ['guanciale', 'pecorino romano', 'eggs', 'egg yolks', 'spaghetti', 'black pepper'] },
  { id: 's5', dishId: 'd2', chefId: 'c5', chefName: 'Kenji A.', chefHandle: 'kenji_lab', title: 'Scientific Carbonara', description: 'Sous vide egg yolks at 63C for the silkiest sauce.', voteScore: 788, rank: 2, photoVerified: true, createdAt: '2026-03-01', tags: ['cuisine:italian', 'method:sous-vide', 'method:saute', 'equip:sous-vide', 'equip:stovetop', 'time:1-2-hours', 'protein:pork', 'protein:eggs', 'cost:premium'], ingredients: ['guanciale', 'pecorino romano', 'parmesan', 'egg yolks', 'rigatoni', 'black pepper'] },
  { id: 's6', dishId: 'd3', chefId: 'c6', chefName: 'Ricardo Gutierrez', chefHandle: 'ricardo_df', title: 'Trompo-Style al Pastor', description: 'Marinated 24 hours with achiote, pineapple, and guajillo chiles.', voteScore: 856, rank: 1, photoVerified: true, createdAt: '2026-01-15', tags: ['cuisine:mexican', 'method:grill', 'method:roast', 'time:over-2-hours', 'time:overnight', 'protein:pork', 'spice:hot', 'meal:dinner', 'meal:party-food'], ingredients: ['pork shoulder', 'achiote paste', 'pineapple', 'guajillo chiles', 'onion', 'cilantro', 'corn tortillas', 'lime'] },
  { id: 's7', dishId: 'd4', chefId: 'c7', chefName: 'Yuki Tanaka', chefHandle: 'yuki_ramen', title: 'Tonkotsu from Scratch', description: '18-hour pork bone broth, chashu, ajitama, and homemade noodles.', voteScore: 934, rank: 1, photoVerified: true, createdAt: '2026-02-10', tags: ['cuisine:japanese', 'method:simmer', 'method:boil', 'equip:dutch-oven', 'time:over-2-hours', 'protein:pork', 'protein:eggs', 'spice:mild', 'meal:comfort-food', 'cost:moderate'], ingredients: ['pork bones', 'pork belly', 'eggs', 'ramen noodles', 'soy sauce', 'mirin', 'green onion', 'nori', 'garlic', 'ginger', 'sesame oil'] },
  { id: 's8', dishId: 'd5', chefId: 'c8', chefName: 'Priya Sharma', chefHandle: 'priya_spice', title: 'Delhi-Style Butter Chicken', description: 'The real Moti Mahal recipe, not the watered-down version.', voteScore: 867, rank: 1, photoVerified: true, createdAt: '2026-03-05', tags: ['cuisine:indian', 'method:simmer', 'method:grill', 'equip:stovetop', 'time:1-2-hours', 'protein:chicken', 'spice:medium', 'diet:gluten-free', 'meal:dinner'], ingredients: ['chicken thighs', 'butter', 'cream', 'tomatoes', 'ginger', 'garlic', 'garam masala', 'kashmiri chili', 'cumin', 'fenugreek leaves', 'yogurt'] },
  { id: 's9', dishId: 'd6', chefId: 'c9', chefName: 'Lan Nguyen', chefHandle: 'lan_saigon', title: 'Southern Pho Bo', description: 'Saigon-style with bean sprouts, Thai basil, and hoisin on the side.', voteScore: 801, rank: 1, photoVerified: true, createdAt: '2026-03-22', tags: ['cuisine:vietnamese', 'method:simmer', 'time:over-2-hours', 'protein:beef', 'spice:mild', 'diet:dairy-free', 'meal:dinner', 'meal:comfort-food'], ingredients: ['beef bones', 'beef brisket', 'rice noodles', 'star anise', 'cinnamon', 'fish sauce', 'bean sprouts', 'Thai basil', 'lime', 'hoisin', 'sriracha', 'onion'] },
  { id: 's10', dishId: 'd10', chefId: 'c4', chefName: 'Marco Rossi', chefHandle: 'marco_roma', title: "Nonna's Tiramisu", description: 'Savoiardi, mascarpone, espresso, Marsala. Aged overnight.', voteScore: 756, rank: 1, photoVerified: true, createdAt: '2026-04-05', tags: ['cuisine:italian', 'method:no-cook', 'equip:none', 'time:under-30', 'time:overnight', 'meal:dessert', 'meal:date-night', 'spice:no-spice', 'cost:moderate'], ingredients: ['mascarpone', 'eggs', 'sugar', 'savoiardi', 'espresso', 'Marsala wine', 'cocoa powder'] },
];

export const DEMO_CHEFS: DemoChef[] = [
  { id: 'c1', displayName: 'Somchai K.', handle: 'somchai_bkk', location: 'Bangkok, Thailand', submissionCount: 23, totalVotes: 4521, wins: 3, followers: 1240, topCuisine: 'Thai' },
  { id: 'c2', displayName: 'Maria Lopez', handle: 'maria_cooks', location: 'Mexico City, MX', submissionCount: 18, totalVotes: 3102, wins: 1, followers: 890, topCuisine: 'Mexican' },
  { id: 'c3', displayName: 'Alex Chen', handle: 'wok_star', location: 'San Francisco, CA', submissionCount: 31, totalVotes: 5678, wins: 5, followers: 2100, topCuisine: 'Pan-Asian' },
  { id: 'c4', displayName: 'Marco Rossi', handle: 'marco_roma', location: 'Rome, Italy', submissionCount: 15, totalVotes: 6234, wins: 7, followers: 3400, topCuisine: 'Italian' },
  { id: 'c5', displayName: 'Kenji A.', handle: 'kenji_lab', location: 'New York, NY', submissionCount: 42, totalVotes: 8901, wins: 9, followers: 5600, topCuisine: 'Fusion' },
  { id: 'c6', displayName: 'Ricardo Gutierrez', handle: 'ricardo_df', location: 'Oaxaca, Mexico', submissionCount: 12, totalVotes: 2890, wins: 2, followers: 760, topCuisine: 'Mexican' },
  { id: 'c7', displayName: 'Yuki Tanaka', handle: 'yuki_ramen', location: 'Fukuoka, Japan', submissionCount: 8, totalVotes: 4120, wins: 4, followers: 1890, topCuisine: 'Japanese' },
  { id: 'c8', displayName: 'Priya Sharma', handle: 'priya_spice', location: 'Delhi, India', submissionCount: 19, totalVotes: 3567, wins: 3, followers: 1340, topCuisine: 'Indian' },
  { id: 'c9', displayName: 'Lan Nguyen', handle: 'lan_saigon', location: 'Ho Chi Minh City, VN', submissionCount: 11, totalVotes: 2345, wins: 2, followers: 670, topCuisine: 'Vietnamese' },
  { id: 'c10', displayName: 'Fatou Diallo', handle: 'fatou_taste', location: 'Dakar, Senegal', submissionCount: 14, totalVotes: 1890, wins: 1, followers: 520, topCuisine: 'West African' },
];

export const DEMO_COMMENTS: DemoComment[] = [
  { id: 'cm1', submissionId: 's1', authorName: 'FoodieJen', authorHandle: 'foodie_jen', text: 'Made this last night. The tamarind ratio is perfect. Do NOT substitute with lime juice.', type: 'tried_this', helpfulCount: 34, createdAt: '2026-03-20' },
  { id: 'cm2', submissionId: 's1', authorName: 'Alex Chen', authorHandle: 'wok_star', text: 'For extra smoky flavor, cook the noodles in a very hot carbon steel wok. The char is essential.', type: 'chefs_tip', helpfulCount: 52, createdAt: '2026-03-17' },
  { id: 'cm3', submissionId: 's4', authorName: 'Pasta_Lover', authorHandle: 'pasta_lover', text: 'Guanciale vs pancetta debate: guanciale wins every time. The rendered fat is incomparable.', type: 'comment', helpfulCount: 28, createdAt: '2026-02-25' },
  { id: 'cm4', submissionId: 's7', authorName: 'Ramen_Mike', authorHandle: 'ramen_mike', text: '18 hours is the real deal. Tried a 6-hour shortcut and the broth was nowhere close.', type: 'tried_this', helpfulCount: 41, createdAt: '2026-02-15' },
  { id: 'cm5', submissionId: 's4', authorName: 'Marco Rossi', authorHandle: 'marco_roma', text: 'Key tip: remove from heat before adding the egg mixture. The residual heat is enough.', type: 'chefs_tip', helpfulCount: 67, createdAt: '2026-02-22' },
];

export const DEMO_BADGES: DemoBadge[] = [
  { id: 'b1', name: 'First Submission', icon: '\u{1F373}', description: 'Submit your first recipe to any dish', criteria: '1 submission' },
  { id: 'b2', name: 'Kitchen Regular', icon: '\u{1F468}\u200D\u{1F373}', description: 'Submit 10 recipes across different dishes', criteria: '10 submissions' },
  { id: 'b3', name: 'Crowd Favorite', icon: '\u2764\uFE0F', description: 'Receive 100+ votes on a single submission', criteria: '100 votes on one recipe' },
  { id: 'b4', name: 'Rising Chef', icon: '\u{1F4C8}', description: 'Reach top 10 ranking for any dish', criteria: 'Top 10 rank' },
  { id: 'b5', name: 'Best in Class', icon: '\u{1F3C6}', description: 'Achieve #1 ranking for any dish', criteria: '#1 rank' },
  { id: 'b6', name: 'World Cuisine', icon: '\u{1F30D}', description: 'Submit recipes from 5 different cuisines', criteria: '5 cuisine variety' },
  { id: 'b7', name: 'Consistent Chef', icon: '\u{1F4AA}', description: 'Submit at least one recipe per week for 4 weeks', criteria: '4-week streak' },
  { id: 'b8', name: 'Photo Verified', icon: '\u{1F4F8}', description: 'Have 5 submissions with verified photos', criteria: '5 verified photos' },
  { id: 'b9', name: 'Helpful Notes', icon: '\u{1F4DD}', description: 'Write 10 comments rated helpful by the community', criteria: '10 helpful comments' },
  { id: 'b10', name: 'Hall of Fame', icon: '\u{1F31F}', description: 'Hold #1 ranking on 3 different dishes simultaneously', criteria: '3 concurrent #1 ranks' },
];

export const DEMO_CHALLENGES = [
  { id: 'ch1', name: 'Spring Fresh', description: 'Submit a recipe using at least 3 seasonal spring ingredients', season: 'spring', metric: 'submission_count', target: 1, reward: 'Spring Fresh badge' },
  { id: 'ch2', name: 'World Tour', description: 'Submit recipes from 3 different cuisines this month', season: 'spring', metric: 'cuisine_variety', target: 3, reward: '2x vote weight for 1 week' },
  { id: 'ch3', name: 'Photo Chef', description: 'Get 5 photo-verified submissions', season: 'spring', metric: 'photo_verified', target: 5, reward: 'Photo Chef badge' },
];

export function getDemoSubmissionsForDish(dishId: string): DemoSubmission[] {
  return DEMO_SUBMISSIONS.filter((s) => s.dishId === dishId)
    .sort((a, b) => b.voteScore - a.voteScore);
}

export function getDemoChef(chefId: string): DemoChef | undefined {
  return DEMO_CHEFS.find((c) => c.id === chefId);
}

export function getDemoCommentsForSubmission(submissionId: string): DemoComment[] {
  return DEMO_COMMENTS.filter((c) => c.submissionId === submissionId);
}
