export type {
  ThoughtRecordStatus,
  DistortionType,
  ThoughtRecord,
  RecordEmotion,
  RecordDistortion,
  EmotionalImpact,
  DistortionFrequency,
} from './types';

export {
  ThoughtRecordStatusSchema,
  DistortionTypeSchema,
  ThoughtRecordSchema,
  RecordEmotionSchema,
  RecordDistortionSchema,
  PREDEFINED_EMOTIONS,
} from './types';

export type { DistortionDefinition } from './distortions';
export { COGNITIVE_DISTORTIONS, getDistortionByType } from './distortions';

export {
  calculateEmotionalImpact,
  calculateBeliefReduction,
  computeDistortionFrequency,
  isValidDistortionType,
} from './cbt-engine';
