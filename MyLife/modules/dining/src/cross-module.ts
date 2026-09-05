/**
 * Cross-module interface implementation for MyDining.
 *
 * Surfaces tonight's reservation and the active wishlist on the hub Today
 * view. All reads are pure queries over dn_ tables via the injected adapter.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type {
  CrossModuleInterface,
  TodayCard,
  TodayCardContext,
} from '@mylife/module-registry';

const MODULE_ID = 'dining';

interface ReservationTodayRow {
  id: string;
  reserved_at: string;
  party_size: number;
  restaurant_name: string;
}

function isoDay(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function endOfUtcDay(now: Date): string {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  ).toISOString();
}

function formatTime(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '';
  return new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function buildReservationCard(
  db: DatabaseAdapter,
  context: TodayCardContext,
): TodayCard | null {
  const today = isoDay(context.now);
  const rows = db.query<ReservationTodayRow>(
    `SELECT r.id, r.reserved_at, r.party_size, rest.name as restaurant_name
     FROM dn_reservations r
     JOIN dn_restaurants rest ON rest.id = r.restaurant_id
     WHERE r.status = 'upcoming' AND date(r.reserved_at) = ?
     ORDER BY r.reserved_at ASC
     LIMIT 1`,
    [today],
  );
  const reservation = rows[0];
  if (!reservation) return null;

  const time = formatTime(reservation.reserved_at);
  const party = `party of ${reservation.party_size}`;

  return {
    id: `dining.reservation.${reservation.id}`,
    moduleId: MODULE_ID,
    kind: 'event',
    priority: 85,
    title: `Reservation: ${reservation.restaurant_name}`,
    subtitle: time ? `${time} · ${party}` : party,
    cta: { label: 'View reservation', route: '/dining/reservations' },
    dismissible: true,
    expiresAt: endOfUtcDay(context.now),
  };
}

function buildWishlistCard(db: DatabaseAdapter, context: TodayCardContext): TodayCard | null {
  const rows = db.query<{ n: number }>(
    `SELECT COUNT(*) as n FROM dn_watchlist WHERE status = 'active'`,
  );
  const count = rows[0]?.n ?? 0;
  if (count === 0) return null;

  return {
    id: `dining.wishlist.${isoDay(context.now)}`,
    moduleId: MODULE_ID,
    kind: 'insight',
    priority: 30,
    title: `${count} place${count === 1 ? '' : 's'} on your wishlist`,
    subtitle: 'Pick one for tonight',
    cta: { label: 'Open MyDining', route: '/dining' },
    dismissible: true,
    expiresAt: endOfUtcDay(context.now),
  };
}

function getTodayCards(db: DatabaseAdapter, context: TodayCardContext): TodayCard[] {
  const cards: TodayCard[] = [];
  const reservation = buildReservationCard(db, context);
  if (reservation) cards.push(reservation);
  const wishlist = buildWishlistCard(db, context);
  if (wishlist) cards.push(wishlist);
  return cards;
}

export const diningCrossModule: CrossModuleInterface = {
  getTodayCards: (db, context) => getTodayCards(db as DatabaseAdapter, context),
};
