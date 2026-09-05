import { Platform } from 'react-native';
import {
  RECIPES_TYPOGRAPHY_ROUNDED,
  type RecipesRoundedVariant,
} from '../typography';

/**
 * Resolve the rounded font family for the current runtime. iOS returns
 * undefined so consumers can opt into the system SF Rounded face by setting
 * fontVariant: ['rounded']; Android and web return Plus Jakarta Sans.
 *
 * Lives in the primitives subdirectory so the RN-only Platform import is not
 * pulled into the @mylife/bestchef package barrel.
 */
export function getRoundedFontFamily(): string | undefined {
  return Platform.select<string | undefined>({
    ios: undefined,
    default: 'PlusJakartaSans',
  });
}

/**
 * Convenience helper that returns a single ramp entry merged with the
 * platform-aware fontFamily. Use this from RN screens when you want the full
 * are-blaze rounded variant without juggling family resolution.
 */
export function roundedTextStyle(variant: RecipesRoundedVariant) {
  return {
    ...RECIPES_TYPOGRAPHY_ROUNDED[variant],
    fontFamily: getRoundedFontFamily(),
  };
}
