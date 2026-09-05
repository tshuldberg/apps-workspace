/**
 * Seed data for popular US chain restaurants and their menu items.
 * Nutrition data sourced from publicly available restaurant nutrition PDFs.
 * All values are approximate.
 */

interface SeedRestaurant {
  id: string;
  name: string;
  category: string;
  chain: number;
  logoEmoji: string;
  website: string;
}

interface SeedMenuItem {
  id: string;
  restaurantId: string;
  name: string;
  category: string;
  servingSize: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sodiumMg: number;
}

const RESTAURANTS: SeedRestaurant[] = [
  { id: 'seed-mcdonalds', name: "McDonald's", category: 'fast_food', chain: 1, logoEmoji: '🍔', website: 'mcdonalds.com' },
  { id: 'seed-chipotle', name: 'Chipotle', category: 'mexican', chain: 1, logoEmoji: '🌯', website: 'chipotle.com' },
  { id: 'seed-starbucks', name: 'Starbucks', category: 'cafe', chain: 1, logoEmoji: '☕', website: 'starbucks.com' },
  { id: 'seed-subway', name: 'Subway', category: 'fast_food', chain: 1, logoEmoji: '🥖', website: 'subway.com' },
  { id: 'seed-chickfila', name: 'Chick-fil-A', category: 'fast_food', chain: 1, logoEmoji: '🐔', website: 'chick-fil-a.com' },
  { id: 'seed-tacobell', name: 'Taco Bell', category: 'mexican', chain: 1, logoEmoji: '🌮', website: 'tacobell.com' },
  { id: 'seed-wendys', name: "Wendy's", category: 'fast_food', chain: 1, logoEmoji: '🍔', website: 'wendys.com' },
  { id: 'seed-panera', name: 'Panera Bread', category: 'casual', chain: 1, logoEmoji: '🍞', website: 'panerabread.com' },
  { id: 'seed-pandaexpress', name: 'Panda Express', category: 'asian', chain: 1, logoEmoji: '🐼', website: 'pandaexpress.com' },
  { id: 'seed-innout', name: 'In-N-Out Burger', category: 'fast_food', chain: 1, logoEmoji: '🍔', website: 'in-n-out.com' },
  { id: 'seed-fiveguys', name: 'Five Guys', category: 'fast_food', chain: 1, logoEmoji: '🍟', website: 'fiveguys.com' },
  { id: 'seed-shakeshack', name: 'Shake Shack', category: 'fast_food', chain: 1, logoEmoji: '🍔', website: 'shakeshack.com' },
  { id: 'seed-sweetgreen', name: 'Sweetgreen', category: 'casual', chain: 1, logoEmoji: '🥗', website: 'sweetgreen.com' },
  { id: 'seed-popeyes', name: 'Popeyes', category: 'fast_food', chain: 1, logoEmoji: '🍗', website: 'popeyes.com' },
  { id: 'seed-dominos', name: "Domino's", category: 'pizza', chain: 1, logoEmoji: '🍕', website: 'dominos.com' },
  { id: 'seed-pizzahut', name: 'Pizza Hut', category: 'pizza', chain: 1, logoEmoji: '🍕', website: 'pizzahut.com' },
  { id: 'seed-dunkin', name: "Dunkin'", category: 'cafe', chain: 1, logoEmoji: '🍩', website: 'dunkindonuts.com' },
  { id: 'seed-wingstop', name: 'Wingstop', category: 'fast_food', chain: 1, logoEmoji: '🍗', website: 'wingstop.com' },
  { id: 'seed-cava', name: 'CAVA', category: 'casual', chain: 1, logoEmoji: '🥙', website: 'cava.com' },
  { id: 'seed-canes', name: "Raising Cane's", category: 'fast_food', chain: 1, logoEmoji: '🍗', website: 'raisingcanes.com' },
];

