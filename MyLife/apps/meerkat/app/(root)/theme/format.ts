// format.ts: pure display formatters with NO react-native import.
//
// These live apart from tokens.ts (which imports react-native's Platform) so that
// pure logic modules and their Node/Vitest tests can use formatBytes/shortHex
// without pulling the native runtime. tokens.ts re-exports both for screens.

// Human-readable byte size, e.g. 1536 -> "1.5 KB".
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = unit === 0 ? value : Math.round(value * 10) / 10;
  return `${rounded} ${units[unit]}`;
}

// Short, readable form of a long hex id (public keys, content ids).
export function shortHex(hex: string, lead = 8, tail = 6): string {
  if (hex.length <= lead + tail + 1) return hex;
  return `${hex.slice(0, lead)}…${hex.slice(hex.length - tail)}`;
}
