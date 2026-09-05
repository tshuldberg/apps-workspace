import type { ReactNode } from 'react';
import { WebModuleLayoutWrapper } from '@/components/WebModuleLayoutWrapper';

const navLinks = [
  { href: '/workouts', label: 'Dashboard' },
  { href: '/workouts/exercises', label: 'Exercises' },
  { href: '/workouts/workouts', label: 'Library' },
  { href: '/workouts/programs', label: 'Programs' },
  { href: '/workouts/progress', label: 'Analytics' },
  { href: '/workouts/social', label: 'Social' },
  { href: '/workouts/settings', label: 'Settings' },
];

export default function WorkoutsLayout({ children }: { children: ReactNode }) {
  return (
    <WebModuleLayoutWrapper moduleId="workouts" navLinks={navLinks}>
      {children}
    </WebModuleLayoutWrapper>
  );
}
