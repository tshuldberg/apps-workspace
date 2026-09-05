import { describe, expect, it } from 'vitest';
import {
  CYCLE_PHASE_COLORS,
  getPhaseColor,
  type CyclePhaseKey,
} from '../ui/tokens';

describe('PhaseRing phase-to-color mapping', () => {
  it('maps every cycle phase to the correct obsidian noir token', () => {
    expect(CYCLE_PHASE_COLORS.menstrual).toBe('#EF4444');
    expect(CYCLE_PHASE_COLORS.follicular).toBe('#FBCFE8');
    expect(CYCLE_PHASE_COLORS.ovulation).toBe('#F472B6');
    expect(CYCLE_PHASE_COLORS.luteal).toBe('#FDA4AF');
  });

  it('exposes exactly 4 phase entries', () => {
    const keys = Object.keys(CYCLE_PHASE_COLORS) as CyclePhaseKey[];
    expect(keys.sort()).toEqual(
      ['follicular', 'luteal', 'menstrual', 'ovulation'].sort(),
    );
  });

  it('returns the same token via the getPhaseColor helper', () => {
    expect(getPhaseColor('menstrual')).toBe(CYCLE_PHASE_COLORS.menstrual);
    expect(getPhaseColor('follicular')).toBe(CYCLE_PHASE_COLORS.follicular);
    expect(getPhaseColor('ovulation')).toBe(CYCLE_PHASE_COLORS.ovulation);
    expect(getPhaseColor('luteal')).toBe(CYCLE_PHASE_COLORS.luteal);
  });

  it('falls back to ovulation when the phase is unknown or missing', () => {
    expect(getPhaseColor(null)).toBe(CYCLE_PHASE_COLORS.ovulation);
    expect(getPhaseColor(undefined)).toBe(CYCLE_PHASE_COLORS.ovulation);
    expect(getPhaseColor('mystery')).toBe(CYCLE_PHASE_COLORS.ovulation);
  });
});
