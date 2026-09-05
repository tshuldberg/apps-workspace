import type { ReactNode } from 'react';
import { ensureModuleMigrations } from '@/lib/db';
import { WebModuleLayoutWrapper } from '@/components/WebModuleLayoutWrapper';

export default function CarLayout({ children }: { children: ReactNode }) {
  // Ensure car tables exist before any child page queries: pages under
  // this layout crashed on fresh databases and broke hermetic prod builds.
  ensureModuleMigrations('car');

  return (
    <WebModuleLayoutWrapper moduleId="car">
      {children}
    </WebModuleLayoutWrapper>
  );
}
