'use client';

import type { ReactNode } from 'react';
import { WebModuleLayoutWrapper } from '@/components/WebModuleLayoutWrapper';
import { ModuleLockGate } from '@/components/ModuleLockGate';

const navLinks = [
  { href: '/mood', label: 'Dashboard' },
  { href: '/mood/log', label: 'Log Mood' },
  { href: '/mood/history', label: 'History' },
  { href: '/mood/insights', label: 'Insights' },
  { href: '/mood/breathe', label: 'Breathing' },
  { href: '/mood/meditate', label: 'Meditation' },
  { href: '/mood/focus', label: 'Focus Sounds' },
  { href: '/mood/experiments', label: 'Experiments' },
  { href: '/mood/pet', label: 'Virtual Pet' },
  { href: '/mood/sos', label: 'SOS' },
  { href: '/mood/year', label: 'Year in Pixels' },
  { href: '/mood/settings', label: 'Settings' },
];

export default function MoodLayout({ children }: { children: ReactNode }) {
  return (
    <WebModuleLayoutWrapper moduleId="mood" navLinks={navLinks}>
      <ModuleLockGate moduleId="mood" moduleName="MyMood" moduleIcon={'\uD83C\uDFAD'} accentColor="#FB923C">
        {children}
      </ModuleLockGate>
    </WebModuleLayoutWrapper>
  );
}
