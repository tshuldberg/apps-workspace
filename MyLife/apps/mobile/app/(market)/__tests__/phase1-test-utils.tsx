import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { vi } from 'vitest';

type HeaderAction = {
  label: string;
  onPress: () => void;
};

type ListingLike = {
  title: string;
  priceCents?: number | null;
};

function formatPrice(price?: number | null) {
  if (price == null) {
    return 'Free';
  }

  return `$${Math.round(price / 100)}`;
}

function MockGlassCard({
  children,
  onPress,
}: {
  children?: ReactNode;
  onPress?: () => void;
  style?: unknown;
  padding?: number;
  elevated?: boolean;
}) {
  if (onPress) {
    return <Pressable onPress={onPress}>{children}</Pressable>;
  }

  return <View>{children}</View>;
}

function MockListingCard({
  listing,
  onPress,
}: {
  listing: ListingLike;
  onPress?: () => void;
  variant?: 'carousel' | 'grid';
}) {
  return (
    <Pressable onPress={onPress}>
      <Text>{listing.title}</Text>
      {listing.priceCents != null ? <Text>{formatPrice(listing.priceCents)}</Text> : null}
    </Pressable>
  );
}

function MockCategoryTile({
  name,
  listingCount,
  onPress,
}: {
  name: string;
  listingCount?: number;
  icon?: string;
  color?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <Text>{name}</Text>
      {typeof listingCount === 'number' ? <Text>{listingCount}</Text> : null}
    </Pressable>
  );
}

function MockListingTypePill({
  type,
  onPress,
}: {
  type: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <Text>{type}</Text>
    </Pressable>
  );
}

