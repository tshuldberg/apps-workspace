export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(1)} GB`;
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function parseSize(s: string): number {
  const match = s.match(/^([\d.]+)([BKMGTP]i?)$/i);
  if (!match) return 0;
  const val = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  const multipliers: Record<string, number> = {
    B: 1,
    K: 1024,
    KI: 1024,
    M: 1024 ** 2,
    MI: 1024 ** 2,
    G: 1024 ** 3,
    GI: 1024 ** 3,
    T: 1024 ** 4,
    TI: 1024 ** 4,
  };
  return val * (multipliers[unit] ?? 1);
}
