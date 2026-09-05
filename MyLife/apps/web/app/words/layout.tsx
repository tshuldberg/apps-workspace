import type { ReactNode } from 'react';
import { WebModuleLayoutWrapper } from '@/components/WebModuleLayoutWrapper';

const navLinks = [
  { href: '/words', label: 'Lookup' },
  { href: '/words/saved', label: 'Saved' },
  { href: '/words/lists', label: 'Lists' },
  { href: '/words/helper', label: 'Helper' },
  { href: '/words/languages', label: 'Languages' },
];

export default function WordsLayout({ children }: { children: ReactNode }) {
  return (
    <WebModuleLayoutWrapper moduleId="words" navLinks={navLinks}>
      {children}
    </WebModuleLayoutWrapper>
  );
}
