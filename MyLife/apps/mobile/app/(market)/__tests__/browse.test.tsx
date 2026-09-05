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

import MarketBrowseScreen from '../(tabs)/browse';

afterEach(() => {
  resetPhase1TestState();
});

describe('MarketBrowsePhase1Screen (mobile)', () => {
  it('renders browse search, filters, and fallback listings', () => {
    render(<MarketBrowseScreen />);

    expect(screen.getByPlaceholderText('Search marketplace...')).toBeTruthy();
    expect(screen.getByText('All')).toBeTruthy();
    expect(screen.getByText('Mirrorless camera kit with two lenses')).toBeTruthy();
  });
});
