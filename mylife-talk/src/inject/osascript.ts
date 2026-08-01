import { execFile } from 'node:child_process';

export interface ExecFileLike {
  (
    command: string,
    args: string[],
  ): Promise<{ stdout: string; stderr: string; code: number | null }>;
}

export const defaultExecFile: ExecFileLike = (command, args) =>
  new Promise((resolve) => {
    execFile(command, args, { encoding: 'utf8' }, (error, stdout, stderr) => {
      resolve({
        stdout,
        stderr,
        code: error === null ? 0 : typeof error.code === 'number' ? error.code : null,
      });
    });
  });

function oneLine(text: string): string {
  return text.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function appleScriptString(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function buildInjectScript(text: string, app: string): string {
  const safeText = appleScriptString(oneLine(text));
  const safeApp = appleScriptString(app);
  return [
    `tell application "${safeApp}" to activate`,
    'delay 0.2',
    'tell application "System Events"',
    `  keystroke "${safeText}"`,
    '  delay 0.15',
    '  key code 36',
    'end tell',
  ].join('\n');
}

export async function injectViaOsascript(
  text: string,
  app: string,
  exec: ExecFileLike = defaultExecFile,
): Promise<void> {
  const result = await exec('osascript', ['-e', buildInjectScript(text, app)]);
  if (result.code === 0) return;
  if (/1002|not allowed/i.test(result.stderr)) {
    throw new Error(
      'Terminal control is not allowed. Grant access in System Settings > Privacy & Security > Accessibility.',
    );
  }
  throw new Error(result.stderr.trim() || `osascript exited with code ${String(result.code)}`);
}
