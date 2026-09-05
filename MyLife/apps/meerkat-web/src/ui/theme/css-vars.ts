// Map a resolved MkColors set to the --mk-* CSS custom properties defined in
// tokens.css, and apply them at runtime so any active theme (preset or custom)
// reskins the whole app through one path. tokens.css remains the no-JS Open
// Burrow fallback; once JS runs, these inline vars on <html> take over.

import type { MkColors } from '@mylife/meerkat-theme';

/** A minimal element-style target so this is testable without a DOM. */
export interface StyleTarget {
  style: { setProperty(property: string, value: string): void };
}

function toCssVarName(token: string): string {
  // surfaceElevated -> --mk-surface-elevated ; onAccent -> --mk-on-accent
  return `--mk-${token.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
}

/** The 22 resolved tokens as a `{ '--mk-*': value }` map. */
export function themeToCssVars(colors: MkColors): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [token, value] of Object.entries(colors)) {
    out[toCssVarName(token)] = value;
  }
  return out;
}

/**
 * Apply the resolved colors as inline custom properties on `target` (default the
 * document root). No-op when there is neither a target nor a document (Node).
 */
export function applyThemeVars(colors: MkColors, target?: StyleTarget): void {
  const el: StyleTarget | null =
    target ?? (typeof document !== 'undefined' ? document.documentElement : null);
  if (!el) return;
  const vars = themeToCssVars(colors);
  for (const name of Object.keys(vars)) {
    el.style.setProperty(name, vars[name]);
  }
}
