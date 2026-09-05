// Web-safe UI barrel for @mylife/presence.
//
// Re-exports design tokens, typography, AND pure logic helpers since
// `./logic.ts` imports no RN. Full RN component surface lives in
// `./index.native.ts` which Metro picks on mobile.

export * from './tokens';
export * from './typography';
export * from './logic';
