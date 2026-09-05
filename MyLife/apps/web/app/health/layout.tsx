'use client';

import type { ReactNode } from 'react';
import { WebModuleLayoutWrapper } from '@/components/WebModuleLayoutWrapper';
import { ModuleLockGate } from '@/components/ModuleLockGate';

export default function HealthLayout({ children }: { children: ReactNode }) {
  return (
    <WebModuleLayoutWrapper moduleId="health">
      <ModuleLockGate moduleId="health" moduleName="MyHealth" moduleIcon={'\u{1FA7A}'} accentColor="#EF4444">
        {children}
      </ModuleLockGate>
    </WebModuleLayoutWrapper>
  );
}
