'use strict';

// Vitest stub for expo-linear-gradient.
// The real package ships raw JSX inside build/LinearGradient.js, which
// vite/rollup cannot parse when a vi.mock in a test forces the transform
// pipeline to crawl it (5 (books) suites failed to collect this way).
// vitest.config.ts aliases the package here, same pattern as the
// lucide-react-native stub above.
//
// The component renders its children so tests can still assert on
// gradient-wrapped content.

const LinearGradient = ({ children }) => (children === undefined ? null : children);

module.exports = {
  __esModule: true,
  default: LinearGradient,
  LinearGradient,
};
