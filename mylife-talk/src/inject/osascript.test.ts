import { describe, expect, it, vi } from 'vitest';

import {
  buildInjectScript,
  injectViaOsascript,
  type ExecFileLike,
} from './osascript.js';

describe('osascript injection', () => {
  it('escapes quotes and backslashes and flattens newlines', () => {
    const script = buildInjectScript('say "hello"\nfrom C:\\temp', 'Terminal');

    expect(script).toContain('keystroke "say \\"hello\\" from C:\\\\temp"');
    expect(script).not.toContain('hello"\nfrom');
  });

  it('activates the app and presses return exactly once', () => {
    const script = buildInjectScript('Run tests', 'iTerm2');

    expect(script).toContain('tell application "iTerm2" to activate');
    expect(script.match(/key code 36/g)).toHaveLength(1);
    expect(script).toContain('delay 0.2');
    expect(script).toContain('delay 0.15');
  });

  it('executes the generated script', async () => {
    const exec = vi.fn<ExecFileLike>().mockResolvedValue({
      stdout: '',
      stderr: '',
      code: 0,
    });

    await injectViaOsascript('Run tests', 'Terminal', exec);

    expect(exec).toHaveBeenCalledWith('osascript', [
      '-e',
      buildInjectScript('Run tests', 'Terminal'),
    ]);
  });

  it.each(['execution error: 1002', 'System Events is not allowed assistive access'])(
    'maps accessibility failure: %s',
    async (stderr) => {
      const exec: ExecFileLike = vi.fn().mockResolvedValue({ stdout: '', stderr, code: 1 });

      await expect(injectViaOsascript('text', 'Terminal', exec)).rejects.toThrow(
        'System Settings > Privacy & Security > Accessibility',
      );
    },
  );

  it('preserves other osascript errors', async () => {
    const exec: ExecFileLike = vi.fn().mockResolvedValue({
      stdout: '',
      stderr: 'syntax error',
      code: 1,
    });

    await expect(injectViaOsascript('text', 'Terminal', exec)).rejects.toThrow(
      'syntax error',
    );
  });
});
