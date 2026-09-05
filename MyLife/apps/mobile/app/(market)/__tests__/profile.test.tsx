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

import MarketProfileScreen from '../(tabs)/profile';

afterEach(() => {
  resetPhase1TestState();
});

describe('MarketProfilePhase1Screen (mobile)', () => {
  it('renders the seller hub with profile actions and stats', async () => {
    render(<MarketProfileScreen />);
    expect(await screen.findByText('Settings')).toBeTruthy();

    expect(screen.getByText('Profile')).toBeTruthy();
    expect(screen.getByText('Trey Seller')).toBeTruthy();
    expect(screen.getByText('Edit Profile')).toBeTruthy();
    expect(screen.getByText('Settings')).toBeTruthy();
    expect(screen.getByText('Listings')).toBeTruthy();
  });
});
