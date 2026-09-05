import type { ReactNode } from 'react';
import { WebModuleLayoutWrapper } from '@/components/WebModuleLayoutWrapper';

const navLinks = [
  { href: '/homes', label: 'Dashboard' },
  { href: '/homes/properties', label: 'Properties' },
  { href: '/homes/maintenance', label: 'Maintenance' },
  { href: '/homes/costs', label: 'Costs' },
  { href: '/homes/contractors', label: 'Contractors' },
  { href: '/homes/projects', label: 'Projects' },
];

export default function HomesLayout({ children }: { children: ReactNode }) {
  return (
    <WebModuleLayoutWrapper moduleId="homes" navLinks={navLinks}>
      {children}
    </WebModuleLayoutWrapper>
  );
}
