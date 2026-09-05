import { afterEach, expect, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
// jest-dom's '/vitest' auto-entry targets vitest 3's expect and silently
// fails to register under vitest 4 ("Invalid Chai property"), so extend
// the matchers explicitly.
import * as jestDomMatchers from '@testing-library/jest-dom/matchers';

expect.extend(jestDomMatchers);
import React from 'react';
import type { ReactNode } from 'react';

// Expo modules expect __DEV__ to be defined globally
(globalThis as Record<string, unknown>).__DEV__ = false;

// expo-modules-core reads `globalThis.expo.EventEmitter` at import time when
// the real RN runtime isn't present. Provide a minimal shim so the import chain
// (expo-modules-core -> ExpoModulesCoreJSLogger -> modules pulled in by the
// books/stats and hub/settings screens) doesn't crash with
// "Cannot read properties of undefined (reading 'EventEmitter')".
class StubEventEmitter {
  addListener() {
    return { remove: () => undefined };
  }
  removeAllListeners() {}
  emit() {}
}
(globalThis as Record<string, unknown>).expo = {
  EventEmitter: StubEventEmitter,
  modules: {},
  NativeModule: class {},
  SharedObject: class {},
  SharedRef: class {},
};

// Stub expo runtime modules that crash in jsdom (no Metro bundler)
vi.mock('expo', () => ({
  default: {},
  requireNativeModule: vi.fn(() => ({})),
}));

vi.mock('expo-sqlite', () => ({
  openDatabaseSync: vi.fn(() => ({
    execSync: vi.fn(),
    getAllSync: vi.fn(() => []),
    getFirstSync: vi.fn(() => null),
    runSync: vi.fn(() => ({ changes: 0, lastInsertRowId: 0 })),
    prepareSync: vi.fn(() => ({
      executeSync: vi.fn(() => []),
      finalizeSync: vi.fn(),
    })),
  })),
  useSQLiteContext: vi.fn(() => ({
    execSync: vi.fn(),
    getAllSync: vi.fn(() => []),
    getFirstSync: vi.fn(() => null),
    runSync: vi.fn(() => ({ changes: 0, lastInsertRowId: 0 })),
  })),
  SQLiteProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
  addDatabaseChangeListener: vi.fn(() => ({ remove: vi.fn() })),
}));

function primitive(tag: keyof HTMLElementTagNameMap) {
  return function Primitive({
    children,
    ...props
  }: {
    children?: ReactNode;
    [key: string]: unknown;
  }) {
    const domProps = { ...props } as Record<string, unknown>;
    if (typeof domProps.accessibilityLabel === 'string') {
      domProps['aria-label'] = domProps.accessibilityLabel;
      delete domProps.accessibilityLabel;
    }
    delete domProps.contentContainerStyle;
    delete domProps.horizontal;
    delete domProps.showsHorizontalScrollIndicator;
    delete domProps.refreshControl;
    delete domProps.keyboardShouldPersistTaps;
    delete domProps.activeOpacity;
    delete domProps.numberOfLines;
    return React.createElement(tag, domProps, children);
  };
}

vi.mock('react-native', () => {
  const View = primitive('div');
  const ScrollView = primitive('div');
  const Text = primitive('span');
  const FlatList = ({
    data = [],
    keyExtractor,
    renderItem,
    ListHeaderComponent,
    ListEmptyComponent,
  }: {
    data?: unknown[];
    keyExtractor?: (item: unknown, index: number) => string;
    renderItem?: (arg: { item: unknown; index: number }) => ReactNode;
    ListHeaderComponent?: ReactNode;
    ListEmptyComponent?: ReactNode;
  }) => {
    const header =
      typeof ListHeaderComponent === 'function'
        ? ListHeaderComponent({})
        : ListHeaderComponent;
    const empty =
      typeof ListEmptyComponent === 'function'
        ? ListEmptyComponent({})
        : ListEmptyComponent;

    return (
      <div>
        {header}
        {data.length === 0 ? empty : null}
        {data.map((item, index) => (
          <div key={keyExtractor ? keyExtractor(item, index) : String(index)}>
            {renderItem ? renderItem({ item, index }) : null}
          </div>
        ))}
      </div>
    );
  };
  const SectionList = ({
    sections = [],
    renderItem,
    renderSectionHeader,
  }: {
    sections?: Array<{ title?: string; data: unknown[] }>;
    renderItem?: (arg: { item: unknown; index: number }) => ReactNode;
    renderSectionHeader?: (arg: { section: { title?: string } }) => ReactNode;
  }) => (
    <div>
      {sections.map((section, sectionIndex) => (
        <div key={String(sectionIndex)}>
          {renderSectionHeader ? renderSectionHeader({ section }) : null}
          {section.data.map((item, index) => (
            <div key={`${sectionIndex}-${index}`}>
              {renderItem ? renderItem({ item, index }) : null}
            </div>
          ))}
        </div>
      ))}
    </div>
  );

  return {
    View,
    ScrollView,
    Text,
    FlatList,
    SectionList,
    Animated: {
      Value: class Value {
        constructor(public value: number) {}
        setValue(next: number) {
          this.value = next;
        }
        stopAnimation() {}
        // `interpolate` is called at render time by components that style via
        // Animated.View (e.g. @mylife/books `BookCard`, `GlassCard`). Return a
        // static string close enough to the outputRange head so jsdom can paint
        // it without the component tree throwing `bgColor.interpolate is not a
        // function`. The exact value doesn't matter for assertions; what
        // matters is that it's a valid style primitive.
        interpolate(config: { outputRange?: unknown[] }) {
          const out = Array.isArray(config?.outputRange) ? config.outputRange[0] : undefined;
          return typeof out === 'string' || typeof out === 'number' ? out : 0;
        }
      },
      View: primitive('div'),
      parallel: () => ({ start: (cb?: () => void) => cb?.(), stop: vi.fn() }),
      sequence: () => ({ start: (cb?: () => void) => cb?.(), stop: vi.fn() }),
      spring: () => ({ start: (cb?: () => void) => cb?.(), stop: vi.fn() }),
      timing: () => ({ start: (cb?: () => void) => cb?.(), stop: vi.fn() }),
      loop: () => ({ start: vi.fn(), stop: vi.fn() }),
    },
    Modal: ({ children, visible, ...props }: { children?: ReactNode; visible?: boolean; [key: string]: unknown }) => {
      if (!visible) return null;
      const domProps = { ...props } as Record<string, unknown>;
      delete domProps.transparent;
      delete domProps.animationType;
      delete domProps.onRequestClose;
      return <div data-testid="modal" {...domProps}>{children}</div>;
    },
    RefreshControl: primitive('div'),
    Image: primitive('img'),
    ActivityIndicator: () => <div data-testid="activity-indicator" />,
    Pressable: ({
      onPress,
      children,
      disabled,
      style,
      ...props
    }: {
      onPress?: () => void;
      children?: ReactNode;
      disabled?: boolean;
      style?: unknown;
      [key: string]: unknown;
    }) => {
      const domProps = { ...props } as Record<string, unknown>;
      if (typeof domProps.accessibilityLabel === 'string') {
        domProps['aria-label'] = domProps.accessibilityLabel;
        delete domProps.accessibilityLabel;
      }
      delete domProps.activeOpacity;
      let resolvedStyle = style;
      if (typeof resolvedStyle === 'function') resolvedStyle = resolvedStyle({ pressed: false });
      if (Array.isArray(resolvedStyle)) resolvedStyle = Object.assign({}, ...resolvedStyle.filter(Boolean));
      return (
      <div
        role="button"
        tabIndex={0}
        aria-disabled={disabled ? 'true' : undefined}
        style={resolvedStyle as React.CSSProperties | undefined}
        onClick={(event) => {
          if (disabled) return;
          if (event.target !== event.currentTarget) return;
          onPress?.();
        }}
        {...domProps}
      >
        {children}
      </div>
    );
    },
    TouchableOpacity: ({
      onPress,
      children,
      ...props
    }: {
      onPress?: () => void;
      children?: ReactNode;
      [key: string]: unknown;
    }) => {
      const domProps = { ...props } as Record<string, unknown>;
      if (typeof domProps.accessibilityLabel === 'string') {
        domProps['aria-label'] = domProps.accessibilityLabel;
        delete domProps.accessibilityLabel;
      }
      delete domProps.activeOpacity;
      return (
        <div
          role="button"
          tabIndex={0}
          onClick={(event) => {
            if (event.target !== event.currentTarget) return;
            onPress?.();
          }}
          {...domProps}
        >
          {children}
        </div>
      );
    },
    TextInput: ({
      value,
      onChangeText,
      placeholder,
      ...props
    }: {
      value?: string;
      onChangeText?: (value: string) => void;
      placeholder?: string;
      [key: string]: unknown;
    }) => (
      (() => {
        const domProps = { ...props } as Record<string, unknown>;
        delete domProps.placeholderTextColor;
        delete domProps.autoCapitalize;
        delete domProps.autoCorrect;
        delete domProps.keyboardType;
        return (
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) =>
          onChangeText?.((event.target as HTMLInputElement).value)
        }
        {...domProps}
      />
        );
      })()
    ),
    Switch: ({
      value,
      onValueChange,
      ...props
    }: {
      value?: boolean;
      onValueChange?: (value: boolean) => void;
      [key: string]: unknown;
    }) => {
      const domProps = { ...props } as Record<string, unknown>;
      delete domProps.trackColor;
      delete domProps.thumbColor;
      return (
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) =>
            onValueChange?.((event.target as HTMLInputElement).checked)
          }
          {...domProps}
        />
      );
    },
    StyleSheet: {
      create: <T extends Record<string, unknown>>(styles: T): T => styles,
      flatten: (style: unknown): Record<string, unknown> =>
        Array.isArray(style)
          ? Object.assign(
              {},
              ...(style.flat(Infinity).filter(Boolean) as Record<string, unknown>[]),
            )
          : ((style as Record<string, unknown>) ?? {}),
      hairlineWidth: 1,
      absoluteFillObject: {},
    },
    Alert: {
      alert: vi.fn(),
      prompt: vi.fn(),
    },
    Share: {
      share: vi.fn().mockResolvedValue({ action: 'sharedAction' }),
    },
    Linking: {
      openURL: vi.fn().mockResolvedValue(true),
    },
    Dimensions: {
      get: () => ({ width: 390, height: 844 }),
    },
    Platform: {
      OS: 'ios',
      select: (spec: Record<string, unknown>) =>
        (spec.ios ?? spec.native ?? spec.default),
    },
    TurboModuleRegistry: {
      getEnforcing: () => ({}),
      get: () => ({}),
    },
  };
});

