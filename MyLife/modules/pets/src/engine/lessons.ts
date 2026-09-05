export interface Lesson {
  command: string;
  difficulty: number;
  steps: string[];
  tips: string;
  commonMistakes: string;
  estimatedDays: number;
}

export interface LessonLevel {
  name: string;
  level: number;
  lessons: Lesson[];
}

export const TRAINING_CURRICULUM: LessonLevel[] = [
  {
    name: 'Puppy Basics',
    level: 1,
    lessons: [
      { command: 'Sit', difficulty: 1, steps: ['Hold treat above nose', 'Move hand back so head tilts up', 'As bottom touches floor, say "sit"', 'Give treat and praise'], tips: 'Keep sessions under 5 minutes for puppies', commonMistakes: 'Pushing the dog down instead of luring', estimatedDays: 3 },
      { command: 'Stay', difficulty: 2, steps: ['Ask for sit', 'Show palm and say "stay"', 'Take one step back', 'Return and reward if dog stayed', 'Gradually increase distance'], tips: 'Start with 2-second stays and build up', commonMistakes: 'Increasing distance too fast', estimatedDays: 7 },
      { command: 'Come', difficulty: 2, steps: ['Crouch down and open arms', 'Say "come" in excited voice', 'Reward generously when dog arrives', 'Practice on leash first'], tips: 'Never punish a dog that comes to you, even if slow', commonMistakes: 'Chasing the dog when they do not come', estimatedDays: 7 },
      { command: 'Down', difficulty: 2, steps: ['Start from sit position', 'Hold treat to nose then lower to ground', 'Slide treat forward along ground', 'Mark and reward when elbows touch floor'], tips: 'Use a mat or bed as a target', commonMistakes: 'Luring too fast', estimatedDays: 5 },
      { command: 'Leave It', difficulty: 3, steps: ['Place treat in closed fist', 'Let dog sniff and paw at fist', 'When dog backs away, say "yes" and give different treat', 'Progress to treat on floor with hand cover'], tips: 'Always reward with a DIFFERENT treat than the one left', commonMistakes: 'Letting dog get the "leave it" item', estimatedDays: 7 },
    ],
  },
  {
    name: 'Good Manners',
    level: 2,
    lessons: [
      { command: 'Heel', difficulty: 3, steps: ['Dog on left side', 'Hold treat at left hip', 'Take a step, lure dog to walk beside', 'Mark and reward for staying at hip level'], tips: 'Start indoors with zero distractions', commonMistakes: 'Walking too fast before dog understands position', estimatedDays: 14 },
      { command: 'Wait', difficulty: 2, steps: ['At door or threshold', 'Say "wait" and open door slightly', 'Close door if dog moves forward', 'Reopen when dog pauses, release with "okay"'], tips: 'Different from "stay" -- "wait" is temporary pause', commonMistakes: 'Not being consistent with the release word', estimatedDays: 5 },
      { command: 'Drop It', difficulty: 3, steps: ['When dog has toy, show high-value treat', 'Say "drop it" as dog releases toy', 'Give treat, then return the toy', 'Dog learns dropping = getting something better'], tips: 'Practice with low-value items first', commonMistakes: 'Chasing or pulling item from mouth', estimatedDays: 7 },
      { command: 'Gentle', difficulty: 2, steps: ['Hold treat in closed fist', 'Only open when dog uses soft mouth', 'Say "gentle" as dog takes treat softly', 'Close fist if dog mouths roughly'], tips: 'Great for dogs that grab treats aggressively', commonMistakes: 'Giving treat even when dog is rough', estimatedDays: 5 },
      { command: 'Place', difficulty: 3, steps: ['Point to bed or mat', 'Lure dog onto it with treat', 'Say "place" and reward on the mat', 'Gradually add duration and distance'], tips: 'Use a portable mat for training in different locations', commonMistakes: 'Not rewarding enough on the mat initially', estimatedDays: 10 },
    ],
  },
  {
    name: 'Social Skills',
    level: 3,
    lessons: [
      { command: 'Greet', difficulty: 3, steps: ['Practice sit when people approach', 'Reward for four-on-the-floor greetings', 'Ask visitors to ignore jumping', 'Only pet when dog is sitting calmly'], tips: 'Have a friend practice approaching multiple times', commonMistakes: 'Allowing jumping "just this once"', estimatedDays: 14 },
      { command: 'Quiet', difficulty: 4, steps: ['Wait for a pause in barking', 'Say "quiet" during the pause', 'Reward immediately', 'Gradually extend quiet duration before reward'], tips: 'Never yell "quiet" -- it sounds like barking to the dog', commonMistakes: 'Rewarding while still barking', estimatedDays: 14 },
      { command: 'Settle', difficulty: 3, steps: ['Capture calm moments with rewards', 'Add "settle" cue when dog lies down relaxed', 'Practice during low-key activities', 'Reward long downs with periodic treats'], tips: 'Use a mat as a settling station', commonMistakes: 'Only practicing when dog is already excited', estimatedDays: 10 },
      { command: 'Off', difficulty: 2, steps: ['When dog jumps on furniture, lure off with treat', 'Say "off" as feet hit the floor', 'Reward immediately', 'Be consistent -- always or never allowed on furniture'], tips: 'Provide an approved alternative spot', commonMistakes: 'Inconsistent rules about furniture access', estimatedDays: 5 },
      { command: 'Touch', difficulty: 1, steps: ['Hold palm out flat', 'When dog touches nose to palm, say "yes"', 'Give treat', 'Add "touch" cue, increase distance'], tips: 'Great foundation for many advanced tricks', commonMistakes: 'Moving hand toward dog instead of letting dog come to hand', estimatedDays: 3 },
    ],
  },
  {
    name: 'Advanced',
    level: 4,
    lessons: [
      { command: 'Roll Over', difficulty: 3, steps: ['Start from down position', 'Lure treat from nose toward shoulder', 'Continue luring in circle until full roll', 'Mark and reward the full rotation'], tips: 'Some dogs need the roll broken into stages', commonMistakes: 'Moving the lure too fast', estimatedDays: 10 },
      { command: 'Shake', difficulty: 2, steps: ['Dog in sit position', 'Hold treat in closed fist near paw level', 'Dog will paw at fist, say "shake" and open hand', 'Reward with other hand'], tips: 'Most dogs offer this naturally when frustrated', commonMistakes: 'Grabbing the paw instead of letting dog offer it', estimatedDays: 5 },
      { command: 'Spin', difficulty: 2, steps: ['Hold treat at nose level', 'Lure in a circle (clockwise)', 'Mark when full turn complete', 'Add "spin" cue, reduce lure'], tips: 'Teach both directions -- "spin" and "twirl"', commonMistakes: 'Making the circle too large', estimatedDays: 5 },
      { command: 'Crawl', difficulty: 4, steps: ['Start from down position', 'Hold treat low and move it forward slowly', 'Mark any forward movement while staying down', 'Gradually increase crawl distance'], tips: 'Use a low barrier like a broomstick to prevent standing', commonMistakes: 'Dog standing up to follow treat', estimatedDays: 14 },
      { command: 'Bow', difficulty: 3, steps: ['Hold treat at ground between front paws', 'Mark when front goes down but rear stays up', 'Add "bow" cue', 'Shape by catching natural stretching bows'], tips: 'Catch natural play bows and reward them', commonMistakes: 'Dog going into full down instead of bow', estimatedDays: 7 },
    ],
  },
  {
    name: 'Expert',
    level: 5,
    lessons: [
      { command: 'Back Up', difficulty: 3, steps: ['Face dog, take step toward them', 'Mark any backward movement', 'Add "back" cue', 'Practice in a narrow hallway first'], tips: 'A hallway prevents the dog from turning around', commonMistakes: 'Stepping too aggressively toward the dog', estimatedDays: 10 },
      { command: 'Speak', difficulty: 3, steps: ['Find what triggers barking (doorbell, excitement)', 'Say "speak" right before the trigger', 'Mark and reward the bark', 'Alternate with "quiet" for contrast'], tips: 'Teaching speak actually helps teach quiet', commonMistakes: 'Rewarding excessive barking chains', estimatedDays: 7 },
      { command: 'Weave', difficulty: 4, steps: ['Stand with legs apart', 'Lure dog through one leg', 'Then through the other', 'Chain together into a weaving pattern'], tips: 'Start with wide leg stance and gradually narrow', commonMistakes: 'Moving legs while dog is weaving through', estimatedDays: 14 },
      { command: 'Fetch Specific', difficulty: 5, steps: ['Name individual toys', 'Place two toys, ask for one by name', 'Reward correct choice', 'Gradually add more named toys'], tips: 'Start with very different-looking toys', commonMistakes: 'Adding too many toys at once', estimatedDays: 21 },
      { command: 'Clean Up', difficulty: 5, steps: ['Teach "drop it" over a container', 'Scatter toys near container', 'Say "clean up" and point to each toy', 'Reward each toy dropped in container'], tips: 'Use a low-sided container that is easy to drop into', commonMistakes: 'Expecting the dog to know which items to clean up', estimatedDays: 21 },
    ],
  },
];

