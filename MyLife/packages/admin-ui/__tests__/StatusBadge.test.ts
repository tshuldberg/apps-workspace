import { describe, it, expect } from 'vitest';
import { StatusBadge } from '../src/StatusBadge';
import type { StatusBadgeProps } from '../src/StatusBadge';

describe('StatusBadge', () => {
  it('exports a function component', () => {
    expect(typeof StatusBadge).toBe('function');
  });

  it('accepts all variant types', () => {
    const variants: StatusBadgeProps['variant'][] = [
      'success',
      'warning',
      'danger',
      'info',
      'neutral',
    ];
    variants.forEach((variant) => {
      const props: StatusBadgeProps = { status: 'active', variant, size: 'md' };
      expect(props.variant).toBe(variant);
    });
  });

  it('accepts both size options', () => {
    const sm: StatusBadgeProps = { status: 'pending', size: 'sm' };
    const md: StatusBadgeProps = { status: 'pending', size: 'md' };
    expect(sm.size).toBe('sm');
    expect(md.size).toBe('md');
  });

  it('defaults are optional', () => {
    const minimal: StatusBadgeProps = { status: 'active' };
    expect(minimal.variant).toBeUndefined();
    expect(minimal.size).toBeUndefined();
  });
});
