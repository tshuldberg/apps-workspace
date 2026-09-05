import type { ReactNode } from 'react';
import { WebModuleLayoutWrapper } from '@/components/WebModuleLayoutWrapper';
import { ModuleLockGate } from '@/components/ModuleLockGate';

const navLinks = [
  { href: '/notes', label: 'Notes' },
  { href: '/notes/search', label: 'Search' },
  { href: '/notes/folders', label: 'Folders' },
  { href: '/notes/daily', label: 'Daily' },
  { href: '/notes/graph', label: 'Graph' },
  { href: '/notes/databases', label: 'Databases' },
  { href: '/notes/canvas', label: 'Canvas' },
  { href: '/notes/templates', label: 'Templates' },
  { href: '/notes/clipper', label: 'Clipper' },
  { href: '/notes/plugins', label: 'Plugins' },
  { href: '/notes/settings', label: 'Settings' },
];

export default function NotesLayout({ children }: { children: ReactNode }) {
  return (
    <WebModuleLayoutWrapper moduleId="notes" navLinks={navLinks}>
      <ModuleLockGate moduleId="notes" moduleName="MyNotes" moduleIcon={'\uD83D\uDCDD'} accentColor="#64748B">
        {children}
      </ModuleLockGate>
    </WebModuleLayoutWrapper>
  );
}
