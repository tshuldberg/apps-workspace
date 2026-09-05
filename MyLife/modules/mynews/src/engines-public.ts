/**
 * RSC-safe public engines subpath (`@mylife/mynews/engines`).
 *
 * Re-exports ONLY the pure engines (diff, credibility, dupes) plus type-only
 * model shapes. This file must never import from `data/`, `signing/`, React,
 * or `@mylife/sync`: the package barrel pulls the signing module, which
 * imports `@mylife/sync`, whose entry re-exports React client hooks and
 * breaks `next build` inside a Server Component. A shell test in
 * apps/mynews-web guards this import graph the same way the cloud-fetch
 * subpath is guarded.
 */
export * from './engines/diff';
export * from './engines/credibility';
export * from './engines/dupes';
export * from './engines/rings';
// Report taxonomy: pure constants and helpers, no data/ or signing/ imports.
export * from './taxonomy';
// Screening is pure and dependency-free, so the console and web surfaces can
// import it from this RSC-safe subpath without pulling data/ or signing/.
export * from './screening';
export type {
  Article,
  ArticleRevision,
  ChangelogEntry,
  CredibilityEntry,
  EditSuggestion,
  Pledge,
  SuggestionType,
} from './models';
