import { z } from 'zod';

export const AutomationOutcomeSchema = z.enum(['applied', 'dismissed', 'error']);
export type AutomationOutcome = z.infer<typeof AutomationOutcomeSchema>;

export interface AutomationRule<
  TriggerInput = unknown,
  PreviewState = unknown,
  ExecutionResult = unknown,
> {
  id: string;
  label: string;
  description: string;
  clusters: string[];
  check(db: unknown, input: TriggerInput): PreviewState | null;
  previewCard(state: PreviewState): {
    title: string;
    subtitle: string;
    cta: { apply: string; dismiss: string };
  };
  apply(db: unknown, state: PreviewState): ExecutionResult;
}

export interface AutomationLogEntry {
  id: string;
  ruleId: string;
  at: string;
  outcome: AutomationOutcome;
  payloadSha256: string | null;
  error: string | null;
}
