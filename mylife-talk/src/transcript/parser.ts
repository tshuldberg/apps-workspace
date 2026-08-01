import { basename } from 'node:path';

import type { SessionEvent } from '../types.js';

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringField(value: Record<string, unknown> | null, key: string): string {
  return typeof value?.[key] === 'string' ? value[key] : '';
}

function toolSummary(name: string, input: Record<string, unknown> | null): string {
  switch (name) {
    case 'Bash': {
      const description = input?.description;
      if (typeof description === 'string') return description;
      return stringField(input, 'command').slice(0, 80);
    }
    case 'Read':
    case 'Write':
    case 'Edit': {
      const filePath = stringField(input, 'file_path');
      return filePath === '' ? '' : basename(filePath);
    }
    case 'Agent':
      return stringField(input, 'description');
    case 'Skill':
      return stringField(input, 'skill');
    default:
      return '';
  }
}

function questionEvents(input: Record<string, unknown> | null): SessionEvent[] {
  if (!Array.isArray(input?.questions)) return [];

  const events: SessionEvent[] = [];
  for (const value of input.questions) {
    const question = asObject(value);
    if (typeof question?.question !== 'string') continue;
    const options = Array.isArray(question.options)
      ? question.options.flatMap((option) => {
          const label = asObject(option)?.label;
          return typeof label === 'string' ? [label] : [];
        })
      : [];
    events.push({ kind: 'question', text: question.question, options });
  }
  return events;
}

export function parseTranscriptLine(line: string): SessionEvent[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line) as unknown;
  } catch {
    return [];
  }

  const root = asObject(parsed);
  if (root === null || root.isSidechain === true || root.isMeta === true) return [];
  const message = asObject(root.message);

  if (root.type === 'user') {
    return typeof message?.content === 'string'
      ? [{ kind: 'user-text', text: message.content }]
      : [];
  }

  if (root.type !== 'assistant' || !Array.isArray(message?.content)) return [];

  const events: SessionEvent[] = [];
  for (const value of message.content) {
    const block = asObject(value);
    if (block?.type === 'text' && typeof block.text === 'string') {
      const text = block.text.trim();
      if (text !== '') events.push({ kind: 'assistant-text', text });
      continue;
    }
    if (block?.type !== 'tool_use' || typeof block.name !== 'string') continue;

    const input = asObject(block.input);
    if (block.name === 'AskUserQuestion') {
      events.push(...questionEvents(input));
    } else {
      events.push({
        kind: 'tool-use',
        name: block.name,
        summary: toolSummary(block.name, input),
      });
    }
  }

  if (message.stop_reason === 'end_turn') events.push({ kind: 'turn-end' });
  return events;
}