function MockSectionHeader({
  title,
  action,
}: {
  title: string;
  action?: HeaderAction;
}) {
  return (
    <View>
      <Text>{title}</Text>
      {action ? (
        <Pressable onPress={action.onPress}>
          <Text>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function MockVerificationBadge({
  tier,
}: {
  tier: string;
  showLabel?: boolean;
}) {
  return <Text>{tier}</Text>;
}

export const routerMock = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
};

export const searchParamsMock: Record<string, string | undefined> = {};

export const authMock = {
  user: { id: 'local-user' },
  isAuthenticated: false,
};

export const supabaseClientFactoryMock = vi.fn();

export const databaseMock = {
  query: vi.fn(() => []),
  execute: vi.fn(),
};

export const imagePickerMock = {
  launchCameraAsync: vi.fn(async () => ({ canceled: true, assets: [] })),
  launchImageLibraryAsync: vi.fn(async () => ({ canceled: true, assets: [] })),
};

export const marketModuleMock = {
  CategoryTile: MockCategoryTile,
  ConditionPill: ({ condition }: { condition: string }) => <Text>{condition}</Text>,
  CreateListingInputSchema: {
    safeParse: vi.fn((input: { title?: string; categoryId?: string }) =>
      input?.title && input?.categoryId
        ? { success: true as const, data: input }
        : {
            success: false as const,
            error: { issues: [{ message: 'Missing title or category.' }] },
          },
    ),
  },
  GlassCard: MockGlassCard,
  ListingCard: MockListingCard,
  ListingTypePill: MockListingTypePill,
  MaterialSymbol: () => null,
  SectionHeader: MockSectionHeader,
  VerificationBadge: MockVerificationBadge,
  cloudCreateListing: vi.fn(async (_client: unknown, input: Record<string, unknown>) => ({
    ok: true as const,
    data: {
      ...input,
      id: 'cloud-listing',
      sellerId: 'local-user',
      condition: input.condition ?? 'good',
      listingType: input.listingType ?? 'sell',
      status: 'active',
      locationName: input.locationName ?? 'Los Angeles, CA',
      latitude: null,
      longitude: null,
      fulfillmentType: input.fulfillmentType ?? 'pickup',
      serviceRadiusMiles: input.serviceRadiusMiles ?? null,
      availabilityNotes: input.availabilityNotes ?? null,
      tradeFor: null,
      viewCount: 0,
      watchCount: 0,
      messageCount: 0,
      createdAt: '2026-04-06T00:00:00.000Z',
      updatedAt: '2026-04-06T00:00:00.000Z',
      expiresAt: null,
      photoUrl: 'https://example.com/photo.jpg',
    },
  })),
  cloudGetCategories: vi.fn(async () => ({ ok: true as const, data: [] })),
  cloudGetConversations: vi.fn(async () => ({ ok: true as const, data: [] })),
  cloudGetListings: vi.fn(async () => ({ ok: true as const, data: [] })),
  cloudGetMessages: vi.fn(async () => ({ ok: true as const, data: [] })),
  cloudGetSellerReviews: vi.fn(async () => ({ ok: true as const, data: [] })),
  cloudGetSellerStats: vi.fn(async () => ({ ok: true as const, data: null })),
  cloudGetSellerVerification: vi.fn(async () => ({ ok: true as const, data: null })),
  cloudGetWatchlist: vi.fn(async () => ({ ok: true as const, data: [] })),
  cloudToggleWatch: vi.fn(async () => ({ ok: true as const, data: undefined })),
  deleteCachedWatchlistItem: vi.fn(),
  formatMarketPrice: vi.fn(formatPrice),
  getCachedCategories: vi.fn(() => []),
  getCachedConversations: vi.fn(() => []),
  getCachedListings: vi.fn(() => []),
  getCachedMessages: vi.fn(() => []),
  getCachedWatchlist: vi.fn(() => []),
  upsertCachedCategory: vi.fn(),
  upsertCachedConversation: vi.fn(),
  upsertCachedListing: vi.fn(),
  upsertCachedMessage: vi.fn(),
  upsertCachedWatchlistItem: vi.fn(),
  MK_ACCENT: '#14B8A6',
  MK_ACCENT_DARK: '#0A2A27',
  MK_ACCENT_LIGHT: '#5EEAD4',
  MK_GLASS_NAV: {
    backgroundColor: '#0A0A0F',
  },
  MK_SURFACES: {
    lowest: '#0A0A0F',
    low: '#12121A',
    base: '#16161E',
    high: '#1A1A24',
    highest: '#232330',
  },
  MK_TEXT: '#F0F0F5',
  MK_TEXT_MUTED: 'rgba(240,240,245,0.45)',
  MK_TEXT_SECONDARY: 'rgba(240,240,245,0.65)',
  MK_TEXT_TERTIARY: 'rgba(240,240,245,0.5)',
  MK_TYPOGRAPHY: {
    headlineMd: { fontFamily: 'System' },
    bodyMd: { fontFamily: 'System' },
    labelUpper: { fontFamily: 'System' },
    displayLg: { fontFamily: 'System' },
    titleMd: { fontFamily: 'System' },
  },
  withAlpha: vi.fn((color: string) => color),
};

const marketFnMocks = [
  marketModuleMock.CreateListingInputSchema.safeParse,
  marketModuleMock.cloudCreateListing,
  marketModuleMock.cloudGetCategories,
  marketModuleMock.cloudGetConversations,
  marketModuleMock.cloudGetListings,
  marketModuleMock.cloudGetMessages,
  marketModuleMock.cloudGetSellerReviews,
  marketModuleMock.cloudGetSellerStats,
  marketModuleMock.cloudGetSellerVerification,
  marketModuleMock.cloudGetWatchlist,
  marketModuleMock.cloudToggleWatch,
  marketModuleMock.deleteCachedWatchlistItem,
  marketModuleMock.formatMarketPrice,
  marketModuleMock.getCachedCategories,
  marketModuleMock.getCachedConversations,
  marketModuleMock.getCachedListings,
  marketModuleMock.getCachedMessages,
  marketModuleMock.getCachedWatchlist,
  marketModuleMock.upsertCachedCategory,
  marketModuleMock.upsertCachedConversation,
  marketModuleMock.upsertCachedListing,
  marketModuleMock.upsertCachedMessage,
  marketModuleMock.upsertCachedWatchlistItem,
  marketModuleMock.withAlpha,
];

export function resetPhase1TestState() {
  delete searchParamsMock.id;

  authMock.user = { id: 'local-user' };
  authMock.isAuthenticated = false;

  routerMock.push.mockClear();
  routerMock.replace.mockClear();
  routerMock.back.mockClear();

  supabaseClientFactoryMock.mockClear();

  databaseMock.query.mockClear();
  databaseMock.execute.mockClear();

  imagePickerMock.launchCameraAsync.mockClear();
  imagePickerMock.launchImageLibraryAsync.mockClear();

  for (const mockFn of marketFnMocks) {
    mockFn.mockClear();
  }
}
