import type { ReactNode } from 'react';
import { ensureModuleMigrations } from '@/lib/db';
import { WebModuleLayoutWrapper } from '@/components/WebModuleLayoutWrapper';

const navLinks = [
  { href: '/flash', label: 'Study' },
  { href: '/flash/decks', label: 'Decks' },
  { href: '/flash/browser', label: 'Browse' },
  { href: '/flash/stats', label: 'Stats' },
  { href: '/flash/import', label: 'Import' },
  { href: '/flash/settings', label: 'Settings' },
];

export default function FlashLayout({ children }: { children: ReactNode }) {
  // Ensure flash tables exist before any child page queries: pages under
  // this layout crashed on fresh databases and broke hermetic prod builds.
  ensureModuleMigrations('flash');

  return (
    <WebModuleLayoutWrapper moduleId="flash" navLinks={navLinks}>
      {children}
    </WebModuleLayoutWrapper>
  );
}
