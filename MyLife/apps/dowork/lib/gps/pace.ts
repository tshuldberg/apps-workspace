// Pure pace-unit conversion for the GPS screen. Lives outside gps.tsx so it
// can be unit tested without pulling in react-native.

export const METERS_PER_MILE = 1609.34;

// calculatePace (from @mylife/workouts) always returns seconds per
// kilometer; convert to seconds per mile so the displayed pace matches the
// active distance unit.
export function paceForUnit(secPerKm: number, distanceUnit: 'mi' | 'km'): number {
  return distanceUnit === 'mi' ? secPerKm * (METERS_PER_MILE / 1000) : secPerKm;
}
