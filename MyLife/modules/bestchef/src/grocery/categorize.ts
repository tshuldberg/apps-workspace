import type { GrocerySection } from '../types';

const SECTION_KEYWORDS: Record<GrocerySection, string[]> = {
  produce: [
    'apple', 'avocado', 'banana', 'basil', 'bean sprout', 'bell pepper',
    'berry', 'blueberry', 'broccoli', 'cabbage', 'carrot', 'celery',
    'cherry', 'chive', 'cilantro', 'corn', 'cucumber', 'dill',
    'eggplant', 'fruit', 'garlic', 'ginger', 'grape', 'green bean',
    'green onion', 'herb', 'jalapeno', 'kale', 'leek', 'lemon',
    'lettuce', 'lime', 'mango', 'melon', 'mint', 'mushroom',
    'onion', 'orange', 'oregano', 'parsley', 'peach', 'pear',
    'pepper', 'pineapple', 'potato', 'radish', 'raspberry', 'romaine',
    'rosemary', 'sage', 'scallion', 'shallot', 'spinach', 'squash',
    'strawberry', 'sweet potato', 'thyme', 'tomato', 'watermelon',
    'zucchini', 'arugula', 'asparagus', 'beet', 'bok choy', 'cauliflower',
    'fennel', 'turnip', 'yam',
  ],
  dairy: [
    'butter', 'buttermilk', 'cheese', 'cheddar', 'cottage cheese',
    'cream', 'cream cheese', 'egg', 'eggs', 'feta', 'goat cheese',
    'gouda', 'gruyere', 'half and half', 'heavy cream', 'mascarpone',
    'milk', 'mozzarella', 'parmesan', 'pecorino', 'provolone',
    'ricotta', 'sour cream', 'swiss', 'whipped cream', 'yogurt',
  ],
  meat: [
    'anchovy', 'bacon', 'beef', 'brisket', 'chicken', 'chorizo',
    'clam', 'cod', 'crab', 'duck', 'fish', 'ground beef', 'ground turkey',
    'guanciale', 'ham', 'hot dog', 'lamb', 'lobster', 'meatball',
    'mussel', 'oyster', 'pancetta', 'pepperoni', 'pork', 'prosciutto',
    'ribs', 'salami', 'salmon', 'sardine', 'sausage', 'scallop',
    'shrimp', 'steak', 'tilapia', 'trout', 'tuna', 'turkey', 'veal',
    'venison',
  ],
  pantry: [
    'almond', 'baking', 'bay leaf', 'breadcrumb', 'brown sugar',
    'canned', 'cashew', 'cereal', 'chickpea', 'chili flake',
    'chocolate', 'chocolate chip', 'cocoa', 'coconut', 'coconut milk',
    'cornmeal', 'cornstarch', 'couscous', 'cracker', 'dried',
    'flour', 'grain', 'granola', 'honey', 'jam', 'jelly',
    'lentil', 'maple syrup', 'molasses', 'noodle', 'nut', 'oat',
    'olive', 'olive oil', 'orzo', 'peanut', 'peanut butter',
    'pecan', 'pine nut', 'quinoa', 'raisin', 'rice', 'pasta',
    'penne', 'rigatoni', 'spaghetti', 'fettuccine', 'linguine',
    'macaroni', 'oil', 'powdered sugar', 'salt', 'sesame',
    'sugar', 'sunflower', 'tahini', 'tomato paste', 'tomato sauce',
    'vanilla', 'vegetable oil', 'walnut', 'yeast',
  ],
  frozen: [
    'frozen', 'ice cream', 'frozen vegetable', 'frozen fruit',
    'frozen pizza', 'popsicle', 'sorbet', 'gelato',
  ],
  bakery: [
    'bagel', 'baguette', 'bread', 'brioche', 'bun', 'ciabatta',
    'cornbread', 'croissant', 'crouton', 'dinner roll', 'english muffin',
    'flatbread', 'focaccia', 'naan', 'pita', 'roll', 'sourdough',
    'tortilla', 'wrap',
  ],
  beverages: [
    'beer', 'bourbon', 'brandy', 'broth', 'cider', 'club soda',
    'coconut water', 'coffee', 'gin', 'juice', 'lemonade',
    'rum', 'sake', 'sparkling water', 'stock', 'tea', 'tequila',
    'tonic', 'vodka', 'whiskey', 'wine',
  ],
  snacks: [
    'chip', 'chips', 'cracker', 'granola bar', 'popcorn',
    'pretzel', 'trail mix',
  ],
  condiments: [
    'bbq sauce', 'capers', 'chili sauce', 'chutney', 'dijon',
    'fish sauce', 'harissa', 'hoisin', 'horseradish', 'hot sauce',
    'ketchup', 'mayonnaise', 'mayo', 'mirin', 'miso', 'mustard',
    'oyster sauce', 'pickle', 'relish', 'salsa', 'sambal',
    'soy sauce', 'sriracha', 'tabasco', 'teriyaki', 'vinegar',
    'wasabi', 'worcestershire',
  ],
  other: [],
};

const SECTION_CHECK_ORDER: GrocerySection[] = [
  'condiments',
  'beverages',
  'bakery',
  'frozen',
  'snacks',
  'dairy',
  'meat',
  'produce',
  'pantry',
];

export function categorizeItem(item: string): GrocerySection {
  const lower = item.toLowerCase();
  for (const section of SECTION_CHECK_ORDER) {
    const keywords = SECTION_KEYWORDS[section];
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        return section;
      }
    }
  }
  return 'other';
}
