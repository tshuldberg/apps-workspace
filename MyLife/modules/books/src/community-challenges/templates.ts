export const PRESET_IDS = [
  'cc_monthly_5',
  'cc_monthly_1000',
  'cc_quarterly_15',
  'cc_yearly_52',
  'cc_yearly_100',
  'cc_genre_5',
  'cc_genre_10',
  'cc_author_10',
  'cc_author_25',
  'cc_themed_scifi',
  'cc_themed_classic',
  'cc_themed_diverse',
] as const;

export type PresetId = typeof PRESET_IDS[number];
