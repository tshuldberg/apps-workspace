import type { ReactNode } from 'react';
import { WebModuleLayoutWrapper } from '@/components/WebModuleLayoutWrapper';

const navLinks = [
  { href: '/books', label: 'Library' },
  { href: '/books/search', label: 'Search' },
  { href: '/books/import', label: 'Import' },
  { href: '/books/stats', label: 'Stats' },
  { href: '/books/reader', label: 'Reader' },
];

export default function BooksLayout({ children }: { children: ReactNode }) {
  return (
    <WebModuleLayoutWrapper moduleId="books" navLinks={navLinks}>
      {children}
    </WebModuleLayoutWrapper>
  );
}
