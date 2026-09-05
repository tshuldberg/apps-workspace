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

import MarketSellerProfileScreen from '../seller-profile';

afterEach(() => {
  resetPhase1TestState();
});

describe('MarketSellerProfileScreen (mobile)', () => {
  it('renders a seller route selected from params', async () => {
    searchParamsMock.id = 'seller-maya';

    render(<MarketSellerProfileScreen />);

    expect((await screen.findAllByText('Maya Chen')).length).toBeGreaterThan(0);
    expect(await screen.findByText('Message')).toBeTruthy();
    expect(await screen.findByText('Listings')).toBeTruthy();
  });
});
