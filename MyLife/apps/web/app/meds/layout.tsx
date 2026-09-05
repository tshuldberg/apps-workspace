'use client';

import type { ReactNode } from 'react';
import { WebModuleLayoutWrapper } from '@/components/WebModuleLayoutWrapper';
import { ModuleLockGate } from '@/components/ModuleLockGate';

const navLinks = [
  { href: '/meds', label: 'Timeline' },
  { href: '/meds/medications', label: 'Prescriptions' },
  { href: '/meds/measurements', label: 'Vitals' },
  { href: '/meds/glucose', label: 'Glucose' },
  { href: '/meds/insulin', label: 'Insulin' },
  { href: '/meds/history', label: 'History' },
  { href: '/meds/export', label: 'Reports' },
  { href: '/meds/settings', label: 'Settings' },
];

export default function MedsLayout({ children }: { children: ReactNode }) {
  return (
    <WebModuleLayoutWrapper moduleId="meds" navLinks={navLinks}>
      <ModuleLockGate moduleId="meds" moduleName="MyMeds" moduleIcon={'💊'} accentColor="#06B6D4">
        {children}
      </ModuleLockGate>
    </WebModuleLayoutWrapper>
  );
}
