import type { ReactNode } from 'react';
import { WebModuleLayoutWrapper } from '@/components/WebModuleLayoutWrapper';

export default function FastLayout({ children }: { children: ReactNode }) {
  return (
    <WebModuleLayoutWrapper moduleId="fast">
      {children}
    </WebModuleLayoutWrapper>
  );
}
