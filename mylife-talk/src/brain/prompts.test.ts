import { describe, expect, it } from 'vitest';

import type { SessionEvent } from '../types.js';
import { buildBrainPrompt, renderEvent } from './prompts.js';

describe('renderEvent', () => {
  it.each<[SessionEvent, string]>([
    [{ kind: 'assistant-text', text: 'Implemented it.' }, 'CLAUDE: Implemented it.'],
    [{ kind: 'tool-use', name: 'Bash', summary: 'pnpm test' }, 'TOOL Bash: pnpm test'],
    [
      { kind: 'question', text: 'Which one?', options: ['A', 'B'] },
      'QUESTION: Which one? OPTIONS: A | B',
    ],
    [{ kind: 'user-text', text: 'Fix it' }, 'FOUNDER-TYPED: Fix it'],
    [{ kind: 'turn-end' }, 'TURN END'],
  ])('renders $kind', (event, expected) => {
    expect(renderEvent(event)).toBe(expected);
  });
});

describe('buildBrainPrompt', () => {
  it.each([
    'route-utterance',
    'narrate-milestone',
    'summarize-turn',
    'read-full',
  ] as const)('builds a self-contained %s prompt', (task) => {
    const prompt = buildBrainPrompt({
      task,
      utterance: 'Please handle this',
      fullText: task === 'summarize-turn' || task === 'read-full' ? 'Full answer' : undefined,
      sessionEvents: ['CLAUDE: first', 'TOOL Bash: pnpm test'],
      history: [{ who: 'copilot', text: 'I am following along.' }],
    });

    expect(prompt).toContain(
      'Reply with ONLY a JSON object {"speak": string|null, "action": "chat"|"prompt"|"none", "prompt": string|null}.',
    );
    expect(prompt).toContain(`TASK: ${task}`);
    expect(prompt).toContain('TOOL Bash: pnpm test');
    expect(prompt).toContain('COPILOT: I am following along.');
    expect(prompt).toContain('Please handle this');
  });

  it('limits supplied conversation history to the last 20 turns', () => {
    const prompt = buildBrainPrompt({
      task: 'route-utterance',
      sessionEvents: [],
      history: Array.from({ length: 22 }, (_, index) => ({
        who: 'founder' as const,
        text: `turn-${index}`,
      })),
    });

    expect(prompt).not.toContain('FOUNDER: turn-0\n');
    expect(prompt).not.toContain('FOUNDER: turn-1\n');
    expect(prompt).toContain('FOUNDER: turn-2\n');
    expect(prompt).toContain('FOUNDER: turn-21\n');
  });
});
