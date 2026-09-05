/**
 * Seating arrangement engine for RSVP events.
 * Validates assignments, auto-assigns guests, generates shareable text.
 */

import type { SeatAssignment } from '../types';

export interface AssignmentInput {
  guestName: string;
  tableId: string;
}

/**
 * Validate that a guest can be assigned to a table.
 * Returns null if valid, or an error message string if invalid.
 */
export function validateAssignment(
  tableCapacity: number,
  currentAssignments: number,
  guestName: string,
  allAssignments: SeatAssignment[],
): string | null {
  if (currentAssignments >= tableCapacity) {
    return 'Table is full';
  }
  const duplicate = allAssignments.find(
    (a) => a.guestName === guestName,
  );
  if (duplicate) {
    return `${guestName} is already assigned to another table`;
  }
  return null;
}

/**
 * Calculate remaining capacity for a table.
 */
export function calculateRemainingCapacity(
  tableCapacity: number,
  currentAssignments: number,
): number {
  return Math.max(0, tableCapacity - currentAssignments);
}

/**
 * Auto-assign unassigned guests to tables with available seats.
 * Fills tables in sort order, guests in alphabetical order.
 * Does not overwrite existing assignments.
 *
 * Returns: { assigned: Array<{guestName, tableId}>, unassigned: string[] }
 */
export function autoAssign(
  tables: Array<{ id: string; capacity: number; sortOrder: number }>,
  assignedCounts: Map<string, number>,
  unassignedGuests: string[],
): { assigned: AssignmentInput[]; unassigned: string[] } {
  const sorted = [...tables].sort((a, b) => a.sortOrder - b.sortOrder);
  const guests = [...unassignedGuests].sort();
  const assigned: AssignmentInput[] = [];
  let guestIdx = 0;

  for (const table of sorted) {
    const currentCount = assignedCounts.get(table.id) ?? 0;
    let available = table.capacity - currentCount;

    while (available > 0 && guestIdx < guests.length) {
      assigned.push({ guestName: guests[guestIdx], tableId: table.id });
      guestIdx++;
      available--;
    }
  }

  return {
    assigned,
    unassigned: guests.slice(guestIdx),
  };
}

/**
 * Get list of going guests not assigned to any table.
 */
export function getUnassignedGuests(
  goingGuests: string[],
  assignedGuests: Set<string>,
): string[] {
  return goingGuests.filter((g) => !assignedGuests.has(g));
}

/**
 * Generate a text summary of the seating arrangement for sharing/printing.
 */
export function generateSeatingText(
  tables: Array<{ label: string; guests: string[] }>,
): string {
  return tables
    .map((t) => {
      const guests = t.guests.length > 0 ? t.guests.join(', ') : '(empty)';
      return `${t.label}: ${guests}`;
    })
    .join('\n');
}
