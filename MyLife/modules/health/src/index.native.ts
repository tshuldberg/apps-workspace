// React Native + Expo barrel for @mylife/health.
//
// Metro (mobile) resolves this via the `react-native` export condition set
// in package.json. Both barrels re-export from `./exports` (a neutrally-named
// file with no `.native` sibling) to avoid `moduleSuffixes: [".native", ""]`
// rewriting a `./index` re-export into a cycle.

export * from './exports';

// RN-coupled UI components. Web bundlers never see these because they resolve
// to `./index.ts` via the `default` condition.
export { SectionHeader } from './ui/SectionHeader';
export { GlassCard } from './ui/GlassCard';
export { VitalCard } from './ui/VitalCard';
export { ActivityRing } from './ui/ActivityRing';
export { GoalProgressCard } from './ui/GoalProgressCard';
export { SleepStageBar } from './ui/SleepStageBar';
export { StatBadge } from './ui/StatBadge';
export { GradientButton } from './ui/GradientButton';
export { QuickActionButton } from './ui/QuickActionButton';
