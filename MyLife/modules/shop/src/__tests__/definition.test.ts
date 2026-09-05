import { describe, it, expect } from 'vitest';
import { SHOP_MODULE } from '../definition';

describe('SHOP_MODULE definition', () => {
  it('has the expected identity', () => {
    expect(SHOP_MODULE.id).toBe('shop');
    expect(SHOP_MODULE.name).toBe('MyShop');
    expect(SHOP_MODULE.tablePrefix).toBe('sh_');
    expect(SHOP_MODULE.tier).toBe('premium');
    expect(SHOP_MODULE.storageType).toBe('sqlite');
  });

  it('declares a contiguous migration list starting at version 1', () => {
    expect(SHOP_MODULE.migrations).toBeDefined();
    expect(SHOP_MODULE.migrations!.length).toBeGreaterThanOrEqual(8);
    expect(SHOP_MODULE.migrations![0].version).toBe(1);
    expect(SHOP_MODULE.migrations![1].version).toBe(2);
    expect(SHOP_MODULE.migrations![2].version).toBe(3);
    expect(SHOP_MODULE.migrations![3].version).toBe(4);
    expect(SHOP_MODULE.migrations![4].version).toBe(5);
    expect(SHOP_MODULE.migrations![5].version).toBe(6);
    expect(SHOP_MODULE.migrations![6].version).toBe(7);
    expect(SHOP_MODULE.migrations![7].version).toBe(8);
    expect(SHOP_MODULE.schemaVersion).toBe(8);
  });

  it('v7 up migration creates sh_thirty_day_rule', () => {
    const v7 = SHOP_MODULE.migrations![6];
    const joined = v7.up.join('\n');
    expect(joined).toContain('CREATE TABLE IF NOT EXISTS sh_thirty_day_rule');
  });

  it('v8 up migration creates sh_comparisons and sh_store_notes', () => {
    const v8 = SHOP_MODULE.migrations![7];
    const joined = v8.up.join('\n');
    expect(joined).toContain('CREATE TABLE IF NOT EXISTS sh_comparisons');
    expect(joined).toContain('CREATE TABLE IF NOT EXISTS sh_store_notes');
  });

  it('v1 up migration creates sh_settings', () => {
    const v1 = SHOP_MODULE.migrations![0];
    const joined = v1.up.join('\n');
    expect(joined).toContain('CREATE TABLE IF NOT EXISTS sh_settings');
  });

  it('v2 up migration creates wishlist tables', () => {
    const v2 = SHOP_MODULE.migrations![1];
    const joined = v2.up.join('\n');
    expect(joined).toContain('CREATE TABLE IF NOT EXISTS sh_wishlists');
    expect(joined).toContain('CREATE TABLE IF NOT EXISTS sh_wishlist_items');
    expect(joined).toContain('CREATE TABLE IF NOT EXISTS sh_photos');
  });

  it('v3 up migration creates sh_purchases', () => {
    const v3 = SHOP_MODULE.migrations![2];
    const joined = v3.up.join('\n');
    expect(joined).toContain('CREATE TABLE IF NOT EXISTS sh_purchases');
  });

  it('v4 up migration creates sh_warranties', () => {
    const v4 = SHOP_MODULE.migrations![3];
    const joined = v4.up.join('\n');
    expect(joined).toContain('CREATE TABLE IF NOT EXISTS sh_warranties');
  });

  it('v5 up migration creates sh_sizes and sh_preferences', () => {
    const v5 = SHOP_MODULE.migrations![4];
    const joined = v5.up.join('\n');
    expect(joined).toContain('CREATE TABLE IF NOT EXISTS sh_sizes');
    expect(joined).toContain('CREATE TABLE IF NOT EXISTS sh_preferences');
  });

  it('v6 up migration creates gift tables and adds gift_for_person_id column', () => {
    const v6 = SHOP_MODULE.migrations![5];
    const joined = v6.up.join('\n');
    expect(joined).toContain('CREATE TABLE IF NOT EXISTS sh_gift_people');
    expect(joined).toContain('CREATE TABLE IF NOT EXISTS sh_gifts_given');
    expect(joined).toContain('CREATE TABLE IF NOT EXISTS sh_gift_budgets');
    expect(joined).toContain('ALTER TABLE sh_wishlist_items ADD COLUMN gift_for_person_id');
  });

  it('declares the P0-C tab surface (wishlist, purchases, warranties, settings)', () => {
    expect(SHOP_MODULE.navigation.tabs.map((tab) => tab.key)).toEqual([
      'index',
      'purchases',
      'warranties',
      'settings',
    ]);
    expect(SHOP_MODULE.navigation.screens).toEqual([]);
  });
});
