import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-router', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  useLocalSearchParams: () => ({}),
}));

vi.mock('@mylife/market', () => {
  const React = require('react');

  return {
    CARRIER_NAMES: { usps: 'USPS', ups: 'UPS', fedex: 'FedEx' },
    LISTING_LIMITS: { titleMax: 100, descriptionMax: 5000, priceMax: 100000, photosMax: 10 },
    buildTrackingUrl: vi.fn(() => 'https://tracking.example'),
    calculateVerificationLevel: vi.fn(() => 'unverified'),
    formatMarketPrice: vi.fn((price) => `$${price}`),
    getCachedCategories: vi.fn(() => []),
    getCachedConversations: vi.fn(() => []),
    getCachedListingById: vi.fn(),
    getCachedListings: vi.fn(() => []),
    getCachedMessages: vi.fn(() => []),
    getCachedWatchlist: vi.fn(() => []),
    upsertCachedListing: vi.fn(),
    upsertCachedWatchlistItem: vi.fn(),
    deleteCachedWatchlistItem: vi.fn(),
    ConditionPill: ({ condition }) => <>{condition}</>,
    GlassCard: ({ children }) => <>{children}</>,
    MaterialSymbol: () => null,
    MessageBubble: ({ message }) => <>{message.body ?? message.offerTitle ?? 'bubble'}</>,
    PriceBadge: ({ price }) => <>{`$${price}`}</>,
    StatusTimeline: ({ steps }) => <>{steps.map((step) => <React.Fragment key={step.label}>{step.label}</React.Fragment>)}</>,
    MK_ACCENT: '#14B8A6',
    MK_ACCENT_DARK: '#002A23',
    MK_ACCENT_LIGHT: '#2DD4BF',
    MK_FONTS: {
      regular: 'regular',
      medium: 'medium',
      semiBold: 'semiBold',
      bold: 'bold',
      extraBold: 'extraBold',
      black: 'black',
    },
    MK_OFFER_STATUS: {
      pending: '#FFB877',
      accepted: '#30D158',
      declined: '#FFB4AB',
      counter: '#2DD4BF',
      expired: '#9F8E81',
    },
    MK_PAYMENT_STATUS: {
      escrowed: '#FFB877',
      released: '#30D158',
      refunded: '#9F8E81',
      failed: '#FFB4AB',
    },
    MK_SURFACES: {
      low: '#1B1B20',
      mid: '#1F1F25',
      highest: '#35343A',
    },
    MK_TEXT: '#E4E1E9',
    MK_TEXT_SECONDARY: '#D6C3B5',
    MK_TEXT_TERTIARY: '#9F8E81',
    withAlpha: vi.fn((color) => color),
  };
});

vi.mock('../../../components/DatabaseProvider', () => ({
  useDatabase: () => ({
    execSync: vi.fn(),
    getAllSync: vi.fn(() => []),
    getFirstSync: vi.fn(() => null),
    runSync: vi.fn(() => ({ changes: 0, lastInsertRowId: 0 })),
  }),
}));

import {
  MarketCheckoutScreen,
  MarketConversationScreen,
  MarketDisputesScreen,
  MarketOffersScreen,
  MarketTrackingDetailScreen,
  MarketTrackingScreen,
} from '../_ui';

describe('MyMarket Phase 3 screens (mobile)', () => {
  it('renders offer tabs and negotiation hero', () => {
    render(<MarketOffersScreen />);
    expect(screen.getAllByText('Offers').length).toBeGreaterThan(0);
    expect(screen.getByText('Received')).toBeTruthy();
    expect(screen.getByText('History')).toBeTruthy();
  });

  it('renders checkout progress flow', () => {
    render(<MarketCheckoutScreen />);
    expect(screen.getByText('Secure Checkout')).toBeTruthy();
    expect(screen.getByText('PROGRESS')).toBeTruthy();
    expect(screen.getByText('ITEM CONFIRMATION')).toBeTruthy();
  });

  it('renders tracking list and detail timeline', () => {
    render(<MarketTrackingScreen />);
    expect(screen.getAllByText('My Orders').length).toBeGreaterThan(0);
    expect(screen.getByText('Active')).toBeTruthy();

    render(<MarketTrackingDetailScreen />);
    expect(screen.getByText('STATUS TIMELINE')).toBeTruthy();
    expect(screen.getByText('ORDER DETAILS')).toBeTruthy();
  });

  it('renders encrypted chat shell and dispute list', () => {
    render(<MarketConversationScreen />);
    expect(screen.getByText('Conversation')).toBeTruthy();
    expect(screen.getByText('Conversation request pending')).toBeTruthy();
    expect(screen.getByPlaceholderText('Message securely')).toBeTruthy();

    render(<MarketDisputesScreen />);
    expect(screen.getAllByText('Disputes').length).toBeGreaterThan(0);
    expect(screen.getByText('BUYER PROTECTION')).toBeTruthy();
  });
});
