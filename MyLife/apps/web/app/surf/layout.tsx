import type { ReactNode } from 'react';
import { WebModuleLayoutWrapper } from '@/components/WebModuleLayoutWrapper';

const navLinks = [
  { href: '/surf', label: 'Spots' },
  { href: '/surf/forecast', label: 'Forecast' },
  { href: '/surf/swell', label: 'Swell' },
  { href: '/surf/tides', label: 'Tides' },
  { href: '/surf/alerts', label: 'Alerts' },
  { href: '/surf/sessions', label: 'Sessions' },
  { href: '/surf/crew', label: 'Crew' },
  { href: '/surf/ratings', label: 'Ratings' },
  { href: '/surf/account', label: 'Settings' },
];

export default function SurfLayout({ children }: { children: ReactNode }) {
  return (
    <WebModuleLayoutWrapper moduleId="surf" navLinks={navLinks}>
      {children}
    </WebModuleLayoutWrapper>
  );
}
