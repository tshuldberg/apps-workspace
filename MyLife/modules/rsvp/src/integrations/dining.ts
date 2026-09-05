export interface DiningEventContext {
  restaurantName: string;
  reservationDate: string;
  reservationTime?: string;
  partySize: number;
  address?: string | null;
}

export function buildRsvpEvent(context: DiningEventContext): {
  prefillTitle: string;
  prefillLocation: string;
  prefillDate: string;
  prefillCapacity: number;
  sourceModule: 'dining';
} {
  return {
    prefillTitle: `Dinner at ${context.restaurantName}`,
    prefillLocation: context.address || context.restaurantName,
    prefillDate: context.reservationDate,
    prefillCapacity: context.partySize,
    sourceModule: 'dining',
  };
}
