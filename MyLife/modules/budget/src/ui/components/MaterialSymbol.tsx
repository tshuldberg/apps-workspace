import * as LucideIcons from 'lucide-react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { ComponentProps, ReactElement } from 'react';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

type BudgetSymbolSpec = {
  material?: MaterialIconName;
  fallback?: string;
};

const SYMBOL_MAP = {
  account_balance: { material: 'account-balance', fallback: 'Landmark' },
  account_balance_wallet: {
    material: 'account-balance-wallet',
    fallback: 'WalletCards',
  },
  wallet: { material: 'account-balance-wallet', fallback: 'WalletCards' },
  savings: { material: 'savings', fallback: 'PiggyBank' },
  payments: { material: 'payments', fallback: 'BadgeDollarSign' },
  credit_card: { material: 'credit-card', fallback: 'CreditCard' },
  trending_up: { material: 'trending-up', fallback: 'TrendingUp' },
  trending_down: { material: 'trending-down', fallback: 'TrendingDown' },
  pie_chart: { material: 'pie-chart', fallback: 'PieChart' },
  list_alt: { material: 'list-alt', fallback: 'List' },
  repeat: { material: 'repeat', fallback: 'Repeat2' },
  receipt_long: { material: 'receipt-long', fallback: 'ReceiptText' },
  add: { material: 'add', fallback: 'Plus' },
  close: { material: 'close', fallback: 'X' },
  more_vert: { material: 'more-vert', fallback: 'MoreVertical' },
  search: { material: 'search', fallback: 'Search' },
  filter_list: { material: 'filter-list', fallback: 'SlidersHorizontal' },
  sort: { material: 'sort', fallback: 'ArrowUpDown' },
  arrow_upward: { material: 'arrow-upward', fallback: 'ArrowUp' },
  arrow_downward: { material: 'arrow-downward', fallback: 'ArrowDown' },
  arrow_forward: { material: 'arrow-forward', fallback: 'ArrowRight' },
  calendar_today: { material: 'calendar-today', fallback: 'CalendarDays' },
  schedule: { material: 'schedule', fallback: 'Clock3' },
  check_circle: { material: 'check-circle', fallback: 'CheckCircle2' },
  warning: { material: 'warning', fallback: 'TriangleAlert' },
  flag: { material: 'flag', fallback: 'Flag' },
  edit: { material: 'edit', fallback: 'Pencil' },
  delete: { material: 'delete', fallback: 'Trash2' },
  photo_camera: { material: 'photo-camera', fallback: 'Camera' },
  qr_code_scanner: {
    material: 'qr-code-scanner',
    fallback: 'ScanQrCode',
  },
  local_atm: { material: 'local-atm', fallback: 'HandCoins' },
  attach_money: { material: 'attach-money', fallback: 'BadgeDollarSign' },
  currency_exchange: {
    material: 'currency-exchange',
    fallback: 'ArrowLeftRight',
  },
  handshake: { material: 'handshake', fallback: 'Handshake' },
  group: { material: 'group', fallback: 'UsersRound' },
  notifications: { material: 'notifications', fallback: 'Bell' },
  tune: { material: 'tune', fallback: 'SlidersHorizontal' },
} satisfies Record<string, BudgetSymbolSpec>;

export interface MaterialSymbolProps {
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function resolveBudgetSymbol(name: string): BudgetSymbolSpec {
  const normalized = name.replace(/-/g, '_').toLowerCase();
  const spec = SYMBOL_MAP[normalized as keyof typeof SYMBOL_MAP];
  return spec ?? { material: 'radio-button-unchecked', fallback: 'Circle' };
}

export function MaterialSymbol({
  name,
  size = 20,
  color = '#E4E1E9',
  strokeWidth = 2,
}: MaterialSymbolProps) {
  const spec = resolveBudgetSymbol(name);

  if (spec.material) {
    return <MaterialIcons name={spec.material} size={size} color={color} />;
  }

  const Fallback =
    (LucideIcons as Record<string, unknown>)[spec.fallback ?? 'Circle'];

  if (typeof Fallback === 'function') {
    const Icon = Fallback as (props: {
      size?: number;
      color?: string;
      strokeWidth?: number;
    }) => ReactElement;

    return <Icon size={size} color={color} strokeWidth={strokeWidth} />;
  }

  return (
    <MaterialIcons
      name="radio-button-unchecked"
      size={size}
      color={color}
    />
  );
}
