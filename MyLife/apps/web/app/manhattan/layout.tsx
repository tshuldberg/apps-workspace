import type { ReactNode } from 'react';
import { WebModuleLayoutWrapper } from '@/components/WebModuleLayoutWrapper';

export default function ManhattanLayout({ children }: { children: ReactNode }) {
  return (
    <WebModuleLayoutWrapper moduleId="manhattan">
      {children}
    </WebModuleLayoutWrapper>
  );
}