vi.mock('expo-router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
}));

vi.mock('@expo/vector-icons', () => {
  const Icon = primitive('span');
  return new Proxy(
    {
      MaterialIcons: Icon,
      AntDesign: Icon,
      createIconSet: vi.fn(() => Icon),
    },
    {
      get: (target, prop) => {
        if (prop in target) {
          return target[prop as keyof typeof target];
        }
        return Icon;
      },
    },
  );
});

vi.mock('expo-blur', () => ({
  BlurView: primitive('div'),
}));

vi.mock('expo-linear-gradient', () => ({
  LinearGradient: primitive('div'),
}));

// Pulled in transitively via `components/DatabaseProvider` ->
// `hooks/use-auto-backup` -> `lib/backup-scheduler` -> `lib/backup.ts`.
// Each of these Expo native modules resolves to `requireNativeModule(...)`
// which crashes in jsdom. Stub the minimal surface each one needs.
vi.mock('expo-sharing', () => ({
  isAvailableAsync: vi.fn(async () => false),
  shareAsync: vi.fn(async () => undefined),
}));

vi.mock('expo-file-system', () => ({
  documentDirectory: '/tmp/',
  cacheDirectory: '/tmp/',
  writeAsStringAsync: vi.fn(async () => undefined),
  readAsStringAsync: vi.fn(async () => ''),
  deleteAsync: vi.fn(async () => undefined),
  getInfoAsync: vi.fn(async () => ({ exists: false })),
  makeDirectoryAsync: vi.fn(async () => undefined),
  readDirectoryAsync: vi.fn(async () => []),
  EncodingType: { UTF8: 'utf8', Base64: 'base64' },
}));

