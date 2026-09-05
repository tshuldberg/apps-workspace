import type { ReactNode } from 'react';
import { WebModuleLayoutWrapper } from '@/components/WebModuleLayoutWrapper';

const navLinks = [
  { href: '/friends', label: 'People' },
  { href: '/friends/hangouts', label: 'Hangouts' },
  { href: '/friends/birthdays', label: 'Birthdays' },
  { href: '/friends/memories', label: 'Memories' },
  { href: '/friends/circles', label: 'Circles' },
  { href: '/friends/health', label: 'Health' },
  { href: '/friends/insights', label: 'Insights' },
  { href: '/friends/settings', label: 'Settings' },
];

export default function FriendsLayout({ children }: { children: ReactNode }) {
  return (
    <WebModuleLayoutWrapper moduleId="friends" navLinks={navLinks}>
      {children}
    </WebModuleLayoutWrapper>
  );
}
