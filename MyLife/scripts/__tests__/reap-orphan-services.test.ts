/**
 * Locks the selection logic of scripts/reap-orphan-services.mjs.
 *
 * This script sends SIGKILL. The question "which rows match?" is therefore the
 * part that must never drift, and it is the part the safety comment in the
 * script claims three specific things about. These tests are that claim.
 */
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const reaper = await import(path.join(REPO_ROOT, 'scripts', 'reap-orphan-services.mjs')) as {
  parseEtimeMinutes: (etime: string) => number;
  serviceBinName: (command: string) => string | null;
  checkoutRoot: (command: string) => string;
  selectCandidates: (psOutput: string, minAgeMinutes: number) => Array<{
    pid: number; bin: string; ageMinutes: number; rssMb: number; checkout: string;
  }>;
};

const { parseEtimeMinutes, serviceBinName, checkoutRoot, selectCandidates } = reaper;

/** A real orphan, in the exact shape `ps -Ao pid=,ppid=,etime=,rss=,command=` prints. */
const ORPHAN = '  402     1 03:14:22 71544 /Users/trey/.nvm/versions/node/v22.22.0/bin/node --import file:///x/tsx/dist/loader.mjs /Users/trey/Desktop/Apps/MyLife/packages/meerkat-relay/bin/meerkat-public-directory-node.mjs';

describe('parseEtimeMinutes', () => {
  it('reads mm:ss', () => {
    expect(parseEtimeMinutes('01:41')).toBe(1);
    expect(parseEtimeMinutes('59:59')).toBe(59);
  });

  it('reads hh:mm:ss', () => {
    expect(parseEtimeMinutes('01:01:41')).toBe(61);
    expect(parseEtimeMinutes('10:00:00')).toBe(600);
  });

  it('reads dd-hh:mm:ss, the shape a 24-day-old orphan prints', () => {
    expect(parseEtimeMinutes('24-01:01:41')).toBe(24 * 1440 + 61);
    expect(parseEtimeMinutes('1-00:00:00')).toBe(1440);
  });
});

describe('serviceBinName: safety condition 2', () => {
  it('matches a service bin inside a repo checkout', () => {
    expect(serviceBinName('/usr/bin/node /Users/trey/Desktop/Apps/MyLife/packages/meerkat-relay/bin/meerkat-verification-service.mjs'))
      .toBe('meerkat-verification-service');
  });

  it('matches inside a worktree checkout too', () => {
    expect(serviceBinName('node /Users/trey/Desktop/Apps/Apps-wt-meerkat-plan59/packages/meerkat-relay/bin/meerkat-relay-server.mjs'))
      .toBe('meerkat-relay-server');
  });

  it('REFUSES a bare bin name outside the workspace path', () => {
    // An installed or containerised service must never be a candidate, however
    // it was started. Only a repo checkout is in scope.
    expect(serviceBinName('node /app/bin/meerkat-relay-server.mjs')).toBeNull();
    expect(serviceBinName('node /opt/meerkat/bin/meerkat-public-directory-node.mjs')).toBeNull();
    expect(serviceBinName('node /usr/local/lib/bin/meerkat-node.mjs')).toBeNull();
  });

  it('refuses unrelated processes', () => {
    expect(serviceBinName('/usr/bin/node server.js')).toBeNull();
    expect(serviceBinName('vitest run')).toBeNull();
    // A path that merely mentions the name is not an invocation of it.
    expect(serviceBinName('cat /Users/trey/notes-about-meerkat-relay.txt')).toBeNull();
  });
});

describe('checkoutRoot', () => {
  it('reports the checkout a candidate runs from', () => {
    expect(checkoutRoot(ORPHAN)).toBe('/Users/trey/Desktop/Apps/MyLife');
  });

  it('says unknown rather than guessing', () => {
    expect(checkoutRoot('node /app/bin/meerkat-relay-server.mjs')).toBe('unknown');
  });
});

describe('selectCandidates: all three safety conditions together', () => {
  it('selects a genuine orphan', () => {
    const rows = selectCandidates(ORPHAN, 10);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      pid: 402,
      bin: 'meerkat-public-directory-node',
      ageMinutes: 194,
      checkout: '/Users/trey/Desktop/Apps/MyLife',
    });
    expect(rows[0].rssMb).toBe(70);
  });

  it('condition 1: never selects a process that still has a parent', () => {
    const supervised = ORPHAN.replace('  402     1 ', '  402  9999 ');
    expect(selectCandidates(supervised, 10)).toEqual([]);
  });

  it('condition 2: never selects a non-checkout service', () => {
    const installed = ORPHAN.replace(
      '/Users/trey/Desktop/Apps/MyLife/packages/meerkat-relay/bin/',
      '/app/bin/',
    );
    expect(selectCandidates(installed, 10)).toEqual([]);
  });

  it('condition 3: never selects a service that is still booting', () => {
    const young = ORPHAN.replace(' 03:14:22 ', ' 00:04 ');
    expect(selectCandidates(young, 10)).toEqual([]);
    // ...but the same process is fair game once it is old enough.
    expect(selectCandidates(young, 0)).toHaveLength(1);
  });

  it('ignores blank lines and rows ps prints in an unexpected shape', () => {
    expect(selectCandidates('\n\n   \nnot a ps row at all\n', 10)).toEqual([]);
  });

  it('selects every orphan in a multi-line listing, and only those', () => {
    const listing = [
      ORPHAN,
      ORPHAN.replace('  402     1 ', '  403     1 ').replace('public-directory-node', 'verification-service'),
      ORPHAN.replace('  402     1 ', '  404  1234 '), // supervised, skipped
      '  405     1 03:14:22 71544 /usr/bin/node /Users/trey/other-project/server.js', // unrelated
    ].join('\n');
    const rows = selectCandidates(listing, 10);
    expect(rows.map((r) => r.pid)).toEqual([402, 403]);
    expect(rows.map((r) => r.bin)).toEqual(['meerkat-public-directory-node', 'meerkat-verification-service']);
  });
});
