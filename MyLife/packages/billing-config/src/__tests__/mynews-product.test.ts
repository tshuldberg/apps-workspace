import { describe, expect, it } from 'vitest';
import { ALL_PRODUCT_IDS, PRODUCTS } from '../index';

describe('mynews billing product', () => {
  it('sells the standalone unlock at 4.99', () => {
    expect(PRODUCTS.standaloneModules.mynews).toEqual({
      id: 'mylife_mynews_unlock',
      price: 4.99,
    });
  });

  it('derives into ALL_PRODUCT_IDS', () => {
    expect(ALL_PRODUCT_IDS).toContain('mylife_mynews_unlock');
  });
});
