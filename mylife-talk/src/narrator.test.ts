import { describe, expect, it } from 'vitest';

import type { NarrationMode, SessionEvent } from './types.js';
import { Narrator } from './narrator.js';

const tool: SessionEvent = { kind: 'tool-use', name: 'Bash', summary: 'pnpm test' };

describe('Narrator event matrix', () => {
  it.each<NarrationMode>(['milestones', 'turn-end', 'play-by-play'])(
    'always speaks questions and summarizes turn ends in %s mode',
    (mode) => {
      const narrator = new Narrator(mode);
      expect(
        narrator.decide({ kind: 'question', text: 'Deploy?', options: ['Yes', 'No'] }),
      ).toEqual({ type: 'question', text: 'Deploy? Options: Yes, No' });
      expect(narrator.decide({ kind: 'turn-end' })).toEqual({ type: 'turn-summary' });
    },
  );

  it.each<NarrationMode>(['milestones', 'turn-end', 'play-by-play'])(
    'keeps assistant text silent in %s mode',
    (mode) => {
      expect(new Narrator(mode).decide({ kind: 'assistant-text', text: 'Done' })).toEqual({
        type: 'silent',
      });
    },
  );

  it.each<NarrationMode>(['milestones', 'turn-end', 'play-by-play'])(
    'keeps user text silent in %s mode',
    (mode) => {
      expect(new Narrator(mode).decide({ kind: 'user-text', text: 'Continue' })).toEqual({
        type: 'silent',
      });
    },
  );

  it('narrates every tool in play-by-play mode', () => {
    const narrator = new Narrator('play-by-play');
    expect(narrator.decide(tool)).toEqual({
      type: 'milestone',
      text: 'TOOL Bash: pnpm test',
    });
    expect(narrator.decide(tool)).toEqual({
      type: 'milestone',
      text: 'TOOL Bash: pnpm test',
    });
  });

  it('keeps all tools silent in turn-end mode', () => {
    expect(new Narrator('turn-end').decide(tool)).toEqual({ type: 'silent' });
  });

  it('narrates only the first tool per turn in milestones mode', () => {
    const narrator = new Narrator('milestones');
    expect(narrator.decide(tool).type).toBe('milestone');
    expect(narrator.decide(tool)).toEqual({ type: 'silent' });
    narrator.decide({ kind: 'turn-end' });
    expect(narrator.decide(tool).type).toBe('milestone');
    expect(narrator.decide(tool)).toEqual({ type: 'silent' });
    narrator.decide({ kind: 'user-text', text: 'Continue' });
    expect(narrator.decide(tool).type).toBe('milestone');
  });

  it('accumulates assistant text and preserves the completed turn', () => {
    const narrator = new Narrator('milestones');
    narrator.decide({ kind: 'assistant-text', text: 'First paragraph.' });
    narrator.decide({ kind: 'assistant-text', text: 'Second paragraph.' });
    expect(narrator.lastAssistantText()).toBe('First paragraph.\nSecond paragraph.');
    narrator.decide({ kind: 'turn-end' });
    expect(narrator.lastAssistantText()).toBe('First paragraph.\nSecond paragraph.');
  });
});
