import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const pushMock = vi.fn();
const backMock = vi.fn();
let localParams: Record<string, string> = {};

vi.mock('expo-image', () => ({
  Image: ({
    source,
    style,
  }: {
    source?: { uri?: string };
    style?: React.CSSProperties;
  }) => <img alt="" src={source?.uri} style={style} />,
}));

vi.mock('expo-linear-gradient', () => ({
  LinearGradient: ({
    children,
    style,
  }: {
    children?: React.ReactNode;
    style?: React.CSSProperties;
  }) => <div style={style}>{children}</div>,
}));

vi.mock('expo-blur', () => ({
  BlurView: ({
    children,
    style,
  }: {
    children?: React.ReactNode;
    style?: React.CSSProperties;
  }) => <div style={style}>{children}</div>,
}));

vi.mock('@expo/vector-icons', () => ({
  MaterialIcons: ({
    name,
    size,
    color,
    style,
  }: {
    name: string;
    size?: number;
    color?: string;
    style?: React.CSSProperties;
  }) => (
    <span data-icon={name} style={{ fontSize: size, color, ...(style ?? {}) }}>
      {name}
    </span>
  ),
}));

vi.mock('expo-router', () => ({
  useRouter: () => ({
    back: backMock,
    push: pushMock,
    replace: vi.fn(),
  }),
  useLocalSearchParams: () => localParams,
}));

vi.mock('../../../components/DatabaseProvider', () => ({
  useDatabase: () => ({
    execute: vi.fn(),
    query: vi.fn(() => []),
  }),
}));

vi.mock('@mylife/market', () => {
  const chip = (label: string) => (
    <span>{label}</span>
  );

  return {
    ConditionPill: ({ condition }: { condition: string }) => chip(condition),
    GlassCard: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    ListingCard: ({
      listing,
      onPress,
    }: {
      listing: { title: string };
      onPress: () => void;
    }) => (
      <button type="button" onClick={onPress}>
        {listing.title}
      </button>
    ),
    MK_ACCENT: '#14B8A6',
    MK_ACCENT_DARK: '#002A23',
    MK_ACCENT_LIGHT: '#2DD4BF',
    MK_FONTS: {
      bold: 'PlusJakartaSans_700Bold',
      medium: 'PlusJakartaSans_500Medium',
      regular: 'PlusJakartaSans_400Regular',
      semiBold: 'PlusJakartaSans_600SemiBold',
    },
    MK_GLOW_STYLE: {},
    MK_SURFACES: {
      base: '#131318',
      high: '#2A292F',
      highest: '#35343A',
      low: '#1B1B20',
      lowest: '#0E0E13',
      mid: '#1F1F25',
    },
    MK_TEXT: '#E4E1E9',
    MK_TEXT_SECONDARY: '#D6C3B5',
    MK_TEXT_TERTIARY: '#9F8E81',
    MK_TYPOGRAPHY: {
      bodyMd: {},
      caption: {},
      displayLg: {},
      headlineMd: {},
      labelUpper: {},
      titleMd: {},
    },
    MaterialSymbol: ({ name }: { name: string }) => <span>{name}</span>,
    PriceBadge: ({ price }: { price: number }) => <span>{`$${price}`}</span>,
    VerificationBadge: ({ tier }: { tier: string }) => <span>{tier}</span>,
    calculateVerificationLevel: () => 'trusted',
    deleteCachedWatchlistItem: vi.fn(),
    formatMarketPrice: (price: number) => `$${price.toFixed(0)}`,
    getCachedCategories: vi.fn(() => []),
    getCachedConversations: vi.fn(() => []),
    getCachedListingById: vi.fn(() => undefined),
    getCachedListings: vi.fn(() => []),
    getCachedWatchlist: vi.fn(() => []),
    getListingPriceLabel: (listing: { priceCents?: number | null; pricingType?: string; currency?: string }) => {
      if (listing.pricingType === 'free') return 'Free';
      return `$${((listing.priceCents ?? 0) / 100).toFixed(0)}`;
    },
    upsertCachedConversation: vi.fn(),
    upsertCachedWatchlistItem: vi.fn(),
    withAlpha: (_hex: string, alpha: number) => `rgba(20,184,166,${alpha})`,
  };
});

import ListingDetailScreen from '../[id]';
import ReviewsScreen from '../reviews';
import SavedSearchesScreen from '../saved-searches';
import WatchlistScreen from '../watchlist';
import { resetMarketPhase2Stores } from '../phase2';

describe('MyMarket Phase 2 mobile screens', () => {
  beforeEach(() => {
    pushMock.mockReset();
    backMock.mockReset();
    localParams = {};
    resetMarketPhase2Stores();
  });

  it('renders the listing detail hero and CTAs', () => {
    localParams = { id: 'mk-listing-camera' };
    render(<ListingDetailScreen />);

    expect(screen.getByText('Mirrorless camera kit with two lenses')).toBeTruthy();
    expect(screen.getByText('Description')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Message Seller/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Make Offer/i })).toBeTruthy();
  });

  it('renders watchlist rows and removes an item', async () => {
    render(<WatchlistScreen />);

    expect(screen.getByText('Your Watchlist')).toBeTruthy();
    expect(screen.getByText('Vintage walnut record player cabinet')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /Remove/i })).toHaveLength(3);

    fireEvent.click(screen.getAllByRole('button', { name: /Remove/i })[0]);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Remove/i })).toHaveLength(2);
    });
  });

  it('creates a new saved search from the sheet', async () => {
    render(<SavedSearchesScreen />);

    fireEvent.click(screen.getByRole('button', { name: /add/i }));
    fireEvent.change(screen.getByPlaceholderText('Name the alert'), {
      target: { value: 'Desk lamp alerts' },
    });
    fireEvent.change(screen.getByPlaceholderText('What are you looking for?'), {
      target: { value: 'ceramic lamp' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: /Save Search/i }).at(-1)!);

    expect(await screen.findByText('Desk lamp alerts')).toBeTruthy();
    expect(await screen.findByText('ceramic lamp')).toBeTruthy();
  });

  it('increments helpful votes on reviews', async () => {
    render(<ReviewsScreen />);

    expect(screen.getByText('Rating Breakdown')).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button', { name: /Helpful/i }).filter((node) => node.textContent?.includes('thumb_up'))[0]);

    expect(await screen.findByText('9 helpful')).toBeTruthy();
  });
});
