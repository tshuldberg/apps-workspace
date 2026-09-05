import type { ReactNode } from 'react';
import { WebModuleLayoutWrapper } from '@/components/WebModuleLayoutWrapper';
import { ModuleLockGate } from '@/components/ModuleLockGate';

const navLinks = [
  { href: '/classes', label: 'Schedule' },
  { href: '/classes/assignments', label: 'Assignments' },
  { href: '/classes/grades', label: 'Grades' },
  { href: '/classes/study', label: 'Study' },
  { href: '/classes/degree', label: 'Degree' },
  { href: '/classes/lifelong', label: 'Lifelong' },
  { href: '/classes/applications', label: 'Applications' },
  { href: '/classes/tests', label: 'Tests' },
  { href: '/classes/settings', label: 'Settings' },
];

export default function ClassesLayout({ children }: { children: ReactNode }) {
  return (
    <WebModuleLayoutWrapper moduleId="classes" navLinks={navLinks}>
      <ModuleLockGate
        moduleId="classes"
        moduleName="MyClasses"
        moduleIcon={'\uD83C\uDF93'}
        accentColor="#3B82F6"
      >
        {children}
      </ModuleLockGate>
    </WebModuleLayoutWrapper>
  );
}
