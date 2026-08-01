import type { Settings } from './config.js';
import type { BrainContext, BrainTurn } from './brain/prompts.js';
import type { BrainResult, ControlCommand, SessionEvent } from './types.js';
import type { DaemonPhase } from './turntaking.js';
import type { NarrationDecision } from './narrator.js';

interface EarPort {
  start(): void;
  stop(): void;
  mute(): void;
  unmute(): void;
  on(event: 'ready', listener: () => void): this;
  on(event: 'partial' | 'final' | 'status', listener: (text: string) => void): this;
  on(event: 'ptt', listener: (state: 'down' | 'up') => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
}

interface SpeakerPort {
  say(text: string, opts?: { interrupt?: boolean }): void;
  stop(): void;
  readonly speaking: boolean;
  on(event: 'speaking-start' | 'speaking-end', listener: () => void): this;
}

interface WatcherPort {
  start(): void;
  stop(): void;
  on(event: 'event', listener: (event: SessionEvent) => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
}

interface BrainPort {
  ask(context: BrainContext): Promise<BrainResult | null>;
}

interface NarratorPort {
  decide(event: SessionEvent): NarrationDecision;
  lastAssistantText(): string;
}

interface TurnTakingPort {
  readonly phase: DaemonPhase;
  onFinalUtterance(text: string): void;
  onPtt(state: 'down' | 'up'): void;
  onBrainPrompt(prompt: string): void;
  tick(): void;
  on(event: 'route' | 'inject' | 'speak', listener: (text: string) => void): this;
  on(event: 'control', listener: (command: ControlCommand) => void): this;
  on(event: 'mute-ear' | 'unmute-ear', listener: () => void): this;
}

interface UiPort {
  log(line: string): void;
  status(state: { phase: string; detail?: string }): void;
}

interface VoiceLogPort {
  append(entry: {
    who: 'founder' | 'copilot' | 'system';
    kind: 'utterance' | 'speech' | 'inject' | 'note';
    text: string;
  }): void;
}

export interface DaemonDependencies {
  settings: Settings;
  ear: EarPort;
  speaker: SpeakerPort;
  watcher: WatcherPort;
  brain: BrainPort;
  injector: (prompt: string) => Promise<void> | void;
  narrator: NarratorPort;
  turnTaking: TurnTakingPort;
  ui: UiPort;
  log: (line: string) => void;
  voiceLog?: VoiceLogPort;
  initialHistory?: BrainTurn[];
}

export class Daemon {
  private readonly history: BrainTurn[] = [];
  private readonly sessionEvents: string[] = [];
  private timer: NodeJS.Timeout | null = null;
  private unmuteTimer: NodeJS.Timeout | null = null;

  constructor(private readonly dependencies: DaemonDependencies) {
    this.history.push(...(dependencies.initialHistory ?? []).slice(-20));
    this.wire();
  }

  start(): void {
    if (this.timer !== null) return;
    this.dependencies.ui.status({ phase: 'listening' });
    this.dependencies.watcher.start();
    this.dependencies.ear.start();
    this.timer = setInterval(() => this.dependencies.turnTaking.tick(), 250);
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    if (this.unmuteTimer !== null) clearTimeout(this.unmuteTimer);
    this.unmuteTimer = null;
    this.dependencies.ear.stop();
    this.dependencies.speaker.stop();
    this.dependencies.watcher.stop();
  }

  private wire(): void {
    const { ear, speaker, watcher, turnTaking } = this.dependencies;

    ear.on('ready', () => this.updatePhase());
    ear.on('final', (text) => turnTaking.onFinalUtterance(text));
    ear.on('ptt', (state) => turnTaking.onPtt(state));
    ear.on('partial', () => {
      if (speaker.speaking) speaker.stop();
    });
    ear.on('status', (message) => this.dependencies.ui.log(message));
    ear.on('error', (error) => this.edgeError('Microphone', error));

    turnTaking.on('route', (text) => {
      void this.routeUtterance(text);
    });
    turnTaking.on('inject', (prompt) => {
      void this.inject(prompt);
    });
    turnTaking.on('speak', (text) => this.speak(text));
    turnTaking.on('control', (command) => {
      void this.handleControl(command);
    });
    turnTaking.on('mute-ear', () => ear.mute());
    turnTaking.on('unmute-ear', () => ear.unmute());

    watcher.on('event', (event) => {
      void this.handleSessionEvent(event);
    });
    watcher.on('error', (error) => this.edgeError('Transcript', error));

    // the mic has no echo cancellation (AEC breaks SFSpeechRecognizer input),
    // so keep the ear muted while TTS plays plus a short tail
    speaker.on('speaking-start', () => {
      if (this.unmuteTimer !== null) clearTimeout(this.unmuteTimer);
      this.unmuteTimer = null;
      ear.mute();
      this.dependencies.ui.status({ phase: 'speaking' });
    });
    speaker.on('speaking-end', () => {
      this.unmuteTimer = setTimeout(() => {
        this.unmuteTimer = null;
        if (turnTaking.phase !== 'muted') ear.unmute();
      }, this.dependencies.settings.ttsMuteTailMs);
      this.updatePhase();
    });
  }

