import type { ReactNode } from 'react';
import { WebModuleLayoutWrapper } from '@/components/WebModuleLayoutWrapper';

const navLinks = [
  { href: '/subs', label: 'Dashboard' },
  { href: '/subs/calendar', label: 'Calendar' },
  { href: '/subs/insights', label: 'Insights' },
  { href: '/subs/catalog', label: 'Catalog' },
  { href: '/subs/compare', label: 'Compare' },
];

export default function SubsLayout({ children }: { children: ReactNode }) {
  return (
    <WebModuleLayoutWrapper moduleId="subs" navLinks={navLinks}>
      {children}
    </WebModuleLayoutWrapper>
  );
}
