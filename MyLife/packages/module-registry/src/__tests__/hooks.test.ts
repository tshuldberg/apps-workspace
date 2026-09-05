import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModuleDefinition } from '../types';
import type { ModuleRegistry } from '../registry';

const reactMocks = vi.hoisted(() => ({
  createContext: vi.fn((defaultValue: unknown) => ({
    Provider: Symbol('Provider'),
    defaultValue,
  })),
  useContext: vi.fn(),
  useEffect: vi.fn(),
  useState: vi.fn(),
}));

vi.mock('react', () => reactMocks);

import {
  ModuleRegistryContext,
  useEnabledModules,
  useModule,
  useModuleRegistry,
} from '../hooks';

const BOOKS_DEF: ModuleDefinition = {
  id: 'books',
  name: 'MyBooks',
  tagline: 'Track your reading life',
  icon: '\u{1F4DA}',
  accentColor: '#C9894D',
  tier: 'premium',
  storageType: 'sqlite',
  tablePrefix: 'bk_',
  navigation: {
    tabs: [{ key: 'home', label: 'Home', icon: 'home' }],
    screens: [{ name: 'book-detail', title: 'Book Details' }],
  },
  requiresAuth: false,
  requiresNetwork: false,
  version: '0.1.0',
};

function makeRegistry(overrides: Partial<ModuleRegistry> = {}): ModuleRegistry {
  const base: Partial<ModuleRegistry> = {
    subscribe: vi.fn(() => vi.fn()),
    getEnabled: vi.fn(() => [BOOKS_DEF]),
    get: vi.fn(() => BOOKS_DEF),
  };

  return { ...base, ...overrides } as ModuleRegistry;
}

describe('hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reactMocks.useState.mockReturnValue([0, vi.fn()]);
    reactMocks.useEffect.mockImplementation(
      (effect: () => void | (() => void)) => {
        effect();
      },
    );
  });

  it('exports a ModuleRegistryContext object', () => {
    expect(ModuleRegistryContext).toBeDefined();
  });

  it('useModuleRegistry returns the registry from context', () => {
    const registry = makeRegistry();
    reactMocks.useContext.mockReturnValue(registry);

    const result = useModuleRegistry();

    expect(result).toBe(registry);
    expect(reactMocks.useContext).toHaveBeenCalledWith(ModuleRegistryContext);
  });

  it('useModuleRegistry throws when context is missing', () => {
    reactMocks.useContext.mockReturnValue(null);

    expect(() => useModuleRegistry()).toThrowError(
      'useModuleRegistry must be used within a ModuleRegistryContext.Provider',
    );
  });

  it('useEnabledModules subscribes and returns enabled modules', () => {
    const setTick = vi.fn();
    const getEnabled = vi.fn(() => [BOOKS_DEF]);
    const unsubscribe = vi.fn();
    let listener: (() => void) | undefined;

    const subscribe = vi.fn((nextListener: () => void) => {
      listener = nextListener;
      return unsubscribe;
    });

    const registry = makeRegistry({ subscribe, getEnabled });
    reactMocks.useContext.mockReturnValue(registry);
    reactMocks.useState.mockReturnValue([0, setTick]);

    let cleanup: (() => void) | undefined;
    reactMocks.useEffect.mockImplementation(
      (effect: () => void | (() => void)) => {
        const maybeCleanup = effect();
        if (typeof maybeCleanup === 'function') {
          cleanup = maybeCleanup;
        }
      },
    );

    const result = useEnabledModules();

    expect(result).toEqual([BOOKS_DEF]);
    expect(subscribe).toHaveBeenCalledOnce();
    expect(listener).toBeTypeOf('function');

    listener?.();
    expect(setTick).toHaveBeenCalledOnce();
    const updateFn = setTick.mock.calls[0]?.[0] as (value: number) => number;
    expect(updateFn(4)).toBe(5);

    expect(cleanup).toBe(unsubscribe);
    if (cleanup) {
      cleanup();
    }
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('useModule returns a module by id', () => {
    const get = vi.fn(() => BOOKS_DEF);
    const registry = makeRegistry({ get });
    reactMocks.useContext.mockReturnValue(registry);

    const result = useModule('books');

    expect(result).toBe(BOOKS_DEF);
    expect(get).toHaveBeenCalledWith('books');
  });
});
