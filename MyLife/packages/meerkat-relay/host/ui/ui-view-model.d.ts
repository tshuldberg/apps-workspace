// Types for the browser twin served at /ui-view-model.js. Zero duplication: the
// twin's shape IS the typed source of truth in host/ui-view-model.ts, so a TS
// importer (the drift-guard test) gets identical types. The runtime deep-equal
// drift guard in __tests__/ui-view-model.test.ts proves the twin's VALUES match.
export * from '../ui-view-model';
