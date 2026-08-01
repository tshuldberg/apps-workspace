import { defaultExecFile, type ExecFileLike } from './osascript.js';

export function tmuxArgs(text: string, target: string): string[] {
  return ['send-keys', '-t', target, '-l', text];
}

export async function injectViaTmux(
  text: string,
  target: string,
  exec: ExecFileLike = defaultExecFile,
): Promise<void> {
  const literal = await exec('tmux', tmuxArgs(text, target));
  if (literal.code !== 0) {
    throw new Error(literal.stderr.trim() || `tmux exited with code ${String(literal.code)}`);
  }
  const enter = await exec('tmux', ['send-keys', '-t', target, 'Enter']);
  if (enter.code !== 0) {
    throw new Error(enter.stderr.trim() || `tmux exited with code ${String(enter.code)}`);
  }
}
