import type { ReactNode } from 'react';
import { WebModuleLayoutWrapper } from '@/components/WebModuleLayoutWrapper';

const navLinks = [
  { href: '/voice', label: 'Dashboard' },
  { href: '/voice/recordings', label: 'Recordings' },
  { href: '/voice/search', label: 'Search' },
  { href: '/voice/commands', label: 'Commands' },
  { href: '/voice/speakers', label: 'Speakers' },
  { href: '/voice/languages', label: 'Languages' },
  { href: '/voice/export', label: 'Export' },
  { href: '/voice/settings', label: 'Settings' },
];

export default function VoiceLayout({ children }: { children: ReactNode }) {
  return (
    <WebModuleLayoutWrapper moduleId="voice" navLinks={navLinks}>
      {children}
    </WebModuleLayoutWrapper>
  );
}
