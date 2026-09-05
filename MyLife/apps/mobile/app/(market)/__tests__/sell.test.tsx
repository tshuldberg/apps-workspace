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

import MarketSellScreen from '../(tabs)/sell';

afterEach(() => {
  resetPhase1TestState();
});

describe('MarketSellPhase1Screen (mobile)', () => {
  it('renders the draft-first listing form', () => {
    render(<MarketSellScreen />);

    expect(screen.getByText('New Listing')).toBeTruthy();
    expect(screen.getByPlaceholderText('What are you selling?')).toBeTruthy();
    expect(
      screen.getByPlaceholderText('Describe your item, condition, why you are selling'),
    ).toBeTruthy();
    expect(screen.getByPlaceholderText('Price in dollars')).toBeTruthy();
    expect(screen.getByText('Save Draft')).toBeTruthy();
    expect(screen.getByText('Post Listing')).toBeTruthy();
  });
});
