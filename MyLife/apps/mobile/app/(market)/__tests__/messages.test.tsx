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

import MarketMessagesScreen from '../(tabs)/messages';

afterEach(() => {
  resetPhase1TestState();
});

describe('MarketMessagesPhase1Screen (mobile)', () => {
  it('renders the encrypted inbox and fallback conversations', () => {
    render(<MarketMessagesScreen />);

    expect(screen.getByText('Messages')).toBeTruthy();
    expect(screen.getByText('Encrypted')).toBeTruthy();
    expect(screen.getAllByText('Maya Chen').length).toBeGreaterThan(0);
  });
});
