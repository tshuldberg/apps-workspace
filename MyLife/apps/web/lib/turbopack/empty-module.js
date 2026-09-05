/**
 * Turbopack loader that emits an empty module. Used to stub out icon-font
 * assets (.ttf / .otf / .woff / .woff2) from `@expo/vector-icons` and other
 * React Native icon packages that are never rendered on web.
 *
 * Turbopack's loader API is a plain function that receives the raw source
 * and returns a module source string. Returning `module.exports = null;`
 * gives downstream code a defined value if anything ever actually imports
 * one of these by module path, while keeping the bundle size at zero.
 */
module.exports = function emptyModule() {
  return 'module.exports = null;';
};