/**
 * Get the lesson plan for a pet, filtering out already-mastered commands.
 */
export function getLessonPlan(
  _masteredCommands: string[],
): LessonLevel[] {
  return TRAINING_CURRICULUM.map((level) => ({
    ...level,
    lessons: [...level.lessons],
  }));
}

/**
 * Get the next unmastered lesson.
 */
export function getNextLesson(
  masteredCommands: string[],
): { level: LessonLevel; lesson: Lesson } | null {
  const masteredSet = new Set(masteredCommands.map((c) => c.toLowerCase()));
  for (const level of TRAINING_CURRICULUM) {
    for (const lesson of level.lessons) {
      if (!masteredSet.has(lesson.command.toLowerCase())) {
        return { level, lesson };
      }
    }
  }
  return null;
}

/**
 * Get progress percentage for a specific curriculum level.
 */
export function getLevelProgress(
  levelNumber: number,
  masteredCommands: string[],
): { level: number; name: string; total: number; mastered: number; progressPct: number } | null {
  const level = TRAINING_CURRICULUM.find((l) => l.level === levelNumber);
  if (!level) return null;

  const masteredSet = new Set(masteredCommands.map((c) => c.toLowerCase()));
  const mastered = level.lessons.filter((l) => masteredSet.has(l.command.toLowerCase())).length;

  return {
    level: level.level,
    name: level.name,
    total: level.lessons.length,
    mastered,
    progressPct: Math.round((mastered / level.lessons.length) * 100),
  };
}
