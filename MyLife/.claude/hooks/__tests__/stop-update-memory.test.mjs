import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildBreadcrumb,
  extractCommitHash,
  findMostRecentAutoLoggedRow,
  insertBreadcrumb,
  shouldSkip,
} from '../lib/stop-memory-core.mjs';

function fixtureMemory(extraRows = []) {
  const rows = [
    '| 2026-07-09 | Some earlier session summary. | [log](docs/sessions/2026-07-09-earlier.md) |',
    '| 2026-07-08 | Even earlier session summary. | [log](docs/sessions/2026-07-08-earlier.md) |',
    ...extraRows,
  ];

  return [
    '# memory.md',
    '',
    '## Project State',
    '',
    'Some state.',
    '',
    '## Sessions',
    '',
    '| Date | Summary | Log |',
    '|------|---------|-----|',
    ...rows,
    '',
    '## Known Tech Debt',
    '',
    '- none',
    '',
  ].join('\n');
}

test('first stop with a commit appends one breadcrumb row after the last Sessions row', () => {
  const memory = fixtureMemory();
  const lastCommit = 'a8b06415 docs: point yearn remediation at renumbered plan 47';
  const currentCommitHash = extractCommitHash(lastCommit);
  const sentinel = '<!-- stop-hook:2026-07-11T09:00 -->';

  assert.equal(
    shouldSkip({ memoryContent: memory, sentinel, currentCommitHash, hasDiff: true, lastCommit }),
    false,
  );

  const breadcrumb = buildBreadcrumb({
    dateStr: '2026-07-11',
    lastCommit,
    hasDiff: true,
    branch: 'feature/dowork-production-readiness',
    sentinel,
  });

  const updated = insertBreadcrumb(memory, breadcrumb);
  assert.ok(updated, 'expected insertBreadcrumb to find the Sessions table');

  const lines = updated.split('\n');
  const tableRows = lines.filter((line) => line.startsWith('|') && !line.includes('------'));
  // Header row + 2 fixture rows + the new breadcrumb, appended last.
  assert.equal(tableRows.length, 4);
  assert.equal(tableRows[tableRows.length - 1], breadcrumb, 'breadcrumb should be inserted after the last existing Sessions row');
});

test('second run with the SAME commit hash but a different minute appends nothing', () => {
  const lastCommit = 'a8b06415 docs: point yearn remediation at renumbered plan 47';
  const firstSentinel = '<!-- stop-hook:2026-07-11T09:00 -->';
  const firstBreadcrumb = buildBreadcrumb({
    dateStr: '2026-07-11',
    lastCommit,
    hasDiff: true,
    branch: 'feature/x',
    sentinel: firstSentinel,
  });
  const memoryAfterFirst = insertBreadcrumb(fixtureMemory(), firstBreadcrumb);

  // A later minute: the naive old logic (sentinel-only) would append again here.
  const secondSentinel = '<!-- stop-hook:2026-07-11T09:07 -->';
  const currentCommitHash = extractCommitHash(lastCommit);

  const skip = shouldSkip({
    memoryContent: memoryAfterFirst,
    sentinel: secondSentinel,
    currentCommitHash,
    hasDiff: true,
    lastCommit,
  });

  assert.equal(skip, true, 'same commit hash in a later minute must be deduped');
});

test('a run with a DIFFERENT commit hash appends a new row', () => {
  const firstCommit = 'a8b06415 docs: point yearn remediation at renumbered plan 47';
  const firstSentinel = '<!-- stop-hook:2026-07-11T09:00 -->';
  const firstBreadcrumb = buildBreadcrumb({
    dateStr: '2026-07-11',
    lastCommit: firstCommit,
    hasDiff: false,
    branch: 'feature/x',
    sentinel: firstSentinel,
  });
  const memoryAfterFirst = insertBreadcrumb(fixtureMemory(), firstBreadcrumb);

  const secondCommit = 'b9c8223d chore(meerkat): mark persona-service bin executable';
  const secondSentinel = '<!-- stop-hook:2026-07-11T09:15 -->';
  const currentCommitHash = extractCommitHash(secondCommit);

  const skip = shouldSkip({
    memoryContent: memoryAfterFirst,
    sentinel: secondSentinel,
    currentCommitHash,
    hasDiff: false,
    lastCommit: secondCommit,
  });
  assert.equal(skip, false, 'a new commit hash should not be deduped');

  const secondBreadcrumb = buildBreadcrumb({
    dateStr: '2026-07-11',
    lastCommit: secondCommit,
    hasDiff: false,
    branch: 'feature/x',
    sentinel: secondSentinel,
  });
  const memoryAfterSecond = insertBreadcrumb(memoryAfterFirst, secondBreadcrumb);

  assert.match(memoryAfterSecond, /Auto-logged: b9c8223d/);
  assert.match(memoryAfterSecond, /Auto-logged: a8b06415/);
});

