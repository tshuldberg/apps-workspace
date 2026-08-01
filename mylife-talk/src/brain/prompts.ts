import type { SessionEvent } from '../types.js';

export interface BrainTurn {
  who: 'founder' | 'copilot';
  text: string;
}

export interface BrainContext {
  utterance?: string;
  sessionEvents: string[];
  history: BrainTurn[];
  task: 'route-utterance' | 'narrate-milestone' | 'summarize-turn' | 'read-full';
  fullText?: string;
}

export function renderEvent(event: SessionEvent): string {
  switch (event.kind) {
    case 'assistant-text':
      return `CLAUDE: ${event.text}`;
    case 'tool-use':
      return `TOOL ${event.name}: ${event.summary}`;
    case 'question':
      return `QUESTION: ${event.text} OPTIONS: ${event.options.join(' | ')}`;
    case 'user-text':
      return `FOUNDER-TYPED: ${event.text}`;
    case 'turn-end':
      return 'TURN END';
  }
}

const taskInstructions: Record<BrainContext['task'], string> = {
  'route-utterance':
    "Decide whether the founder is talking to you or directing Claude. Answer conversational questions with chat. Turn work requests and answers to Claude's questions into an exact prompt.",
  'narrate-milestone':
    'Briefly narrate the latest meaningful development. Use action none if it is not worth interrupting the founder.',
  'summarize-turn':
    "Summarize Claude's completed turn conversationally in about 60 words or fewer, emphasizing outcome, blockers, and what needs attention.",
  'read-full':
    "Prepare Claude's full message to be spoken clearly. Preserve its meaning while removing markdown-only formatting.",
};

export function buildBrainPrompt(context: BrainContext): string {
  const events = context.sessionEvents.length > 0 ? context.sessionEvents : ['(none)'];
  const history = context.history.slice(-20).map(
    (turn) => `${turn.who === 'founder' ? 'FOUNDER' : 'COPILOT'}: ${turn.text}`,
  );

  return [
    'You are MyTalk, the spoken-voice copilot for a founder pair-programming with Claude Code.',
    'Your speak text is read aloud by TTS. Keep it conversational, under about 60 words for narration, use no markdown or code blocks, and say file names plainly.',
    'Reply with ONLY a JSON object {"speak": string|null, "action": "chat"|"prompt"|"none", "prompt": string|null}.',
    "Use action prompt only when the founder is giving Claude work or answering Claude's question. Then prompt is the exact text to type into the Claude terminal as a single line without wrapping quotes.",
    'Use action chat when answering the founder aloud. Use action none when nothing needs saying.',
    '',
    `TASK: ${context.task}`,
    taskInstructions[context.task],
    ...(context.fullText === undefined ? [] : ['', 'CLAUDE FULL TEXT:', context.fullText]),
    '',
    'RECENT SESSION EVENTS:',
    ...events,
    '',
    'ROLLING CONVERSATION:',
    ...(history.length > 0 ? history : ['(none)']),
    '',
    'FOUNDER UTTERANCE:',
    context.utterance ?? '(none)',
  ].join('\n');
}
