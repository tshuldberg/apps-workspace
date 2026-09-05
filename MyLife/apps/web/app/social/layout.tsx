import type { ReactNode } from 'react';
import { WebModuleLayoutWrapper } from '@/components/WebModuleLayoutWrapper';

const navLinks = [
  { href: '/social', label: 'Feed' },
  { href: '/social/friends', label: 'Friends' },
  { href: '/social/challenges', label: 'Challenges' },
  { href: '/social/groups', label: 'Groups' },
  { href: '/social/leaderboard', label: 'Leaderboard' },
  { href: '/social/profile', label: 'Profile' },
];

export default function SocialLayout({ children }: { children: ReactNode }) {
  return (
    <WebModuleLayoutWrapper moduleId="social" navLinks={navLinks}>
      {children}
    </WebModuleLayoutWrapper>
  );
}
