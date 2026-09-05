export type CycleTempUnit = 'celsius' | 'fahrenheit';

// Session-scoped preferences until the full MyCycle settings persistence lands.
let currentTempUnit: CycleTempUnit = 'fahrenheit';

export function getCycleTempUnit(): CycleTempUnit {
  return currentTempUnit;
}

export function setCycleTempUnit(unit: CycleTempUnit): void {
  currentTempUnit = unit;
}