vi.mock('expo-document-picker', () => ({
  getDocumentAsync: vi.fn(async () => ({ canceled: true })),
}));

vi.mock('react-native-svg', () => {
  const Svg = primitive('svg');
  return {
    default: Svg,
    Svg,
    Circle: primitive('circle'),
    Defs: primitive('defs'),
    G: primitive('g'),
    Line: primitive('line'),
    LinearGradient: primitive('linearGradient'),
    Path: primitive('path'),
    Polyline: primitive('polyline'),
    Rect: primitive('rect'),
    Stop: primitive('stop'),
    Text: primitive('text'),
  };
});

vi.mock('react-native-gesture-handler', () => ({
  Swipeable: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

// Pulled in by hub `_layout.tsx` (tab bar uses `useSafeAreaInsets`). The real
// package ships a TSX source entry with Flow `import typeof` syntax that
// esbuild can't parse, so we shim the tiny hook-and-provider surface the hub
// screens touch.
vi.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
  SafeAreaView: primitive('div'),
  SafeAreaInsetsContext: {
    Consumer: ({ children }: { children: (insets: { top: number; bottom: number; left: number; right: number }) => ReactNode }) =>
      <>{children({ top: 0, bottom: 0, left: 0, right: 0 })}</>,
  },
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
}));

