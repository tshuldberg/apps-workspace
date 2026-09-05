import type { NextConfig } from 'next';

/**
 * Next.js config for @mylife/web.
 *
 * Two things matter most here:
 *
 * 1. `transpilePackages` must list every workspace `@mylife/*` module the
 *    web app imports, plus every RN/Expo package those modules drag in
 *    transitively. Next's default rule is "don't parse anything under
 *    node_modules as source" -- workspace packages exist as real sources
 *    (not built dist), so they have to be listed explicitly. Missing one
 *    shows up as `Module parse failed: Unexpected token` on raw TypeScript.
 *
 * 2. `turbopack.rules` tells Turbopack what to do with non-JS assets (.ttf,
 *    .otf, .woff, .woff2). The `@expo/vector-icons` package ships a set of
 *    icon-font `.ttf` files alongside its TS sources and imports them as
 *    modules (`import font from './MaterialIcons.ttf'`). Without a rule,
 *    Turbopack errors with `Unknown module type`. We alias these as empty
 *    JS modules: the web bundle never actually renders `@expo/vector-icons`
 *    (mobile-only), but Turbopack still walks the import graph so the
 *    assets have to resolve to something.
 *
 * The companion source-side fix is: every module's main barrel exports only
 * design tokens (pure values, no RN), and mobile imports RN components from
 * `@mylife/<module>/ui` directly. See `modules/<name>/src/index.ts`.
 *
 * Two durable safeguards keep this from regressing:
 *
 *   a. `@mylife/ui` is published with `"sideEffects": false` (see
 *      `packages/ui/package.json`). Its barrel re-exports both pure tokens and
 *      react-native components, but it has no real import side effects, so the
 *      bundler can tree-shake the RN-laden components when web code imports
 *      only tokens. Mobile still imports the bare barrel freely.
 *   b. A CI/lint guard, `scripts/check-web-ui-barrel-imports.mjs`, fails if any
 *      `apps/web/**` file imports the bare `@mylife/ui` specifier for a VALUE
 *      (type-only imports are allowed). Web code must import tokens from an
 *      explicit subpath, e.g. `@mylife/ui/src/tokens/typography`. Run it with
 *      `node scripts/check-web-ui-barrel-imports.mjs`.
 */

// Every @mylife/* workspace package the web app could pull in. Keep this in
// sync with `packages/` and `modules/` — a missing entry means raw TS parse
// failures in `next build`.
const MYLIFE_WORKSPACE_PACKAGES = [
  // Hub packages
  '@mylife/ui',
  '@mylife/module-registry',
  '@mylife/db',
  '@mylife/auth',
  '@mylife/entitlements',
  '@mylife/billing-config',
  '@mylife/subscription',
  '@mylife/migration',
  '@mylife/onboarding',
  '@mylife/search',
  '@mylife/notifications',
  '@mylife/engagement',
  '@mylife/intelligence',
  '@mylife/sync',
  '@mylife/social',
  '@mylife/errors',
  '@mylife/automations',

  // All modules (some pull zero RN; safest to list them all)
  '@mylife/books',
  '@mylife/budget',
  '@mylife/car',
  '@mylife/classes',
  '@mylife/closet',
  '@mylife/create',
  '@mylife/cycle',
  '@mylife/dining',
  '@mylife/fast',
  '@mylife/flash',
  '@mylife/forums',
  '@mylife/friends',
  '@mylife/garden',
  '@mylife/habits',
  '@mylife/health',
  '@mylife/homes',
  '@mylife/journal',
  '@mylife/mail',
  '@mylife/market',
  '@mylife/meds',
  '@mylife/mood',
  '@mylife/notes',
  '@mylife/nutrition',
  '@mylife/payments',
  '@mylife/pets',
  '@mylife/presence',
  '@mylife/bestchef',
  '@mylife/rsvp',
  '@mylife/shop',
  '@mylife/sleep',
  '@mylife/sports',
  '@mylife/stars',
  '@mylife/subs',
  '@mylife/surf',
  '@mylife/trails',
  '@mylife/travel',
  '@mylife/voice',
  '@mylife/words',
  '@mylife/workouts',
];

// Standalone companion packages consumed via path aliases / passthrough.
const STANDALONE_WORKSPACE_PACKAGES = [
  '@myfast/shared',
  '@myfast/ui',
  '@mycar/shared',
  '@mycar/ui',
  '@humanhomes/shared',
  '@humanhomes/ui',
  '@mysurf/shared',
  '@mysurf/ui',
];

