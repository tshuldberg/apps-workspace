export interface DinerExportData {
  profile: { name: string; email: string; phone?: string };
  reservations: Array<{ restaurantName: string; date: string; partySize: number; status: string }>;
  preferences: Record<string, unknown>;
  allergens: string[];
  exportedAt: string;
  format: 'json' | 'csv';
}

export type SustainabilityTag = 'woman_owned' | 'bipoc_owned' | 'farm_direct' | 'zero_waste' | 'vegan_first' | 'halal' | 'gluten_free_kitchen';

export const SUSTAINABILITY_TAGS: { id: SustainabilityTag; label: string; icon: string }[] = [
  { id: 'woman_owned', label: 'Woman-Owned', icon: '\u2640' },
  { id: 'bipoc_owned', label: 'BIPOC-Owned', icon: '\u270A' },
  { id: 'farm_direct', label: 'Farm-Direct', icon: '\uD83C\uDF31' },
  { id: 'zero_waste', label: 'Zero Waste', icon: '\u267B' },
  { id: 'vegan_first', label: 'Vegan-First', icon: '\uD83C\uDF3F' },
  { id: 'halal', label: 'Halal Certified', icon: '\u262A' },
  { id: 'gluten_free_kitchen', label: 'Gluten-Free Kitchen', icon: '\uD83C\uDF3E' },
];
