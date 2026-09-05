import type { ReactNode } from 'react';
import { WebModuleLayoutWrapper } from '@/components/WebModuleLayoutWrapper';

const navLinks = [
  { href: '/stars', label: 'Today' },
  { href: '/stars/moon', label: 'Sky' },
  { href: '/stars/journal', label: 'Journal' },
  { href: '/stars/chart', label: 'Charts' },
  { href: '/stars/compatibility', label: 'Compatibility' },
  { href: '/stars/moon-calendar', label: 'Moon' },
  { href: '/stars/tarot', label: 'Tarot' },
  { href: '/stars/zodiac-events', label: 'Events' },
  { href: '/stars/retrograde', label: 'Retrogrades' },
  { href: '/stars/readings', label: 'History' },
  { href: '/stars/settings', label: 'Settings' },
];

export default function StarsLayout({ children }: { children: ReactNode }) {
  return (
    <WebModuleLayoutWrapper moduleId="stars" navLinks={navLinks}>
      {children}
    </WebModuleLayoutWrapper>
  );
}
