import type { ThemeProfile } from '../schema';
import { COOL_OBSIDIAN } from './cool-obsidian';

/**
 * BestChef Obsidian preset.
 *
 * BestChef-branded alias of the Cool Obsidian (MyLife default) preset. This
 * remains the BestChef default until the are-blaze visual rollout flips the
 * default to bestchef-warm-cream / bestchef-warm-charcoal in P10.
 */
export const BESTCHEF_OBSIDIAN: ThemeProfile = {
  ...COOL_OBSIDIAN,
  id: 'bestchef-obsidian',
  name: 'BestChef Obsidian',
  description:
    'BestChef-branded Obsidian Noir. Default until are-blaze rollout finishes (P10).',
  author: 'BestChef',
};
