'use client';

import type { ReactNode } from 'react';
import { WebModuleLayoutWrapper } from '@/components/WebModuleLayoutWrapper';
import { ModuleLockGate } from '@/components/ModuleLockGate';

const navLinks = [
  { href: '/cycle', label: 'Today' },
  { href: '/cycle/calendar', label: 'Calendar' },
  { href: '/cycle/history', label: 'History' },
  { href: '/cycle/insights', label: 'Insights' },
  { href: '/cycle/analytics', label: 'Analytics' },
  { href: '/cycle/predictions', label: 'Predictions' },
  { href: '/cycle/symptoms', label: 'Symptoms' },
  { href: '/cycle/log', label: 'Log' },
  { href: '/cycle/bbt', label: 'BBT' },
  { href: '/cycle/pregnancy', label: 'Pregnancy' },
  { href: '/cycle/sharing', label: 'Sharing' },
  { href: '/cycle/community', label: 'Community' },
  { href: '/cycle/settings', label: 'Settings' },
];

export default function CycleLayout({ children }: { children: ReactNode }) {
  return (
    <WebModuleLayoutWrapper moduleId="cycle" navLinks={navLinks}>
      <ModuleLockGate moduleId="cycle" moduleName="MyCycle" moduleIcon={'\uD83C\uDF19'} accentColor="#F472B6">
        {children}
      </ModuleLockGate>
    </WebModuleLayoutWrapper>
  );
}
