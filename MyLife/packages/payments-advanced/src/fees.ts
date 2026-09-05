export const BOOKING_FEE_CENTS = 100; // $1 per completed reservation

export function calculatePlatformFee(
  _depositAmountCents: number,
  isCompletedBooking: boolean,
): number {
  if (!isCompletedBooking) return 0;
  return BOOKING_FEE_CENTS;
}

export function calculateRestaurantPayout(
  capturedAmountCents: number,
  applicationFeeCents: number,
): number {
  return capturedAmountCents - applicationFeeCents;
}