// Third-party packages that ship untranspiled TypeScript or ESM that Next's
// default Babel pipeline won't handle. `expo-image` specifically uses
// `import type` from `expo` and fails webpack's default parser without this.
const EXPO_RN_PACKAGES = [
  'expo',
  'expo-image',
  'expo-blur',
  'expo-linear-gradient',
  'expo-font',
  'expo-asset',
  'expo-constants',
  'expo-file-system',
  'expo-haptics',
  'expo-image-picker',
  'expo-linking',
  'expo-router',
  'expo-status-bar',
  '@expo/vector-icons',
  'react-native',
  'react-native-web',
  'react-native-svg',
  'react-native-safe-area-context',
  'react-native-vector-icons',
  'lucide-react-native',
];

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  experimental: {
    externalDir: true,
  },
  env: {
    NEXT_PUBLIC_WORKOUTS_BASE_PATH: '/workouts',
  },
  transpilePackages: [
    ...MYLIFE_WORKSPACE_PACKAGES,
    ...STANDALONE_WORKSPACE_PACKAGES,
    ...EXPO_RN_PACKAGES,
    'maplibre-gl',
  ],
  // Turbopack config for `next dev --turbopack`. When `--turbopack` isn't
  // set, the `webpack:` block below handles the same concerns via extension
  // aliasing and resolve aliasing. Keep both in sync if you adjust one.
  turbopack: {
    // Map bare `react-native` imports to `react-native-web` so module barrels
    // that re-export RN UI components (Text, View, etc.) resolve to the web
    // implementation instead of dragging RN's Flow source into the bundle.
    // Two react-native versions resolve in the graph (0.81.x and 0.84.x); this
    // bare-specifier alias maps both, since neither version's web bundle should
    // ever import RN's native index.
    resolveAlias: {
      'react-native': 'react-native-web',
    },
    // Prefer `.web.*` source variants first, then the standard extensions, so
    // any platform-specific web files win and RN-only files are skipped.
    resolveExtensions: [
      '.web.tsx',
      '.web.ts',
      '.web.jsx',
      '.web.js',
      '.tsx',
      '.ts',
      '.jsx',
      '.js',
      '.mjs',
      '.json',
    ],
    rules: {
      // Treat icon-font assets from @expo/vector-icons (and similar RN icon
      // libraries) as empty JS modules on web. The web app doesn't render
      // native icon fonts -- it uses Material Symbols via Google Fonts CSS,
      // already loaded in `app/globals.css`.
      '*.ttf': { loaders: ['./lib/turbopack/empty-module.js'], as: '*.js' },
      '*.otf': { loaders: ['./lib/turbopack/empty-module.js'], as: '*.js' },
      '*.woff': { loaders: ['./lib/turbopack/empty-module.js'], as: '*.js' },
      '*.woff2': { loaders: ['./lib/turbopack/empty-module.js'], as: '*.js' },
    },
  },
  webpack: (config, { webpack }) => {
    config.resolve = config.resolve ?? {};
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    // Alias bare `react-native` -> `react-native-web`. Module barrels that
    // re-export RN UI components (mood, books, budget, meds, workouts,
    // nutrition, fast, ...) would otherwise pull in RN's Flow-typed
    // `index.js`, which webpack's parser cannot read (`Expected 'from', got
    // 'typeOf'`). Two RN versions (0.81.x and 0.84.x) resolve in the graph;
    // the bare-specifier alias `react-native$` maps both to RNW regardless of
    // version. The trailing `$` matches the package entry only, leaving deep
    // imports like `react-native/Libraries/...` to resolve normally.
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      'react-native$': 'react-native-web',
    };
    // Resolve `.web.*` source variants ahead of the defaults so any web-first
    // files win. Preserve whatever extensions webpack already configured.
    const defaultExtensions = config.resolve.extensions ?? [
      '.tsx',
      '.ts',
      '.jsx',
      '.js',
      '.mjs',
      '.json',
    ];
    config.resolve.extensions = [
      '.web.tsx',
      '.web.ts',
      '.web.jsx',
      '.web.js',
      ...defaultExtensions.filter((ext: string) => !ext.startsWith('.web.')),
    ];
    // react-native-web's source references the `__DEV__` global and reads
    // `process.env.NODE_ENV`. Define them so the web bundle compiles without a
    // ReferenceError. Next already defines `process.env.NODE_ENV`, but RNW also
    // wants the bare `__DEV__` flag.
    config.plugins = config.plugins ?? [];
    config.plugins.push(
      new webpack.DefinePlugin({
        __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
      }),
    );
    // Mirror the Turbopack font rule: empty out RN icon fonts so webpack's
    // default asset handling doesn't try to copy them into the web bundle.
    config.module = config.module ?? {};
    config.module.rules = config.module.rules ?? [];
    config.module.rules.push({
      test: /\.(ttf|otf|woff|woff2)$/,
      resourceQuery: { not: [/^\?url/] },
      use: 'null-loader',
    });
    return config;
  },
};

export default nextConfig;