test('same-minute duplicate is still skipped by the sentinel guard', () => {
  const lastCommit = 'a8b06415 docs: point yearn remediation at renumbered plan 47';
  const sentinel = '<!-- stop-hook:2026-07-11T09:00 -->';
  const breadcrumb = buildBreadcrumb({
    dateStr: '2026-07-11',
    lastCommit,
    hasDiff: true,
    branch: 'feature/x',
    sentinel,
  });
  const memoryAfterFirst = insertBreadcrumb(fixtureMemory(), breadcrumb);

  const currentCommitHash = extractCommitHash(lastCommit);
  const skip = shouldSkip({
    memoryContent: memoryAfterFirst,
    sentinel, // exact same sentinel = same minute
    currentCommitHash,
    hasDiff: true,
    lastCommit,
  });

  assert.equal(skip, true, 'identical sentinel (same minute) must always be skipped');
});

test('a summary containing the hash of an OLDER (not most recent) auto-logged row still appends', () => {
  const olderCommit = 'a8b06415 docs: point yearn remediation at renumbered plan 47';
  const middleCommit = 'b9c8223d chore(meerkat): mark persona-service bin executable';

  const olderBreadcrumb = buildBreadcrumb({
    dateStr: '2026-07-10',
    lastCommit: olderCommit,
    hasDiff: false,
    branch: 'feature/x',
    sentinel: '<!-- stop-hook:2026-07-10T08:00 -->',
  });
  const middleBreadcrumb = buildBreadcrumb({
    dateStr: '2026-07-11',
    lastCommit: middleCommit,
    hasDiff: false,
    branch: 'feature/x',
    sentinel: '<!-- stop-hook:2026-07-11T09:00 -->',
  });

  // Insert older first, then middle, mirroring real chronological insertion
  // (most recent breadcrumb ends up immediately after the header separator).
  let memory = insertBreadcrumb(fixtureMemory(), olderBreadcrumb);
  memory = insertBreadcrumb(memory, middleBreadcrumb);

  // Sanity: the most recent auto-logged row found should be the middle commit, not the older one.
  const mostRecent = findMostRecentAutoLoggedRow(memory);
  assert.equal(mostRecent.commitHash, 'b9c8223d');

  // Now simulate a Stop event where HEAD is back at (or references) the OLDER commit hash again
  // (e.g. a revert or a rebase). Since the most recent row is the middle commit, this must NOT be deduped.
  const currentCommitHash = extractCommitHash(olderCommit);
  const skip = shouldSkip({
    memoryContent: memory,
    sentinel: '<!-- stop-hook:2026-07-11T10:00 -->',
    currentCommitHash,
    hasDiff: false,
    lastCommit: olderCommit,
  });

  assert.equal(skip, false, 'dedup must only compare against the most recent auto-logged row');
});

test('extractCommitHash pulls the first whitespace-delimited token', () => {
  assert.equal(
    extractCommitHash('a8b06415 docs: point yearn remediation at renumbered plan 47'),
    'a8b06415',
  );
  assert.equal(extractCommitHash(''), null);
  assert.equal(extractCommitHash(null), null);
});

test('no-op guard: no commit and no diff skips regardless of commit hash logic', () => {
  const memory = fixtureMemory();
  const skip = shouldSkip({
    memoryContent: memory,
    sentinel: '<!-- stop-hook:2026-07-11T09:00 -->',
    currentCommitHash: null,
    hasDiff: false,
    lastCommit: '',
  });
  assert.equal(skip, true);
});

test('insertBreadcrumb returns null when there is no Sessions table', () => {
  const memory = '# memory.md\n\nNo table here.\n';
  const result = insertBreadcrumb(memory, '| 2026-07-11 | x | y |');
  assert.equal(result, null);
});
