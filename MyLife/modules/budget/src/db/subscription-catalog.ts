/**
 * Pre-populated subscription catalog for MyBudget hub module.
 * Prices are in cents (USD). Reflects typical US pricing as of 2026.
 */

import type { CatalogEntry } from '../types';

export const SUBSCRIPTION_CATALOG: readonly CatalogEntry[] = [
  // Entertainment
  { id: 'netflix-standard', name: 'Netflix Standard', defaultPrice: 1549, billingCycle: 'monthly', category: 'entertainment' },
  { id: 'netflix-premium', name: 'Netflix Premium', defaultPrice: 2299, billingCycle: 'monthly', category: 'entertainment' },
  { id: 'netflix-ads', name: 'Netflix Standard with Ads', defaultPrice: 799, billingCycle: 'monthly', category: 'entertainment' },
  { id: 'spotify-premium', name: 'Spotify Premium', defaultPrice: 1199, billingCycle: 'monthly', category: 'entertainment' },
  { id: 'spotify-family', name: 'Spotify Premium Family', defaultPrice: 1999, billingCycle: 'monthly', category: 'entertainment' },
  { id: 'youtube-premium', name: 'YouTube Premium', defaultPrice: 1399, billingCycle: 'monthly', category: 'entertainment' },
  { id: 'youtube-music', name: 'YouTube Music Premium', defaultPrice: 1099, billingCycle: 'monthly', category: 'entertainment' },
  { id: 'hulu-ads', name: 'Hulu (with Ads)', defaultPrice: 999, billingCycle: 'monthly', category: 'entertainment' },
  { id: 'hulu-no-ads', name: 'Hulu (No Ads)', defaultPrice: 1899, billingCycle: 'monthly', category: 'entertainment' },
  { id: 'disney-plus', name: 'Disney+', defaultPrice: 1399, billingCycle: 'monthly', category: 'entertainment' },
  { id: 'hbo-max', name: 'Max', defaultPrice: 1699, billingCycle: 'monthly', category: 'entertainment' },
  { id: 'apple-tv-plus', name: 'Apple TV+', defaultPrice: 999, billingCycle: 'monthly', category: 'entertainment' },
  { id: 'amazon-prime', name: 'Amazon Prime', defaultPrice: 14999, billingCycle: 'annual', category: 'shopping' },
  { id: 'peacock-premium', name: 'Peacock Premium', defaultPrice: 799, billingCycle: 'monthly', category: 'entertainment' },
  { id: 'paramount-plus', name: 'Paramount+', defaultPrice: 1299, billingCycle: 'monthly', category: 'entertainment' },
  { id: 'apple-music', name: 'Apple Music', defaultPrice: 1099, billingCycle: 'monthly', category: 'entertainment' },
  { id: 'audible', name: 'Audible', defaultPrice: 1495, billingCycle: 'monthly', category: 'entertainment' },
  { id: 'crunchyroll', name: 'Crunchyroll', defaultPrice: 799, billingCycle: 'monthly', category: 'entertainment' },
  { id: 'tidal', name: 'Tidal', defaultPrice: 1099, billingCycle: 'monthly', category: 'entertainment' },
  { id: 'xbox-game-pass', name: 'Xbox Game Pass Ultimate', defaultPrice: 1999, billingCycle: 'monthly', category: 'entertainment' },
  { id: 'ps-plus-essential', name: 'PlayStation Plus Essential', defaultPrice: 5999, billingCycle: 'annual', category: 'entertainment' },

  // Productivity
  { id: 'microsoft-365', name: 'Microsoft 365 Personal', defaultPrice: 6999, billingCycle: 'annual', category: 'productivity' },
  { id: 'google-one-100gb', name: 'Google One 100 GB', defaultPrice: 199, billingCycle: 'monthly', category: 'productivity' },
  { id: 'google-one-2tb', name: 'Google One 2 TB', defaultPrice: 999, billingCycle: 'monthly', category: 'productivity' },
  { id: 'icloud-50gb', name: 'iCloud+ 50 GB', defaultPrice: 99, billingCycle: 'monthly', category: 'productivity' },
  { id: 'icloud-200gb', name: 'iCloud+ 200 GB', defaultPrice: 299, billingCycle: 'monthly', category: 'productivity' },
  { id: 'icloud-2tb', name: 'iCloud+ 2 TB', defaultPrice: 999, billingCycle: 'monthly', category: 'productivity' },
  { id: 'dropbox-plus', name: 'Dropbox Plus', defaultPrice: 1199, billingCycle: 'monthly', category: 'productivity' },
  { id: 'notion', name: 'Notion Plus', defaultPrice: 1000, billingCycle: 'monthly', category: 'productivity' },
  { id: 'evernote', name: 'Evernote Personal', defaultPrice: 1499, billingCycle: 'monthly', category: 'productivity' },
  { id: '1password', name: '1Password', defaultPrice: 299, billingCycle: 'monthly', category: 'productivity' },
  { id: 'chatgpt-plus', name: 'ChatGPT Plus', defaultPrice: 2000, billingCycle: 'monthly', category: 'productivity' },
  { id: 'claude-pro', name: 'Claude Pro', defaultPrice: 2000, billingCycle: 'monthly', category: 'productivity' },
  { id: 'github-pro', name: 'GitHub Pro', defaultPrice: 400, billingCycle: 'monthly', category: 'productivity' },

  // Health & Fitness
  { id: 'peloton-membership', name: 'Peloton App', defaultPrice: 1299, billingCycle: 'monthly', category: 'health' },
  { id: 'strava-premium', name: 'Strava Premium', defaultPrice: 1199, billingCycle: 'monthly', category: 'health' },
  { id: 'headspace', name: 'Headspace', defaultPrice: 1299, billingCycle: 'monthly', category: 'health' },
  { id: 'calm', name: 'Calm', defaultPrice: 6999, billingCycle: 'annual', category: 'health' },
  { id: 'fitbod', name: 'Fitbod', defaultPrice: 1299, billingCycle: 'monthly', category: 'health' },
  { id: 'apple-fitness-plus', name: 'Apple Fitness+', defaultPrice: 999, billingCycle: 'monthly', category: 'health' },
  { id: 'gym-membership', name: 'Gym Membership (typical)', defaultPrice: 5000, billingCycle: 'monthly', category: 'health' },

  // News & Media
  { id: 'nyt-digital', name: 'New York Times Digital', defaultPrice: 1700, billingCycle: 'monthly', category: 'news' },
  { id: 'wsj', name: 'Wall Street Journal', defaultPrice: 3899, billingCycle: 'monthly', category: 'news' },
  { id: 'washington-post', name: 'Washington Post', defaultPrice: 1000, billingCycle: 'monthly', category: 'news' },
  { id: 'apple-news-plus', name: 'Apple News+', defaultPrice: 1299, billingCycle: 'monthly', category: 'news' },
  { id: 'medium', name: 'Medium', defaultPrice: 500, billingCycle: 'monthly', category: 'news' },

  // Utilities
  { id: 'nordvpn', name: 'NordVPN', defaultPrice: 1299, billingCycle: 'monthly', category: 'utilities' },
  { id: 'expressvpn', name: 'ExpressVPN', defaultPrice: 1299, billingCycle: 'monthly', category: 'utilities' },
  { id: 'adobe-cc', name: 'Adobe Creative Cloud', defaultPrice: 5999, billingCycle: 'monthly', category: 'utilities' },
  { id: 'canva-pro', name: 'Canva Pro', defaultPrice: 1299, billingCycle: 'monthly', category: 'utilities' },

  // Finance
  { id: 'ynab', name: 'YNAB', defaultPrice: 14999, billingCycle: 'annual', category: 'finance' },
];

