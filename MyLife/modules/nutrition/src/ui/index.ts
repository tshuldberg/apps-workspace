// Web-safe UI barrel for @mylife/nutrition.
//
// Re-exports ONLY design tokens and typography (pure values, no RN imports).
// Full component surface lives in `./index.native.ts`; Metro picks that on
// iOS/Android while web bundlers ignore `.native.ts` and read this file.
// See modules/budget/src/ui/index.ts for the documented pattern.

export * from './tokens';
export * from './typography';
