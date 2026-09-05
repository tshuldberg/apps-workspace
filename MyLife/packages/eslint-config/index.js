module.exports = {
  extends: ['eslint:recommended'],
  parser: '@typescript-eslint/parser',
  // `react-hooks` is wired here (not behind a React-specific preset) because
  // module source files scattered across modules/**/ui and apps/mobile use
  // `// eslint-disable-next-line react-hooks/exhaustive-deps`. ESLint v9+
  // fails with "Definition for rule 'react-hooks/exhaustive-deps' was not
  // found" if a disable comment references a rule the config doesn't know,
  // which blocks the husky pre-commit gate for everyone. Keeping the plugin
  // loaded globally is cheap and makes the disable comments legitimate.
  plugins: ['@typescript-eslint', 'react-hooks'],
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  rules: {
    'no-undef': 'off',
    'no-unused-vars': 'off',
    // Core no-redeclare does not understand TypeScript overload signatures.
    // TypeScript itself is the duplicate-declaration authority for .ts/.tsx.
    'no-redeclare': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    // React Hooks correctness. `rules-of-hooks` is an error because
    // conditional hook calls are genuine, silent bugs and this rule
    // catches them at authoring time. `exhaustive-deps` stays as a
    // warning so intentional dep-array exclusions (documented with a
    // local disable comment) don't block commits.
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
  },
  ignorePatterns: ['dist/', '.next/', 'node_modules/'],
  overrides: [
    {
      files: [
        '**/__tests__/**/*.{ts,tsx}',
        '**/*.test.{ts,tsx}',
      ],
      globals: {
        afterEach: 'readonly',
        beforeEach: 'readonly',
        describe: 'readonly',
        expect: 'readonly',
        it: 'readonly',
        vi: 'readonly',
      },
    },
  ],
};
