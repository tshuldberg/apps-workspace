import type { ReactNode } from 'react';
import { WebModuleLayoutWrapper } from '@/components/WebModuleLayoutWrapper';

const navLinks = [
  { href: '/dining', label: 'Restaurants' },
  { href: '/dining/map', label: 'Map' },
  { href: '/dining/visits', label: 'Visits' },
  { href: '/dining/reservations', label: 'Reservations' },
  { href: '/dining/wishlist', label: 'Wishlist' },
  { href: '/dining/year-review', label: 'Year in Review' },
  { href: '/dining/settings', label: 'Settings' },
];

export default function DiningLayout({ children }: { children: ReactNode }) {
  return (
    <WebModuleLayoutWrapper moduleId="dining" navLinks={navLinks}>
      {children}
    </WebModuleLayoutWrapper>
  );
}
