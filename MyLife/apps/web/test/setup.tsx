import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string | { pathname?: string };
    children: any;
  }) => {
    const resolvedHref =
      typeof href === 'string' ? href : (href?.pathname ?? '');
    return (
      <a href={resolvedHref} {...props}>
        {children}
      </a>
    );
  },
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
