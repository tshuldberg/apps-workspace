import type { FastingZone } from './types';

/**
 * Configurable fasting zones. Language intentionally avoids medical certainty.
 */
export const FASTING_ZONES: FastingZone[] = [
  {
    id: 'fed-state',
    name: 'Fed State',
    startHour: 0,
    endHour: 4,
    title: 'Insulin rising',
    description:
      'After eating, research suggests insulin may stay elevated while your body prioritizes glucose use.',
  },
  {
    id: 'early-fasting',
    name: 'Early Fasting',
    startHour: 4,
    endHour: 8,
    title: 'Insulin dropping',
    description:
      'Insulin may begin trending down and glycogen use may increase as your eating window gets farther away.',
  },
  {
    id: 'fat-burning',
    name: 'Fat Burning',
    startHour: 8,
    endHour: 12,
    title: 'Glucagon activity may increase',
    description:
      'Many people may begin relying more on stored energy in this range, though timing varies person to person.',
  },
  {
    id: 'ketosis-beginning',
    name: 'Ketosis Beginning',
    startHour: 12,
    endHour: 18,
    title: 'Ketone production may rise',
    description:
      'Some users may see early ketone increases here, especially after consistent fasting habits.',
  },
  {
    id: 'deep-ketosis',
    name: 'Deep Ketosis',
    startHour: 18,
    endHour: 24,
    title: 'Sustained fasting window',
    description:
      'Longer fasting windows may keep ketone production elevated for some people.',
  },
  {
    id: 'autophagy-possible',
    name: 'Autophagy Possible',
    startHour: 24,
    endHour: null,
    title: 'Extended fast territory',
    description:
      'Some research suggests cellular clean-up processes may increase in longer fasts, but results are not universal.',
  },
];

/**
 * Resolve the current zone from elapsed seconds.
 */
export function getCurrentFastingZone(elapsedSeconds: number): FastingZone {
  const elapsedHours = Math.max(0, elapsedSeconds / 3600);

  for (const zone of FASTING_ZONES) {
    const inZone = zone.endHour == null
      ? elapsedHours >= zone.startHour
      : elapsedHours >= zone.startHour && elapsedHours < zone.endHour;

    if (inZone) {
      return zone;
    }
  }

  return FASTING_ZONES[FASTING_ZONES.length - 1];
}

/**
 * 0..1 progress inside the active zone for progress visuals.
 */
export function getCurrentZoneProgress(elapsedSeconds: number): number {
  const zone = getCurrentFastingZone(elapsedSeconds);
  const elapsedHours = Math.max(0, elapsedSeconds / 3600);

  if (zone.endHour == null) {
    return 1;
  }

  const span = Math.max(0.1, zone.endHour - zone.startHour);
  const raw = (elapsedHours - zone.startHour) / span;
  return Math.max(0, Math.min(1, raw));
}
