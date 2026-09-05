/**
 * MyShop -> MyFriends integration adapters (P8-B).
 *
 * Pure helpers. The Shop module does not query the Friends DB directly. The
 * caller hands in already-fetched arrays so the adapter stays deterministic
 * and trivially testable, and so a disabled MyFriends module simply means
 * "no input, empty output" without any throw.
 */

import type { Gift, Size, WishlistItem } from '../models/schemas';

/**
 * Wishlist items saved as gift ideas for a given Friends person.
 *
 * Uses `giftForPersonId` (added in shop migration v6). Items without that
 * field set are not gift ideas and are filtered out. Sort by createdAt DESC
 * so freshly captured ideas surface first on the friend profile.
 */
export function getGiftIdeasForPerson(
  wishlistItems: WishlistItem[],
  personId: string,
): WishlistItem[] {
  if (!wishlistItems || wishlistItems.length === 0 || !personId) return [];
  return wishlistItems
    .filter((item) => item.giftForPersonId === personId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/**
 * Gifts already given to a person, sorted by gift_date DESC (most recent
 * first). Pure filter + sort.
 */
export function getGiftHistoryForPerson(
  gifts: Gift[],
  personId: string,
): Gift[] {
  if (!gifts || gifts.length === 0 || !personId) return [];
  return gifts
    .filter((g) => g.personId === personId)
    .sort((a, b) => b.giftDate - a.giftDate);
}

/**
 * Sizes known for a specific person.
 *
 * Today, sh_sizes is owner-only — there is no person_id column. Until a future
 * v9 migration adds `person_id TEXT REFERENCES sh_gift_people(id)`, this
 * helper cannot scope sizes by person and intentionally returns an empty
 * array. The signature is kept so the Friends profile UI can wire against the
 * eventual contract today.
 *
 * Future schema sketch (v9):
 *   ALTER TABLE sh_sizes ADD COLUMN person_id TEXT
 *     REFERENCES sh_gift_people(id) ON DELETE SET NULL;
 *   CREATE INDEX sh_sizes_person_idx ON sh_sizes(person_id);
 */
export function getSizeMemoryForPerson(
  _sizes: Size[],
  _personId: string,
): Size[] {
  // TODO(v9): once sh_sizes.person_id exists, return
  //   sizes.filter((s) => s.personId === personId).
  return [];
}

/** Total cents spent on a person across all completed gifts. */
function totalSpentOnPersonCents(gifts: Gift[]): number {
  let total = 0;
  for (const g of gifts) {
    total += g.isGroupGift ? g.myShareCents ?? 0 : g.amountCents;
  }
  return total;
}

/**
 * Single-call rollup the Friends profile screen can render as the "Shop"
 * panel. Pure: no IO, safe with empty inputs.
 */
export function surfaceInFriendProfile(args: {
  wishlistItems: WishlistItem[];
  gifts: Gift[];
  sizes: Size[];
  personId: string;
}): {
  ideasCount: number;
  ideas: WishlistItem[];
  pastGiftsCount: number;
  totalSpentOnPersonCents: number;
  knownSizes: Size[];
} {
  const { wishlistItems, gifts, sizes, personId } = args;
  const ideas = getGiftIdeasForPerson(wishlistItems ?? [], personId);
  const history = getGiftHistoryForPerson(gifts ?? [], personId);
  const knownSizes = getSizeMemoryForPerson(sizes ?? [], personId);

  return {
    ideasCount: ideas.length,
    ideas,
    pastGiftsCount: history.length,
    totalSpentOnPersonCents: totalSpentOnPersonCents(history),
    knownSizes,
  };
}
