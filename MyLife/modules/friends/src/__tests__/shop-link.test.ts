import { describe, expect, it } from 'vitest';
import { linkPersonToShop } from '../integrations/shop-link';

describe('linkPersonToShop', () => {
  it('builds the three shop deep links for a given person id', () => {
    expect(linkPersonToShop('person_42')).toEqual({
      shopRoutes: {
        ideas: '/shop/gifts/ideas/person_42',
        gifts: '/shop/gifts/person_42',
        addGift: '/shop/gifts/add?personId=person_42',
      },
    });
  });

  it('returns a safe shape when personId is empty', () => {
    expect(linkPersonToShop('')).toEqual({
      shopRoutes: {
        ideas: '/shop/gifts/ideas/',
        gifts: '/shop/gifts/',
        addGift: '/shop/gifts/add?personId=',
      },
    });
  });
});