const POPULAR_IDS = new Set([
  'netflix-standard', 'spotify-premium', 'youtube-premium', 'disney-plus',
  'hbo-max', 'amazon-prime', 'apple-music', 'chatgpt-plus', 'icloud-200gb',
  'microsoft-365', '1password', 'gym-membership', 'nyt-digital',
]);

export function searchCatalog(query: string): CatalogEntry[] {
  const q = query.toLowerCase().trim();
  if (q.length === 0) return [];

  const matches = SUBSCRIPTION_CATALOG.filter(
    (entry) =>
      entry.name.toLowerCase().includes(q) ||
      entry.id.includes(q),
  );

  return [...matches].sort((a, b) => {
    const aPrefix = a.name.toLowerCase().startsWith(q) ? 0 : 1;
    const bPrefix = b.name.toLowerCase().startsWith(q) ? 0 : 1;
    if (aPrefix !== bPrefix) return aPrefix - bPrefix;

    const aPopular = POPULAR_IDS.has(a.id) ? 0 : 1;
    const bPopular = POPULAR_IDS.has(b.id) ? 0 : 1;
    if (aPopular !== bPopular) return aPopular - bPopular;

    return a.name.localeCompare(b.name);
  });
}

export function getPopularEntries(): CatalogEntry[] {
  return SUBSCRIPTION_CATALOG
    .filter((entry) => POPULAR_IDS.has(entry.id))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function normalizeToMonthly(
  price: number,
  billingCycle: string,
  customDays?: number | null,
): number {
  switch (billingCycle) {
    case 'weekly':
      return Math.round((price * 52) / 12);
    case 'monthly':
      return price;
    case 'quarterly':
      return Math.round(price / 3);
    case 'semi_annual':
      return Math.round(price / 6);
    case 'annual':
      return Math.round(price / 12);
    case 'custom': {
      if (!customDays || customDays < 1) return price;
      return Math.round((price * (365 / customDays)) / 12);
    }
    default:
      return price;
  }
}

export function normalizeToAnnual(
  price: number,
  billingCycle: string,
  customDays?: number | null,
): number {
  switch (billingCycle) {
    case 'weekly':
      return Math.round(price * 52);
    case 'monthly':
      return Math.round(price * 12);
    case 'quarterly':
      return Math.round(price * 4);
    case 'semi_annual':
      return Math.round(price * 2);
    case 'annual':
      return price;
    case 'custom': {
      if (!customDays || customDays < 1) return price;
      return Math.round(price * (365 / customDays));
    }
    default:
      return price;
  }
}

export function calculateNextRenewal(
  startDate: string,
  billingCycle: string,
): string {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const [y, m, d] = startDate.split('-').map(Number);
  let renewal = new Date(y, m - 1, d);
  const anchorDay = renewal.getDate();

  while (formatDateIso(renewal) <= todayStr) {
    switch (billingCycle) {
      case 'weekly':
        renewal.setDate(renewal.getDate() + 7);
        break;
      case 'monthly':
        advanceMonths(renewal, 1, anchorDay);
        break;
      case 'quarterly':
        advanceMonths(renewal, 3, anchorDay);
        break;
      case 'semi_annual':
        advanceMonths(renewal, 6, anchorDay);
        break;
      case 'annual':
        advanceMonths(renewal, 12, anchorDay);
        break;
      default:
        renewal.setDate(renewal.getDate() + 30);
        break;
    }
  }

  return formatDateIso(renewal);
}

function advanceMonths(date: Date, months: number, anchorDay: number): void {
  const newMonth = date.getMonth() + months;
  date.setMonth(newMonth);
  const expectedMonth = newMonth % 12;
  if (date.getMonth() !== expectedMonth) {
    date.setDate(0);
  } else {
    const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(anchorDay, daysInMonth));
  }
}

function formatDateIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
