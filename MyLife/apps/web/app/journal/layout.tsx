'use client';

import type { ReactNode } from 'react';
import { WebModuleLayoutWrapper } from '@/components/WebModuleLayoutWrapper';
import { ModuleLockGate } from '@/components/ModuleLockGate';

export default function JournalLayout({ children }: { children: ReactNode }) {
  return (
    <WebModuleLayoutWrapper moduleId="journal">
      <ModuleLockGate moduleId="journal" moduleName="MyJournal" moduleIcon={'📓'} accentColor="#A78BFA">
        {children}
      </ModuleLockGate>
    </WebModuleLayoutWrapper>
  );
}