const MENU_ITEMS: SeedMenuItem[] = [
  // McDonald's
  { id: 'seed-mi-mcd-1', restaurantId: 'seed-mcdonalds', name: 'Big Mac', category: 'Burgers', servingSize: '1 sandwich', calories: 550, proteinG: 25, carbsG: 45, fatG: 30, fiberG: 3, sodiumMg: 1010 },
  { id: 'seed-mi-mcd-2', restaurantId: 'seed-mcdonalds', name: 'Quarter Pounder with Cheese', category: 'Burgers', servingSize: '1 sandwich', calories: 520, proteinG: 30, carbsG: 42, fatG: 27, fiberG: 2, sodiumMg: 1150 },
  { id: 'seed-mi-mcd-3', restaurantId: 'seed-mcdonalds', name: 'McChicken', category: 'Chicken', servingSize: '1 sandwich', calories: 400, proteinG: 14, carbsG: 40, fatG: 21, fiberG: 1, sodiumMg: 780 },
  { id: 'seed-mi-mcd-4', restaurantId: 'seed-mcdonalds', name: 'Medium French Fries', category: 'Sides', servingSize: '1 medium', calories: 320, proteinG: 5, carbsG: 43, fatG: 15, fiberG: 4, sodiumMg: 260 },
  { id: 'seed-mi-mcd-5', restaurantId: 'seed-mcdonalds', name: 'Egg McMuffin', category: 'Breakfast', servingSize: '1 sandwich', calories: 300, proteinG: 17, carbsG: 30, fatG: 13, fiberG: 2, sodiumMg: 770 },
  // Chipotle
  { id: 'seed-mi-chi-1', restaurantId: 'seed-chipotle', name: 'Chicken Burrito', category: 'Burritos', servingSize: '1 burrito', calories: 1005, proteinG: 55, carbsG: 105, fatG: 37, fiberG: 13, sodiumMg: 2150 },
  { id: 'seed-mi-chi-2', restaurantId: 'seed-chipotle', name: 'Chicken Bowl', category: 'Bowls', servingSize: '1 bowl', calories: 740, proteinG: 49, carbsG: 72, fatG: 24, fiberG: 11, sodiumMg: 1860 },
  { id: 'seed-mi-chi-3', restaurantId: 'seed-chipotle', name: 'Steak Tacos (3)', category: 'Tacos', servingSize: '3 tacos', calories: 580, proteinG: 30, carbsG: 42, fatG: 28, fiberG: 5, sodiumMg: 980 },
  { id: 'seed-mi-chi-4', restaurantId: 'seed-chipotle', name: 'Chips and Guacamole', category: 'Sides', servingSize: '1 order', calories: 770, proteinG: 8, carbsG: 79, fatG: 47, fiberG: 12, sodiumMg: 600 },
  { id: 'seed-mi-chi-5', restaurantId: 'seed-chipotle', name: 'Sofritas Bowl', category: 'Bowls', servingSize: '1 bowl', calories: 690, proteinG: 27, carbsG: 82, fatG: 26, fiberG: 13, sodiumMg: 1700 },
  // Starbucks
  { id: 'seed-mi-sbx-1', restaurantId: 'seed-starbucks', name: 'Caffe Latte (Grande)', category: 'Drinks', servingSize: '16 oz', calories: 190, proteinG: 13, carbsG: 19, fatG: 7, fiberG: 0, sodiumMg: 170 },
  { id: 'seed-mi-sbx-2', restaurantId: 'seed-starbucks', name: 'Iced Caramel Macchiato (Grande)', category: 'Drinks', servingSize: '16 oz', calories: 250, proteinG: 10, carbsG: 34, fatG: 7, fiberG: 0, sodiumMg: 150 },
  { id: 'seed-mi-sbx-3', restaurantId: 'seed-starbucks', name: 'Bacon Gouda Sandwich', category: 'Food', servingSize: '1 sandwich', calories: 370, proteinG: 18, carbsG: 34, fatG: 18, fiberG: 1, sodiumMg: 790 },
  { id: 'seed-mi-sbx-4', restaurantId: 'seed-starbucks', name: 'Blueberry Muffin', category: 'Bakery', servingSize: '1 muffin', calories: 360, proteinG: 6, carbsG: 55, fatG: 13, fiberG: 2, sodiumMg: 340 },
  { id: 'seed-mi-sbx-5', restaurantId: 'seed-starbucks', name: 'Vanilla Sweet Cream Cold Brew (Grande)', category: 'Drinks', servingSize: '16 oz', calories: 200, proteinG: 2, carbsG: 28, fatG: 10, fiberG: 0, sodiumMg: 30 },
  // Subway
  { id: 'seed-mi-sub-1', restaurantId: 'seed-subway', name: 'Turkey Breast 6-inch', category: 'Subs', servingSize: '1 sub', calories: 280, proteinG: 18, carbsG: 42, fatG: 4, fiberG: 5, sodiumMg: 810 },
  { id: 'seed-mi-sub-2', restaurantId: 'seed-subway', name: 'Italian B.M.T. 6-inch', category: 'Subs', servingSize: '1 sub', calories: 400, proteinG: 20, carbsG: 44, fatG: 16, fiberG: 5, sodiumMg: 1290 },
  { id: 'seed-mi-sub-3', restaurantId: 'seed-subway', name: 'Meatball Marinara 6-inch', category: 'Subs', servingSize: '1 sub', calories: 480, proteinG: 22, carbsG: 53, fatG: 20, fiberG: 5, sodiumMg: 1070 },
  { id: 'seed-mi-sub-4', restaurantId: 'seed-subway', name: 'Chicken Teriyaki 6-inch', category: 'Subs', servingSize: '1 sub', calories: 370, proteinG: 26, carbsG: 52, fatG: 6, fiberG: 5, sodiumMg: 910 },
  { id: 'seed-mi-sub-5', restaurantId: 'seed-subway', name: 'Veggie Delite 6-inch', category: 'Subs', servingSize: '1 sub', calories: 200, proteinG: 8, carbsG: 39, fatG: 2, fiberG: 5, sodiumMg: 360 },
  // Chick-fil-A
  { id: 'seed-mi-cfa-1', restaurantId: 'seed-chickfila', name: 'Chicken Sandwich', category: 'Sandwiches', servingSize: '1 sandwich', calories: 440, proteinG: 28, carbsG: 40, fatG: 19, fiberG: 1, sodiumMg: 1400 },
  { id: 'seed-mi-cfa-2', restaurantId: 'seed-chickfila', name: 'Spicy Chicken Sandwich', category: 'Sandwiches', servingSize: '1 sandwich', calories: 450, proteinG: 28, carbsG: 42, fatG: 19, fiberG: 2, sodiumMg: 1620 },
  { id: 'seed-mi-cfa-3', restaurantId: 'seed-chickfila', name: 'Nuggets (8-count)', category: 'Entrees', servingSize: '8 nuggets', calories: 250, proteinG: 27, carbsG: 11, fatG: 11, fiberG: 0, sodiumMg: 1090 },
  { id: 'seed-mi-cfa-4', restaurantId: 'seed-chickfila', name: 'Waffle Fries (Medium)', category: 'Sides', servingSize: '1 medium', calories: 420, proteinG: 5, carbsG: 47, fatG: 24, fiberG: 5, sodiumMg: 240 },
  { id: 'seed-mi-cfa-5', restaurantId: 'seed-chickfila', name: 'Cobb Salad', category: 'Salads', servingSize: '1 salad', calories: 510, proteinG: 40, carbsG: 28, fatG: 27, fiberG: 5, sodiumMg: 1310 },
  // Taco Bell
  { id: 'seed-mi-tb-1', restaurantId: 'seed-tacobell', name: 'Crunchy Taco', category: 'Tacos', servingSize: '1 taco', calories: 170, proteinG: 8, carbsG: 13, fatG: 10, fiberG: 3, sodiumMg: 310 },
  { id: 'seed-mi-tb-2', restaurantId: 'seed-tacobell', name: 'Crunchwrap Supreme', category: 'Specialties', servingSize: '1 wrap', calories: 530, proteinG: 16, carbsG: 71, fatG: 21, fiberG: 4, sodiumMg: 1100 },
  { id: 'seed-mi-tb-3', restaurantId: 'seed-tacobell', name: 'Bean Burrito', category: 'Burritos', servingSize: '1 burrito', calories: 380, proteinG: 14, carbsG: 55, fatG: 11, fiberG: 8, sodiumMg: 1050 },
  { id: 'seed-mi-tb-4', restaurantId: 'seed-tacobell', name: 'Chicken Quesadilla', category: 'Specialties', servingSize: '1 quesadilla', calories: 510, proteinG: 26, carbsG: 39, fatG: 27, fiberG: 2, sodiumMg: 1250 },
  { id: 'seed-mi-tb-5', restaurantId: 'seed-tacobell', name: 'Nachos BellGrande', category: 'Specialties', servingSize: '1 order', calories: 740, proteinG: 16, carbsG: 81, fatG: 38, fiberG: 8, sodiumMg: 1050 },
  // Wendy's
  { id: 'seed-mi-wen-1', restaurantId: 'seed-wendys', name: "Dave's Single", category: 'Burgers', servingSize: '1 burger', calories: 570, proteinG: 30, carbsG: 39, fatG: 34, fiberG: 2, sodiumMg: 1110 },
  { id: 'seed-mi-wen-2', restaurantId: 'seed-wendys', name: 'Spicy Chicken Sandwich', category: 'Chicken', servingSize: '1 sandwich', calories: 500, proteinG: 29, carbsG: 47, fatG: 22, fiberG: 2, sodiumMg: 1370 },
  { id: 'seed-mi-wen-3', restaurantId: 'seed-wendys', name: 'Baconator', category: 'Burgers', servingSize: '1 burger', calories: 950, proteinG: 57, carbsG: 39, fatG: 62, fiberG: 2, sodiumMg: 1740 },
  { id: 'seed-mi-wen-4', restaurantId: 'seed-wendys', name: 'Medium French Fries', category: 'Sides', servingSize: '1 medium', calories: 350, proteinG: 5, carbsG: 47, fatG: 16, fiberG: 5, sodiumMg: 390 },
  { id: 'seed-mi-wen-5', restaurantId: 'seed-wendys', name: 'Apple Pecan Chicken Salad', category: 'Salads', servingSize: '1 salad', calories: 560, proteinG: 38, carbsG: 37, fatG: 27, fiberG: 6, sodiumMg: 1030 },
  // Panera
  { id: 'seed-mi-pan-1', restaurantId: 'seed-panera', name: 'Broccoli Cheddar Soup (Bowl)', category: 'Soups', servingSize: '1 bowl', calories: 360, proteinG: 14, carbsG: 29, fatG: 21, fiberG: 6, sodiumMg: 1190 },
  { id: 'seed-mi-pan-2', restaurantId: 'seed-panera', name: 'Bacon Turkey Bravo', category: 'Sandwiches', servingSize: '1 sandwich', calories: 600, proteinG: 31, carbsG: 55, fatG: 28, fiberG: 3, sodiumMg: 1550 },
  { id: 'seed-mi-pan-3', restaurantId: 'seed-panera', name: 'Caesar Salad', category: 'Salads', servingSize: '1 salad', calories: 330, proteinG: 10, carbsG: 22, fatG: 23, fiberG: 3, sodiumMg: 630 },
  { id: 'seed-mi-pan-4', restaurantId: 'seed-panera', name: 'Mac and Cheese (Bowl)', category: 'Soups', servingSize: '1 bowl', calories: 590, proteinG: 22, carbsG: 55, fatG: 30, fiberG: 2, sodiumMg: 1490 },
  { id: 'seed-mi-pan-5', restaurantId: 'seed-panera', name: 'Mediterranean Veggie Sandwich', category: 'Sandwiches', servingSize: '1 sandwich', calories: 520, proteinG: 15, carbsG: 57, fatG: 27, fiberG: 5, sodiumMg: 1240 },
  // Panda Express
  { id: 'seed-mi-pe-1', restaurantId: 'seed-pandaexpress', name: 'Orange Chicken', category: 'Entrees', servingSize: '5.7 oz', calories: 490, proteinG: 25, carbsG: 51, fatG: 23, fiberG: 0, sodiumMg: 820 },
  { id: 'seed-mi-pe-2', restaurantId: 'seed-pandaexpress', name: 'Beijing Beef', category: 'Entrees', servingSize: '5.6 oz', calories: 470, proteinG: 14, carbsG: 56, fatG: 22, fiberG: 2, sodiumMg: 660 },
  { id: 'seed-mi-pe-3', restaurantId: 'seed-pandaexpress', name: 'Fried Rice', category: 'Sides', servingSize: '9.3 oz', calories: 520, proteinG: 11, carbsG: 85, fatG: 16, fiberG: 1, sodiumMg: 850 },
  { id: 'seed-mi-pe-4', restaurantId: 'seed-pandaexpress', name: 'Chow Mein', category: 'Sides', servingSize: '9.4 oz', calories: 510, proteinG: 13, carbsG: 80, fatG: 16, fiberG: 4, sodiumMg: 860 },
  { id: 'seed-mi-pe-5', restaurantId: 'seed-pandaexpress', name: 'Kung Pao Chicken', category: 'Entrees', servingSize: '5.6 oz', calories: 290, proteinG: 19, carbsG: 14, fatG: 19, fiberG: 2, sodiumMg: 870 },
  // In-N-Out
  { id: 'seed-mi-ino-1', restaurantId: 'seed-innout', name: 'Double-Double', category: 'Burgers', servingSize: '1 burger', calories: 670, proteinG: 37, carbsG: 39, fatG: 41, fiberG: 3, sodiumMg: 1440 },
  { id: 'seed-mi-ino-2', restaurantId: 'seed-innout', name: 'Cheeseburger', category: 'Burgers', servingSize: '1 burger', calories: 480, proteinG: 22, carbsG: 39, fatG: 27, fiberG: 3, sodiumMg: 1000 },
  { id: 'seed-mi-ino-3', restaurantId: 'seed-innout', name: 'French Fries', category: 'Sides', servingSize: '1 order', calories: 395, proteinG: 7, carbsG: 54, fatG: 18, fiberG: 2, sodiumMg: 245 },
  { id: 'seed-mi-ino-4', restaurantId: 'seed-innout', name: 'Protein Style Burger', category: 'Burgers', servingSize: '1 burger', calories: 240, proteinG: 13, carbsG: 11, fatG: 17, fiberG: 3, sodiumMg: 370 },
  { id: 'seed-mi-ino-5', restaurantId: 'seed-innout', name: 'Vanilla Shake', category: 'Drinks', servingSize: '15 oz', calories: 580, proteinG: 9, carbsG: 72, fatG: 29, fiberG: 0, sodiumMg: 350 },
  // Five Guys
  { id: 'seed-mi-fg-1', restaurantId: 'seed-fiveguys', name: 'Cheeseburger', category: 'Burgers', servingSize: '1 burger', calories: 840, proteinG: 47, carbsG: 40, fatG: 55, fiberG: 2, sodiumMg: 1050 },
  { id: 'seed-mi-fg-2', restaurantId: 'seed-fiveguys', name: 'Little Hamburger', category: 'Burgers', servingSize: '1 burger', calories: 480, proteinG: 23, carbsG: 39, fatG: 26, fiberG: 2, sodiumMg: 380 },
  { id: 'seed-mi-fg-3', restaurantId: 'seed-fiveguys', name: 'Regular Fries', category: 'Sides', servingSize: '1 regular', calories: 530, proteinG: 8, carbsG: 60, fatG: 30, fiberG: 5, sodiumMg: 530 },
  { id: 'seed-mi-fg-4', restaurantId: 'seed-fiveguys', name: 'Hot Dog', category: 'Hot Dogs', servingSize: '1 hot dog', calories: 545, proteinG: 18, carbsG: 40, fatG: 35, fiberG: 2, sodiumMg: 1130 },
  { id: 'seed-mi-fg-5', restaurantId: 'seed-fiveguys', name: 'Veggie Sandwich', category: 'Sandwiches', servingSize: '1 sandwich', calories: 440, proteinG: 16, carbsG: 60, fatG: 15, fiberG: 5, sodiumMg: 1040 },
  // Shake Shack
  { id: 'seed-mi-ss-1', restaurantId: 'seed-shakeshack', name: 'ShackBurger', category: 'Burgers', servingSize: '1 burger', calories: 530, proteinG: 28, carbsG: 27, fatG: 34, fiberG: 0, sodiumMg: 1280 },
  { id: 'seed-mi-ss-2', restaurantId: 'seed-shakeshack', name: 'SmokeShack', category: 'Burgers', servingSize: '1 burger', calories: 610, proteinG: 30, carbsG: 28, fatG: 39, fiberG: 0, sodiumMg: 1550 },
  { id: 'seed-mi-ss-3', restaurantId: 'seed-shakeshack', name: 'Chicken Shack', category: 'Chicken', servingSize: '1 sandwich', calories: 580, proteinG: 28, carbsG: 55, fatG: 27, fiberG: 3, sodiumMg: 1190 },
  { id: 'seed-mi-ss-4', restaurantId: 'seed-shakeshack', name: 'Crinkle Cut Fries', category: 'Sides', servingSize: '1 order', calories: 470, proteinG: 7, carbsG: 63, fatG: 22, fiberG: 5, sodiumMg: 890 },
  { id: 'seed-mi-ss-5', restaurantId: 'seed-shakeshack', name: 'Vanilla Shake', category: 'Shakes', servingSize: '1 shake', calories: 640, proteinG: 11, carbsG: 80, fatG: 31, fiberG: 0, sodiumMg: 260 },
  // Sweetgreen
  { id: 'seed-mi-sg-1', restaurantId: 'seed-sweetgreen', name: 'Harvest Bowl', category: 'Bowls', servingSize: '1 bowl', calories: 705, proteinG: 27, carbsG: 63, fatG: 38, fiberG: 9, sodiumMg: 710 },
  { id: 'seed-mi-sg-2', restaurantId: 'seed-sweetgreen', name: 'Kale Caesar', category: 'Salads', servingSize: '1 salad', calories: 470, proteinG: 18, carbsG: 33, fatG: 30, fiberG: 5, sodiumMg: 780 },
  { id: 'seed-mi-sg-3', restaurantId: 'seed-sweetgreen', name: 'Guacamole Greens', category: 'Salads', servingSize: '1 salad', calories: 555, proteinG: 19, carbsG: 44, fatG: 34, fiberG: 10, sodiumMg: 620 },
  { id: 'seed-mi-sg-4', restaurantId: 'seed-sweetgreen', name: 'Shroomami', category: 'Bowls', servingSize: '1 bowl', calories: 520, proteinG: 16, carbsG: 58, fatG: 25, fiberG: 7, sodiumMg: 550 },
  { id: 'seed-mi-sg-5', restaurantId: 'seed-sweetgreen', name: 'Crispy Rice Bowl', category: 'Bowls', servingSize: '1 bowl', calories: 650, proteinG: 22, carbsG: 72, fatG: 30, fiberG: 6, sodiumMg: 810 },
  // Popeyes
  { id: 'seed-mi-pop-1', restaurantId: 'seed-popeyes', name: 'Chicken Sandwich', category: 'Sandwiches', servingSize: '1 sandwich', calories: 700, proteinG: 28, carbsG: 50, fatG: 42, fiberG: 2, sodiumMg: 1440 },
  { id: 'seed-mi-pop-2', restaurantId: 'seed-popeyes', name: 'Spicy Chicken (2 pc)', category: 'Chicken', servingSize: '2 pieces', calories: 530, proteinG: 37, carbsG: 14, fatG: 36, fiberG: 1, sodiumMg: 1560 },
  { id: 'seed-mi-pop-3', restaurantId: 'seed-popeyes', name: 'Cajun Fries (Regular)', category: 'Sides', servingSize: '1 regular', calories: 260, proteinG: 3, carbsG: 34, fatG: 14, fiberG: 3, sodiumMg: 680 },
  { id: 'seed-mi-pop-4', restaurantId: 'seed-popeyes', name: 'Red Beans and Rice', category: 'Sides', servingSize: '1 regular', calories: 230, proteinG: 7, carbsG: 26, fatG: 11, fiberG: 6, sodiumMg: 720 },
  { id: 'seed-mi-pop-5', restaurantId: 'seed-popeyes', name: 'Chicken Tenders (3 pc)', category: 'Chicken', servingSize: '3 tenders', calories: 410, proteinG: 22, carbsG: 25, fatG: 24, fiberG: 1, sodiumMg: 1230 },
  // Domino's
  { id: 'seed-mi-dom-1', restaurantId: 'seed-dominos', name: 'Pepperoni Pizza (2 slices, Medium)', category: 'Pizza', servingSize: '2 slices', calories: 440, proteinG: 18, carbsG: 52, fatG: 18, fiberG: 2, sodiumMg: 1020 },
  { id: 'seed-mi-dom-2', restaurantId: 'seed-dominos', name: 'Cheese Pizza (2 slices, Medium)', category: 'Pizza', servingSize: '2 slices', calories: 400, proteinG: 16, carbsG: 50, fatG: 14, fiberG: 2, sodiumMg: 840 },
  { id: 'seed-mi-dom-3', restaurantId: 'seed-dominos', name: 'Breadsticks (8 pc)', category: 'Sides', servingSize: '8 sticks', calories: 580, proteinG: 14, carbsG: 94, fatG: 16, fiberG: 3, sodiumMg: 700 },
  { id: 'seed-mi-dom-4', restaurantId: 'seed-dominos', name: 'Boneless Chicken Wings (8 pc)', category: 'Wings', servingSize: '8 pieces', calories: 560, proteinG: 28, carbsG: 52, fatG: 26, fiberG: 2, sodiumMg: 1800 },
  { id: 'seed-mi-dom-5', restaurantId: 'seed-dominos', name: 'Pasta Primavera (Bowl)', category: 'Pasta', servingSize: '1 bowl', calories: 680, proteinG: 22, carbsG: 85, fatG: 28, fiberG: 5, sodiumMg: 1120 },
  // Pizza Hut
  { id: 'seed-mi-ph-1', restaurantId: 'seed-pizzahut', name: 'Pepperoni Pan Pizza (2 slices, Medium)', category: 'Pizza', servingSize: '2 slices', calories: 480, proteinG: 18, carbsG: 52, fatG: 22, fiberG: 2, sodiumMg: 1100 },
  { id: 'seed-mi-ph-2', restaurantId: 'seed-pizzahut', name: 'Meat Lovers Pan Pizza (2 slices, Medium)', category: 'Pizza', servingSize: '2 slices', calories: 580, proteinG: 24, carbsG: 52, fatG: 30, fiberG: 2, sodiumMg: 1340 },
  { id: 'seed-mi-ph-3', restaurantId: 'seed-pizzahut', name: 'Veggie Lovers Thin Crust (2 slices, Medium)', category: 'Pizza', servingSize: '2 slices', calories: 340, proteinG: 14, carbsG: 34, fatG: 16, fiberG: 3, sodiumMg: 780 },
  { id: 'seed-mi-ph-4', restaurantId: 'seed-pizzahut', name: 'Breadsticks (5 pc)', category: 'Sides', servingSize: '5 sticks', calories: 500, proteinG: 14, carbsG: 76, fatG: 16, fiberG: 3, sodiumMg: 890 },
  { id: 'seed-mi-ph-5', restaurantId: 'seed-pizzahut', name: 'WingStreet Boneless (8 pc)', category: 'Wings', servingSize: '8 pieces', calories: 640, proteinG: 32, carbsG: 54, fatG: 32, fiberG: 2, sodiumMg: 2000 },
  // Dunkin'
  { id: 'seed-mi-dun-1', restaurantId: 'seed-dunkin', name: 'Glazed Donut', category: 'Donuts', servingSize: '1 donut', calories: 240, proteinG: 3, carbsG: 31, fatG: 11, fiberG: 1, sodiumMg: 330 },
  { id: 'seed-mi-dun-2', restaurantId: 'seed-dunkin', name: 'Medium Iced Coffee (Cream + Sugar)', category: 'Drinks', servingSize: '24 oz', calories: 170, proteinG: 2, carbsG: 29, fatG: 6, fiberG: 0, sodiumMg: 60 },
  { id: 'seed-mi-dun-3', restaurantId: 'seed-dunkin', name: 'Bacon Egg Cheese on Croissant', category: 'Breakfast', servingSize: '1 sandwich', calories: 510, proteinG: 18, carbsG: 37, fatG: 33, fiberG: 1, sodiumMg: 990 },
  { id: 'seed-mi-dun-4', restaurantId: 'seed-dunkin', name: 'Hash Browns (6 pc)', category: 'Sides', servingSize: '6 pieces', calories: 360, proteinG: 3, carbsG: 27, fatG: 27, fiberG: 4, sodiumMg: 690 },
  { id: 'seed-mi-dun-5', restaurantId: 'seed-dunkin', name: 'Medium Latte', category: 'Drinks', servingSize: '14 oz', calories: 120, proteinG: 8, carbsG: 12, fatG: 5, fiberG: 0, sodiumMg: 130 },
  // Wingstop
  { id: 'seed-mi-ws-1', restaurantId: 'seed-wingstop', name: 'Classic Wings (10 pc, Plain)', category: 'Wings', servingSize: '10 wings', calories: 730, proteinG: 56, carbsG: 0, fatG: 56, fiberG: 0, sodiumMg: 1940 },
  { id: 'seed-mi-ws-2', restaurantId: 'seed-wingstop', name: 'Boneless Wings (8 pc, Plain)', category: 'Wings', servingSize: '8 pieces', calories: 540, proteinG: 38, carbsG: 42, fatG: 24, fiberG: 2, sodiumMg: 1520 },
  { id: 'seed-mi-ws-3', restaurantId: 'seed-wingstop', name: 'Cajun Fried Corn', category: 'Sides', servingSize: '1 order', calories: 220, proteinG: 5, carbsG: 29, fatG: 11, fiberG: 2, sodiumMg: 420 },
  { id: 'seed-mi-ws-4', restaurantId: 'seed-wingstop', name: 'Seasoned Fries', category: 'Sides', servingSize: '1 regular', calories: 330, proteinG: 5, carbsG: 52, fatG: 12, fiberG: 4, sodiumMg: 590 },
  { id: 'seed-mi-ws-5', restaurantId: 'seed-wingstop', name: 'Ranch Dip', category: 'Sauces', servingSize: '1 oz', calories: 160, proteinG: 1, carbsG: 2, fatG: 17, fiberG: 0, sodiumMg: 260 },
  // CAVA
  { id: 'seed-mi-cav-1', restaurantId: 'seed-cava', name: 'Greens + Grains Bowl', category: 'Bowls', servingSize: '1 bowl', calories: 620, proteinG: 32, carbsG: 58, fatG: 28, fiberG: 8, sodiumMg: 720 },
  { id: 'seed-mi-cav-2', restaurantId: 'seed-cava', name: 'Grilled Chicken Pita', category: 'Pitas', servingSize: '1 pita', calories: 510, proteinG: 28, carbsG: 52, fatG: 20, fiberG: 4, sodiumMg: 880 },
  { id: 'seed-mi-cav-3', restaurantId: 'seed-cava', name: 'Crazy Feta Dip', category: 'Dips', servingSize: '2 oz', calories: 110, proteinG: 3, carbsG: 3, fatG: 10, fiberG: 0, sodiumMg: 310 },
  { id: 'seed-mi-cav-4', restaurantId: 'seed-cava', name: 'Braised Lamb Bowl', category: 'Bowls', servingSize: '1 bowl', calories: 710, proteinG: 38, carbsG: 55, fatG: 35, fiberG: 7, sodiumMg: 950 },
  { id: 'seed-mi-cav-5', restaurantId: 'seed-cava', name: 'Harissa Honey Chicken Bowl', category: 'Bowls', servingSize: '1 bowl', calories: 580, proteinG: 30, carbsG: 62, fatG: 22, fiberG: 6, sodiumMg: 820 },
  // Raising Cane's
  { id: 'seed-mi-rc-1', restaurantId: 'seed-canes', name: 'The Box Combo', category: 'Combos', servingSize: '1 combo', calories: 1250, proteinG: 44, carbsG: 121, fatG: 64, fiberG: 4, sodiumMg: 2400 },
  { id: 'seed-mi-rc-2', restaurantId: 'seed-canes', name: 'Chicken Fingers (3 pc)', category: 'Chicken', servingSize: '3 fingers', calories: 380, proteinG: 25, carbsG: 18, fatG: 23, fiberG: 0, sodiumMg: 980 },
  { id: 'seed-mi-rc-3', restaurantId: 'seed-canes', name: "Cane's Sauce", category: 'Sauces', servingSize: '1 oz', calories: 190, proteinG: 0, carbsG: 7, fatG: 18, fiberG: 0, sodiumMg: 260 },
  { id: 'seed-mi-rc-4', restaurantId: 'seed-canes', name: 'Crinkle Cut Fries', category: 'Sides', servingSize: '1 order', calories: 290, proteinG: 4, carbsG: 38, fatG: 14, fiberG: 3, sodiumMg: 140 },
  { id: 'seed-mi-rc-5', restaurantId: 'seed-canes', name: 'Texas Toast', category: 'Sides', servingSize: '1 slice', calories: 150, proteinG: 4, carbsG: 19, fatG: 7, fiberG: 1, sodiumMg: 230 },
];

