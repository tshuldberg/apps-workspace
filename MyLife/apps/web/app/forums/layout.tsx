import type { ReactNode } from 'react';
import { WebModuleLayoutWrapper } from '@/components/WebModuleLayoutWrapper';

const navLinks = [
  { href: '/forums', label: 'Threads' },
  { href: '/forums/communities', label: 'Categories' },
  { href: '/forums/saved', label: 'Bookmarks' },
  { href: '/forums/messages', label: 'Messages' },
  { href: '/forums/activity', label: 'Activity' },
  { href: '/forums/create-thread', label: 'New Post' },
  { href: '/forums/profile', label: 'Profile' },
];

export default function ForumsLayout({ children }: { children: ReactNode }) {
  return (
    <WebModuleLayoutWrapper moduleId="forums" navLinks={navLinks}>
      {children}
    </WebModuleLayoutWrapper>
  );
}
