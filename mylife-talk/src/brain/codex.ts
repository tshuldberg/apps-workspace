import { execFile } from 'node:child_process';

import type { Settings } from '../config.js';
import type { BrainResult } from '../types.js';
import { buildBrainPrompt, type BrainContext } from './prompts.js';
import { extractJson, validateBrainResult } from './schema.js';

export interface CodexRunner {
  (
    args: string[],
    input: string,
    timeoutMs: number,
  ): Promise<{ stdout: string; code: number | null }>;
}

const defaultRunner: CodexRunner = (args, input, timeoutMs) =>
  new Promise((resolve) => {
    const commandArgs = input === '' ? args : [...args, input];
    const child = execFile(
      'codex',
      commandArgs,
      { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, timeout: timeoutMs },
      (error, stdout) => {
        resolve({
          stdout,
          code: error === null ? 0 : typeof error.code === 'number' ? error.code : null,
        });
      },
    );
    // codex waits on stdin when it is an open pipe ("Reading additional input
    // from stdin...") and hangs until EOF; close it so the prompt arg is all it gets
    child.stdin?.end();
  });

function parseResult(stdout: string): BrainResult | null {
  // codex exec stdout can contain braces before the answer (config echo, logs),
  // so scan every candidate JSON object until one validates
  let position = stdout.indexOf('{');
  while (position !== -1) {
    const candidate = extractJson(stdout.slice(position));
    if (candidate !== null) {
      try {
        const validated = validateBrainResult(JSON.parse(candidate) as unknown);
        if (validated !== null) return validated;
      } catch {
        // fall through to the next candidate
      }
    }
    position = stdout.indexOf('{', position + 1);
  }
  return null;
}

export class CodexBrain {
  private availability: { value: boolean; expiresAt: number } | null = null;

  constructor(
    private readonly settings: Settings,
    private readonly run: CodexRunner = defaultRunner,
  ) {}

  async available(): Promise<boolean> {
    const now = Date.now();
    if (this.availability !== null && this.availability.expiresAt > now) {
      return this.availability.value;
    }

    let value = false;
    try {
      const result = await this.run(['--version'], '', this.settings.codexTimeoutMs);
      value = result.code === 0;
    } catch {
      value = false;
    }
    this.availability = { value, expiresAt: now + 5 * 60_000 };
    return value;
  }

  async ask(context: BrainContext): Promise<BrainResult | null> {
    const args = ['exec', '-s', 'read-only', '--skip-git-repo-check'];
    if (this.settings.codexModel !== null) args.push('-m', this.settings.codexModel);
    const prompt = buildBrainPrompt(context);

    const first = await this.attempt(args, prompt);
    if (first.failed || first.result !== null) return first.result;

    const retry = await this.attempt(
      args,
      `${prompt}\nReply with ONLY the JSON object.`,
    );
    return retry.failed ? null : retry.result;
  }

  private async attempt(
    args: string[],
    prompt: string,
  ): Promise<{ failed: boolean; result: BrainResult | null }> {
    try {
      const response = await this.run(args, prompt, this.settings.codexTimeoutMs);
      if (response.code !== 0) return { failed: true, result: null };
      return { failed: false, result: parseResult(response.stdout) };
    } catch {
      return { failed: true, result: null };
    }
  }
}
