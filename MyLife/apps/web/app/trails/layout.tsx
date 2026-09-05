import type { ReactNode } from 'react';
import { WebModuleLayoutWrapper } from '@/components/WebModuleLayoutWrapper';

const navLinks = [
  { href: '/trails', label: 'Home' },
  { href: '/trails/list', label: 'Trails' },
  { href: '/trails/recordings', label: 'Recordings' },
  { href: '/trails/discover', label: 'Discover' },
  { href: '/trails/trips', label: 'Trips' },
  { href: '/trails/segments', label: 'Segments' },
  { href: '/trails/gear', label: 'Gear' },
  { href: '/trails/photos', label: 'Photos' },
  { href: '/trails/settings', label: 'Settings' },
];

export default function TrailsLayout({ children }: { children: ReactNode }) {
  return (
    <WebModuleLayoutWrapper moduleId="trails" navLinks={navLinks}>
      {children}
    </WebModuleLayoutWrapper>
  );
}
