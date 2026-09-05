import type { HabitType, ProgramDifficulty, TimeOfDay } from '../types';

export interface ProgramHabitBlueprint {
  key: string;
  name: string;
  icon: string;
  description: string;
  habitType: HabitType;
  timeOfDay: TimeOfDay;
  baseTarget: number;
  unit?: string;
}

export interface ProgramDayPlanItem {
  key: string;
  name: string;
  icon: string;
  description: string;
  habitType: HabitType;
  timeOfDay: TimeOfDay;
  target: number;
  unit?: string;
}

export interface BuiltInProgram {
  id: string;
  name: string;
  description: string;
  icon: string;
  durationDays: number;
  difficulty: ProgramDifficulty;
  schedule: number[];
  focusArea: string;
  coverPalette: string[];
  enrolledCount: number;
  benefits: string[];
  expectedOutcomes: string[];
  scienceNote: string;
  habitBlueprints: ProgramHabitBlueprint[];
  dayPlan?: (target: number, day: number) => ProgramDayPlanItem[];
}

function linearInterpolate(
  keyframes: Array<{ day: number; value: number }>,
  totalDays: number,
): number[] {
  if (keyframes.length === 0) return Array(totalDays).fill(1);
  if (keyframes.length === 1) return Array(totalDays).fill(keyframes[0].value);

  const schedule: number[] = [];
  for (let day = 1; day <= totalDays; day++) {
    let before = keyframes[0];
    let after = keyframes[keyframes.length - 1];

    for (let index = 0; index < keyframes.length - 1; index++) {
      if (day >= keyframes[index].day && day <= keyframes[index + 1].day) {
        before = keyframes[index];
        after = keyframes[index + 1];
        break;
      }
    }

    if (day <= before.day) {
      schedule.push(before.value);
      continue;
    }

    if (day >= after.day) {
      schedule.push(after.value);
      continue;
    }

    const ratio = (day - before.day) / (after.day - before.day);
    schedule.push(Math.round(before.value + (after.value - before.value) * ratio));
  }

  return schedule;
}

function singlePlan(
  blueprint: ProgramHabitBlueprint,
  target: number,
): ProgramDayPlanItem[] {
  return [{
    key: blueprint.key,
    name: blueprint.name,
    icon: blueprint.icon,
    description: blueprint.description,
    habitType: blueprint.habitType,
    timeOfDay: blueprint.timeOfDay,
    target,
    unit: blueprint.unit,
  }];
}

function cappedListPlan(
  blueprints: ProgramHabitBlueprint[],
  target: number,
): ProgramDayPlanItem[] {
  return blueprints.slice(0, Math.max(1, target)).map((blueprint) => ({
    key: blueprint.key,
    name: blueprint.name,
    icon: blueprint.icon,
    description: blueprint.description,
    habitType: blueprint.habitType,
    timeOfDay: blueprint.timeOfDay,
    target: blueprint.baseTarget,
    unit: blueprint.unit,
  }));
}

export { linearInterpolate as interpolateSchedule };

