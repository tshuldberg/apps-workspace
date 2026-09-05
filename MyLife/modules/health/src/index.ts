// Web-safe barrel for @mylife/health.
//
// All exports here (module definition, CRUD, types, engines, tokens) are free
// of React Native imports. Web bundlers (Next.js / Rollup) resolve the
// package's `default` export condition to this file.
//
// React Native consumers resolve the `react-native` condition to
// `./index.native.ts`, which re-exports from `./exports` (note: NOT from
// `./index` — doing so would trigger `moduleSuffixes: [".native", ""]` in the
// mobile tsconfig to loop back here and then forward to itself).
//
// The shared body lives in `./exports.ts` so both barrels can re-export from
// a neutrally-named file that has no `.native` sibling.

export * from './exports';
