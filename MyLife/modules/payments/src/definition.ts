import type { ModuleDefinition } from '@mylife/module-registry';

export const PAYMENTS_MODULE: ModuleDefinition = {
  id: 'payments',
  name: 'MyPay',
  tagline: 'Wallet, transfers, and money controls',
  icon: '\u{1F4B8}',
  accentColor: '#00C389',
  tier: 'premium',
  storageType: 'supabase',
  tablePrefix: 'pay_',
  navigation: {
    tabs: [
      { key: 'wallet', label: 'Wallet', icon: 'wallet' },
      { key: 'activity', label: 'Activity', icon: 'arrow-left-right' },
      { key: 'cards', label: 'Cards', icon: 'credit-card' },
      { key: 'protect', label: 'Protect', icon: 'shield-check' },
      { key: 'settings', label: 'Settings', icon: 'settings' },
    ],
    screens: [
      { name: 'send-money', title: 'Send Money' },
      { name: 'request-money', title: 'Request Money' },
      { name: 'cash-out', title: 'Cash Out' },
      { name: 'add-funding-source', title: 'Add Funding Source' },
      { name: 'transaction-detail', title: 'Transaction' },
      { name: 'dispute-center', title: 'Disputes' },
      { name: 'dispute-detail', title: 'Dispute Detail' },
      { name: 'remittance-quote', title: 'Remittance Quote' },
      { name: 'remittance-confirm', title: 'Confirm Transfer' },
      { name: 'compliance-review', title: 'Compliance Review' },
    ],
  },
  requiresAuth: true,
  requiresNetwork: true,
  version: '0.1.0',
  syncPolicy: {
    defaultScope: 'device_local',
    shareable: false,
    isSensitive: true,
    entityRules: [
      {
        tableName: 'transactions',
        defaultScope: 'device_local',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'annotations',
        defaultScope: 'personal_replica',
        conflictStrategy: 'manual_review',
        requiresManualResolver: true,
        resolverComponent: 'PaymentAnnotationResolver',
      },
    ],
  },
};
