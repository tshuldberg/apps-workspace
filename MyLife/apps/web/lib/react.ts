import { useCallback, useRef } from 'react';

export { useState, useCallback, useEffect } from 'react';
export type { CSSProperties } from 'react';

/**
 * Stable-identity event callback. React's `useEffectEvent` is still experimental
 * and is not exported from the stable React 19 runtime, so importing it directly
 * crashes at prerender (`useEffectEvent is not a function`). This userland
 * equivalent keeps the same semantics: a stable function reference that always
 * invokes the latest closure, safe to list in effect dependency arrays.
 */
export function useEffectEvent<TArgs extends unknown[], TReturn>(
  handler: (...args: TArgs) => TReturn,
): (...args: TArgs) => TReturn {
  const ref = useRef(handler);
  ref.current = handler;
  return useCallback((...args: TArgs) => ref.current(...args), []);
}
