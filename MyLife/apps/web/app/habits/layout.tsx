import type { ReactNode } from 'react';
import { WebModuleLayoutWrapper } from '@/components/WebModuleLayoutWrapper';

const navLinks = [
  { href: '/habits', label: 'Today' },
  { href: '/habits/habits', label: 'Habits' },
  { href: '/habits/stats', label: 'Stats' },
  { href: '/habits/badges', label: 'Badges' },
  { href: '/habits/rpg', label: 'RPG' },
  { href: '/habits/pet', label: 'Pet' },
  { href: '/habits/sobriety', label: 'Sobriety' },
  { href: '/habits/focus', label: 'Focus' },
  { href: '/habits/time-reports', label: 'Time' },
  { href: '/habits/programs', label: 'Programs' },
  { href: '/habits/stacking', label: 'Stacking' },
  { href: '/habits/settings', label: 'Settings' },
];

export default function HabitsLayout({ children }: { children: ReactNode }) {
  return (
    <WebModuleLayoutWrapper moduleId="habits" navLinks={navLinks}>
      {children}
    </WebModuleLayoutWrapper>
  );
}
