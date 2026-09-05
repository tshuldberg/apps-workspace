/**
 * Pure logic for the Stop hook's memory.md breadcrumb writer.
 * No side effects on import: every export here is a plain function
 * operating on strings passed in by the caller (no fs/git access).
 */

const SESSIONS_TABLE_SEPARATOR = '|------|---------|-----|';
const AUTO_LOGGED_PREFIX = 'Auto-logged:';
const SENTINEL_PREFIX = '<!-- stop-hook:';

/** First whitespace-delimited token of a `git log --oneline -1` line, e.g. the commit hash. */
export function extractCommitHash(lastCommitLine) {
  if (!lastCommitLine) {
    return null;
  }
  const token = lastCommitLine.trim().split(/\s+/)[0];
  return token || null;
}

/**
 * Scan the Sessions table for the most recent auto-logged breadcrumb row
 * (Summary cell starts with "Auto-logged:" and Log cell contains a stop-hook sentinel).
 * The hook always appends new breadcrumbs after the last existing row of the table
 * (see insertBreadcrumb), so the most recently written breadcrumb is the bottom-most
 * matching row, not the first one encountered.
 * Returns { commitHash, rowIndex } or null if none found.
 */
export function findMostRecentAutoLoggedRow(memoryContent) {
  const lines = memoryContent.split('\n');
  let inSessionsTable = false;
  let mostRecent = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes(SESSIONS_TABLE_SEPARATOR)) {
      inSessionsTable = true;
      continue;
    }
    if (!inSessionsTable) {
      continue;
    }
    if (!line.startsWith('|')) {
      break;
    }

    const cells = line.split('|').map((cell) => cell.trim());
    // cells[0] is '' (before the leading pipe); Date, Summary, Log follow.
    const summary = cells[2] ?? '';
    const logCell = cells[3] ?? '';

    if (summary.startsWith(AUTO_LOGGED_PREFIX) && logCell.includes(SENTINEL_PREFIX)) {
      const commitHash = extractCommitHash(summary.slice(AUTO_LOGGED_PREFIX.length));
      mostRecent = { commitHash, rowIndex: i };
    }
  }

  return mostRecent;
}

/** True if this run should be skipped entirely (no breadcrumb written). */
export function shouldSkip({ memoryContent, sentinel, currentCommitHash, hasDiff, lastCommit }) {
  if (memoryContent.includes(sentinel)) {
    return true;
  }

  if (!hasDiff && !lastCommit) {
    return true;
  }

  if (currentCommitHash) {
    const mostRecent = findMostRecentAutoLoggedRow(memoryContent);
    if (mostRecent && mostRecent.commitHash === currentCommitHash) {
      return true;
    }
  }

  return false;
}

/** Build the Sessions table breadcrumb row for this run. */
export function buildBreadcrumb({ dateStr, lastCommit, hasDiff, branch, sentinel }) {
  const summary = lastCommit
    ? `Auto-logged: ${lastCommit.slice(0, 80)}${hasDiff ? ' (+uncommitted changes)' : ''}`
    : `Auto-logged: uncommitted work on ${branch}`;

  return `| ${dateStr} | ${summary} | ${sentinel} |`;
}

/**
 * Insert a breadcrumb row immediately after the last row of the Sessions table.
 * Returns the updated memory.md content, or null if no Sessions table was found.
 */
export function insertBreadcrumb(memoryContent, breadcrumb) {
  if (!memoryContent.includes(SESSIONS_TABLE_SEPARATOR)) {
    return null;
  }

  const lines = memoryContent.split('\n');
  let lastTableLine = -1;
  let inSessionsTable = false;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(SESSIONS_TABLE_SEPARATOR)) {
      inSessionsTable = true;
      continue;
    }
    if (inSessionsTable && lines[i].startsWith('|')) {
      lastTableLine = i;
    }
    if (inSessionsTable && !lines[i].startsWith('|') && lines[i].trim() !== '') {
      break;
    }
  }

  if (lastTableLine < 0) {
    return null;
  }

  lines.splice(lastTableLine + 1, 0, breadcrumb);
  return lines.join('\n');
}

export const SESSIONS_TABLE_SEPARATOR_TEXT = SESSIONS_TABLE_SEPARATOR;
