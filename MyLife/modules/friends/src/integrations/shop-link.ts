/**
 * MyFriends -> MyShop integration adapters (P8-B).
 *
 * Pure URL builder for cross-module deep links. The Friends profile screen
 * uses these to render "Gift ideas", "Gift history", and "Add gift" entry
 * points pointing into MyShop. No IO, no partner module assumptions beyond
 * route shape.
 */

/**
 * Build the set of MyShop deep links for a given Friends person.
 * Returns an empty/safe shape even if `personId` is empty so the caller can
 * render disabled buttons without throwing.
 */
export function linkPersonToShop(personId: string): {
  shopRoutes: { ideas: string; gifts: string; addGift: string };
} {
  const safeId = personId ?? '';
  return {
    shopRoutes: {
      ideas: `/shop/gifts/ideas/${safeId}`,
      gifts: `/shop/gifts/${safeId}`,
      addGift: `/shop/gifts/add?personId=${safeId}`,
    },
  };
}
