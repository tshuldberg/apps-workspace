import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WordsScreen from '../index';

// ── Mocks ────────────────────────────────────────────────────────────

const getMyWordsLanguagesMock = vi.fn();
const lookupWordMock = vi.fn();
const getCachePrefixMatchesMock = vi.fn();
const clearCacheMock = vi.fn();
const getSavedWordByWordAndLangMock = vi.fn();
const saveWordMock = vi.fn();
const unsaveWordMock = vi.fn();
const cacheAfterLookupMock = vi.fn();

vi.mock('@mylife/words', () => ({
  getMyWordsLanguages: (...args: unknown[]) => getMyWordsLanguagesMock(...args),
  lookupWord: (...args: unknown[]) => lookupWordMock(...args),
  getCachePrefixMatches: (...args: unknown[]) => getCachePrefixMatchesMock(...args),
  clearCache: (...args: unknown[]) => clearCacheMock(...args),
  getSavedWordByWordAndLang: (...args: unknown[]) => getSavedWordByWordAndLangMock(...args),
  saveWord: (...args: unknown[]) => saveWordMock(...args),
  unsaveWord: (...args: unknown[]) => unsaveWordMock(...args),
  cacheAfterLookup: (...args: unknown[]) => cacheAfterLookupMock(...args),
}));

vi.mock('expo-haptics', () => ({
  impactAsync: vi.fn(),
  notificationAsync: vi.fn(),
  ImpactFeedbackStyle: { Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success' },
}));

vi.mock('expo-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const dbQueryMock = vi.fn().mockReturnValue([]);
const dbExecuteMock = vi.fn();

vi.mock('../../../components/DatabaseProvider', () => ({
  useDatabase: () => ({
    query: dbQueryMock,
    execute: dbExecuteMock,
  }),
}));

vi.mock('../../../lib/uuid', () => ({
  uuid: () => 'test-uuid-1',
}));

describe('LookupScreen (mobile)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getMyWordsLanguagesMock.mockResolvedValue([
      { code: 'en', name: 'English', words: 1343902 },
      { code: 'es', name: 'Spanish', words: 759364 },
    ]);
    getCachePrefixMatchesMock.mockReturnValue([]);
    getSavedWordByWordAndLangMock.mockReturnValue(null);
    dbQueryMock.mockReturnValue([]);
  });

  it('renders search input and language pills on mount', async () => {
    render(<WordsScreen />);

    expect(screen.getByPlaceholderText('Search any word...')).toBeInTheDocument();

    await waitFor(() => {
      expect(getMyWordsLanguagesMock).toHaveBeenCalled();
    });
  });

  it('performs a lookup on submit and shows compact result preview', async () => {
    lookupWordMock.mockResolvedValue({
      word: 'ocean',
      language: { code: 'en', name: 'English' },
      synonyms: ['sea', 'waters'],
      antonyms: ['land'],
      entries: [
        {
          partOfSpeech: 'noun',
          senses: [{ definition: 'A very large body of salt water.' }],
          pronunciations: [],
          forms: [],
          synonyms: [],
          antonyms: [],
        },
      ],
      attributions: [],
      providers: ['freeDictionaryApi'],
    });

    render(<WordsScreen />);

    const input = screen.getByPlaceholderText('Search any word...');
    fireEvent.change(input, { target: { value: 'ocean' } });
    fireEvent.submit(input);

    await waitFor(() => {
      expect(lookupWordMock).toHaveBeenCalledWith({
        languageCode: 'en',
        word: 'ocean',
      });
    });

    expect(await screen.findByText('ocean')).toBeInTheDocument();
    expect(screen.getByText('noun')).toBeInTheDocument();
  });

  it('shows an error message when the lookup returns no match', async () => {
    lookupWordMock.mockResolvedValue(null);

    render(<WordsScreen />);
    await waitFor(() => {
      expect(getMyWordsLanguagesMock).toHaveBeenCalled();
    });

    const input = screen.getByPlaceholderText('Search any word...');
    fireEvent.change(input, { target: { value: 'qwertyword' } });
    fireEvent.submit(input);

    expect(
      await screen.findByText(/No entry found for "qwertyword"/i),
    ).toBeInTheDocument();
  });

  it('shows starter words when there are no recent lookups', async () => {
    render(<WordsScreen />);

    await waitFor(() => {
      expect(getMyWordsLanguagesMock).toHaveBeenCalled();
    });

    expect(screen.getByText('ephemeral')).toBeInTheDocument();
    expect(screen.getByText('serendipity')).toBeInTheDocument();
    expect(screen.getByText('ubiquitous')).toBeInTheDocument();
  });
});
