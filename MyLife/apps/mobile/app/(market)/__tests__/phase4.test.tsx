import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { routerMock, getSearchParams, setSearchParams, getCachedListingByIdMock, upsertCachedListingMock } = vi.hoisted(() => {
  let searchParams = {};

  return {
    routerMock: {
      push: vi.fn(),
      back: vi.fn(),
      replace: vi.fn(),
    },
    getSearchParams: () => searchParams,
    setSearchParams: (next) => {
      searchParams = next;
    },
    getCachedListingByIdMock: vi.fn(() => undefined),
    upsertCachedListingMock: vi.fn(),
  };
});

vi.mock('expo-router', () => ({
  useRouter: () => routerMock,
  useLocalSearchParams: () => getSearchParams(),
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

vi.mock('expo-linear-gradient', () => {
  const React = require('react');
  return {
    LinearGradient: ({ children }) => React.createElement(React.Fragment, null, children),
  };
});

vi.mock('@mylife/market', () => {
  const React = require('react');

  return {
    GlassCard: ({ children }) => React.createElement(React.Fragment, null, children),
    ListingTypePill: ({ type }) => React.createElement(React.Fragment, null, type),
    MaterialSymbol: ({ name }) => React.createElement(React.Fragment, null, name),
    PriceBadge: ({ price }) => React.createElement(React.Fragment, null, `$${price}`),
    SectionHeader: ({ title, action }) =>
      React.createElement(
        React.Fragment,
        null,
        title,
        action ? action.label ?? 'See All' : null,
      ),
    VerificationBadge: ({ tier }) => React.createElement(React.Fragment, null, tier),
    MK_ACCENT: '#14B8A6',
    MK_ACCENT_DARK: '#002A23',
    MK_ACCENT_LIGHT: '#2DD4BF',
    MK_SURFACES: {
      base: '#131318',
      low: '#1B1B20',
      high: '#2A292F',
    },
    MK_TEXT: '#E4E1E9',
    MK_TEXT_SECONDARY: '#D6C3B5',
    MK_TEXT_TERTIARY: '#9F8E81',
    MK_TYPOGRAPHY: {
      displayLg: {},
      headlineMd: {},
      bodyMd: {},
      labelUpper: {},
      titleMd: {},
      caption: {},
    },
    withAlpha: (_value: string, alpha: number) => `rgba(20,184,166,${alpha})`,
    getCachedListingById: getCachedListingByIdMock,
    upsertCachedListing: upsertCachedListingMock,
  };
});

vi.mock('../../../components/DatabaseProvider', () => ({
  useDatabase: () => ({
    execute: vi.fn(),
    query: vi.fn(() => []),
    transaction: vi.fn(),
  }),
}));

import MarketReportScreen from '../report';
import MarketServicesScreen from '../services';
import MarketSettingsScreen from '../settings';

describe('MyMarket Phase 4 mobile screens', () => {
  beforeEach(() => {
    setSearchParams({});
    getCachedListingByIdMock.mockReset();
    getCachedListingByIdMock.mockReturnValue(undefined);
    upsertCachedListingMock.mockReset();
    routerMock.push.mockReset();
    routerMock.back.mockReset();
    routerMock.replace.mockReset();
  });

  it('renders the services hub tabs and CTA', () => {
    render(<MarketServicesScreen />);

    expect(screen.getAllByText('Services').length).toBeGreaterThan(0);
    expect(screen.getByText('Browse')).toBeTruthy();
    expect(screen.getByText('My Services')).toBeTruthy();
    expect(screen.getByText('Requests')).toBeTruthy();
    expect(screen.getByText('Offer a Service')).toBeTruthy();
  });

  it('renders the report flow with subject, reason, and anonymity controls', () => {
    setSearchParams({ type: 'listing', id: 'listing-1' });
    getCachedListingByIdMock.mockReturnValue({
      id: 'listing-1',
      sellerId: 'seller-1',
      categoryId: 'mk-cat-services',
      title: 'Vintage amp head',
      description: 'Reported listing',
      priceCents: 25000,
      currency: 'USD',
      pricingType: 'fixed',
      condition: 'good',
      listingType: 'sell',
      status: 'active',
      locationName: 'Los Angeles',
      latitude: null,
      longitude: null,
      fulfillmentType: 'pickup',
      serviceRadiusMiles: null,
      availabilityNotes: null,
      tradeFor: null,
      viewCount: 0,
      watchCount: 0,
      messageCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: null,
    });

    render(<MarketReportScreen />);

    expect(screen.getByText('Report Issue')).toBeTruthy();
    expect(screen.getByText('Reason')).toBeTruthy();
    expect(screen.getByText('What happened?')).toBeTruthy();
    expect(screen.getByText('Submit anonymously')).toBeTruthy();
  });

  it('renders grouped marketplace settings sections', () => {
    render(<MarketSettingsScreen />);

    expect(screen.getAllByText('Settings').length).toBeGreaterThan(0);
    expect(screen.getByText('Account')).toBeTruthy();
    expect(screen.getByText('Verification')).toBeTruthy();
    expect(screen.getByText('Notifications')).toBeTruthy();
    expect(screen.getByText('Payment Methods')).toBeTruthy();
    expect(screen.getByText('Blocked Users')).toBeTruthy();
  });
});
