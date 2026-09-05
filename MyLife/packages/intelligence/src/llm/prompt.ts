/**
 * Prompt construction for LLM insight generation.
 *
 * Takes on-device analytics results (InsightCards, ModuleSummaries)
 * and constructs a structured prompt for the LLM.
 */

import type { InsightCard, SummaryResult } from '../engine/types';

/**
 * Build a prompt from on-device analytics results.
 *
 * The prompt includes:
 * 1. Module summaries (what data the user has)
 * 2. Statistical correlations already discovered
 * 3. A request for deeper narrative insights
 */
export function buildPrompt(
  insights: InsightCard[],
  summary: SummaryResult,
): string {
  const parts: string[] = [];

  parts.push(
    'You are a personal analytics assistant helping a user understand patterns in their life data.',
    'The user has opted in to AI analysis. Provide helpful, actionable insights.',
    'Be concise and cite the specific user data that supports each insight.',
    'The API enforces the output schema. Return only insights that are supported by the data below.',
    '',
  );

  // Module summaries
  if (summary.modules.length > 0) {
    parts.push('## User Data Overview');
    for (const mod of summary.modules) {
      const statEntries = Object.entries(mod.stats)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      parts.push(`- ${mod.moduleId}: ${mod.totalItems} items (${statEntries})`);
    }
    parts.push('');
  }

  // Statistical correlations
  if (insights.length > 0) {
    parts.push('## Statistical Correlations Found (on-device Pearson analysis)');
    for (const insight of insights) {
      parts.push(
        `- ${insight.title}: r=${insight.correlation.coefficient.toFixed(2)}, ` +
        `${insight.correlation.dataPoints} data points, ` +
        `confidence: ${insight.confidence}`,
      );
    }
    parts.push('');
  }

  parts.push(
    '## Task',
    'Based on the data overview and statistical correlations above, provide 1-5 actionable insights.',
    'Focus on patterns the user might not notice and practical suggestions.',
    'Keep titles under 80 characters and descriptions under 200 characters.',
  );

  return parts.join('\n');
}
