// Vitest 4 matcher typing for @testing-library/jest-dom.
//
// jest-dom 6.x's bundled '/vitest' entry augments vitest 3's Assertion
// interface, which no longer reaches vitest 4's expect typings. Vitest 3.2+
// exposes `Matchers` as the supported augmentation point; wiring jest-dom's
// matcher map into it restores toBeInTheDocument/toBeVisible/etc. types.
// Runtime registration happens in test/setup.tsx via expect.extend.

import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-empty-object-type
  interface Matchers<T = any> extends TestingLibraryMatchers<any, T> {}
}
