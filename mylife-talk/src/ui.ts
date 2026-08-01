export type UiState = { phase: string; detail?: string };

const icons: Record<string, string> = {
  listening: '🎤',
  muted: '⏸',
  speaking: '🔊',
  thinking: '⚙',
  'read-back': '📨',
  error: '✖',
};

function width(text: string): number {
  return Array.from(text).length;
}

export class Ui {
  private statusLine = '';
  private statusWidth = 0;

  constructor(private readonly out: { write(value: string): void } = process.stdout) {}

  log(line: string): void {
    if (this.statusWidth > 0) {
      this.out.write(`\r${' '.repeat(this.statusWidth)}\r`);
    }
    this.out.write(`${line}\n`);
    if (this.statusLine !== '') this.out.write(`\r${this.statusLine}`);
  }

  status(state: UiState): void {
    const icon = icons[state.phase] ?? '•';
    const line = `  ${icon} ${state.phase}${state.detail === undefined ? '' : ` — ${state.detail}`}`;
    const padding = ' '.repeat(Math.max(0, this.statusWidth - width(line)));
    this.out.write(`\r${line}${padding}`);
    this.statusLine = line;
    this.statusWidth = width(line);
  }
}
