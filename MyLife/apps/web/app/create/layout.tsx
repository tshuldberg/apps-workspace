import type { ReactNode } from 'react';
import { WebModuleLayoutWrapper } from '@/components/WebModuleLayoutWrapper';
import { ModuleLockGate } from '@/components/ModuleLockGate';

const navLinks = [
  { href: '/create', label: 'Projects' },
  { href: '/create/practice', label: 'Practice' },
  { href: '/create/skills', label: 'Skills' },
  { href: '/create/portfolio', label: 'Portfolio' },
  { href: '/create/settings', label: 'Settings' },
];

export default function CreateLayout({ children }: { children: ReactNode }) {
  return (
    <WebModuleLayoutWrapper moduleId="create" navLinks={navLinks}>
      <ModuleLockGate
        moduleId="create"
        moduleName="MyCreate"
        moduleIcon={'\uD83C\uDFA8'}
        accentColor="#D946EF"
      >
        {children}
      </ModuleLockGate>
    </WebModuleLayoutWrapper>
  );
}
