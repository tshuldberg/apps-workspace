import { describe, expect, it, vi } from 'vitest';

import type { ExecFileLike } from './osascript.js';
import { injectViaTmux, tmuxArgs } from './tmux.js';

describe('tmux injection', () => {
  it('uses literal send-keys arguments', () => {
    expect(tmuxArgs('echo "$HOME"', 'dev:1')).toEqual([
      'send-keys',
      '-t',
      'dev:1',
      '-l',
      'echo "$HOME"',
    ]);
  });

  it('sends text and Enter separately', async () => {
    const exec = vi
      .fn<ExecFileLike>()
      .mockResolvedValue({ stdout: '', stderr: '', code: 0 });

    await injectViaTmux('Run tests', 'dev:1', exec);

    expect(exec).toHaveBeenNthCalledWith(1, 'tmux', [
      'send-keys',
      '-t',
      'dev:1',
      '-l',
      'Run tests',
    ]);
    expect(exec).toHaveBeenNthCalledWith(2, 'tmux', [
      'send-keys',
      '-t',
      'dev:1',
      'Enter',
    ]);
  });

  it('stops after a failed literal send', async () => {
    const exec = vi.fn<ExecFileLike>().mockResolvedValue({
      stdout: '',
      stderr: 'no server running',
      code: 1,
    });

    await expect(injectViaTmux('Run tests', 'dev:1', exec)).rejects.toThrow(
      'no server running',
    );
    expect(exec).toHaveBeenCalledOnce();
  });
});
