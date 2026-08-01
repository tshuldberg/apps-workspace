import { describe, expect, it } from 'vitest';

import { parseTranscriptLine } from './parser.js';

function line(value: unknown): string {
  return JSON.stringify(value);
}

describe('parseTranscriptLine', () => {
  it.each([
    ['malformed JSON', '{"type":'],
    ['a torn line', '{"type":"assistant","message":'],
    ['sidechain events', line({ type: 'assistant', isSidechain: true, message: { content: [] } })],
    ['meta events', line({ type: 'user', isMeta: true, message: { content: 'hidden' } })],
    ['unknown event types', line({ type: 'progress', message: { content: 'working' } })],
  ])('ignores %s', (_label, input) => {
    expect(parseTranscriptLine(input)).toEqual([]);
  });

  it('parses real user prompts and ignores tool result arrays', () => {
    expect(
      parseTranscriptLine(line({ type: 'user', message: { content: 'Run the tests' } })),
    ).toEqual([{ kind: 'user-text', text: 'Run the tests' }]);
    expect(
      parseTranscriptLine(
        line({ type: 'user', message: { content: [{ type: 'tool_result' }] } }),
      ),
    ).toEqual([]);
  });

  it('parses non-empty assistant text and skips empty text blocks', () => {
    const input = line({
      type: 'assistant',
      message: {
        content: [
          { type: 'text', text: '  Finished the change.  ' },
          { type: 'text', text: '   ' },
        ],
      },
    });

    expect(parseTranscriptLine(input)).toEqual([
      { kind: 'assistant-text', text: 'Finished the change.' },
    ]);
  });

  it.each([
    ['Bash', { description: 'Run unit tests', command: 'pnpm test' }, 'Run unit tests'],
    ['Bash', { command: 'x'.repeat(100) }, 'x'.repeat(80)],
    ['Read', { file_path: '/tmp/src/config.ts' }, 'config.ts'],
    ['Write', { file_path: '/tmp/src/new.ts' }, 'new.ts'],
    ['Edit', { file_path: '/tmp/src/edit.ts' }, 'edit.ts'],
    ['Agent', { description: 'Research the parser' }, 'Research the parser'],
    ['Skill', { skill: 'audit-code' }, 'audit-code'],
    ['OtherTool', { value: 'ignored' }, ''],
  ])('summarizes %s tool use', (name, input, summary) => {
    const eventLine = line({
      type: 'assistant',
      message: { content: [{ type: 'tool_use', name, input }] },
    });

    expect(parseTranscriptLine(eventLine)).toEqual([{ kind: 'tool-use', name, summary }]);
  });

  it('turns each AskUserQuestion question into an event', () => {
    const input = line({
      type: 'assistant',
      message: {
        content: [
          {
            type: 'tool_use',
            name: 'AskUserQuestion',
            input: {
              questions: [
                {
                  question: 'Which database?',
                  header: 'Database',
                  options: [
                    { label: 'SQLite', description: 'Local' },
                    { label: 'Postgres', description: 'Hosted' },
                  ],
                },
                {
                  question: 'Ship now?',
                  header: 'Release',
                  options: [{ label: 'Yes', description: 'Deploy it' }],
                },
              ],
            },
          },
        ],
        stop_reason: 'tool_use',
      },
    });

    expect(parseTranscriptLine(input)).toEqual([
      { kind: 'question', text: 'Which database?', options: ['SQLite', 'Postgres'] },
      { kind: 'question', text: 'Ship now?', options: ['Yes'] },
    ]);
  });

  it('appends turn-end after assistant text', () => {
    const input = line({
      type: 'assistant',
      message: {
        content: [{ type: 'text', text: 'All done.' }],
        stop_reason: 'end_turn',
      },
    });

    expect(parseTranscriptLine(input)).toEqual([
      { kind: 'assistant-text', text: 'All done.' },
      { kind: 'turn-end' },
    ]);
  });
});
