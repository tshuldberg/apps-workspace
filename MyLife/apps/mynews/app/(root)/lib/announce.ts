import type { ReactNode } from 'react';

/**
 * Pure text extraction for screen-reader announcements (plan 48 WP10).
 *
 * Lives here rather than beside `ErrorText` so it is testable: the app's vitest
 * suite runs in a node environment with no React Native transform, so anything
 * that imports `react-native` cannot be unit-tested (see CLAUDE.md). This module
 * imports only a type, which is erased.
 */

/**
 * The announceable string inside a node.
 *
 * Call sites pass either a single string or an interpolated mix such as
 * "Could not load your profile: {message}", which React hands over as an array
 * with the JSX whitespace still in it. String and number children are joined,
 * runs of whitespace collapse, and element children are skipped rather than
 * guessed at: announcing a half-read nested element is worse than announcing the
 * part we can read.
 */
export function flattenText(children: ReactNode): string {
  if (children === null || children === undefined || children === false) return '';
  if (typeof children === 'string') return children.trim();
  if (typeof children === 'number') return String(children);
  if (Array.isArray(children)) {
    // Join, then collapse. JSX hands over its own indentation as children, and
    // skipped element children contribute empty strings, so the collapse is what
    // turns both into single spaces rather than gaps in the announcement.
    return children.map(flattenText).join(' ').replace(/\s+/g, ' ').trim();
  }
  return '';
}
