import type { ReactNode } from 'react';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { WebModuleLayoutWrapper } from '@/components/WebModuleLayoutWrapper';
import { MarketShellClient } from './MarketShellClient';

const marketFont = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-market',
});

export default function MarketLayout({ children }: { children: ReactNode }) {
  return (
    <WebModuleLayoutWrapper moduleId="market">
      <div className={marketFont.variable}>
        <MarketShellClient>{children}</MarketShellClient>
      </div>
    </WebModuleLayoutWrapper>
  );
}