function escapeSQL(str: string): string {
  return str.replace(/'/g, "''");
}

export function getRestaurantSeedInserts(): string[] {
  const inserts: string[] = [];

  for (const r of RESTAURANTS) {
    inserts.push(
      `INSERT OR IGNORE INTO nu_restaurants (id, name, category, chain, logo_emoji, website, source, verified) VALUES ('${escapeSQL(r.id)}', '${escapeSQL(r.name)}', '${escapeSQL(r.category)}', ${r.chain}, '${escapeSQL(r.logoEmoji)}', '${escapeSQL(r.website)}', 'seed', 1)`,
    );
  }

  for (const m of MENU_ITEMS) {
    inserts.push(
      `INSERT OR IGNORE INTO nu_menu_items (id, restaurant_id, name, category, serving_size, calories, protein_g, carbs_g, fat_g, fiber_g, sodium_mg, source, verified) VALUES ('${escapeSQL(m.id)}', '${escapeSQL(m.restaurantId)}', '${escapeSQL(m.name)}', '${escapeSQL(m.category)}', '${escapeSQL(m.servingSize)}', ${m.calories}, ${m.proteinG}, ${m.carbsG}, ${m.fatG}, ${m.fiberG}, ${m.sodiumMg}, 'seed', 1)`,
    );
  }

  // Populate FTS tables from seed data
  for (const r of RESTAURANTS) {
    inserts.push(
      `INSERT OR IGNORE INTO nu_restaurants_fts(rowid, name) SELECT rowid, name FROM nu_restaurants WHERE id = '${escapeSQL(r.id)}'`,
    );
  }

  for (const m of MENU_ITEMS) {
    inserts.push(
      `INSERT OR IGNORE INTO nu_menu_items_fts(rowid, name, description, category) SELECT rowid, name, description, category FROM nu_menu_items WHERE id = '${escapeSQL(m.id)}'`,
    );
  }

  return inserts;
}
