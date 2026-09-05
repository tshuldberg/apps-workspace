import type { ReactNode } from 'react';
import { WebModuleLayoutWrapper } from '@/components/WebModuleLayoutWrapper';

const navLinks = [
  { href: '/presence', label: 'Home' },
  { href: '/presence/hub', label: 'Hub' },
  { href: '/presence/stats', label: 'Stats' },
  { href: '/presence/sessions', label: 'Sessions' },
  { href: '/presence/intentions', label: 'Intentions' },
  { href: '/presence/insights', label: 'Insights' },
  { href: '/presence/report', label: 'Report' },
  { href: '/presence/settings', label: 'Settings' },
];

export default function PresenceLayout({ children }: { children: ReactNode }) {
  return (
    <WebModuleLayoutWrapper moduleId="presence" navLinks={navLinks}>
      {children}
    </WebModuleLayoutWrapper>
  );
}
