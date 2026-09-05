import type { ReactNode } from 'react';
import { ensureModuleMigrations } from '@/lib/db';
import { WebModuleLayoutWrapper } from '@/components/WebModuleLayoutWrapper';

export default function ClosetLayout({ children }: { children: ReactNode }) {
  // Ensure closet tables exist before any child page queries: pages under
  // this layout crashed on fresh databases and broke hermetic prod builds.
  ensureModuleMigrations('closet');

  return (
    <WebModuleLayoutWrapper moduleId="closet">
      {children}
    </WebModuleLayoutWrapper>
  );
}
