// Default built-in packing list templates for common trail activities.

export interface DefaultTemplateItem {
  name: string;
  category: string;
}

export interface DefaultTemplate {
  name: string;
  type: string;
  items: DefaultTemplateItem[];
}

export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  {
    name: 'Day Hike',
    type: 'day_hike',
    items: [
      // essentials
      { name: 'Backpack', category: 'essentials' },
      { name: 'Phone (charged)', category: 'essentials' },
      { name: 'ID / park pass', category: 'essentials' },
      { name: 'Sunscreen', category: 'essentials' },
      { name: 'Sunglasses', category: 'essentials' },
      // clothing
      { name: 'Hiking boots', category: 'clothing' },
      { name: 'Moisture-wicking shirt', category: 'clothing' },
      { name: 'Light jacket', category: 'clothing' },
      { name: 'Hat', category: 'clothing' },
      // food_water
      { name: 'Water (2L)', category: 'food_water' },
      { name: 'Snacks / trail mix', category: 'food_water' },
      { name: 'Lunch', category: 'food_water' },
      // navigation
      { name: 'Trail map', category: 'navigation' },
      { name: 'Compass', category: 'navigation' },
      // safety
      { name: 'First aid kit', category: 'safety' },
      { name: 'Whistle', category: 'safety' },
      { name: 'Headlamp', category: 'safety' },
    ],
  },
  {
    name: 'Overnight',
    type: 'overnight',
    items: [
      // essentials
      { name: 'Backpack (40-50L)', category: 'essentials' },
      { name: 'Phone (charged)', category: 'essentials' },
      { name: 'Permit / reservation', category: 'essentials' },
      { name: 'Sunscreen', category: 'essentials' },
      // clothing
      { name: 'Hiking boots', category: 'clothing' },
      { name: 'Extra socks', category: 'clothing' },
      { name: 'Insulating layer', category: 'clothing' },
      { name: 'Rain jacket', category: 'clothing' },
      { name: 'Sleep clothes', category: 'clothing' },
      // food_water
      { name: 'Water (3L)', category: 'food_water' },
      { name: 'Water filter', category: 'food_water' },
      { name: 'Meals (dinner + breakfast)', category: 'food_water' },
      { name: 'Snacks', category: 'food_water' },
      { name: 'Stove + fuel', category: 'food_water' },
      // navigation
      { name: 'Trail map', category: 'navigation' },
      { name: 'Compass', category: 'navigation' },
      { name: 'GPS device', category: 'navigation' },
      // safety
      { name: 'First aid kit', category: 'safety' },
      { name: 'Headlamp + extra batteries', category: 'safety' },
      { name: 'Bear canister / hang bag', category: 'safety' },
      // shelter
      { name: 'Tent', category: 'shelter' },
      { name: 'Sleeping bag', category: 'shelter' },
      { name: 'Sleeping pad', category: 'shelter' },
    ],
  },
  {
    name: 'Backpacking',
    type: 'backpacking',
    items: [
      // essentials
      { name: 'Backpack (60-70L)', category: 'essentials' },
      { name: 'Phone + battery bank', category: 'essentials' },
      { name: 'Permits', category: 'essentials' },
      { name: 'Sunscreen', category: 'essentials' },
      { name: 'Trekking poles', category: 'essentials' },
      // clothing
      { name: 'Hiking boots (broken in)', category: 'clothing' },
      { name: 'Camp shoes', category: 'clothing' },
      { name: 'Multiple socks', category: 'clothing' },
      { name: 'Base layer', category: 'clothing' },
      { name: 'Insulating layer', category: 'clothing' },
      { name: 'Rain shell', category: 'clothing' },
      { name: 'Warm hat + gloves', category: 'clothing' },
      // food_water
      { name: 'Water (3L capacity)', category: 'food_water' },
      { name: 'Water filter', category: 'food_water' },
      { name: 'Meals (all days)', category: 'food_water' },
      { name: 'Snacks', category: 'food_water' },
      { name: 'Stove + fuel canister', category: 'food_water' },
      { name: 'Utensils + pot', category: 'food_water' },
      // navigation
      { name: 'Topographic map', category: 'navigation' },
      { name: 'Compass', category: 'navigation' },
      { name: 'GPS device / app', category: 'navigation' },
      // safety
      { name: 'First aid kit (extended)', category: 'safety' },
      { name: 'Headlamp + spare batteries', category: 'safety' },
      { name: 'Bear canister', category: 'safety' },
      { name: 'Emergency shelter / bivy', category: 'safety' },
      { name: 'Knife / multi-tool', category: 'safety' },
      // shelter
      { name: 'Tent / tarp', category: 'shelter' },
      { name: 'Sleeping bag (rated)', category: 'shelter' },
      { name: 'Sleeping pad', category: 'shelter' },
      { name: 'Stuff sack / pillow', category: 'shelter' },
    ],
  },
  {
    name: 'Winter Hike',
    type: 'winter',
    items: [
      // essentials
      { name: 'Insulated backpack', category: 'essentials' },
      { name: 'Phone (keep warm)', category: 'essentials' },
      { name: 'Trekking poles', category: 'essentials' },
      // clothing
      { name: 'Insulated hiking boots', category: 'clothing' },
      { name: 'Wool socks', category: 'clothing' },
      { name: 'Base layer (top + bottom)', category: 'clothing' },
      { name: 'Mid layer (fleece)', category: 'clothing' },
      { name: 'Insulated jacket', category: 'clothing' },
      { name: 'Waterproof shell', category: 'clothing' },
      { name: 'Warm hat / balaclava', category: 'clothing' },
      { name: 'Insulated gloves', category: 'clothing' },
      { name: 'Gaiters', category: 'clothing' },
      // food_water
      { name: 'Insulated water bottle', category: 'food_water' },
      { name: 'Hot drink in thermos', category: 'food_water' },
      { name: 'High-calorie snacks', category: 'food_water' },
      // navigation
      { name: 'Trail map', category: 'navigation' },
      { name: 'Compass', category: 'navigation' },
      { name: 'Microspikes / crampons', category: 'navigation' },
      // safety
      { name: 'First aid kit', category: 'safety' },
      { name: 'Headlamp', category: 'safety' },
      { name: 'Hand warmers', category: 'safety' },
      { name: 'Emergency blanket', category: 'safety' },
      { name: 'Avalanche beacon (if needed)', category: 'safety' },
    ],
  },
  {
    name: 'Trail Run',
    type: 'trail_run',
    items: [
      // essentials
      { name: 'Running vest / belt', category: 'essentials' },
      { name: 'Phone', category: 'essentials' },
      { name: 'Sunscreen', category: 'essentials' },
      // clothing
      { name: 'Trail running shoes', category: 'clothing' },
      { name: 'Running socks', category: 'clothing' },
      { name: 'Moisture-wicking shirt', category: 'clothing' },
      { name: 'Running shorts', category: 'clothing' },
      { name: 'Light windbreaker', category: 'clothing' },
      { name: 'Cap / visor', category: 'clothing' },
      // food_water
      { name: 'Water (500ml-1L)', category: 'food_water' },
      { name: 'Energy gels', category: 'food_water' },
      { name: 'Electrolyte tabs', category: 'food_water' },
      // navigation
      { name: 'Route downloaded to watch/phone', category: 'navigation' },
      // safety
      { name: 'Whistle', category: 'safety' },
      { name: 'ID band / card', category: 'safety' },
    ],
  },
];
