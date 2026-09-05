/**
 * Representative USDA seed data: ~100 common whole foods with accurate macros.
 * Per-100g values sourced from USDA SR Legacy / FoodData Central.
 * Full population available via `pnpm data:usda` script.
 */

interface SeedFood {
  id: string;
  name: string;
  brand: null;
  serving_size: number;
  serving_unit: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  source: 'usda';
}

function escape(s: string): string {
  return s.replace(/'/g, "''");
}

// All values per 100g unless serving_unit says otherwise
const SEED_FOODS: SeedFood[] = [
  // -- Proteins --
  { id: 'usda-chicken-breast', name: 'Chicken Breast, boneless, skinless, raw', brand: null, serving_size: 100, serving_unit: 'g', calories: 120, protein_g: 22.5, carbs_g: 0, fat_g: 2.6, fiber_g: 0, sugar_g: 0, sodium_mg: 45, source: 'usda' },
  { id: 'usda-chicken-thigh', name: 'Chicken Thigh, boneless, skinless, raw', brand: null, serving_size: 100, serving_unit: 'g', calories: 177, protein_g: 19.7, carbs_g: 0, fat_g: 10.5, fiber_g: 0, sugar_g: 0, sodium_mg: 75, source: 'usda' },
  { id: 'usda-ground-beef-90', name: 'Ground Beef, 90% lean, raw', brand: null, serving_size: 100, serving_unit: 'g', calories: 176, protein_g: 20, carbs_g: 0, fat_g: 10, fiber_g: 0, sugar_g: 0, sodium_mg: 66, source: 'usda' },
  { id: 'usda-ground-beef-80', name: 'Ground Beef, 80% lean, raw', brand: null, serving_size: 100, serving_unit: 'g', calories: 254, protein_g: 17.2, carbs_g: 0, fat_g: 20, fiber_g: 0, sugar_g: 0, sodium_mg: 66, source: 'usda' },
  { id: 'usda-salmon-atlantic', name: 'Salmon, Atlantic, raw', brand: null, serving_size: 100, serving_unit: 'g', calories: 208, protein_g: 20.4, carbs_g: 0, fat_g: 13.4, fiber_g: 0, sugar_g: 0, sodium_mg: 59, source: 'usda' },
  { id: 'usda-tuna-yellowfin', name: 'Tuna, Yellowfin, raw', brand: null, serving_size: 100, serving_unit: 'g', calories: 109, protein_g: 24.4, carbs_g: 0, fat_g: 0.5, fiber_g: 0, sugar_g: 0, sodium_mg: 45, source: 'usda' },
  { id: 'usda-shrimp', name: 'Shrimp, raw', brand: null, serving_size: 100, serving_unit: 'g', calories: 85, protein_g: 20.1, carbs_g: 0.2, fat_g: 0.5, fiber_g: 0, sugar_g: 0, sodium_mg: 119, source: 'usda' },
  { id: 'usda-pork-tenderloin', name: 'Pork Tenderloin, raw', brand: null, serving_size: 100, serving_unit: 'g', calories: 143, protein_g: 22.2, carbs_g: 0, fat_g: 5.4, fiber_g: 0, sugar_g: 0, sodium_mg: 48, source: 'usda' },
  { id: 'usda-turkey-breast', name: 'Turkey Breast, raw', brand: null, serving_size: 100, serving_unit: 'g', calories: 104, protein_g: 24.6, carbs_g: 0, fat_g: 0.6, fiber_g: 0, sugar_g: 0, sodium_mg: 46, source: 'usda' },
  { id: 'usda-egg-whole', name: 'Egg, whole, raw', brand: null, serving_size: 50, serving_unit: 'g', calories: 143, protein_g: 12.6, carbs_g: 0.7, fat_g: 9.9, fiber_g: 0, sugar_g: 0.4, sodium_mg: 142, source: 'usda' },
  { id: 'usda-egg-white', name: 'Egg White, raw', brand: null, serving_size: 33, serving_unit: 'g', calories: 52, protein_g: 10.9, carbs_g: 0.7, fat_g: 0.2, fiber_g: 0, sugar_g: 0.7, sodium_mg: 166, source: 'usda' },
  { id: 'usda-tofu-firm', name: 'Tofu, firm, raw', brand: null, serving_size: 100, serving_unit: 'g', calories: 144, protein_g: 15.6, carbs_g: 2.3, fat_g: 8.7, fiber_g: 1.2, sugar_g: 0.5, sodium_mg: 14, source: 'usda' },
  // -- Dairy --
  { id: 'usda-greek-yogurt-nonfat', name: 'Greek Yogurt, nonfat, plain', brand: null, serving_size: 170, serving_unit: 'g', calories: 59, protein_g: 10.2, carbs_g: 3.6, fat_g: 0.4, fiber_g: 0, sugar_g: 3.2, sodium_mg: 36, source: 'usda' },
  { id: 'usda-milk-whole', name: 'Milk, whole, 3.25%', brand: null, serving_size: 244, serving_unit: 'g', calories: 61, protein_g: 3.2, carbs_g: 4.8, fat_g: 3.3, fiber_g: 0, sugar_g: 5.1, sodium_mg: 43, source: 'usda' },
  { id: 'usda-milk-2pct', name: 'Milk, reduced fat, 2%', brand: null, serving_size: 244, serving_unit: 'g', calories: 50, protein_g: 3.3, carbs_g: 4.7, fat_g: 2, fiber_g: 0, sugar_g: 5.1, sodium_mg: 47, source: 'usda' },
  { id: 'usda-cheddar-cheese', name: 'Cheddar Cheese', brand: null, serving_size: 28, serving_unit: 'g', calories: 403, protein_g: 24.9, carbs_g: 1.3, fat_g: 33.1, fiber_g: 0, sugar_g: 0.5, sodium_mg: 621, source: 'usda' },
  { id: 'usda-cottage-cheese', name: 'Cottage Cheese, 2% milkfat', brand: null, serving_size: 113, serving_unit: 'g', calories: 84, protein_g: 10.5, carbs_g: 4.3, fat_g: 2.3, fiber_g: 0, sugar_g: 4.0, sodium_mg: 321, source: 'usda' },
  { id: 'usda-butter', name: 'Butter, salted', brand: null, serving_size: 14, serving_unit: 'g', calories: 717, protein_g: 0.9, carbs_g: 0.1, fat_g: 81.1, fiber_g: 0, sugar_g: 0.1, sodium_mg: 643, source: 'usda' },
  // -- Grains --
  { id: 'usda-white-rice-cooked', name: 'White Rice, cooked', brand: null, serving_size: 158, serving_unit: 'g', calories: 130, protein_g: 2.7, carbs_g: 28.2, fat_g: 0.3, fiber_g: 0.4, sugar_g: 0, sodium_mg: 1, source: 'usda' },
  { id: 'usda-brown-rice-cooked', name: 'Brown Rice, cooked', brand: null, serving_size: 195, serving_unit: 'g', calories: 123, protein_g: 2.7, carbs_g: 25.6, fat_g: 1.0, fiber_g: 1.6, sugar_g: 0.4, sodium_mg: 4, source: 'usda' },
  { id: 'usda-oats-rolled', name: 'Oats, rolled, dry', brand: null, serving_size: 40, serving_unit: 'g', calories: 389, protein_g: 16.9, carbs_g: 66.3, fat_g: 6.9, fiber_g: 10.6, sugar_g: 0, sodium_mg: 2, source: 'usda' },
  { id: 'usda-bread-whole-wheat', name: 'Bread, whole wheat', brand: null, serving_size: 32, serving_unit: 'g', calories: 247, protein_g: 12.9, carbs_g: 41.3, fat_g: 3.4, fiber_g: 6.0, sugar_g: 5.6, sodium_mg: 472, source: 'usda' },
  { id: 'usda-bread-white', name: 'Bread, white', brand: null, serving_size: 25, serving_unit: 'g', calories: 265, protein_g: 9.4, carbs_g: 49.2, fat_g: 3.3, fiber_g: 2.7, sugar_g: 5.3, sodium_mg: 491, source: 'usda' },
  { id: 'usda-pasta-cooked', name: 'Pasta, cooked', brand: null, serving_size: 140, serving_unit: 'g', calories: 131, protein_g: 5.0, carbs_g: 25.4, fat_g: 1.1, fiber_g: 1.8, sugar_g: 0.6, sodium_mg: 1, source: 'usda' },
  { id: 'usda-quinoa-cooked', name: 'Quinoa, cooked', brand: null, serving_size: 185, serving_unit: 'g', calories: 120, protein_g: 4.4, carbs_g: 21.3, fat_g: 1.9, fiber_g: 2.8, sugar_g: 0.9, sodium_mg: 7, source: 'usda' },
  { id: 'usda-tortilla-flour', name: 'Tortilla, flour', brand: null, serving_size: 45, serving_unit: 'g', calories: 312, protein_g: 8.3, carbs_g: 51.6, fat_g: 8.8, fiber_g: 2.1, sugar_g: 3.2, sodium_mg: 558, source: 'usda' },
  // -- Fruits --
  { id: 'usda-banana', name: 'Banana, raw', brand: null, serving_size: 118, serving_unit: 'g', calories: 89, protein_g: 1.1, carbs_g: 22.8, fat_g: 0.3, fiber_g: 2.6, sugar_g: 12.2, sodium_mg: 1, source: 'usda' },
  { id: 'usda-apple', name: 'Apple, raw, with skin', brand: null, serving_size: 182, serving_unit: 'g', calories: 52, protein_g: 0.3, carbs_g: 13.8, fat_g: 0.2, fiber_g: 2.4, sugar_g: 10.4, sodium_mg: 1, source: 'usda' },
  { id: 'usda-strawberries', name: 'Strawberries, raw', brand: null, serving_size: 152, serving_unit: 'g', calories: 32, protein_g: 0.7, carbs_g: 7.7, fat_g: 0.3, fiber_g: 2.0, sugar_g: 4.9, sodium_mg: 1, source: 'usda' },
  { id: 'usda-blueberries', name: 'Blueberries, raw', brand: null, serving_size: 148, serving_unit: 'g', calories: 57, protein_g: 0.7, carbs_g: 14.5, fat_g: 0.3, fiber_g: 2.4, sugar_g: 10.0, sodium_mg: 1, source: 'usda' },
  { id: 'usda-orange', name: 'Orange, raw', brand: null, serving_size: 131, serving_unit: 'g', calories: 47, protein_g: 0.9, carbs_g: 11.8, fat_g: 0.1, fiber_g: 2.4, sugar_g: 9.4, sodium_mg: 0, source: 'usda' },
  { id: 'usda-grapes-red', name: 'Grapes, red, raw', brand: null, serving_size: 151, serving_unit: 'g', calories: 69, protein_g: 0.7, carbs_g: 18.1, fat_g: 0.2, fiber_g: 0.9, sugar_g: 15.5, sodium_mg: 2, source: 'usda' },
  { id: 'usda-avocado', name: 'Avocado, raw', brand: null, serving_size: 150, serving_unit: 'g', calories: 160, protein_g: 2.0, carbs_g: 8.5, fat_g: 14.7, fiber_g: 6.7, sugar_g: 0.7, sodium_mg: 7, source: 'usda' },
  { id: 'usda-mango', name: 'Mango, raw', brand: null, serving_size: 165, serving_unit: 'g', calories: 60, protein_g: 0.8, carbs_g: 15.0, fat_g: 0.4, fiber_g: 1.6, sugar_g: 13.7, sodium_mg: 1, source: 'usda' },
  { id: 'usda-watermelon', name: 'Watermelon, raw', brand: null, serving_size: 286, serving_unit: 'g', calories: 30, protein_g: 0.6, carbs_g: 7.6, fat_g: 0.2, fiber_g: 0.4, sugar_g: 6.2, sodium_mg: 1, source: 'usda' },
  { id: 'usda-pineapple', name: 'Pineapple, raw', brand: null, serving_size: 165, serving_unit: 'g', calories: 50, protein_g: 0.5, carbs_g: 13.1, fat_g: 0.1, fiber_g: 1.4, sugar_g: 9.9, sodium_mg: 1, source: 'usda' },
  // -- Vegetables --
  { id: 'usda-broccoli', name: 'Broccoli, raw', brand: null, serving_size: 91, serving_unit: 'g', calories: 34, protein_g: 2.8, carbs_g: 6.6, fat_g: 0.4, fiber_g: 2.6, sugar_g: 1.7, sodium_mg: 33, source: 'usda' },
  { id: 'usda-spinach', name: 'Spinach, raw', brand: null, serving_size: 30, serving_unit: 'g', calories: 23, protein_g: 2.9, carbs_g: 3.6, fat_g: 0.4, fiber_g: 2.2, sugar_g: 0.4, sodium_mg: 79, source: 'usda' },
  { id: 'usda-kale', name: 'Kale, raw', brand: null, serving_size: 67, serving_unit: 'g', calories: 49, protein_g: 4.3, carbs_g: 8.8, fat_g: 0.9, fiber_g: 3.6, sugar_g: 2.3, sodium_mg: 38, source: 'usda' },
  { id: 'usda-sweet-potato', name: 'Sweet Potato, raw', brand: null, serving_size: 130, serving_unit: 'g', calories: 86, protein_g: 1.6, carbs_g: 20.1, fat_g: 0.1, fiber_g: 3.0, sugar_g: 4.2, sodium_mg: 55, source: 'usda' },
  { id: 'usda-potato-russet', name: 'Potato, Russet, raw', brand: null, serving_size: 213, serving_unit: 'g', calories: 79, protein_g: 2.1, carbs_g: 17.5, fat_g: 0.1, fiber_g: 1.3, sugar_g: 0.8, sodium_mg: 5, source: 'usda' },
  { id: 'usda-carrot', name: 'Carrot, raw', brand: null, serving_size: 61, serving_unit: 'g', calories: 41, protein_g: 0.9, carbs_g: 9.6, fat_g: 0.2, fiber_g: 2.8, sugar_g: 4.7, sodium_mg: 69, source: 'usda' },
  { id: 'usda-tomato', name: 'Tomato, raw', brand: null, serving_size: 123, serving_unit: 'g', calories: 18, protein_g: 0.9, carbs_g: 3.9, fat_g: 0.2, fiber_g: 1.2, sugar_g: 2.6, sodium_mg: 5, source: 'usda' },
  { id: 'usda-onion', name: 'Onion, raw', brand: null, serving_size: 110, serving_unit: 'g', calories: 40, protein_g: 1.1, carbs_g: 9.3, fat_g: 0.1, fiber_g: 1.7, sugar_g: 4.2, sodium_mg: 4, source: 'usda' },
  { id: 'usda-bell-pepper-red', name: 'Bell Pepper, red, raw', brand: null, serving_size: 119, serving_unit: 'g', calories: 31, protein_g: 1.0, carbs_g: 6.0, fat_g: 0.3, fiber_g: 2.1, sugar_g: 4.2, sodium_mg: 4, source: 'usda' },
  { id: 'usda-corn-sweet', name: 'Corn, sweet, yellow, raw', brand: null, serving_size: 90, serving_unit: 'g', calories: 86, protein_g: 3.3, carbs_g: 18.7, fat_g: 1.2, fiber_g: 2.0, sugar_g: 6.3, sodium_mg: 15, source: 'usda' },
  { id: 'usda-cucumber', name: 'Cucumber, with peel, raw', brand: null, serving_size: 301, serving_unit: 'g', calories: 15, protein_g: 0.7, carbs_g: 3.6, fat_g: 0.1, fiber_g: 0.5, sugar_g: 1.7, sodium_mg: 2, source: 'usda' },
  { id: 'usda-green-beans', name: 'Green Beans, raw', brand: null, serving_size: 110, serving_unit: 'g', calories: 31, protein_g: 1.8, carbs_g: 7.0, fat_g: 0.1, fiber_g: 3.4, sugar_g: 1.4, sodium_mg: 6, source: 'usda' },
  { id: 'usda-mushroom-white', name: 'Mushrooms, white, raw', brand: null, serving_size: 70, serving_unit: 'g', calories: 22, protein_g: 3.1, carbs_g: 3.3, fat_g: 0.3, fiber_g: 1.0, sugar_g: 2.0, sodium_mg: 5, source: 'usda' },
  { id: 'usda-zucchini', name: 'Zucchini, raw', brand: null, serving_size: 113, serving_unit: 'g', calories: 17, protein_g: 1.2, carbs_g: 3.1, fat_g: 0.3, fiber_g: 1.0, sugar_g: 2.5, sodium_mg: 8, source: 'usda' },
  { id: 'usda-cauliflower', name: 'Cauliflower, raw', brand: null, serving_size: 100, serving_unit: 'g', calories: 25, protein_g: 1.9, carbs_g: 5.0, fat_g: 0.3, fiber_g: 2.0, sugar_g: 1.9, sodium_mg: 30, source: 'usda' },
  { id: 'usda-celery', name: 'Celery, raw', brand: null, serving_size: 101, serving_unit: 'g', calories: 14, protein_g: 0.7, carbs_g: 3.0, fat_g: 0.2, fiber_g: 1.6, sugar_g: 1.3, sodium_mg: 80, source: 'usda' },
  // -- Legumes --
  { id: 'usda-black-beans-cooked', name: 'Black Beans, cooked', brand: null, serving_size: 172, serving_unit: 'g', calories: 132, protein_g: 8.9, carbs_g: 23.7, fat_g: 0.5, fiber_g: 8.7, sugar_g: 0.3, sodium_mg: 1, source: 'usda' },
  { id: 'usda-chickpeas-cooked', name: 'Chickpeas, cooked', brand: null, serving_size: 164, serving_unit: 'g', calories: 164, protein_g: 8.9, carbs_g: 27.4, fat_g: 2.6, fiber_g: 7.6, sugar_g: 4.8, sodium_mg: 7, source: 'usda' },
  { id: 'usda-lentils-cooked', name: 'Lentils, cooked', brand: null, serving_size: 198, serving_unit: 'g', calories: 116, protein_g: 9.0, carbs_g: 20.1, fat_g: 0.4, fiber_g: 7.9, sugar_g: 1.8, sodium_mg: 2, source: 'usda' },
  { id: 'usda-peanut-butter', name: 'Peanut Butter, smooth', brand: null, serving_size: 32, serving_unit: 'g', calories: 588, protein_g: 25.1, carbs_g: 20.0, fat_g: 50.4, fiber_g: 6.0, sugar_g: 9.2, sodium_mg: 459, source: 'usda' },
  { id: 'usda-edamame', name: 'Edamame, frozen, prepared', brand: null, serving_size: 155, serving_unit: 'g', calories: 121, protein_g: 11.9, carbs_g: 8.9, fat_g: 5.2, fiber_g: 5.2, sugar_g: 2.2, sodium_mg: 6, source: 'usda' },
  // -- Nuts and Seeds --
  { id: 'usda-almonds', name: 'Almonds, raw', brand: null, serving_size: 28, serving_unit: 'g', calories: 579, protein_g: 21.2, carbs_g: 21.6, fat_g: 49.9, fiber_g: 12.5, sugar_g: 4.4, sodium_mg: 1, source: 'usda' },
  { id: 'usda-walnuts', name: 'Walnuts, raw', brand: null, serving_size: 28, serving_unit: 'g', calories: 654, protein_g: 15.2, carbs_g: 13.7, fat_g: 65.2, fiber_g: 6.7, sugar_g: 2.6, sodium_mg: 2, source: 'usda' },
  { id: 'usda-cashews', name: 'Cashews, raw', brand: null, serving_size: 28, serving_unit: 'g', calories: 553, protein_g: 18.2, carbs_g: 30.2, fat_g: 43.9, fiber_g: 3.3, sugar_g: 5.9, sodium_mg: 12, source: 'usda' },
  { id: 'usda-chia-seeds', name: 'Chia Seeds', brand: null, serving_size: 28, serving_unit: 'g', calories: 486, protein_g: 16.5, carbs_g: 42.1, fat_g: 30.7, fiber_g: 34.4, sugar_g: 0, sodium_mg: 16, source: 'usda' },
  { id: 'usda-flaxseed', name: 'Flaxseed, whole', brand: null, serving_size: 10, serving_unit: 'g', calories: 534, protein_g: 18.3, carbs_g: 28.9, fat_g: 42.2, fiber_g: 27.3, sugar_g: 1.6, sodium_mg: 30, source: 'usda' },
  { id: 'usda-pumpkin-seeds', name: 'Pumpkin Seeds, raw', brand: null, serving_size: 28, serving_unit: 'g', calories: 559, protein_g: 30.2, carbs_g: 10.7, fat_g: 49.1, fiber_g: 6.0, sugar_g: 1.4, sodium_mg: 7, source: 'usda' },
  { id: 'usda-sunflower-seeds', name: 'Sunflower Seeds, raw', brand: null, serving_size: 28, serving_unit: 'g', calories: 584, protein_g: 20.8, carbs_g: 20.0, fat_g: 51.5, fiber_g: 8.6, sugar_g: 2.6, sodium_mg: 9, source: 'usda' },
  // -- Oils and Fats --
  { id: 'usda-olive-oil', name: 'Olive Oil', brand: null, serving_size: 14, serving_unit: 'g', calories: 884, protein_g: 0, carbs_g: 0, fat_g: 100, fiber_g: 0, sugar_g: 0, sodium_mg: 2, source: 'usda' },
  { id: 'usda-coconut-oil', name: 'Coconut Oil', brand: null, serving_size: 14, serving_unit: 'g', calories: 862, protein_g: 0, carbs_g: 0, fat_g: 100, fiber_g: 0, sugar_g: 0, sodium_mg: 0, source: 'usda' },
  // -- Sweeteners --
  { id: 'usda-honey', name: 'Honey', brand: null, serving_size: 21, serving_unit: 'g', calories: 304, protein_g: 0.3, carbs_g: 82.4, fat_g: 0, fiber_g: 0.2, sugar_g: 82.1, sodium_mg: 4, source: 'usda' },
  { id: 'usda-maple-syrup', name: 'Maple Syrup', brand: null, serving_size: 20, serving_unit: 'g', calories: 260, protein_g: 0, carbs_g: 67.0, fat_g: 0.1, fiber_g: 0, sugar_g: 60.4, sodium_mg: 12, source: 'usda' },
  // -- Beverages --
  { id: 'usda-coffee-brewed', name: 'Coffee, brewed', brand: null, serving_size: 237, serving_unit: 'g', calories: 1, protein_g: 0.1, carbs_g: 0, fat_g: 0, fiber_g: 0, sugar_g: 0, sodium_mg: 2, source: 'usda' },
  { id: 'usda-orange-juice', name: 'Orange Juice, fresh', brand: null, serving_size: 248, serving_unit: 'g', calories: 45, protein_g: 0.7, carbs_g: 10.4, fat_g: 0.2, fiber_g: 0.2, sugar_g: 8.4, sodium_mg: 1, source: 'usda' },
  // -- Condiments --
  { id: 'usda-soy-sauce', name: 'Soy Sauce', brand: null, serving_size: 16, serving_unit: 'g', calories: 53, protein_g: 5.6, carbs_g: 5.6, fat_g: 0.1, fiber_g: 0.4, sugar_g: 0.4, sodium_mg: 5493, source: 'usda' },
  { id: 'usda-ketchup', name: 'Ketchup', brand: null, serving_size: 17, serving_unit: 'g', calories: 112, protein_g: 1.7, carbs_g: 25.8, fat_g: 0.1, fiber_g: 0.3, sugar_g: 21.3, sodium_mg: 907, source: 'usda' },
  { id: 'usda-mustard-yellow', name: 'Mustard, yellow', brand: null, serving_size: 5, serving_unit: 'g', calories: 66, protein_g: 4.4, carbs_g: 5.3, fat_g: 4.0, fiber_g: 3.3, sugar_g: 2.2, sodium_mg: 1135, source: 'usda' },
  // -- Snacks / Misc --
  { id: 'usda-dark-chocolate-70', name: 'Dark Chocolate, 70-85%', brand: null, serving_size: 28, serving_unit: 'g', calories: 598, protein_g: 7.8, carbs_g: 45.9, fat_g: 42.6, fiber_g: 10.9, sugar_g: 24.0, sodium_mg: 20, source: 'usda' },
  { id: 'usda-hummus', name: 'Hummus', brand: null, serving_size: 30, serving_unit: 'g', calories: 166, protein_g: 7.9, carbs_g: 14.3, fat_g: 9.6, fiber_g: 6.0, sugar_g: 0.3, sodium_mg: 379, source: 'usda' },
  { id: 'usda-granola', name: 'Granola, homemade', brand: null, serving_size: 61, serving_unit: 'g', calories: 489, protein_g: 14.3, carbs_g: 53.4, fat_g: 24.4, fiber_g: 8.6, sugar_g: 18.1, sodium_mg: 22, source: 'usda' },
  { id: 'usda-popcorn-air', name: 'Popcorn, air-popped', brand: null, serving_size: 8, serving_unit: 'g', calories: 387, protein_g: 12.9, carbs_g: 77.8, fat_g: 4.5, fiber_g: 14.5, sugar_g: 0.9, sodium_mg: 8, source: 'usda' },
  // -- Fish / Seafood (more) --
  { id: 'usda-cod', name: 'Cod, Atlantic, raw', brand: null, serving_size: 100, serving_unit: 'g', calories: 82, protein_g: 17.8, carbs_g: 0, fat_g: 0.7, fiber_g: 0, sugar_g: 0, sodium_mg: 54, source: 'usda' },
  { id: 'usda-tilapia', name: 'Tilapia, raw', brand: null, serving_size: 100, serving_unit: 'g', calories: 96, protein_g: 20.1, carbs_g: 0, fat_g: 1.7, fiber_g: 0, sugar_g: 0, sodium_mg: 52, source: 'usda' },
  // -- Additional staples --
  { id: 'usda-basmati-rice', name: 'Basmati Rice, cooked', brand: null, serving_size: 158, serving_unit: 'g', calories: 121, protein_g: 3.5, carbs_g: 25.2, fat_g: 0.4, fiber_g: 0.4, sugar_g: 0, sodium_mg: 1, source: 'usda' },
  { id: 'usda-greek-yogurt-whole', name: 'Greek Yogurt, whole milk, plain', brand: null, serving_size: 170, serving_unit: 'g', calories: 97, protein_g: 9.0, carbs_g: 3.6, fat_g: 5.0, fiber_g: 0, sugar_g: 3.6, sodium_mg: 47, source: 'usda' },
  { id: 'usda-whey-protein', name: 'Whey Protein, isolate, unflavored', brand: null, serving_size: 30, serving_unit: 'g', calories: 367, protein_g: 87.5, carbs_g: 4.2, fat_g: 0.8, fiber_g: 0, sugar_g: 1.7, sodium_mg: 200, source: 'usda' },
  { id: 'usda-tempeh', name: 'Tempeh', brand: null, serving_size: 84, serving_unit: 'g', calories: 192, protein_g: 20.3, carbs_g: 7.6, fat_g: 10.8, fiber_g: 0, sugar_g: 0, sodium_mg: 9, source: 'usda' },
  { id: 'usda-seitan', name: 'Seitan (wheat gluten)', brand: null, serving_size: 100, serving_unit: 'g', calories: 370, protein_g: 75.2, carbs_g: 13.8, fat_g: 1.9, fiber_g: 0.6, sugar_g: 0.2, sodium_mg: 29, source: 'usda' },
  { id: 'usda-coconut-milk', name: 'Coconut Milk, canned', brand: null, serving_size: 240, serving_unit: 'g', calories: 230, protein_g: 2.3, carbs_g: 6.0, fat_g: 23.8, fiber_g: 0, sugar_g: 3.3, sodium_mg: 15, source: 'usda' },
  { id: 'usda-almond-milk', name: 'Almond Milk, unsweetened', brand: null, serving_size: 240, serving_unit: 'g', calories: 15, protein_g: 0.6, carbs_g: 0.3, fat_g: 1.2, fiber_g: 0, sugar_g: 0, sodium_mg: 170, source: 'usda' },
  { id: 'usda-oat-milk', name: 'Oat Milk, unsweetened', brand: null, serving_size: 240, serving_unit: 'g', calories: 45, protein_g: 1.0, carbs_g: 7.0, fat_g: 1.5, fiber_g: 1.0, sugar_g: 3.5, sodium_mg: 100, source: 'usda' },
  // -- More veggies --
  { id: 'usda-asparagus', name: 'Asparagus, raw', brand: null, serving_size: 134, serving_unit: 'g', calories: 20, protein_g: 2.2, carbs_g: 3.9, fat_g: 0.1, fiber_g: 2.1, sugar_g: 1.9, sodium_mg: 2, source: 'usda' },
  { id: 'usda-brussels-sprouts', name: 'Brussels Sprouts, raw', brand: null, serving_size: 88, serving_unit: 'g', calories: 43, protein_g: 3.4, carbs_g: 9.0, fat_g: 0.3, fiber_g: 3.8, sugar_g: 2.2, sodium_mg: 25, source: 'usda' },
  { id: 'usda-cabbage', name: 'Cabbage, green, raw', brand: null, serving_size: 89, serving_unit: 'g', calories: 25, protein_g: 1.3, carbs_g: 5.8, fat_g: 0.1, fiber_g: 2.5, sugar_g: 3.2, sodium_mg: 18, source: 'usda' },
  { id: 'usda-lettuce-romaine', name: 'Lettuce, Romaine, raw', brand: null, serving_size: 85, serving_unit: 'g', calories: 17, protein_g: 1.2, carbs_g: 3.3, fat_g: 0.3, fiber_g: 2.1, sugar_g: 1.2, sodium_mg: 8, source: 'usda' },
  { id: 'usda-garlic', name: 'Garlic, raw', brand: null, serving_size: 3, serving_unit: 'g', calories: 149, protein_g: 6.4, carbs_g: 33.1, fat_g: 0.5, fiber_g: 2.1, sugar_g: 1.0, sodium_mg: 17, source: 'usda' },
  { id: 'usda-ginger', name: 'Ginger Root, raw', brand: null, serving_size: 11, serving_unit: 'g', calories: 80, protein_g: 1.8, carbs_g: 17.8, fat_g: 0.8, fiber_g: 2.0, sugar_g: 1.7, sodium_mg: 13, source: 'usda' },
  // -- More fruits --
  { id: 'usda-peach', name: 'Peach, raw', brand: null, serving_size: 150, serving_unit: 'g', calories: 39, protein_g: 0.9, carbs_g: 9.5, fat_g: 0.3, fiber_g: 1.5, sugar_g: 8.4, sodium_mg: 0, source: 'usda' },
  { id: 'usda-pear', name: 'Pear, raw', brand: null, serving_size: 178, serving_unit: 'g', calories: 57, protein_g: 0.4, carbs_g: 15.2, fat_g: 0.1, fiber_g: 3.1, sugar_g: 9.8, sodium_mg: 1, source: 'usda' },
  { id: 'usda-cherry-sweet', name: 'Cherries, sweet, raw', brand: null, serving_size: 138, serving_unit: 'g', calories: 63, protein_g: 1.1, carbs_g: 16.0, fat_g: 0.2, fiber_g: 2.1, sugar_g: 12.8, sodium_mg: 0, source: 'usda' },
  { id: 'usda-kiwi', name: 'Kiwi, green, raw', brand: null, serving_size: 69, serving_unit: 'g', calories: 61, protein_g: 1.1, carbs_g: 14.7, fat_g: 0.5, fiber_g: 3.0, sugar_g: 9.0, sodium_mg: 3, source: 'usda' },
  { id: 'usda-lemon', name: 'Lemon, raw, without peel', brand: null, serving_size: 58, serving_unit: 'g', calories: 29, protein_g: 1.1, carbs_g: 9.3, fat_g: 0.3, fiber_g: 2.8, sugar_g: 2.5, sodium_mg: 2, source: 'usda' },
  { id: 'usda-raspberry', name: 'Raspberries, raw', brand: null, serving_size: 123, serving_unit: 'g', calories: 52, protein_g: 1.2, carbs_g: 11.9, fat_g: 0.7, fiber_g: 6.5, sugar_g: 4.4, sodium_mg: 1, source: 'usda' },
];

/**
 * Generate SQL INSERT statements for seed foods.
 */
export function getUSDAFoodInserts(): string[] {
  return SEED_FOODS.map((f) => {
    return `INSERT OR IGNORE INTO nu_foods (id, name, brand, serving_size, serving_unit, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, source, barcode, usda_ndb_number, created_at, updated_at) VALUES ('${escape(f.id)}', '${escape(f.name)}', NULL, ${f.serving_size}, '${escape(f.serving_unit)}', ${f.calories}, ${f.protein_g}, ${f.carbs_g}, ${f.fat_g}, ${f.fiber_g}, ${f.sugar_g}, ${f.sodium_mg}, '${f.source}', NULL, NULL, datetime('now'), datetime('now'))`;
  });
}

/**
 * Generate SQL INSERT statements to populate the FTS index for seed foods.
 */
export function getUSDAFTSInserts(): string[] {
  return SEED_FOODS.map((f) => {
    return `INSERT OR IGNORE INTO nu_foods_fts (rowid, name, brand) SELECT rowid, name, brand FROM nu_foods WHERE id = '${escape(f.id)}'`;
  });
}
