import type { ReactNode } from 'react';
import { WebModuleLayoutWrapper } from '@/components/WebModuleLayoutWrapper';

export default function RecipesLayout({ children }: { children: ReactNode }) {
  return (
    <WebModuleLayoutWrapper moduleId="recipes">
      {children}
    </WebModuleLayoutWrapper>
  );
}
