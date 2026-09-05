// Edge mirror of modules/mynews/src/data/terms.ts. The edge cannot import the
// TS package, so CURRENT_TERMS_VERSION is duplicated here and both the module
// test and the edge test pin the literal to catch drift. Bump both together.
//
// mynews-publish and mynews-suggest reject with the typed 'terms-not-accepted'
// error (403) when the actor has not accepted THIS exact version. A bump
// re-gates every author and editor until they re-accept.

export const EDGE_CURRENT_TERMS_VERSION = '2026-07-05';

export const TERMS_NOT_ACCEPTED_ERROR = 'terms-not-accepted';
