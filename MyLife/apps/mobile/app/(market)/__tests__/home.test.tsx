import { View } from 'react-native';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  authMock,
  databaseMock,
  imagePickerMock,
  marketModuleMock,
  resetPhase1TestState,
  routerMock,
  searchParamsMock,
  supabaseClientFactoryMock,
} from './phase1-test-utils';

vi.mock('expo-router', () => ({
  useRouter: () => routerMock,
  useLocalSearchParams: () => searchParamsMock,
}));

vi.mock('@mylife/auth', () => ({
  useAuth: () => authMock,
  getSupabaseClient: supabaseClientFactoryMock,
}));

vi.mock('expo-image', () => ({
  Image: ({ contentFit: _contentFit, source: _source, ...props }: any) => <View {...props} />,
}));

vi.mock('expo-image-picker', () => imagePickerMock);

vi.mock('@mylife/market', () => marketModuleMock);

vi.mock('../../../components/DatabaseProvider', () => ({
  useDatabase: () => databaseMock,
}));

import MarketHomeScreen from '../(tabs)/index';

afterEach(() => {
  resetPhase1TestState();
});

describe('MarketHomePhase1Screen (mobile)', () => {
  it('renders the phase 1 discovery sections', () => {
    render(<MarketHomeScreen />);

    expect(screen.getByText('Recent Listings')).toBeTruthy();
    expect(screen.getByText('Browse Categories')).toBeTruthy();
    expect(screen.getByText('Your Watchlist')).toBeTruthy();
    expect(
      screen.getAllByText('Mirrorless camera kit with two lenses').length,
    ).toBeGreaterThan(0);
  });
});
