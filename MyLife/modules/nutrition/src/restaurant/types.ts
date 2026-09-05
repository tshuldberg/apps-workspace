export type RestaurantCategory =
  | 'fast_food'
  | 'casual'
  | 'fine_dining'
  | 'cafe'
  | 'pizza'
  | 'asian'
  | 'mexican'
  | 'other';

export type RestaurantSource = 'seed' | 'user' | 'api';

export type MenuItemSource = 'seed' | 'user' | 'official';

export interface Restaurant {
  id: string;
  name: string;
  category: RestaurantCategory;
  chain: boolean;
  logoEmoji: string | null;
  logoUri: string | null;
  website: string | null;
  source: RestaurantSource;
  verified: boolean;
  createdAt: string;
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  name: string;
  description: string | null;
  category: string | null;
  servingSize: string | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sodiumMg: number;
  source: MenuItemSource;
  verified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RestaurantWithCount extends Restaurant {
  menuItemCount: number;
}

export interface RestaurantVisitStats {
  visitCount: number;
  averageCalories: number;
  lastFiveAverageCalories: number;
}
