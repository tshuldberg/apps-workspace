import type { ReactNode } from 'react';
import { ensureModuleMigrations } from '@/lib/db';
import { WebModuleLayoutWrapper } from '@/components/WebModuleLayoutWrapper';

export default function PetsLayout({ children }: { children: ReactNode }) {
  // Ensure pets tables exist before any child page queries: pages under
  // this layout crashed on fresh databases and broke hermetic prod builds.
  ensureModuleMigrations('pets');

  return (
    <WebModuleLayoutWrapper moduleId="pets">
      {children}
    </WebModuleLayoutWrapper>
  );
}
