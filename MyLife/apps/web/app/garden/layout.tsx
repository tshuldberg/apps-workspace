import type { ReactNode } from 'react';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { WebModuleLayoutWrapper } from '@/components/WebModuleLayoutWrapper';
import { GardenShell } from './_components/GardenShell';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
});

export default function GardenLayout({ children }: { children: ReactNode }) {
  return (
    <WebModuleLayoutWrapper moduleId="garden">
      <div className={plusJakarta.className}>
        <GardenShell>{children}</GardenShell>
      </div>
    </WebModuleLayoutWrapper>
  );
}
