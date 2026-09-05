// Pure duration estimator for the superset builder. Lives outside
// superset.tsx so it can be unit tested without pulling in react-native.

export interface SupersetDurationSlot {
  sets: number;
  reps: number;
  restAfter: number;
}

// Superset rounds run every slot's set back-to-back, then rest once per
// round (not once per slot per set). Rest after a round uses the slowest
// slot's restAfter and the shared round count (the max sets across slots),
// so the rest term does not multiply out per slot.
export function estimateSupersetDurationSeconds(slots: SupersetDurationSlot[]): number {
  if (slots.length === 0) return 0;

  const workSeconds = slots.reduce(
    (total, slot) => total + slot.sets * Math.max(slot.reps, 8) * 3,
    0,
  );
  const roundCount = Math.max(...slots.map((slot) => slot.sets));
  const restPerRound = Math.max(...slots.map((slot) => slot.restAfter));

  return workSeconds + roundCount * restPerRound;
}
