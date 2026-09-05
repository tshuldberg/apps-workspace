import type { MailMessage, MailFilter, MailFilterAction } from '../types';

export interface FilterResult {
  matched: boolean;
  filterId?: string;
  action?: MailFilterAction;
  actionValue?: string | null;
}

/**
 * Run active filters against a message. Returns the first matching filter's action.
 * Filters are processed in priority order (lower priority number = higher priority).
 * First match wins -- subsequent filters are skipped.
 */
export function applyFilters(
  message: MailMessage,
  filters: MailFilter[],
): FilterResult {
  const sorted = [...filters]
    .filter((f) => f.isActive)
    .sort((a, b) => a.priority - b.priority);

  for (const filter of sorted) {
    if (matchesFilter(message, filter)) {
      return {
        matched: true,
        filterId: filter.id,
        action: filter.action,
        actionValue: filter.actionValue,
      };
    }
  }

  return { matched: false };
}

/**
 * Check if a message matches a single filter's field + pattern.
 * Case-insensitive substring match.
 */
export function matchesFilter(message: MailMessage, filter: MailFilter): boolean {
  const pattern = filter.pattern.toLowerCase();
  if (!pattern) return false;

  let fieldValue: string;
  switch (filter.field) {
    case 'from':
      fieldValue = message.from;
      break;
    case 'to':
      fieldValue = message.to.join(', ');
      break;
    case 'subject':
      fieldValue = message.subject;
      break;
    case 'body':
      fieldValue = message.body;
      break;
    default:
      return false;
  }

  return fieldValue.toLowerCase().includes(pattern);
}

/**
 * Count how many messages from a list match a filter (test mode).
 * Does not execute any actions.
 */
export function countMatches(messages: MailMessage[], filter: MailFilter): number {
  return messages.filter((msg) => matchesFilter(msg, filter)).length;
}

/** Create a filter CRUD input for a new filter. */
export interface CreateFilterInput {
  accountId: string;
  name: string;
  field: MailFilter['field'];
  pattern: string;
  action: MailFilter['action'];
  actionValue?: string;
  priority?: number;
}
