import type { ReactNode } from 'react';
import { WebModuleLayoutWrapper } from '@/components/WebModuleLayoutWrapper';

export default function RsvpLayout({ children }: { children: ReactNode }) {
  return (
    <WebModuleLayoutWrapper moduleId="rsvp">
      {children}
    </WebModuleLayoutWrapper>
  );
}
