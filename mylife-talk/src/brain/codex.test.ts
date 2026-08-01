import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_SETTINGS } from '../config.js';
import { CodexBrain, type CodexRunner } from './codex.js';

const context = {
  task: 'route-utterance' as const,
  utterance: 'Run the tests',
  sessionEvents: [],
  history: [],
};

describe('CodexBrain', () => {
  it('parses a valid response', async () => {
    const run: CodexRunner = vi.fn().mockResolvedValue({
      stdout: '{"speak":"Okay","action":"chat","prompt":null}',
      code: 0,
    });

    await expect(new CodexBrain(DEFAULT_SETTINGS, run).ask(context)).resolves.toEqual({
      speak: 'Okay',
      action: 'chat',
      prompt: null,
    });
  });

  it('extracts JSON from noisy stdout', async () => {
    const run: CodexRunner = vi.fn().mockResolvedValue({
      stdout: 'startup noise\n{"action":"none"}\nfinished',
      code: 0,
    });

    await expect(new CodexBrain(DEFAULT_SETTINGS, run).ask(context)).resolves.toEqual({
      speak: null,
      action: 'none',
      prompt: null,
    });
  });

  it('retries invalid output exactly once with a JSON reminder', async () => {
    const run = vi
      .fn<CodexRunner>()
      .mockResolvedValueOnce({ stdout: 'not json', code: 0 })
      .mockResolvedValueOnce({ stdout: '{"action":"none"}', code: 0 });

    await expect(new CodexBrain(DEFAULT_SETTINGS, run).ask(context)).resolves.toEqual({
      speak: null,
      action: 'none',
      prompt: null,
    });
    expect(run).toHaveBeenCalledTimes(2);
    expect(run.mock.calls[1]?.[1]).toContain('Reply with ONLY the JSON object.');
  });

  it('returns null on timeout without retrying', async () => {
    const run = vi.fn<CodexRunner>().mockRejectedValue(new Error('timed out'));

    await expect(new CodexBrain(DEFAULT_SETTINGS, run).ask(context)).resolves.toBeNull();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('always uses the read-only sandbox flags', async () => {
    const run = vi
      .fn<CodexRunner>()
      .mockResolvedValue({ stdout: '{"action":"none"}', code: 0 });

    await new CodexBrain(DEFAULT_SETTINGS, run).ask(context);

    expect(run.mock.calls[0]?.[0]).toEqual([
      'exec',
      '-s',
      'read-only',
      '--skip-git-repo-check',
    ]);
  });

  it('adds the model flag only when configured', async () => {
    const run = vi
      .fn<CodexRunner>()
      .mockResolvedValue({ stdout: '{"action":"none"}', code: 0 });

    await new CodexBrain({ ...DEFAULT_SETTINGS, codexModel: 'gpt-5.5' }, run).ask(
      context,
    );

    expect(run.mock.calls[0]?.[0]).toContain('-m');
    expect(run.mock.calls[0]?.[0]).toContain('gpt-5.5');
  });

  it('probes availability and caches the result', async () => {
    const run = vi.fn<CodexRunner>().mockResolvedValue({ stdout: 'codex 1.0', code: 0 });
    const brain = new CodexBrain(DEFAULT_SETTINGS, run);

    await expect(brain.available()).resolves.toBe(true);
    await expect(brain.available()).resolves.toBe(true);
    expect(run).toHaveBeenCalledOnce();
    expect(run).toHaveBeenCalledWith(['--version'], '', DEFAULT_SETTINGS.codexTimeoutMs);
  });
});
