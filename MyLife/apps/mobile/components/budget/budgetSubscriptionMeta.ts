import {
  BG_ACCENT_LIGHT,
  BG_DANGER,
  BG_MONEY,
  BG_SURFACES,
  BG_TRANSFER,
  searchCatalog,
  type BudgetSubscription,
  type CatalogCategory,
  type CatalogEntry,
} from '@mylife/budget';

type BrandMeta = {
  color: string;
  glyph: string;
  websiteUrl?: string;
  steps?: string[];
};

const CATEGORY_META: Record<
  CatalogCategory,
  { color: string; label: string; glyph: string; surface: string }
> = {
  entertainment: {
    color: BG_ACCENT_LIGHT,
    label: 'Entertainment',
    glyph: 'E',
    surface: 'rgba(255,184,119,0.14)',
  },
  productivity: {
    color: BG_TRANSFER,
    label: 'Productivity',
    glyph: 'P',
    surface: 'rgba(139,207,240,0.14)',
  },
  health: {
    color: BG_MONEY,
    label: 'Health',
    glyph: 'H',
    surface: 'rgba(34,197,94,0.14)',
  },
  shopping: {
    color: '#F59E0B',
    label: 'Shopping',
    glyph: 'S',
    surface: 'rgba(245,158,11,0.14)',
  },
  news: {
    color: '#A78BFA',
    label: 'News',
    glyph: 'N',
    surface: 'rgba(167,139,250,0.14)',
  },
  finance: {
    color: BG_MONEY,
    label: 'Finance',
    glyph: 'F',
    surface: 'rgba(34,197,94,0.14)',
  },
  utilities: {
    color: '#38BDF8',
    label: 'Utilities',
    glyph: 'U',
    surface: 'rgba(56,189,248,0.14)',
  },
  other: {
    color: BG_DANGER,
    label: 'Other',
    glyph: 'O',
    surface: BG_SURFACES.high,
  },
};

const BRAND_META: Record<string, BrandMeta> = {
  netflix: {
    color: '#E50914',
    glyph: 'N',
    websiteUrl: 'https://www.netflix.com',
    steps: ['Open your Netflix account', 'Choose Manage Membership', 'Finish the cancel flow'],
  },
  spotify: {
    color: '#1DB954',
    glyph: 'S',
    websiteUrl: 'https://www.spotify.com/account',
    steps: ['Open your Spotify account page', 'Choose Your plan', 'Select cancel Premium'],
  },
  disney: {
    color: '#5BC0FF',
    glyph: 'D',
    websiteUrl: 'https://www.disneyplus.com',
    steps: ['Open Account', 'Choose Subscription', 'Review and confirm cancellation'],
  },
  hulu: {
    color: '#1CE783',
    glyph: 'H',
    websiteUrl: 'https://www.hulu.com/account',
    steps: ['Open your Hulu account page', 'Find Manage Plan', 'Follow the cancel prompts'],
  },
  youtube: {
    color: '#FF0033',
    glyph: 'Y',
    websiteUrl: 'https://www.youtube.com/paid_memberships',
    steps: ['Open Paid memberships', 'Choose the plan', 'Review the cancellation options'],
  },
  apple: {
    color: '#F5F5F7',
    glyph: 'A',
    websiteUrl: 'https://support.apple.com/subscriptions',
    steps: ['Open Apple subscription settings', 'Choose the subscription', 'Tap or click Cancel'],
  },
  amazon: {
    color: '#FF9900',
    glyph: 'A',
    websiteUrl: 'https://www.amazon.com/primecentral',
    steps: ['Open Prime settings', 'Manage membership', 'Confirm the change'],
  },
  notion: {
    color: '#FFFFFF',
    glyph: 'N',
    websiteUrl: 'https://www.notion.so/settings',
    steps: ['Open Settings', 'Choose Billing', 'Manage or cancel the plan'],
  },
  claude: {
    color: '#D97706',
    glyph: 'C',
    websiteUrl: 'https://claude.ai',
    steps: ['Open Settings', 'Choose Billing', 'Manage your plan'],
  },
  chatgpt: {
    color: BG_MONEY,
    glyph: 'G',
    websiteUrl: 'https://chatgpt.com',
    steps: ['Open Settings', 'Choose Plan', 'Manage or cancel the subscription'],
  },
  github: {
    color: '#8B5CF6',
    glyph: 'G',
    websiteUrl: 'https://github.com/settings/billing',
    steps: ['Open Billing and plans', 'Choose the plan', 'Manage the subscription'],
  },
  microsoft: {
    color: '#60A5FA',
    glyph: 'M',
    websiteUrl: 'https://account.microsoft.com/services',
    steps: ['Open Services and subscriptions', 'Choose Manage', 'Cancel recurring billing'],
  },
};

export type ResolvedSubscriptionMeta = {
  accentColor: string;
  category: CatalogCategory;
  categoryLabel: string;
  entry: CatalogEntry | null;
  glyph: string;
  name: string;
  surfaceColor: string;
  steps: string[];
  url: string | null;
};

function normalizeLookup(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function findBrand(name: string): BrandMeta | null {
  const normalized = normalizeLookup(name);
  const brandKey = Object.keys(BRAND_META).find((key) => normalized.includes(key));
  return brandKey ? BRAND_META[brandKey] : null;
}

export function getCatalogEntryForSubscription(
  subscription: Pick<BudgetSubscription, 'catalog_id' | 'name'>,
): CatalogEntry | null {
  if (subscription.catalog_id) {
    const byId = searchCatalog(subscription.catalog_id).find(
      (entry) => entry.id === subscription.catalog_id,
    );
    if (byId) {
      return byId;
    }
  }

  const byName = searchCatalog(subscription.name).find(
    (entry) => entry.name.toLowerCase() === subscription.name.toLowerCase(),
  );
  return byName ?? null;
}

export function resolveSubscriptionMeta(
  source: Pick<BudgetSubscription, 'catalog_id' | 'color' | 'icon' | 'name' | 'url'>,
): ResolvedSubscriptionMeta {
  const entry = getCatalogEntryForSubscription({
    catalog_id: source.catalog_id,
    name: source.name,
  });
  const category = entry?.category ?? 'other';
  const categoryMeta = CATEGORY_META[category];
  const brandMeta = findBrand(source.name) ?? (entry ? findBrand(entry.name) : null);

  return {
    accentColor: source.color ?? brandMeta?.color ?? categoryMeta.color,
    category,
    categoryLabel: categoryMeta.label,
    entry,
    glyph: source.icon ?? brandMeta?.glyph ?? categoryMeta.glyph,
    name: source.name,
    surfaceColor: categoryMeta.surface,
    steps:
      brandMeta?.steps ?? [
        'Open the provider account page',
        'Find the billing or plan section',
        'Confirm the change after reviewing your renewal details',
      ],
    url: source.url ?? brandMeta?.websiteUrl ?? null,
  };
}

export function categoryMeta(category: CatalogCategory) {
  return CATEGORY_META[category];
}

export function allCatalogCategories(): CatalogCategory[] {
  return Object.keys(CATEGORY_META) as CatalogCategory[];
}
