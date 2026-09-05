import type { ReactNode } from 'react';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { WebModuleLayoutWrapper } from '@/components/WebModuleLayoutWrapper';
import { NutritionShell } from './_components/NutritionShell';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
});

export default function NutritionLayout({ children }: { children: ReactNode }) {
  return (
    <WebModuleLayoutWrapper moduleId="nutrition">
      <div className={plusJakarta.className}>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,400..700,0..1,0"
        />
        <style>
          {`
            .material-symbols-outlined {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              font-style: normal;
              font-weight: normal;
              letter-spacing: normal;
              text-transform: none;
              white-space: nowrap;
              word-wrap: normal;
              direction: ltr;
            }
          `}
        </style>
        <NutritionShell>{children}</NutritionShell>
      </div>
    </WebModuleLayoutWrapper>
  );
}
