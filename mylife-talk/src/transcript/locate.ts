import { resolve } from 'node:path';

export function projectSlug(projectDir: string): string {
  return resolve(projectDir).replace(/[^A-Za-z0-9]/g, '-');
}

export function transcriptDirFor(projectDir: string, home: string): string {
  return `${home}/.claude/projects/${projectSlug(projectDir)}`;
}

export function newestTranscript(
  dir: string,
  fsi: {
    readdirSync(path: string): string[];
    statSync(path: string): { mtimeMs: number };
  },
): string | null {
  try {
    const files = fsi.readdirSync(dir).filter((file) => file.endsWith('.jsonl'));
    let newest: { path: string; mtimeMs: number } | null = null;

    for (const file of files) {
      const path = `${dir}/${file}`;
      const { mtimeMs } = fsi.statSync(path);
      if (newest === null || mtimeMs > newest.mtimeMs) {
        newest = { path, mtimeMs };
      }
    }

    return newest?.path ?? null;
  } catch {
    return null;
  }
}