vi.mock('react-native-draggable-flatlist', () => {
  const DraggableFlatList = ({
    data = [],
    keyExtractor,
    renderItem,
  }: {
    data?: unknown[];
    keyExtractor?: (item: unknown, index: number) => string;
    renderItem?: (arg: {
      item: unknown;
      index: number;
      drag: () => void;
      isActive: boolean;
    }) => ReactNode;
  }) => (
    <div>
      {data.map((item, index) => (
        <div key={keyExtractor ? keyExtractor(item, index) : String(index)}>
          {renderItem ? renderItem({ item, index, drag: vi.fn(), isActive: false }) : null}
        </div>
      ))}
    </div>
  );

  return {
    __esModule: true,
    default: DraggableFlatList,
  };
});

// lucide-react-native is NOT vi.mocked: the resolve.alias in
// vitest.config.ts redirects it to test/stubs/lucide-react-native.cjs,
// whose CJS Proxy serves unlimited named icon exports. Vitest 4's mocker
// statically validates factory exports, which a Proxy cannot enumerate,
// so the alias-level stub is the only layer that supports arbitrary
// `import { AnyIcon }` usage.

// Fully synthetic factory ON PURPOSE: spreading importOriginal() here pulls
// the real @mylife/ui barrel (every component) into each worker, which
// grinds ~6 min per file at 92% CPU and OOM-kills the fork (measured
// 2026-06-10). Vitest 4 validates every accessed export, so when a screen
// starts using a new token or component, add it HERE rather than partial-
// mocking the real package.
vi.mock('@mylife/ui', () => ({
  Text: ({
    children,
    numberOfLines: _numberOfLines,
    onPress,
    ...props
  }: {
    children?: ReactNode;
    numberOfLines?: number;
    onPress?: () => void;
    [key: string]: unknown;
  }) => (
    <span onClick={onPress} {...props}>
      {children}
    </span>
  ),
  Card: ({
    children,
    ...props
  }: {
    children?: ReactNode;
    [key: string]: unknown;
  }) => <div {...props}>{children}</div>,
  Button: ({
    label,
    onPress,
    ...props
  }: {
    label: string;
    onPress?: () => void;
    [key: string]: unknown;
  }) => (
    <button onClick={onPress} {...props}>
      {label}
    </button>
  ),
  SearchBar: ({
    value,
    onChangeText,
    placeholder,
    onScanPress,
  }: {
    value?: string;
    onChangeText?: (value: string) => void;
    placeholder?: string;
    onScanPress?: () => void;
  }) => (
    <div>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) =>
          onChangeText?.((event.target as HTMLInputElement).value)
        }
      />
      {onScanPress ? <button onClick={onScanPress}>Scan</button> : null}
    </div>
  ),
  BookCover: ({ title }: { title: string }) => <div>{title}</div>,
  StarRating: ({ rating }: { rating: number }) => <div>{`rating:${rating}`}</div>,
  ReadingGoalRing: ({ current, target }: { current: number; target: number }) => (
    <div>{`${current}/${target}`}</div>
  ),
  fontFamilies: {
    display: 'Plus Jakarta Sans',
    body: 'Inter',
    serif: 'Literata',
    fallback: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  OnboardingFlow: () => null,
  colors: {
    background: '#0A0A0F',
    surface: '#12121A',
    surfaceElevated: '#1A1A24',
    text: '#F0F0F5',
    textSecondary: 'rgba(240,240,245,0.65)',
    textTertiary: 'rgba(240,240,245,0.35)',
    border: 'rgba(255,255,255,0.06)',
    danger: '#FF453A',
    success: '#30D158',
    warning: '#FF9F0A',
    accent: '#3B82F6',
    glass: 'rgba(255,255,255,0.04)',
    glassStrong: 'rgba(255,255,255,0.08)',
    glassBorder: 'rgba(255,255,255,0.10)',
    star: '#ffcc66',
    modules: {
      books: '#C9894D',
      budget: '#22C55E',
      car: '#3B82F6',
      closet: '#E879A8',
      cycle: '#F472B6',
      fast: '#14B8A6',
      flash: '#FBBF24',
      forums: '#7C4DFF',
      garden: '#22C55E',
      habits: '#8B5CF6',
      health: '#10B981',
      homes: '#D97706',
      journal: '#A78BFA',
      mail: '#3B82F6',
      market: '#E11D48',
      meds: '#06B6D4',
      mood: '#FB923C',
      notes: '#64748B',
      nutrition: '#F97316',
      pets: '#F97316',
      recipes: '#F97316',
      rsvp: '#FB7185',
      stars: '#8B5CF6',
      subs: '#10B981',
      surf: '#3B82F6',
      trails: '#65A30D',
      voice: '#EF4444',
      words: '#0EA5E9',
      workouts: '#EF4444',
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 40,
  },
  borderRadius: {
    sm: 4,
    md: 8,
    xl: 999,
  },
  glass: {
    card: { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderRadius: 16 },
    strong: { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', borderRadius: 16 },
    dock: { backgroundColor: 'rgba(18,18,26,0.65)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 24 },
  },
  glassWeb: {
    card: 'blur(40px) saturate(180%)',
    strong: 'blur(60px) saturate(200%)',
    dock: 'blur(80px) saturate(200%)',
  },
  surfaceTiers: {
    lowest: '#0E0E13',
    low: '#1B1B20',
    container: '#1F1F25',
    high: '#2A292F',
    highest: '#35343A',
  },
  glassFills: {
    subtle: 'rgba(255,255,255,0.04)',
    standard: 'rgba(255,255,255,0.08)',
    prominent: 'rgba(255,255,255,0.12)',
    dock: 'rgba(18,18,26,0.65)',
  },
  glassBorders: {
    subtle: 'rgba(255,255,255,0.06)',
    standard: 'rgba(255,255,255,0.10)',
    prominent: 'rgba(255,255,255,0.14)',
  },
  EmptyState: ({ icon, title, message, actionLabel, onAction }: { icon?: string; title: string; message?: string; actionLabel?: string; onAction?: () => void }) => (
    <div data-testid="empty-state">
      {icon ? <span>{icon}</span> : null}
      <span>{title}</span>
      {message ? <span>{message}</span> : null}
      {actionLabel && onAction ? <button onClick={onAction}>{actionLabel}</button> : null}
    </div>
  ),
  LoadingState: ({ rows }: { rows?: number }) => (
    <div data-testid="loading-state">{`Loading ${rows ?? 3} rows`}</div>
  ),
  ErrorState: ({ message, onRetry }: { message?: string; onRetry?: () => void }) => (
    <div data-testid="error-state">
      <span>{message ?? 'Something went wrong'}</span>
      {onRetry ? <button onClick={onRetry}>Try Again</button> : null}
    </div>
  ),
  // Theme hooks introduced by the ThemeProvider rollout. Return minimal
  // token shapes so consumers that destructure can render in tests.
  useThemeColors: () => ({
    background: '#131318',
    surface: '#2A292F',
    text: '#E4E1E9',
    textSecondary: '#D6C3B5',
    primary: '#FFB877',
    primaryContainer: '#C9894D',
    border: 'rgba(255,255,255,0.10)',
    glass: 'rgba(255,255,255,0.03)',
    glassStrong: 'rgba(255,255,255,0.08)',
    glassBorder: 'rgba(255,255,255,0.10)',
    tertiary: '#8BCFF0',
    danger: '#FFB4AB',
    success: '#30D158',
  }),
  useThemeLayout: () => ({
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
    radius: { sm: 4, md: 8, lg: 16, xl: 24 },
  }),
  useThemeSurfaces: () => ({
    cornerRadius: { card: 16, sheet: 24, pill: 999 },
  }),
  useTheme: () => ({
    profile: 'cool-obsidian',
    colors: { background: '#131318', surface: '#2A292F', text: '#E4E1E9' },
    glass: {
      cardFill: 'rgba(255,255,255,0.03)',
      cardBorder: 'rgba(255,255,255,0.10)',
      cardFillStrong: 'rgba(255,255,255,0.08)',
    },
  }),
  ThemeProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
  THEME_PRESETS: {},
  COOL_OBSIDIAN: { id: 'cool-obsidian' },
  ThemeProfileSchema: { parse: (v: unknown) => v },
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
