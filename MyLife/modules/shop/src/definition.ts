import type { ModuleDefinition } from '@mylife/module-registry';
import { getMigrations } from './db/schema';

export const SHOP_MODULE: ModuleDefinition = {
  id: 'shop',
  name: 'MyShop',
  tagline: 'Your private shopping memory',
  icon: '\u{1F6CD}\u{FE0F}',
  accentColor: '#10B981',
  tier: 'premium',
  storageType: 'sqlite',
  tablePrefix: 'sh_',
  schemaVersion: 8,
  migrations: getMigrations(),
  syncPolicy: {
    defaultScope: 'personal_replica',
    shareable: false,
    entityRules: [
      {
        tableName: 'wishlist_items',
        defaultScope: 'personal_replica',
        conflictStrategy: 'or_set',
      },
      {
        tableName: 'purchases',
        defaultScope: 'personal_replica',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'warranties',
        defaultScope: 'personal_replica',
        conflictStrategy: 'lww',
      },
    ],
  },
  navigation: {
    tabs: [
      { key: 'index', label: 'Wishlist', icon: 'heart' },
      { key: 'purchases', label: 'Purchases', icon: 'receipt' },
      { key: 'warranties', label: 'Warranties', icon: 'shield-check' },
      { key: 'settings', label: 'Settings', icon: 'settings' },
    ],
    screens: [],
  },
  requiresAuth: false,
  requiresNetwork: false,
  version: '0.1.0',
};
