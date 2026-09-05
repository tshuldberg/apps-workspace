'use client';

import type { ReactNode } from 'react';
import { WebModuleLayoutWrapper } from '@/components/WebModuleLayoutWrapper';
import { ModuleLockGate } from '@/components/ModuleLockGate';

const navLinks = [
  { href: '/mail', label: 'Inbox' },
  { href: '/mail/compose', label: 'Compose' },
  { href: '/mail/contacts', label: 'Contacts' },
  { href: '/mail/filters', label: 'Filters' },
  { href: '/mail/accounts', label: 'Accounts' },
  { href: '/mail/settings', label: 'Settings' },
];

export default function MailLayout({ children }: { children: ReactNode }) {
  return (
    <WebModuleLayoutWrapper moduleId="mail" navLinks={navLinks}>
      <ModuleLockGate moduleId="mail" moduleName="MyMail" moduleIcon={'\uD83D\uDCEC'} accentColor="#3B82F6">
        {children}
      </ModuleLockGate>
    </WebModuleLayoutWrapper>
  );
}