export const BUILT_IN_PROGRAMS: BuiltInProgram[] = [
  {
    id: 'builtin_meditation_30',
    name: '30-Day Meditation Reset',
    description: 'Progress from a 3 minute reset to a 20 minute daily meditation ritual.',
    icon: '🧘',
    durationDays: 30,
    difficulty: 'beginner',
    schedule: linearInterpolate(
      [{ day: 1, value: 3 }, { day: 10, value: 8 }, { day: 20, value: 14 }, { day: 30, value: 20 }],
      30,
    ),
    focusArea: 'mind',
    coverPalette: ['#24133B', '#4C1D95', '#A78BFA'],
    enrolledCount: 18420,
    benefits: [
      'Lower baseline stress with a predictable daily reset.',
      'Build focus endurance before the workday accelerates.',
      'Create a calm anchor habit that pairs well with journaling or breathwork.',
    ],
    expectedOutcomes: ['Calmer mornings', 'Stronger focus blocks', 'Improved emotional regulation'],
    scienceNote: 'Short, repeated mindfulness sessions are easier to retain than occasional long sits, especially during the first month of habit formation.',
    habitBlueprints: [
      {
        key: 'meditate',
        name: 'Meditate',
        icon: '🫁',
        description: 'Guided breathing or silent meditation.',
        habitType: 'timed',
        timeOfDay: 'morning',
        baseTarget: 3,
        unit: 'min',
      },
    ],
    dayPlan: (target) => singlePlan({
      key: 'meditate',
      name: 'Meditate',
      icon: '🫁',
      description: 'Guided breathing or silent meditation.',
      habitType: 'timed',
      timeOfDay: 'morning',
      baseTarget: 3,
      unit: 'min',
    }, target),
  },
  {
    id: 'builtin_c25k',
    name: '30-Day Fitness Kickstart',
    description: 'Use walk-run progression, mobility resets, and hydration to build everyday momentum.',
    icon: '🏃',
    durationDays: 30,
    difficulty: 'intermediate',
    schedule: linearInterpolate(
      [{ day: 1, value: 12 }, { day: 10, value: 20 }, { day: 20, value: 28 }, { day: 30, value: 35 }],
      30,
    ),
    focusArea: 'body',
    coverPalette: ['#1A102B', '#312E81', '#60A5FA'],
    enrolledCount: 12984,
    benefits: [
      'Turn inconsistent workouts into a daily identity loop.',
      'Pair movement with recovery so the streak stays sustainable.',
      'Build proof that your body can handle gradual progression.',
    ],
    expectedOutcomes: ['Higher cardio confidence', 'More daily energy', 'Reliable movement routine'],
    scienceNote: 'Progressive overload works best when volume increases gradually and recovery is built into the same system instead of treated as optional.',
    habitBlueprints: [
      {
        key: 'movement',
        name: 'Run-Walk Session',
        icon: '🏃',
        description: 'Primary movement block for the day.',
        habitType: 'timed',
        timeOfDay: 'morning',
        baseTarget: 12,
        unit: 'min',
      },
      {
        key: 'mobility',
        name: 'Mobility Reset',
        icon: '🧎',
        description: 'Five minute cooldown or prep sequence.',
        habitType: 'timed',
        timeOfDay: 'afternoon',
        baseTarget: 5,
        unit: 'min',
      },
      {
        key: 'hydrate',
        name: 'Recovery Hydration',
        icon: '💧',
        description: 'Refill after the session finishes.',
        habitType: 'measurable',
        timeOfDay: 'afternoon',
        baseTarget: 1,
        unit: 'bottle',
      },
    ],
    dayPlan: (target) => [
      {
        key: 'movement',
        name: 'Run-Walk Session',
        icon: '🏃',
        description: 'Primary movement block for the day.',
        habitType: 'timed',
        timeOfDay: 'morning',
        target,
        unit: 'min',
      },
      {
        key: 'mobility',
        name: 'Mobility Reset',
        icon: '🧎',
        description: 'Five minute cooldown or prep sequence.',
        habitType: 'timed',
        timeOfDay: 'afternoon',
        target: 5,
        unit: 'min',
      },
      {
        key: 'hydrate',
        name: 'Recovery Hydration',
        icon: '💧',
        description: 'Refill after the session finishes.',
        habitType: 'measurable',
        timeOfDay: 'afternoon',
        target: 1,
        unit: 'bottle',
      },
    ],
  },
  {
    id: 'builtin_morning_routine',
    name: 'Morning Routine Builder',
    description: 'Layer one small ritual at a time until your first hour runs on rails.',
    icon: '☀️',
    durationDays: 28,
    difficulty: 'beginner',
    schedule: linearInterpolate(
      [{ day: 1, value: 1 }, { day: 8, value: 2 }, { day: 15, value: 3 }, { day: 22, value: 4 }, { day: 28, value: 4 }],
      28,
    ),
    focusArea: 'mind',
    coverPalette: ['#1C1330', '#6D28D9', '#FDBA74'],
    enrolledCount: 22134,
    benefits: [
      'Reduce decision fatigue before the day starts.',
      'Use stacking to make each next action obvious.',
      'Create fast wins that raise consistency across the rest of the app.',
    ],
    expectedOutcomes: ['Less chaotic mornings', 'Cleaner energy ramp', 'Automatic first-hour routine'],
    scienceNote: 'Habit stacking works best when each step happens in the same place, right after the same cue, with as little thinking as possible.',
    habitBlueprints: [
      {
        key: 'water',
        name: 'Drink Water',
        icon: '💧',
        description: 'Hydrate before your phone grabs your attention.',
        habitType: 'measurable',
        timeOfDay: 'morning',
        baseTarget: 1,
        unit: 'glass',
      },
      {
        key: 'stretch',
        name: '2 Minute Stretch',
        icon: '🤸',
        description: 'Wake the body up with one short mobility set.',
        habitType: 'timed',
        timeOfDay: 'morning',
        baseTarget: 2,
        unit: 'min',
      },
      {
        key: 'journal',
        name: 'Set Intentions',
        icon: '✍️',
        description: 'Write your top one to three intentions for the day.',
        habitType: 'standard',
        timeOfDay: 'morning',
        baseTarget: 1,
      },
      {
        key: 'read',
        name: 'Read 10 Pages',
        icon: '📚',
        description: 'End the chain with learning before the day speeds up.',
        habitType: 'standard',
        timeOfDay: 'morning',
        baseTarget: 1,
      },
    ],
    dayPlan: (target) => cappedListPlan([
      {
        key: 'water',
        name: 'Drink Water',
        icon: '💧',
        description: 'Hydrate before your phone grabs your attention.',
        habitType: 'measurable',
        timeOfDay: 'morning',
        baseTarget: 1,
        unit: 'glass',
      },
      {
        key: 'stretch',
        name: '2 Minute Stretch',
        icon: '🤸',
        description: 'Wake the body up with one short mobility set.',
        habitType: 'timed',
        timeOfDay: 'morning',
        baseTarget: 2,
        unit: 'min',
      },
      {
        key: 'journal',
        name: 'Set Intentions',
        icon: '✍️',
        description: 'Write your top one to three intentions for the day.',
        habitType: 'standard',
        timeOfDay: 'morning',
        baseTarget: 1,
      },
      {
        key: 'read',
        name: 'Read 10 Pages',
        icon: '📚',
        description: 'End the chain with learning before the day speeds up.',
        habitType: 'standard',
        timeOfDay: 'morning',
        baseTarget: 1,
      },
    ], target),
  },
  {
    id: 'builtin_no_sugar_30',
    name: '30-Day No Sugar Challenge',
    description: 'Replace the autopilot snack loop with a cleaner decision pattern.',
    icon: '🚫',
    durationDays: 30,
    difficulty: 'intermediate',
    schedule: Array(30).fill(1),
    focusArea: 'body',
    coverPalette: ['#1A0F14', '#7F1D1D', '#FDBA74'],
    enrolledCount: 9430,
    benefits: [
      'Make cravings visible instead of automatic.',
      'Create a replacement routine for the hardest trigger windows.',
      'Use clean streaks as compounding motivation.',
    ],
    expectedOutcomes: ['Fewer reactive snacks', 'Better energy stability', 'Cleaner craving awareness'],
    scienceNote: 'Breaking a cue-driven food habit is easier when you install a replacement action in the same trigger window rather than relying on willpower alone.',
    habitBlueprints: [
      {
        key: 'no_sugar',
        name: 'No Added Sugar',
        icon: '🚫',
        description: 'Stay clean from added sugar for the full day.',
        habitType: 'negative',
        timeOfDay: 'evening',
        baseTarget: 1,
      },
      {
        key: 'craving_reset',
        name: 'Craving Reset',
        icon: '🫖',
        description: 'Swap one craving moment with tea, gum, or a walk.',
        habitType: 'standard',
        timeOfDay: 'afternoon',
        baseTarget: 1,
      },
    ],
    dayPlan: () => [
      {
        key: 'no_sugar',
        name: 'No Added Sugar',
        icon: '🚫',
        description: 'Stay clean from added sugar for the full day.',
        habitType: 'negative',
        timeOfDay: 'evening',
        target: 1,
      },
      {
        key: 'craving_reset',
        name: 'Craving Reset',
        icon: '🫖',
        description: 'Swap one craving moment with tea, gum, or a walk.',
        habitType: 'standard',
        timeOfDay: 'afternoon',
        target: 1,
      },
    ],
  },
  {
    id: 'builtin_reading_30',
    name: 'Atomic Habits Starter',
    description: 'Use reading, reflection, and one visible daily action to lock in consistency.',
    icon: '📚',
    durationDays: 21,
    difficulty: 'beginner',
    schedule: linearInterpolate(
      [{ day: 1, value: 5 }, { day: 11, value: 10 }, { day: 21, value: 20 }],
      21,
    ),
    focusArea: 'learning',
    coverPalette: ['#0F172A', '#1D4ED8', '#93C5FD'],
    enrolledCount: 15448,
    benefits: [
      'Tie learning to immediate application.',
      'Keep the habit small enough that it survives busy weeks.',
      'Give yourself a daily proof-of-progress loop.',
    ],
    expectedOutcomes: ['Steadier reading cadence', 'More reflective planning', 'Higher habit confidence'],
    scienceNote: 'Identity-based change sticks faster when each repetition ends with visible evidence that you became the kind of person you wanted to be.',
    habitBlueprints: [
      {
        key: 'read',
        name: 'Read',
        icon: '📚',
        description: 'Read from one book without switching contexts.',
        habitType: 'measurable',
        timeOfDay: 'evening',
        baseTarget: 5,
        unit: 'pages',
      },
      {
        key: 'capture',
        name: 'Capture One Insight',
        icon: '📝',
        description: 'Write one note about what you just read.',
        habitType: 'standard',
        timeOfDay: 'evening',
        baseTarget: 1,
      },
    ],
    dayPlan: (target) => [
      {
        key: 'read',
        name: 'Read',
        icon: '📚',
        description: 'Read from one book without switching contexts.',
        habitType: 'measurable',
        timeOfDay: 'evening',
        target,
        unit: 'pages',
      },
      {
        key: 'capture',
        name: 'Capture One Insight',
        icon: '📝',
        description: 'Write one note about what you just read.',
        habitType: 'standard',
        timeOfDay: 'evening',
        target: 1,
      },
    ],
  },
  {
    id: 'builtin_hydration_14',
    name: 'Hydration Challenge',
    description: 'Increase daily water intake with small, consistent target jumps.',
    icon: '💧',
    durationDays: 14,
    difficulty: 'beginner',
    schedule: linearInterpolate([{ day: 1, value: 6 }, { day: 7, value: 8 }, { day: 14, value: 10 }], 14),
    focusArea: 'health',
    coverPalette: ['#082F49', '#0EA5E9', '#67E8F9'],
    enrolledCount: 11732,
    benefits: [
      'Create a health habit that is easy to anchor to existing routines.',
      'Use measurable targets that feel objective instead of vague.',
      'Improve energy and recovery with a low-friction daily win.',
    ],
    expectedOutcomes: ['More consistent hydration', 'Better workout recovery', 'Clearer daily baseline'],
    scienceNote: 'Measurable habits improve adherence because the finish line is unambiguous and easy to log.',
    habitBlueprints: [
      {
        key: 'hydrate',
        name: 'Drink Water',
        icon: '💧',
        description: 'Hit your daily bottle or glass target.',
        habitType: 'measurable',
        timeOfDay: 'anytime',
        baseTarget: 6,
        unit: 'glasses',
      },
    ],
    dayPlan: (target) => singlePlan({
      key: 'hydrate',
      name: 'Drink Water',
      icon: '💧',
      description: 'Hit your daily bottle or glass target.',
      habitType: 'measurable',
      timeOfDay: 'anytime',
      baseTarget: 6,
      unit: 'glasses',
    }, target),
  },
  {
    id: 'builtin_digital_detox_21',
    name: '7-Day Digital Detox',
    description: 'Pull attention back from screen loops with one reclaim-your-focus ritual per day.',
    icon: '📵',
    durationDays: 7,
    difficulty: 'intermediate',
    schedule: linearInterpolate([{ day: 1, value: 45 }, { day: 7, value: 120 }], 7),
    focusArea: 'mind',
    coverPalette: ['#111827', '#374151', '#22C55E'],
    enrolledCount: 20112,
    benefits: [
      'Rebuild focus by creating screen-free blocks on purpose.',
      'Use friction and replacement cues instead of pure self-control.',
      'Gain visible evidence that attention can be trained.',
    ],
    expectedOutcomes: ['Lower compulsive checking', 'More present evenings', 'Cleaner focus blocks'],
    scienceNote: 'Removing cue exposure for short scheduled windows is more sustainable than aiming for an all-day detox immediately.',
    habitBlueprints: [
      {
        key: 'detox',
        name: 'Screen-Free Block',
        icon: '📵',
        description: 'Protect one stretch of time from phone use.',
        habitType: 'timed',
        timeOfDay: 'evening',
        baseTarget: 45,
        unit: 'min',
      },
      {
        key: 'replacement',
        name: 'Offline Reset',
        icon: '📓',
        description: 'Swap in reading, journaling, or a walk.',
        habitType: 'standard',
        timeOfDay: 'evening',
        baseTarget: 1,
      },
    ],
    dayPlan: (target) => [
      {
        key: 'detox',
        name: 'Screen-Free Block',
        icon: '📵',
        description: 'Protect one stretch of time from phone use.',
        habitType: 'timed',
        timeOfDay: 'evening',
        target,
        unit: 'min',
      },
      {
        key: 'replacement',
        name: 'Offline Reset',
        icon: '📓',
        description: 'Swap in reading, journaling, or a walk.',
        habitType: 'standard',
        timeOfDay: 'evening',
        target: 1,
      },
    ],
  },
  {
    id: 'builtin_gratitude_30',
    name: '21-Day Gratitude Practice',
    description: 'Train your attention toward what is working with one fast nightly reflection.',
    icon: '🙏',
    durationDays: 21,
    difficulty: 'beginner',
    schedule: linearInterpolate([{ day: 1, value: 1 }, { day: 10, value: 2 }, { day: 21, value: 3 }], 21),
    focusArea: 'social',
    coverPalette: ['#2C0E1F', '#BE185D', '#F9A8D4'],
    enrolledCount: 8742,
    benefits: [
      'Use a low-friction reflection ritual to close the day.',
      'Increase positive recall without forcing toxic optimism.',
      'Create a journaling on-ramp for users who resist long entries.',
    ],
    expectedOutcomes: ['More grounded evenings', 'Higher positive recall', 'Easier journaling habit'],
    scienceNote: 'Short gratitude practices work because they change where attention goes at the end of the day, not because they force a specific mood.',
    habitBlueprints: [
      {
        key: 'gratitude',
        name: 'Log Gratitude',
        icon: '🙏',
        description: 'Write what went right before you sleep.',
        habitType: 'measurable',
        timeOfDay: 'evening',
        baseTarget: 1,
        unit: 'wins',
      },
    ],
    dayPlan: (target) => singlePlan({
      key: 'gratitude',
      name: 'Log Gratitude',
      icon: '🙏',
      description: 'Write what went right before you sleep.',
      habitType: 'measurable',
      timeOfDay: 'evening',
      baseTarget: 1,
      unit: 'wins',
    }, target),
  },
];

export function getCurrentDay(startDate: string, today: string): number {
  const start = new Date(`${startDate}T00:00:00`);
  const now = new Date(`${today}T00:00:00`);
  const diffMs = now.getTime() - start.getTime();
  return Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1;
}

export function resolveDailyTarget(
  schedule: number[],
  currentDay: number,
): number | null {
  if (currentDay < 1 || currentDay > schedule.length) return null;
  return schedule[currentDay - 1];
}

export function isProgramComplete(currentDay: number, durationDays: number): boolean {
  return currentDay > durationDays;
}

export function getProgramDayPlan(
  program: BuiltInProgram,
  currentDay: number,
): ProgramDayPlanItem[] {
  const target = resolveDailyTarget(program.schedule, currentDay) ?? program.schedule[program.schedule.length - 1] ?? 1;

  if (program.dayPlan) {
    return program.dayPlan(target, currentDay);
  }

  return program.habitBlueprints.map((blueprint) => ({
    key: blueprint.key,
    name: blueprint.name,
    icon: blueprint.icon,
    description: blueprint.description,
    habitType: blueprint.habitType,
    timeOfDay: blueprint.timeOfDay,
    target: target > 0 ? target : blueprint.baseTarget,
    unit: blueprint.unit,
  }));
}
