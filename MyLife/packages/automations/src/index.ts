export type {
  AutomationRule,
  AutomationOutcome,
  AutomationLogEntry,
} from './types';
export { AutomationOutcomeSchema } from './types';
export {
  registerRule,
  getRule,
  listRules,
  clearRegistryForTests,
} from './registry';
export {
  logAutomationEvent,
  listAutomationLog,
  getRuleFireCount,
  type LogAutomationEventInput,
} from './audit';
