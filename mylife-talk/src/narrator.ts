import { renderEvent } from './brain/prompts.js';
import type { NarrationMode, SessionEvent } from './types.js';

export type NarrationDecision =
  | { type: 'silent' }
  | { type: 'milestone'; text: string }
  | { type: 'question'; text: string }
  | { type: 'turn-summary' };

export class Narrator {
  private toolSeenThisTurn = false;
  private currentAssistantText: string[] = [];
  private completedAssistantText = '';

  constructor(private readonly mode: NarrationMode) {}

  decide(event: SessionEvent): NarrationDecision {
    switch (event.kind) {
      case 'question':
        return {
          type: 'question',
          text: `${event.text} Options: ${event.options.join(', ')}`,
        };
      case 'turn-end':
        this.toolSeenThisTurn = false;
        this.completedAssistantText = this.currentAssistantText.join('\n');
        this.currentAssistantText = [];
        return { type: 'turn-summary' };
      case 'user-text':
        this.toolSeenThisTurn = false;
        return { type: 'silent' };
      case 'assistant-text':
        this.currentAssistantText.push(event.text);
        return { type: 'silent' };
      case 'tool-use': {
        const firstTool = !this.toolSeenThisTurn;
        this.toolSeenThisTurn = true;
        if (this.mode === 'play-by-play' || (this.mode === 'milestones' && firstTool)) {
          return { type: 'milestone', text: renderEvent(event) };
        }
        return { type: 'silent' };
      }
    }
  }

  lastAssistantText(): string {
    return this.currentAssistantText.length > 0
      ? this.currentAssistantText.join('\n')
      : this.completedAssistantText;
  }
}