  private async routeUtterance(utterance: string): Promise<void> {
    this.remember({ who: 'founder', text: utterance });
    this.dependencies.ui.status({ phase: 'thinking', detail: 'routing' });
    const result = await this.dependencies.brain.ask(
      this.context('route-utterance', { utterance }),
    );

    if (result === null) {
      this.dependencies.log('Codex unavailable, using verbatim fallback.');
      this.speak('Codex is unreachable; sending your words as spoken.');
      await this.inject(utterance);
      return;
    }

    switch (result.action) {
      case 'chat':
        if (result.speak !== null) this.speak(result.speak);
        break;
      case 'prompt':
        if (result.prompt !== null) this.dependencies.turnTaking.onBrainPrompt(result.prompt);
        break;
      case 'none':
        this.updatePhase();
        break;
    }
  }

  private async handleSessionEvent(event: SessionEvent): Promise<void> {
    const rendered = this.renderSessionEvent(event);
    this.sessionEvents.push(rendered);
    if (this.sessionEvents.length > 40) this.sessionEvents.splice(0, this.sessionEvents.length - 40);

    const decision = this.dependencies.narrator.decide(event);
    switch (decision.type) {
      case 'silent':
        return;
      case 'question':
        this.speak(decision.text, { interrupt: true });
        return;
      case 'milestone':
        await this.narrateMilestone(decision.text);
        return;
      case 'turn-summary':
        await this.summarizeTurn();
        return;
    }
  }

  private async narrateMilestone(fallback: string): Promise<void> {
    const result = await this.dependencies.brain.ask(this.context('narrate-milestone'));
    if (result === null) {
      this.speak(fallback);
    } else if (result.speak !== null) {
      this.speak(result.speak);
    }
  }

  private async summarizeTurn(): Promise<void> {
    const fullText = this.dependencies.narrator.lastAssistantText();
    const result = await this.dependencies.brain.ask(
      this.context('summarize-turn', { fullText }),
    );
    if (result === null) {
      const fallback = fullText.slice(0, 200).trim();
      if (fallback !== '') this.speak(fallback);
    } else if (result.speak !== null) {
      this.speak(result.speak);
    }
  }

  private async handleControl(command: ControlCommand): Promise<void> {
    switch (command) {
      case 'status': {
        this.remember({ who: 'founder', text: "What's happening?" });
        const result = await this.dependencies.brain.ask(
          this.context('route-utterance', { utterance: "What's happening right now?" }),
        );
        if (result?.speak !== null && result?.speak !== undefined) {
          this.speak(result.speak);
        } else if (result === null) {
          const last = this.sessionEvents.at(-1) ?? 'No session activity yet.';
          this.speak(`${this.dependencies.turnTaking.phase}. ${last}`);
        }
        break;
      }
      case 'read-full':
        this.speakFull(this.dependencies.narrator.lastAssistantText());
        break;
      case 'help':
        this.speak(this.helpText());
        break;
      default:
        break;
    }
  }

  private async inject(prompt: string): Promise<void> {
    try {
      await this.dependencies.injector(prompt);
      this.dependencies.voiceLog?.append({ who: 'system', kind: 'inject', text: prompt });
      this.updatePhase();
    } catch (error) {
      this.edgeError('Injection', error);
    }
  }

  private edgeError(edge: string, value: unknown): void {
    const message = value instanceof Error ? value.message : String(value);
    this.dependencies.log(`${edge} error: ${message}`);
    this.dependencies.ui.status({ phase: 'error', detail: message });
    this.speak(`${edge} error. ${message}`);
  }

  private speak(text: string, opts: { interrupt?: boolean } = {}): void {
    if (text.trim() === '') return;
    this.remember({ who: 'copilot', text });
    this.dependencies.speaker.say(text, opts);
  }

  private speakFull(text: string): void {
    const remaining = text.trim();
    if (remaining === '') {
      this.speak('There is no Claude response to read yet.');
      return;
    }
    for (let start = 0; start < remaining.length; start += 1100) {
      this.speak(remaining.slice(start, start + 1100));
    }
  }

  private context(
    task: BrainContext['task'],
    extra: Pick<BrainContext, 'utterance' | 'fullText'> = {},
  ): BrainContext {
    return {
      task,
      sessionEvents: this.sessionEvents.slice(-12),
      history: [...this.history],
      ...extra,
    };
  }

  private remember(turn: BrainTurn): void {
    this.history.push(turn);
    if (this.history.length > 20) this.history.splice(0, this.history.length - 20);
    this.dependencies.voiceLog?.append({
      who: turn.who,
      kind: turn.who === 'founder' ? 'utterance' : 'speech',
      text: turn.text,
    });
  }

  private renderSessionEvent(event: SessionEvent): string {
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

  private updatePhase(): void {
    this.dependencies.ui.status({
      phase: this.dependencies.speaker.speaking
        ? 'speaking'
        : this.dependencies.turnTaking.phase,
    });
  }

  private helpText(): string {
    const settings = this.dependencies.settings;
    return `Control words include ${[
      ...settings.sendWords,
      ...settings.cancelWords,
      ...settings.waitWords,
      ...settings.muteWords,
      ...settings.unmuteWords,
      ...settings.statusWords,
      ...settings.readFullWords,
      'help',
    ].join(', ')}.`;
  }
}
