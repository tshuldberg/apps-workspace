const FRACTION_MAP: Array<{ decimal: number; display: string }> = [
  { decimal: 0.125, display: '1/8' },
  { decimal: 0.25, display: '1/4' },
  { decimal: 1 / 3, display: '1/3' },
  { decimal: 0.375, display: '3/8' },
  { decimal: 0.5, display: '1/2' },
  { decimal: 0.625, display: '5/8' },
  { decimal: 2 / 3, display: '2/3' },
  { decimal: 0.75, display: '3/4' },
  { decimal: 0.875, display: '7/8' },
];

export function toFraction(decimal: number): string | null {
  const tolerance = 0.01;
  for (const { decimal: value, display } of FRACTION_MAP) {
    if (Math.abs(decimal - value) < tolerance) {
      return display;
    }
  }
  return null;
}

export function formatQuantity(value: number | null): string {
  if (value === null) return '';
  if (value === 0) return '0';

  const whole = Math.floor(value);
  const fractional = value - whole;
  if (fractional < 0.01) {
    return String(whole);
  }

  const fraction = toFraction(fractional);
  if (fraction) {
    return whole > 0 ? `${whole} ${fraction}` : fraction;
  }

  return String(Math.round(value * 100) / 100);
}
