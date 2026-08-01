import { describe, expect, it } from 'vitest';

import { newestTranscript, projectSlug, transcriptDirFor } from './locate.js';

describe('transcript location', () => {
  it('creates the verified Claude project slug', () => {
    expect(projectSlug('/Users/trey/Desktop/Apps/MyLife')).toBe(
      '-Users-trey-Desktop-Apps-MyLife',
    );
  });

  it('replaces dots and underscores', () => {
    expect(projectSlug('/tmp/my.project_name')).toBe('-tmp-my-project-name');
  });

  it('builds the transcript directory', () => {
    expect(transcriptDirFor('/tmp/project', '/Users/me')).toBe(
      '/Users/me/.claude/projects/-tmp-project',
    );
  });

  it('selects the newest JSONL file by modification time', () => {
    const fsi = {
      readdirSync: () => ['old.jsonl', 'notes.txt', 'new.jsonl'],
      statSync: (path: string) => ({ mtimeMs: path.includes('new') ? 20 : 10 }),
    };

    expect(newestTranscript('/sessions', fsi)).toBe('/sessions/new.jsonl');
  });

  it('returns null for a missing directory or no transcripts', () => {
    expect(
      newestTranscript('/missing', {
        readdirSync: () => {
          throw new Error('ENOENT');
        },
        statSync: () => ({ mtimeMs: 0 }),
      }),
    ).toBeNull();
    expect(
      newestTranscript('/empty', {
        readdirSync: () => ['notes.txt'],
        statSync: () => ({ mtimeMs: 0 }),
      }),
    ).toBeNull();
  });
});
